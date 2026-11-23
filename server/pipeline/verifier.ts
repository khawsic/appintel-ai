import {
  ApiAccessModel,
  AppRecord,
  BuildabilityVerdict,
  ClaimVerificationItem,
  ClaimVerificationResult,
  EvidenceRecord,
  FirstPassSnapshot,
  McpStatus,
  VerificationStatus,
} from "../../shared/types.ts";
import { computeBuildabilityScore } from "./buildabilityScorer.ts";
import { RetrievedDoc } from "./docRetrieval.ts";
import { extractSnippet } from "./extractor.ts";
import { CuratedAppSources } from "./sourceRegistry.ts";
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

const AUTH_VERIFY_REGEX: Record<string, RegExp> = {
  "OAuth 2.0": /\boauth\s*2(\.0)?\b|\boauth2\b|\bauthorization[_ ]code\b|\bclient[_ ]credentials\b|\brefresh[_ ]token\b/i,
  "OAuth 1.0a": /\boauth\s*1(\.0a?)?\b/i,
  "API Key": /\bapi[\s_-]?keys?\b|\bx-api-key\b|\bsecret[\s_-]?key\b|\bpublishable[\s_-]?key\b/i,
  "Bearer Token / PAT": /\bbearer\s+token\b|\bpersonal access token\b|\bprivate app token\b|\bauthorization:\s*bearer\b|\bbot token\b/i,
  JWT: /\bjson web token\b|\bjwt\b/i,
  "Basic Auth": /\bbasic auth(entication)?\b|\bhttp basic\b/i,
  "Webhook Signatures (HMAC)": /\bhmac\b|\bwebhook signature\b|\bsigning secret\b|\bx-hub-signature\b/i,
  "mTLS / Certificate": /\bmutual tls\b|\bmtls\b|\bclient certificate\b/i,
};

const API_TYPE_VERIFY_REGEX: Record<string, RegExp> = {
  REST: /\brest(ful)?(\s+api)?\b|\bopenapi\b|\bswagger\b|\bhttp\s+(get|post|put|patch|delete)\b|\bjson api\b|\bapi\.[\w.-]+\/v\d/i,
  GraphQL: /\bgraphql\b/i,
  Webhooks: /\bwebhooks?\b|\bevent subscriptions?\b/i,
  gRPC: /\bgrpc\b|\bprotobuf\b/i,
  WebSockets: /\bwebsockets?\b|\bwss:\/\/\b|\breal[- ]time api\b/i,
  SOAP: /\bsoap\b|\bwsdl\b/i,
  "Official SDK": /\b(typescript|javascript|node\.?js|python|go|ruby|java|php)\s+sdk\b|\bofficial sdk\b/i,
  CLI: /\bcommand[- ]line\b|\bcli\b|\bnpm install\b|\bpip install\b/i,
};

const HARD_GATED_REGEX =
  /\b(request access|contact sales|apply for access|partner program|partner approval|invite[- ]only|private beta|waitlist|enterprise[- ]only|requires approval|must be approved|manual review)\b/i;

const SELF_SERVE_REGEX =
  /\b(create (a |an )?(new )?(api )?key|generate (a |an )?(api )?token|get started|quickstart|getting started|personal access token|sandbox|free tier|developer account|sign up for free|api_key|bearer)\b/i;

const API_PRESENCE_REGEX =
  /\b(rest api|graphql|openapi|swagger|endpoints?|api reference|base url|rate limit|webhooks?|sdk|curl|authorization:\s*bearer|x-api-key|oauth\s*2)\b/i;

const NO_PUBLIC_API_REGEX =
  /\b(no public api|does not provide a public api|does not offer an api|api is not publicly available)\b/i;

export async function runVerificationLoop(
  appName: string,
  extracted: ExtractedAppPayload,
  registryEntry: CuratedAppSources,
  retrievedDocs: RetrievedDoc[],
  existingApp?: AppRecord
): Promise<VerificationOutput> {
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

  const fetchedDocs = retrievedDocs.filter((d) => d.status === "fetched");
  const blockedDocs = retrievedDocs.filter((d) => d.status !== "fetched");

  let updatedAuthMethods = [...extracted.authentication_methods];
  let updatedApiAvailable = extracted.api_available;
  let updatedApiTypes = [...extracted.api_types];
  let updatedAccessModel: ApiAccessModel = extracted.api_access_model;
  let updatedMcpStatus: McpStatus = extracted.mcp_status;
  let updatedBuildability: BuildabilityVerdict = extracted.buildability;

  const items: ClaimVerificationItem[] = [];
  const makeId = (idx: number) => `v-${Date.now()}-${idx}`;

  // 1. Verify authentication_methods
  {
    const verifiedMethods: string[] = [];
    let firstUrl: string | null = null;
    let firstExcerpt: string | null = null;

    for (const method of extracted.authentication_methods) {
      const rx = AUTH_VERIFY_REGEX[method];
      const matchDoc = rx
        ? fetchedDocs.find(
            (d) =>
              (d.source_type === "auth_docs" ||
                d.source_type === "official_docs" ||
                d.source_type === "api_reference" ||
                d.source_type === "official_mcp" ||
                API_PRESENCE_REGEX.test(d.full_text)) &&
              rx.test(d.full_text)
          )
        : undefined;
      if (matchDoc && rx) {
        verifiedMethods.push(method);
        if (!firstUrl) {
          firstUrl = matchDoc.resolved_url ?? matchDoc.original_url;
          firstExcerpt = extractSnippet(matchDoc.full_text, rx, 220);
        }
      }
    }

    let result: ClaimVerificationResult;
    let correctedFinding: string | null = null;
    let explanation: string;

    if (extracted.authentication_methods.length === 0) {
      if (extracted.api_available === false) {
        result = "verified";
        explanation = "No API authentication expected because official sources indicate CLI/local tool or no public SaaS API.";
      } else {
        result = fetchedDocs.length === 0 ? "not_verifiable" : "needs_human_review";
        explanation =
          fetchedDocs.length === 0
            ? `Cannot verify authentication for ${appName}: 0 documentation URLs returned readable text over HTTP.`
            : "No explicit authentication scheme matched in retrieved documentation; requires human review.";
      }
    } else if (verifiedMethods.length === extracted.authentication_methods.length) {
      result = "verified";
      explanation = `All ${verifiedMethods.length} authentication method(s) corroborated by verbatim text in fetched official docs.`;
    } else if (verifiedMethods.length > 0) {
      result = "corrected";
      updatedAuthMethods = verifiedMethods;
      correctedFinding = verifiedMethods.join(", ");
      explanation = `Removed uncorroborated auth method(s); retained ${verifiedMethods.join(", ")} backed by retrieved excerpts.`;
    } else {
      result = "unsupported";
      updatedAuthMethods = [];
      correctedFinding = "Unknown (uncorroborated)";
      explanation = "Extracted authentication methods were not corroborated by retrieved documentation text.";
    }

    items.push({
      id: makeId(0),
      claim_key: "authentication_methods",
      claim_label: "Authentication Methods",
      original_ai_finding:
        extracted.authentication_methods.length > 0
          ? extracted.authentication_methods.join(", ")
          : "None / Unknown",
      evidence_url: firstUrl,
      evidence_excerpt: firstExcerpt,
      verification_result: result,
      corrected_finding: correctedFinding,
      explanation,
    });
  }

  // 2. Verify api_available
  {
    const apiDoc = fetchedDocs.find(
      (d) =>
        (d.source_type === "official_docs" ||
          d.source_type === "api_reference" ||
          d.source_type === "auth_docs" ||
          d.source_type === "official_mcp") &&
        API_PRESENCE_REGEX.test(d.full_text)
    );
    const noApiDoc = fetchedDocs.find((d) => NO_PUBLIC_API_REGEX.test(d.full_text));
    const isCliOnly =
      registryEntry.source_kind === "cli_or_library" &&
      !registryEntry.api_reference &&
      fetchedDocs.length > 0;

    let result: ClaimVerificationResult;
    let correctedFinding: string | null = null;
    let explanation: string;
    let evUrl: string | null = null;
    let evExcerpt: string | null = null;

    if (extracted.api_available === true) {
      if (apiDoc) {
        result = "verified";
        evUrl = apiDoc.resolved_url ?? apiDoc.original_url;
        evExcerpt = extractSnippet(apiDoc.full_text, API_PRESENCE_REGEX, 220);
        explanation = "Public developer API confirmed by retrieved developer/API documentation text.";
      } else {
        result = "corrected";
        updatedApiAvailable = null;
        correctedFinding = "unknown (null)";
        explanation = "No fetched developer/API doc corroborated public API availability; reset to unknown.";
      }
    } else if (extracted.api_available === false) {
      if (noApiDoc || isCliOnly) {
        result = "verified";
        const refDoc = noApiDoc ?? fetchedDocs[0];
        evUrl = refDoc?.resolved_url ?? refDoc?.original_url ?? null;
        evExcerpt = refDoc ? refDoc.excerpt.slice(0, 220) : null;
        explanation = isCliOnly
          ? "Confirmed local CLI/library distribution rather than a hosted public SaaS API."
          : "Official source explicitly states no public API is offered.";
      } else {
        result = "corrected";
        updatedApiAvailable = null;
        correctedFinding = "unknown (null)";
        explanation =
          "Blocked/missing HTTP docs (e.g. 403/404/timeout) do not prove absence of a public API; corrected to unknown.";
      }
    } else {
      result = fetchedDocs.length === 0 ? "not_verifiable" : "needs_human_review";
      explanation =
        fetchedDocs.length === 0
          ? "Curated sources were unreachable/blocked over HTTP; API availability remains unknown and requires human check."
          : "Retrieved pages did not conclusively confirm or rule out a public API.";
    }

    items.push({
      id: makeId(1),
      claim_key: "api_available",
      claim_label: "Public API Availability",
      original_ai_finding: String(extracted.api_available),
      evidence_url: evUrl,
      evidence_excerpt: evExcerpt,
      verification_result: result,
      corrected_finding: correctedFinding,
      explanation,
    });
  }

  // 3. Verify api_types
  {
    const verifiedTypes: string[] = [];
    let evUrl: string | null = null;
    let evExcerpt: string | null = null;

    for (const t of extracted.api_types) {
      const rx = API_TYPE_VERIFY_REGEX[t];
      const matchDoc = rx ? fetchedDocs.find((d) => rx.test(d.full_text)) : undefined;
      if (matchDoc && rx) {
        verifiedTypes.push(t);
        if (!evUrl) {
          evUrl = matchDoc.resolved_url ?? matchDoc.original_url;
          evExcerpt = extractSnippet(matchDoc.full_text, rx, 220);
        }
      }
    }

    let result: ClaimVerificationResult;
    let correctedFinding: string | null = null;
    let explanation: string;

    if (extracted.api_types.length === 0) {
      result = fetchedDocs.length === 0 ? "not_verifiable" : "needs_human_review";
      explanation =
        fetchedDocs.length === 0
          ? "API protocol/interface types could not be extracted because no documentation pages returned readable text."
          : "No explicit API protocol type (REST/GraphQL/Webhooks/SDK) matched in fetched docs.";
    } else if (verifiedTypes.length === extracted.api_types.length) {
      result = "verified";
      explanation = `Verified ${verifiedTypes.join(", ")} directly against retrieved documentation text.`;
    } else if (verifiedTypes.length > 0) {
      result = "corrected";
      updatedApiTypes = verifiedTypes;
      correctedFinding = verifiedTypes.join(", ");
      explanation = `Filtered uncorroborated API types; retained ${verifiedTypes.join(", ")}.`;
    } else {
      result = "unsupported";
      updatedApiTypes = [];
      correctedFinding = "Unknown";
      explanation = "Cited API types were not supported by retrieved text.";
    }

    items.push({
      id: makeId(2),
      claim_key: "api_types",
      claim_label: "API Types & Surfaces",
      original_ai_finding:
        extracted.api_types.length > 0 ? extracted.api_types.join(", ") : "None / Unknown",
      evidence_url: evUrl,
      evidence_excerpt: evExcerpt,
      verification_result: result,
      corrected_finding: correctedFinding,
      explanation,
    });
  }

  // 4. Verify api_access_model
  {
    const gatedDoc = fetchedDocs.find((d) => HARD_GATED_REGEX.test(d.full_text));
    const selfDoc = fetchedDocs.find((d) => SELF_SERVE_REGEX.test(d.full_text));

    let result: ClaimVerificationResult;
    let correctedFinding: string | null = null;
    let explanation: string;
    let evUrl: string | null = null;
    let evExcerpt: string | null = null;

    if (extracted.api_access_model === "self_serve" && gatedDoc && !selfDoc) {
      result = "corrected";
      updatedAccessModel = "gated";
      correctedFinding = "gated";
      evUrl = gatedDoc.resolved_url ?? gatedDoc.original_url;
      evExcerpt = extractSnippet(gatedDoc.full_text, HARD_GATED_REGEX, 220);
      explanation = "Retrieved docs contain gating/approval requirements without self-serve onboarding; corrected to gated.";
    } else if (extracted.api_access_model === "self_serve" && gatedDoc && selfDoc) {
      result = "corrected";
      updatedAccessModel = "mixed";
      correctedFinding = "mixed";
      evUrl = gatedDoc.resolved_url ?? gatedDoc.original_url;
      evExcerpt = extractSnippet(gatedDoc.full_text, HARD_GATED_REGEX, 220);
      explanation = "Retrieved docs show both self-serve setup and gated/approval language; corrected to mixed.";
    } else if (extracted.api_access_model === "self_serve" && selfDoc) {
      result = "verified";
      evUrl = selfDoc.resolved_url ?? selfDoc.original_url;
      evExcerpt = extractSnippet(selfDoc.full_text, SELF_SERVE_REGEX, 220);
      explanation = "Self-serve developer access corroborated by retrieved onboarding/key-creation documentation.";
    } else if (extracted.api_access_model === "gated" && gatedDoc) {
      result = "verified";
      evUrl = gatedDoc.resolved_url ?? gatedDoc.original_url;
      evExcerpt = extractSnippet(gatedDoc.full_text, HARD_GATED_REGEX, 220);
      explanation = "Gated access requirement corroborated by retrieved documentation.";
    } else if (extracted.api_access_model === "mixed" && (selfDoc || gatedDoc)) {
      result = "verified";
      const refDoc = gatedDoc ?? selfDoc!;
      evUrl = refDoc.resolved_url ?? refDoc.original_url;
      evExcerpt = refDoc.excerpt.slice(0, 220);
      explanation = "Mixed access model (self-serve onboarding with tiered/review gates) corroborated by retrieved docs.";
    } else if (extracted.api_access_model === "unknown") {
      result = fetchedDocs.length === 0 ? "not_verifiable" : "needs_human_review";
      explanation =
        fetchedDocs.length === 0
          ? "Access model could not be verified because curated docs could not be fetched."
          : "Access model remained ambiguous in retrieved pages; requires human pricing/developer portal check.";
    } else {
      result = "needs_human_review";
      explanation = "Access model classification lacked an explicit corroborating excerpt; flagged for human review.";
    }

    items.push({
      id: makeId(3),
      claim_key: "api_access_model",
      claim_label: "API Access Model",
      original_ai_finding: extracted.api_access_model,
      evidence_url: evUrl,
      evidence_excerpt: evExcerpt,
      verification_result: result,
      corrected_finding: correctedFinding,
      explanation,
    });
  }

  // 5. Verify mcp_status (strict Official vs Third-Party guard)
  {
    const mcpRegex = /\bmodel context protocol\b|\bmcp\b/i;
    const officialMcpDoc = registryEntry.official_mcp
      ? fetchedDocs.find(
          (d) =>
            (d.original_url === registryEntry.official_mcp!.url ||
              d.source_type === "official_mcp" ||
              d.source_type !== "github_repo") &&
            mcpRegex.test(d.full_text)
        )
      : fetchedDocs.find(
          (d) =>
            d.source_type !== "github_repo" &&
            /\bmodel context protocol\b|\bmcp server\b/i.test(d.full_text)
        );
    const thirdPartyDoc = registryEntry.third_party_mcp
      ? fetchedDocs.find(
          (d) =>
            (d.original_url === registryEntry.third_party_mcp!.url ||
              d.source_type === "github_repo") &&
            mcpRegex.test(d.full_text)
        )
      : undefined;

    let result: ClaimVerificationResult;
    let correctedFinding: string | null = null;
    let explanation: string;
    let evUrl: string | null = null;
    let evExcerpt: string | null = null;

    if (extracted.mcp_status === "official") {
      if (officialMcpDoc) {
        result = "verified";
        evUrl = officialMcpDoc.resolved_url ?? officialMcpDoc.original_url;
        evExcerpt = extractSnippet(officialMcpDoc.full_text, mcpRegex, 220);
        explanation = "Official vendor-maintained MCP support confirmed directly in retrieved vendor documentation.";
      } else if (thirdPartyDoc) {
        result = "corrected";
        updatedMcpStatus = "third_party";
        correctedFinding = "third_party";
        evUrl = thirdPartyDoc.resolved_url ?? thirdPartyDoc.original_url;
        evExcerpt = extractSnippet(thirdPartyDoc.full_text, mcpRegex, 220);
        explanation = "Only community/third-party MCP evidence found; downgraded from official to third_party.";
      } else {
        result = "corrected";
        updatedMcpStatus = "unknown";
        correctedFinding = "unknown";
        explanation = "No fetched official source corroborated official MCP ownership; reset to unknown.";
      }
    } else if (extracted.mcp_status === "third_party") {
      if (thirdPartyDoc) {
        result = "verified";
        evUrl = thirdPartyDoc.resolved_url ?? thirdPartyDoc.original_url;
        evExcerpt = extractSnippet(thirdPartyDoc.full_text, mcpRegex, 220);
        explanation = "Third-party/community MCP repository confirmed in retrieved GitHub/community source.";
      } else {
        result = "needs_human_review";
        explanation = "Third-party MCP candidate URL was not readable over HTTP; requires manual verification.";
      }
    } else if (extracted.mcp_status === "unavailable" && registryEntry.source_kind === "cli_or_library" && fetchedDocs.length > 0) {
      result = "verified";
      evUrl = fetchedDocs[0].resolved_url ?? fetchedDocs[0].original_url;
      evExcerpt = fetchedDocs[0].excerpt.slice(0, 200);
      explanation = "Local CLI/library tool with no vendor MCP server in registry or official repository.";
    } else {
      result = "needs_human_review";
      explanation =
        registryEntry.official_mcp
          ? "Candidate official MCP link could not be confirmed via HTTP retrieval; requires human check."
          : "No official MCP link confirmed in curated sources; human review needed to confirm whether vendor recently launched one.";
    }

    items.push({
      id: makeId(4),
      claim_key: "mcp_status",
      claim_label: "MCP Support & Ownership",
      original_ai_finding: `${extracted.mcp_status}${extracted.mcp_server_name ? ` (${extracted.mcp_server_name})` : ""}`,
      evidence_url: evUrl,
      evidence_excerpt: evExcerpt,
      verification_result: result,
      corrected_finding: correctedFinding,
      explanation,
    });
  }

  // 6. Verify buildability consistency with verified dimensions & access model
  {
    const recomputed = computeBuildabilityScore(
      extracted.dimensions,
      updatedApiAvailable,
      updatedAccessModel
    );

    let result: ClaimVerificationResult;
    let correctedFinding: string | null = null;
    let explanation: string;

    if (fetchedDocs.length === 0) {
      if (extracted.buildability !== "unknown") {
        result = "corrected";
        updatedBuildability = "unknown";
        correctedFinding = "unknown";
        explanation = "Zero sources fetched; corrected buildability verdict to unknown.";
      } else {
        result = "not_verifiable";
        explanation = "Buildability cannot be confirmed without readable vendor documentation.";
      }
    } else if (recomputed.mapped_verdict !== extracted.buildability) {
      result = "corrected";
      updatedBuildability = recomputed.mapped_verdict;
      correctedFinding = recomputed.mapped_verdict;
      explanation = `Post-verification access/API adjustments changed weighted rubric verdict from "${extracted.buildability}" to "${recomputed.mapped_verdict}" (${recomputed.weighted_score}/5.00).`;
    } else if (updatedApiAvailable === null) {
      result = "needs_human_review";
      explanation = "Weighted score computed conservatively, but public API availability remains unconfirmed.";
    } else {
      result = "verified";
      explanation = `Buildability verdict "${recomputed.mapped_verdict}" (${recomputed.weighted_score}/5.00) is consistent with verified access model and rubric weights.`;
    }

    items.push({
      id: makeId(5),
      claim_key: "buildability",
      claim_label: "Buildability Verdict",
      original_ai_finding: extracted.buildability,
      evidence_url: fetchedDocs[0]?.resolved_url ?? fetchedDocs[0]?.original_url ?? null,
      evidence_excerpt: recomputed.explanation,
      verification_result: result,
      corrected_finding: correctedFinding,
      explanation,
    });
  }

  // 7. Verify technical_restrictions (documented blockers vs engineering concerns)
  {
    const documentedBlockers = extracted.blockers.filter((b) => b.kind === "documented");
    const hasBlockedRetrieval = blockedDocs.length > 0;

    let result: ClaimVerificationResult;
    let explanation: string;
    let evUrl: string | null = null;
    let evExcerpt: string | null = null;

    if (documentedBlockers.length > 0 && documentedBlockers.every((b) => !b.evidence_url || fetchedDocs.some((d) => d.original_url === b.evidence_url || d.resolved_url === b.evidence_url))) {
      const refUrl = documentedBlockers.find((b) => b.evidence_url)?.evidence_url ?? fetchedDocs[0]?.original_url ?? null;
      evUrl = refUrl;
      evExcerpt = documentedBlockers.map((b) => b.description).join(" | ").slice(0, 240);
      if (hasBlockedRetrieval) {
        result = "needs_human_review";
        explanation = `Documented restrictions verified, but ${blockedDocs.length} curated URL(s) failed retrieval (${blockedDocs.map((d) => d.http_status ?? d.status).join(", ")}), requiring manual check for hidden restrictions.`;
      } else {
        result = "verified";
        explanation = "Documented restrictions match retrieved documentation and are clearly separated from engineering concerns.";
      }
    } else if (fetchedDocs.length > 0 && !hasBlockedRetrieval) {
      result = "verified";
      evUrl = fetchedDocs[0].resolved_url ?? fetchedDocs[0].original_url;
      evExcerpt = extracted.blockers[0]?.description ?? "No severe documented blockers found in retrieved pages.";
      explanation = "Blockers and engineering concerns properly separated based on retrieved documentation.";
    } else {
      result = "needs_human_review";
      explanation = "Incomplete documentation retrieval prevented full verification of commercial/technical restrictions.";
    }

    items.push({
      id: makeId(6),
      claim_key: "technical_restrictions",
      claim_label: "Technical & Commercial Blockers",
      original_ai_finding: `${extracted.blockers.length} blocker(s) (${documentedBlockers.length} documented)`,
      evidence_url: evUrl,
      evidence_excerpt: evExcerpt,
      verification_result: result,
      corrected_finding: null,
      explanation,
    });
  }

  // 8. Verify evidence_urls (content-backed provenance, never URL status 200 alone)
  {
    const totalCited = extracted.evidence.length;
    const contentBackedCount = extracted.evidence.filter((ev) => {
      const matchingDoc = fetchedDocs.find(
        (d) => d.resolved_url === ev.url || d.original_url === ev.url
      );
      return Boolean(
        matchingDoc &&
          matchingDoc.status === "fetched" &&
          ev.excerpt &&
          ev.excerpt.trim().length >= 12 &&
          matchingDoc.full_text.includes(ev.excerpt.slice(0, 40))
      );
    }).length;

    let result: ClaimVerificationResult;
    let explanation: string;
    const firstEv = extracted.evidence[0];

    if (totalCited === 0) {
      result = blockedDocs.length > 0 ? "not_verifiable" : "unsupported";
      explanation =
        blockedDocs.length > 0
          ? `0 evidence records attached because all ${blockedDocs.length} curated URLs returned errors or thin content.`
          : "No valid evidence URLs attached.";
    } else if (contentBackedCount === totalCited && blockedDocs.length === 0) {
      result = "verified";
      explanation = `All ${contentBackedCount}/${totalCited} evidence citations match retrieved page content and verbatim excerpts.`;
    } else if (contentBackedCount > 0) {
      result = "needs_human_review";
      explanation = `${contentBackedCount}/${totalCited} cited evidence URLs verified with verbatim excerpts; ${blockedDocs.length} curated URL(s) could not be fetched (${blockedDocs.map((d) => d.http_status ?? d.status).join(", ")}).`;
    } else {
      result = "unsupported";
      explanation = "Evidence citations lacked matching retrieved text excerpts.";
    }

    items.push({
      id: makeId(7),
      claim_key: "evidence_urls",
      claim_label: "Evidence Citations & Excerpts",
      original_ai_finding: `${totalCited} evidence URL(s) cited`,
      evidence_url: firstEv?.url ?? null,
      evidence_excerpt: firstEv?.excerpt?.slice(0, 220) ?? null,
      verification_result: result,
      corrected_finding: null,
      explanation,
    });
  }

  // Preserve human-reviewed overrides from any prior run on this app
  const priorHumanOverrides = new Map(
    (existingApp?.verification_items ?? [])
      .filter((v) => v.human_override === true)
      .map((v) => [v.claim_key, v])
  );

  const finalVerificationItems: ClaimVerificationItem[] = items.map((item) => {
    const cleanEvidenceUrl = isValidHttpUrl(item.evidence_url) ? item.evidence_url : null;
    const humanItem = priorHumanOverrides.get(item.claim_key);
    if (!humanItem) {
      return {
        ...item,
        evidence_url: cleanEvidenceUrl,
      };
    }
    return {
      ...item,
      evidence_url: cleanEvidenceUrl,
      verification_result: humanItem.verification_result,
      corrected_finding: humanItem.corrected_finding,
      explanation: `${humanItem.explanation} [Human override preserved across re-run]`,
      human_override: true,
      reviewed_at: humanItem.reviewed_at,
    };
  });

  const hasFlaggedItems = finalVerificationItems.some(
    (v) =>
      v.verification_result === "needs_human_review" ||
      v.verification_result === "unsupported" ||
      v.verification_result === "not_verifiable"
  );

  const verificationStatus: VerificationStatus =
    finalVerificationItems.length > 0 && !hasFlaggedItems ? "verified" : "needs_review";

  const updatedEvidence: EvidenceRecord[] = extracted.evidence.map((e, i) => {
    const matchingDoc = fetchedDocs.find(
      (d) => d.resolved_url === e.url || d.original_url === e.url
    );
    const hasExcerptMatch = Boolean(
      matchingDoc &&
        matchingDoc.status === "fetched" &&
        e.excerpt &&
        matchingDoc.full_text.includes(e.excerpt.slice(0, 32))
    );
    return {
      id: `ev-${Date.now()}-${i}`,
      source_title: e.source_title,
      url: e.url,
      source_type: e.source_type,
      claim_supported: e.claim_supported,
      excerpt: e.excerpt.slice(0, 420),
      researched_at: e.researched_at || now,
      verification_status: hasExcerptMatch ? "verified" : "needs_review",
    };
  });

  return {
    firstPassSnapshot,
    verificationItems: finalVerificationItems,
    verificationStatus,
    updatedAuthMethods,
    updatedApiAvailable,
    updatedApiTypes,
    updatedAccessModel,
    updatedMcpStatus,
    updatedBuildability,
    updatedEvidence,
  };
}
