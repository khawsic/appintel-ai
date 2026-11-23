import { Type } from "@google/genai";
import { getGeminiClient, GEMINI_MODEL, withRetry } from "../geminiClient.ts";
import { SourceDiscoveryResult } from "./sourceDiscovery.ts";
import { RetrievedDoc } from "./docRetrieval.ts";
import { ExtractedAppPayload, validateAndSanitizeExtraction } from "./validator.ts";

export async function extractAppIntelligence(
  appName: string,
  category: string,
  discovery: SourceDiscoveryResult,
  retrievedDocs: RetrievedDoc[]
): Promise<ExtractedAppPayload> {
  const ai = getGeminiClient();

  const docsBlock = retrievedDocs
    .map(
      (d, idx) =>
        `[Source ${idx + 1}] Title: ${d.title}\nURL: ${d.url}\nFetch Status: ${d.status}\nExcerpt: ${d.excerpt}`
    )
    .join("\n\n---\n\n");

  const groundingList = discovery.groundingUrls
    .map((g, i) => `${i + 1}. ${g.title} — ${g.url}`)
    .join("\n");

  const prompt = `You are a senior integration product ops researcher evaluating "${appName}" (category: ${category}) for Composio.

Strict accuracy rules:
1. Base claims strictly on the search summary, grounding URLs, and retrieved documentation excerpts below.
2. NEVER invent URLs. Only cite URLs that appear in the Grounding URLs or Retrieved Sources below, or leave URLs null/omit unverified claims.
3. NEVER assume an auth method or public API exists merely because similar apps have it.
4. Distinguish clearly:
   - api_available: true (public developer API confirmed), false (confirmed no public API), null (insufficient evidence).
   - mcp_status: "official" ONLY if vendor-maintained/official announcement or official org repo exists; "third_party" if community repo exists; "unavailable" if searched and none found; "unknown" if unclear.
   - blockers: tag each item as "documented" (explicitly verified in docs/pricing/terms) vs "engineering_concern" (analytical engineering hypothesis).
5. Score each of the 8 buildability dimensions from 1 (hardest/most restricted) to 5 (easiest/most open).

=== SEARCH SUMMARY ===
${discovery.searchSummary}

=== GROUNDING URLS ===
${groundingList || "None returned"}

=== RETRIEVED DOCUMENTATION EXCERPTS ===
${docsBlock || "No pages could be directly fetched"}`;

  const response = await withRetry(
    () =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction:
            "Return only valid JSON matching the exact schema. Be conservative: mark uncertain fields as 'unknown' or null rather than guessing.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              official_website: { type: Type.STRING, nullable: true },
              description: { type: Type.STRING },
              primary_purpose: { type: Type.STRING },
              use_cases: { type: Type.ARRAY, items: { type: Type.STRING } },
              authentication_methods: { type: Type.ARRAY, items: { type: Type.STRING } },
              authentication_evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
              api_available: { type: Type.BOOLEAN, nullable: true },
              api_types: { type: Type.ARRAY, items: { type: Type.STRING } },
              api_surface: { type: Type.ARRAY, items: { type: Type.STRING } },
              api_access_model: {
                type: Type.STRING,
                enum: ["self_serve", "gated", "mixed", "unknown"],
              },
              access_model_reasoning: { type: Type.STRING },
              access_restrictions: { type: Type.ARRAY, items: { type: Type.STRING } },
              api_rate_limits: { type: Type.STRING, nullable: true },
              api_doc_quality: {
                type: Type.STRING,
                enum: ["high", "moderate", "limited", "unavailable", "unknown"],
              },
              mcp_status: {
                type: Type.STRING,
                enum: ["official", "third_party", "unavailable", "unknown"],
              },
              mcp_server_name: { type: Type.STRING, nullable: true },
              mcp_repository_url: { type: Type.STRING, nullable: true },
              mcp_ownership: {
                type: Type.STRING,
                enum: ["official", "third_party", "none", "unknown"],
              },
              mcp_capabilities: { type: Type.ARRAY, items: { type: Type.STRING } },
              mcp_maintained: { type: Type.BOOLEAN, nullable: true },
              mcp_limitations: { type: Type.STRING, nullable: true },
              buildability: {
                type: Type.STRING,
                enum: ["easy", "moderate", "difficult", "unknown"],
              },
              buildability_reasoning: { type: Type.STRING },
              dimensions: {
                type: Type.OBJECT,
                properties: {
                  authentication_complexity: { type: Type.INTEGER },
                  api_accessibility: { type: Type.INTEGER },
                  documentation_quality: { type: Type.INTEGER },
                  api_completeness: { type: Type.INTEGER },
                  access_restrictions: { type: Type.INTEGER },
                  developer_ecosystem: { type: Type.INTEGER },
                  mcp_availability: { type: Type.INTEGER },
                  operational_constraints: { type: Type.INTEGER },
                },
                required: [
                  "authentication_complexity",
                  "api_accessibility",
                  "documentation_quality",
                  "api_completeness",
                  "access_restrictions",
                  "developer_ecosystem",
                  "mcp_availability",
                  "operational_constraints",
                ],
              },
              blockers: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    description: { type: Type.STRING },
                    kind: { type: Type.STRING, enum: ["documented", "engineering_concern"] },
                    evidence_url: { type: Type.STRING, nullable: true },
                  },
                  required: ["description", "kind"],
                },
              },
              commercial_restrictions: { type: Type.ARRAY, items: { type: Type.STRING } },
              evidence: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    source_title: { type: Type.STRING },
                    url: { type: Type.STRING },
                    source_type: {
                      type: Type.STRING,
                      enum: [
                        "official_docs",
                        "api_reference",
                        "auth_docs",
                        "pricing_access",
                        "official_mcp",
                        "github_repo",
                        "technical_source",
                      ],
                    },
                    claim_supported: { type: Type.STRING },
                  },
                  required: ["source_title", "url", "source_type", "claim_supported"],
                },
              },
              confidence: { type: Type.INTEGER },
              notes: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: [
              "official_website",
              "description",
              "primary_purpose",
              "use_cases",
              "authentication_methods",
              "authentication_evidence",
              "api_available",
              "api_types",
              "api_surface",
              "api_access_model",
              "access_model_reasoning",
              "access_restrictions",
              "api_rate_limits",
              "api_doc_quality",
              "mcp_status",
              "mcp_server_name",
              "mcp_repository_url",
              "mcp_ownership",
              "mcp_capabilities",
              "mcp_maintained",
              "mcp_limitations",
              "buildability",
              "buildability_reasoning",
              "dimensions",
              "blockers",
              "commercial_restrictions",
              "evidence",
              "confidence",
              "notes",
            ],
          },
        },
      }),
    { label: `extract:${appName}`, retries: 2 }
  );

  const rawJson = (response.text ?? "{}").trim();
  const allowedUrls = [
    ...discovery.groundingUrls.map((g) => g.url),
    ...retrievedDocs.map((d) => d.url),
  ];

  return validateAndSanitizeExtraction(rawJson, allowedUrls);
}
