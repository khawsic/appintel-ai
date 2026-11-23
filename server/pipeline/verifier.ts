import { Type } from "@google/genai";
import {
  ApiAccessModel,
  BuildabilityVerdict,
  ClaimVerificationItem,
  ClaimVerificationResult,
  EvidenceRecord,
  FirstPassSnapshot,
  McpStatus,
  VerificationStatus,
} from "../../shared/types.ts";
import { getGeminiClient, GEMINI_MODEL, withRetry } from "../geminiClient.ts";
import { RetrievedDoc, retrieveDocumentation } from "./docRetrieval.ts";
import { ExtractedAppPayload, isValidHttpUrl } from "./validator.ts";

export interface VerificationOutput {
  firstPassSnapshot: FirstPassSnapshot;
  verificationItems: ClaimVerificationItem[];
  verificationStatus: VerificationStatus;
  updatedAuthMethods: string[];
  updatedApiAvailable: boolean | null;
  updatedApiTypes: string[];
  updatedAccessModel: ApiAccessModel;
  updatedMcpStatus: McpStatus;
  updatedBuildability: BuildabilityVerdict;
  updatedEvidence: EvidenceRecord[];
}

async function checkUrlReachability(urls: string[]): Promise<Map<string, { ok: boolean; status?: number }>> {
  const map = new Map<string, { ok: boolean; status?: number }>();
  const unique = Array.from(new Set(urls.filter((u) => isValidHttpUrl(u)))).slice(0, 8);

  await Promise.all(
    unique.map(async (url) => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          signal: controller.signal,
          headers: { "User-Agent": "AppIntelAI-Verifier/1.0" },
        });
        clearTimeout(t);
        // Some servers reject HEAD with 405/403 while GET works
        if (res.status === 405 || res.status === 403) {
          const c2 = new AbortController();
          const t2 = setTimeout(() => c2.abort(), 5000);
          const resGet = await fetch(url, {
            method: "GET",
            redirect: "follow",
            signal: c2.signal,
            headers: { "User-Agent": "AppIntelAI-Verifier/1.0" },
          });
          clearTimeout(t2);
          map.set(url, { ok: resGet.ok || resGet.status === 403, status: resGet.status });
        } else {
          map.set(url, { ok: res.ok, status: res.status });
        }
      } catch {
        clearTimeout(t);
        map.set(url, { ok: false });
      }
    })
  );

  return map;
}

export async function runVerificationLoop(
  appName: string,
  extracted: ExtractedAppPayload,
  priorRetrievedDocs: RetrievedDoc[]
): Promise<VerificationOutput> {
  const ai = getGeminiClient();
  const now = new Date().toISOString();

  const firstPassSnapshot: FirstPassSnapshot = {
    captured_at: now,
    authentication_methods: [...extracted.authentication_methods],
    api_available: extracted.api_available,
    api_types: [...extracted.api_types],
    api_access_model: extracted.api_access_model,
    mcp_status: extracted.mcp_status,
    buildability: extracted.buildability,
    buildability_reasoning: extracted.buildability_reasoning,
    blockers_summary: extracted.blockers.map((b) => `${b.kind}: ${b.description}`),
  };

  // Fetch any cited evidence URLs not already retrieved
  const alreadyFetched = new Set(priorRetrievedDocs.map((d) => d.url));
  const missingEvidenceUrls = extracted.evidence
    .filter((e) => !alreadyFetched.has(e.url))
    .map((e) => ({ url: e.url, title: e.source_title }));

  const extraDocs =
    missingEvidenceUrls.length > 0 ? await retrieveDocumentation(missingEvidenceUrls) : [];
  const allDocs = [...priorRetrievedDocs, ...extraDocs];

  const reachability = await checkUrlReachability(extracted.evidence.map((e) => e.url));

  const evidenceContext = allDocs
    .map(
      (d) =>
        `URL: ${d.url}\nStatus: ${d.status} (HTTP ${d.httpStatus ?? "n/a"})\nExcerpt: ${d.excerpt.slice(0, 1800)}`
    )
    .join("\n\n---\n\n");

  const reachabilitySummary = Array.from(reachability.entries())
    .map(([u, r]) => `${u} -> ${r.ok ? `OK (${r.status})` : `UNREACHABLE (${r.status ?? "timeout/err"})`}`)
    .join("\n");

  // Step 1: Independent verification search & source comparison (using Google Search)
  const verificationPrompt = `You are an adversarial technical auditor verifying first-pass AI research claims for "${appName}".
Compare EVERY first-pass claim below against actual official documentation using Google Search and the fetched excerpts below.

First-pass AI findings to audit:
1. authentication_methods: ${JSON.stringify(extracted.authentication_methods)}
2. api_available: ${JSON.stringify(extracted.api_available)}
3. api_types: ${JSON.stringify(extracted.api_types)}
4. api_access_model: ${extracted.api_access_model} (Reasoning: ${extracted.access_model_reasoning})
5. mcp_status: ${extracted.mcp_status} (Server: ${extracted.mcp_server_name ?? "none"}, URL: ${extracted.mcp_repository_url ?? "none"})
6. buildability: ${extracted.buildability}
7. technical_restrictions: ${JSON.stringify(extracted.blockers)}
8. evidence_urls: ${JSON.stringify(extracted.evidence.map((e) => e.url))}

URL Reachability Check:
${reachabilitySummary || "No URLs cited"}

Fetched Source Excerpts:
${evidenceContext || "None retrieved"}

Audit rules:
- NEVER mark a claim "verified" unless official documentation or live search results directly corroborate it.
- Watch closely for common AI hallucinations: assuming OAuth 2.0 exists when only API keys exist; confusing Zapier/UI integrations with a public API; calling a third-party GitHub MCP server "official"; marking gated/enterprise APIs as "self_serve".
- If a claim contradicts official evidence, mark it "corrected" and state the exact corrected value.
- If evidence is ambiguous or behind a login/paywall, mark it "needs_human_review".
- If no credible evidence supports the claim, mark it "unsupported" or "not_verifiable".`;

  const searchAuditResp = await withRetry(
    () =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: verificationPrompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      }),
    { label: `verifySearch:${appName}`, retries: 2 }
  );

  const auditText = searchAuditResp.text ?? "";
  const auditChunks = searchAuditResp.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const auditUrls = auditChunks
    .map((c) => c.web?.uri)
    .filter((u): u is string => Boolean(u && u.startsWith("http")));

  // Step 2: Structure the audit into formal per-claim verification records
  const structurePrompt = `Convert this verification audit for "${appName}" into structured per-claim verification records and corrected field values (if any corrections were identified).

Audit Findings:
${auditText}

Audit Grounding URLs:
${auditUrls.join("\n") || "None"}

Original First-Pass Values:
- authentication_methods: ${JSON.stringify(extracted.authentication_methods)}
- api_available: ${JSON.stringify(extracted.api_available)}
- api_types: ${JSON.stringify(extracted.api_types)}
- api_access_model: ${extracted.api_access_model}
- mcp_status: ${extracted.mcp_status}
- buildability: ${extracted.buildability}

Provide all 8 claim items:
- authentication_methods
- api_available
- api_types
- api_access_model
- mcp_status
- buildability
- technical_restrictions
- evidence_urls`;

  const structuredAuditResp = await withRetry(
    () =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: structurePrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    claim_key: {
                      type: Type.STRING,
                      enum: [
                        "authentication_methods",
                        "api_available",
                        "api_types",
                        "api_access_model",
                        "mcp_status",
                        "buildability",
                        "technical_restrictions",
                        "evidence_urls",
                      ],
                    },
                    claim_label: { type: Type.STRING },
                    original_ai_finding: { type: Type.STRING },
                    evidence_url: { type: Type.STRING, nullable: true },
                    evidence_excerpt: { type: Type.STRING, nullable: true },
                    verification_result: {
                      type: Type.STRING,
                      enum: [
                        "verified",
                        "corrected",
                        "needs_human_review",
                        "unsupported",
                        "not_verifiable",
                      ],
                    },
                    corrected_finding: { type: Type.STRING, nullable: true },
                    explanation: { type: Type.STRING },
                  },
                  required: [
                    "claim_key",
                    "claim_label",
                    "original_ai_finding",
                    "evidence_url",
                    "evidence_excerpt",
                    "verification_result",
                    "corrected_finding",
                    "explanation",
                  ],
                },
              },
              corrected_authentication_methods: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              corrected_api_available: { type: Type.BOOLEAN, nullable: true },
              corrected_api_types: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              corrected_api_access_model: {
                type: Type.STRING,
                enum: ["self_serve", "gated", "mixed", "unknown"],
              },
              corrected_mcp_status: {
                type: Type.STRING,
                enum: ["official", "third_party", "unavailable", "unknown"],
              },
              corrected_buildability: {
                type: Type.STRING,
                enum: ["easy", "moderate", "difficult", "unknown"],
              },
            },
            required: [
              "items",
              "corrected_authentication_methods",
              "corrected_api_available",
              "corrected_api_types",
              "corrected_api_access_model",
              "corrected_mcp_status",
              "corrected_buildability",
            ],
          },
        },
      }),
    { label: `verifyStruct:${appName}`, retries: 2 }
  );

  const parsedAudit = JSON.parse((structuredAuditResp.text ?? "{}").trim()) as {
    items: Array<{
      claim_key: ClaimVerificationItem["claim_key"];
      claim_label: string;
      original_ai_finding: string;
      evidence_url: string | null;
      evidence_excerpt: string | null;
      verification_result: ClaimVerificationResult;
      corrected_finding: string | null;
      explanation: string;
    }>;
    corrected_authentication_methods: string[];
    corrected_api_available: boolean | null;
    corrected_api_types: string[];
    corrected_api_access_model: ApiAccessModel;
    corrected_mcp_status: McpStatus;
    corrected_buildability: BuildabilityVerdict;
  };

  const verificationItems: ClaimVerificationItem[] = (parsedAudit.items ?? []).map((item, idx) => ({
    id: `v-${Date.now()}-${idx}`,
    claim_key: item.claim_key,
    claim_label: item.claim_label,
    original_ai_finding: item.original_ai_finding,
    evidence_url: isValidHttpUrl(item.evidence_url) ? item.evidence_url : null,
    evidence_excerpt: item.evidence_excerpt,
    verification_result: item.verification_result,
    corrected_finding: item.corrected_finding,
    explanation: item.explanation,
  }));

  const hasFlaggedItems = verificationItems.some(
    (v) =>
      v.verification_result === "needs_human_review" ||
      v.verification_result === "unsupported" ||
      v.verification_result === "not_verifiable"
  );

  const verificationStatus: VerificationStatus =
    verificationItems.length > 0 && !hasFlaggedItems ? "verified" : "needs_review";

  const updatedEvidence: EvidenceRecord[] = extracted.evidence.map((e, i) => {
    const reach = reachability.get(e.url);
    const matchingDoc = allDocs.find((d) => d.url === e.url);
    return {
      id: `ev-${Date.now()}-${i}`,
      source_title: e.source_title,
      url: e.url,
      source_type: e.source_type,
      claim_supported: e.claim_supported,
      excerpt: matchingDoc?.status === "fetched" ? matchingDoc.excerpt.slice(0, 420) : undefined,
      researched_at: now,
      verification_status:
        reach?.ok === true
          ? "verified"
          : reach?.ok === false
          ? "needs_review"
          : "needs_review",
    };
  });

  const byKey = new Map(verificationItems.map((v) => [v.claim_key, v]));

  const isCorrected = (key: ClaimVerificationItem["claim_key"]) =>
    byKey.get(key)?.verification_result === "corrected";

  return {
    firstPassSnapshot,
    verificationItems,
    verificationStatus,
    updatedAuthMethods:
      isCorrected("authentication_methods") &&
      Array.isArray(parsedAudit.corrected_authentication_methods) &&
      parsedAudit.corrected_authentication_methods.length > 0
        ? parsedAudit.corrected_authentication_methods
        : extracted.authentication_methods,
    updatedApiAvailable:
      isCorrected("api_available") &&
      parsedAudit.corrected_api_available !== undefined
        ? parsedAudit.corrected_api_available
        : extracted.api_available,
    updatedApiTypes:
      isCorrected("api_types") &&
      Array.isArray(parsedAudit.corrected_api_types) &&
      parsedAudit.corrected_api_types.length > 0
        ? parsedAudit.corrected_api_types
        : extracted.api_types,
    updatedAccessModel:
      isCorrected("api_access_model") && parsedAudit.corrected_api_access_model
        ? parsedAudit.corrected_api_access_model
        : extracted.api_access_model,
    updatedMcpStatus:
      isCorrected("mcp_status") && parsedAudit.corrected_mcp_status
        ? parsedAudit.corrected_mcp_status
        : extracted.mcp_status,
    updatedBuildability:
      isCorrected("buildability") && parsedAudit.corrected_buildability
        ? parsedAudit.corrected_buildability
        : extracted.buildability,
    updatedEvidence,
  };
}
