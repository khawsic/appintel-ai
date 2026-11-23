import { AppCategory, ApiAccessModel, DocQuality, McpStatus } from "../../shared/types.ts";
import { CuratedAppSources } from "./sourceRegistry.ts";
import { RetrievedDoc } from "./docRetrieval.ts";
import { computeBuildabilityScore } from "./buildabilityScorer.ts";
import {
  ExtractedAppPayload,
  isValidHttpUrl,
  validateAndSanitizeExtraction,
} from "./validator.ts";

interface PatternRule {
  label: string;
  regex: RegExp;
}

const AUTH_RULES: PatternRule[] = [
  {
    label: "OAuth 2.0",
    regex: /\boauth\s*2(\.0)?\b|\boauth2\b|\bauthorization[_ ]code\b|\bclient[_ ]credentials\b|\brefresh[_ ]token\b/i,
  },
  {
    label: "OAuth 1.0a",
    regex: /\boauth\s*1(\.0a?)?\b/i,
  },
  {
    label: "API Key",
    regex: /\bapi[\s_-]?keys?\b|\bx-api-key\b|\bsecret[\s_-]?key\b|\bpublishable[\s_-]?key\b/i,
  },
  {
    label: "Bearer Token / PAT",
    regex: /\bbearer\s+token\b|\bpersonal access token\b|\bprivate app token\b|\bauthorization:\s*bearer\b|\bbot token\b/i,
  },
  {
    label: "JWT",
    regex: /\bjson web token\b|\bjwt\b/i,
  },
  {
    label: "Basic Auth",
    regex: /\bbasic auth(entication)?\b|\bhttp basic\b/i,
  },
  {
    label: "Webhook Signatures (HMAC)",
    regex: /\bhmac\b|\bwebhook signature\b|\bsigning secret\b|\bx-hub-signature\b/i,
  },
  {
    label: "mTLS / Certificate",
    regex: /\bmutual tls\b|\bmtls\b|\bclient certificate\b/i,
  },
];

const API_TYPE_RULES: PatternRule[] = [
  {
    label: "REST",
    regex: /\brest(ful)?(\s+api)?\b|\bopenapi\b|\bswagger\b|\bhttp\s+(get|post|put|patch|delete)\b|\bjson api\b|\bapi\.[\w.-]+\/v\d/i,
  },
  {
    label: "GraphQL",
    regex: /\bgraphql\b/i,
  },
  {
    label: "Webhooks",
    regex: /\bwebhooks?\b|\bevent subscriptions?\b/i,
  },
  {
    label: "gRPC",
    regex: /\bgrpc\b|\bprotobuf\b/i,
  },
  {
    label: "WebSockets",
    regex: /\bwebsockets?\b|\bwss:\/\/\b|\breal[- ]time api\b/i,
  },
  {
    label: "SOAP",
    regex: /\bsoap\b|\bwsdl\b/i,
  },
  {
    label: "Official SDK",
    regex: /\b(typescript|javascript|node\.?js|python|go|ruby|java|php)\s+sdk\b|\bofficial sdk\b/i,
  },
];

const API_SURFACE_RULES: PatternRule[] = [
  { label: "Contacts & CRM Records", regex: /\b(contacts|leads|deals|opportunities|accounts|companies)\b/i },
  { label: "Messages & Channels", regex: /\b(messages|channels|conversations|threads|chat|sms|emails?)\b/i },
  { label: "Tickets & Support", regex: /\b(tickets|helpdesk|cases|incidents|articles)\b/i },
  { label: "Payments & Billing", regex: /\b(payments|charges|invoices|subscriptions|checkout|refunds|payouts)\b/i },
  { label: "Orders & Catalog", regex: /\b(orders|products|inventory|fulfillment|customers|carts)\b/i },
  { label: "Repositories & Issues", regex: /\b(repositories|pull requests|commits|issues|workflows|releases)\b/i },
  { label: "Documents & Databases", regex: /\b(pages|blocks|databases|documents|files|folders|spreadsheets)\b/i },
  { label: "Tasks & Projects", regex: /\b(tasks|projects|boards|sprints|milestones|calendars|events)\b/i },
  { label: "Search, Crawling & Extraction", regex: /\b(crawl|scrape|search|serp|extract|actors?|datasets?)\b/i },
  { label: "Webhooks & Event Streams", regex: /\b(webhooks?|events?|triggers?|subscriptions?)\b/i },
];

const USE_CASE_RULES: PatternRule[] = [
  { label: "Automated CRM & Lead Sync", regex: /\b(crm|contacts|leads|deals|pipeline|sales)\b/i },
  { label: "Customer Support Triage", regex: /\b(tickets|support|helpdesk|conversations|inbox)\b/i },
  { label: "Team Messaging & Notifications", regex: /\b(slack|messages|channels|notifications|alerts|sms|email)\b/i },
  { label: "Campaign & Audience Automation", regex: /\b(campaigns|audiences|subscribers|segments|ads)\b/i },
  { label: "Order & Commerce Sync", regex: /\b(orders|products|inventory|shopify|checkout|ecommerce)\b/i },
  { label: "Web Data & Search Extraction", regex: /\b(scrape|crawl|search|serp|dataset|transcript|captions)\b/i },
  { label: "Developer & CI/CD Workflows", regex: /\b(repositories|issues|deployments|pull requests|incidents)\b/i },
  { label: "Knowledge & Task Automation", regex: /\b(tasks|projects|pages|databases|notes|meetings)\b/i },
  { label: "Payment & Financial Operations", regex: /\b(payments|invoices|payouts|accounting|transactions)\b/i },
];

const SELF_SERVE_REGEX =
  /\b(create (a |an )?(new )?(api )?key|generate (a |an )?(api )?token|get started|quickstart|getting started|personal access token|sandbox|free tier|developer account|sign up for free|api_key|bearer)\b/i;

const HARD_GATED_REGEX =
  /\b(request access|contact sales|apply for access|partner program|partner approval|invite[- ]only|private beta|waitlist|enterprise[- ]only|requires approval|must be approved|manual review)\b/i;

const MIXED_TIER_REGEX =
  /\b(enterprise plan|paid plan|pro plan|business plan|app review|marketplace review|scoping approval|edition)\b/i;

const RATE_LIMIT_REGEX =
  /\b(rate[- ]limit(?:s|ing)?|requests per (?:second|minute|hour|day)|per minute|per second|429 too many requests|throttl(?:e|ing)|quota)\b/i;

const API_PRESENCE_REGEX =
  /\b(rest api|graphql|openapi|swagger|endpoints?|api reference|base url|rate limit|webhooks?|sdk|curl|authorization:\s*bearer|x-api-key|oauth\s*2)\b/i;

const NO_PUBLIC_API_REGEX =
  /\b(no public api|does not provide a public api|does not offer an api|api is not publicly available)\b/i;

const CLI_ONLY_REGEX =
  /\b(command[- ]line interface|cli tool|npm install -g|npx |pip install|local command)\b/i;

export function extractSnippet(text: string, regex: RegExp, maxLen = 260): string | null {
  const match = regex.exec(text);
  if (!match || match.index === undefined) return null;
  const idx = match.index;
  const start = Math.max(0, idx - 85);
  const end = Math.min(text.length, idx + maxLen - 85);
  let slice = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) slice = `…${slice}`;
  if (end < text.length) slice = `${slice}…`;
  return slice;
}

function buildDescriptionFromDocs(
  appName: string,
  fetchedDocs: RetrievedDoc[]
): string | null {
  if (fetchedDocs.length === 0) return null;
  const preferred =
    fetchedDocs.find((d) => d.source_type === "technical_source") ??
    fetchedDocs.find((d) => d.source_type === "official_docs") ??
    fetchedDocs[0];
  if (!preferred || preferred.full_text.trim().length < 40) return null;

  const clean = preferred.full_text.replace(/\s+/g, " ").trim();
  const titlePrefix = preferred.page_title ? `${preferred.page_title}: ` : "";
  const bodySnippet = clean.slice(0, 320);
  const combined = `${titlePrefix}${bodySnippet}`.trim();
  return combined.length >= 20 ? combined : `${appName} official documentation page retrieved.`;
}

function buildPrimaryPurpose(
  appName: string,
  category: AppCategory,
  fetchedDocs: RetrievedDoc[]
): string | null {
  if (fetchedDocs.length === 0) return null;
  const preferred =
    fetchedDocs.find((d) => d.source_type === "official_docs") ??
    fetchedDocs.find((d) => d.source_type === "technical_source") ??
    fetchedDocs[0];
  const title = preferred.page_title || preferred.title;
  return `${appName} (${category}) — documented via ${title}`.slice(0, 220);
}

export function extractAppIntelligence(
  appName: string,
  category: AppCategory,
  registryEntry: CuratedAppSources,
  retrievedDocs: RetrievedDoc[]
): ExtractedAppPayload {
  const fetchedDocs = retrievedDocs.filter((d) => d.status === "fetched");
  const blockedDocs = retrievedDocs.filter(
    (d) => d.status === "http_error" || d.status === "thin_content" || d.status === "timeout" || d.status === "network_error"
  );

  const notes: string[] = [...registryEntry.registry_notes];
  for (const d of retrievedDocs) {
    if (d.status !== "fetched" && d.error_detail) {
      notes.push(`[${d.source_type}] ${d.original_url}: ${d.error_detail}`);
    }
  }

  // Docs considered authoritative for API / auth technical signals
  const technicalDocs = fetchedDocs.filter(
    (d) =>
      d.source_type === "auth_docs" ||
      d.source_type === "official_docs" ||
      d.source_type === "api_reference" ||
      d.source_type === "official_mcp"
  );
  const fallbackTechDocs =
    technicalDocs.length > 0
      ? technicalDocs
      : fetchedDocs.filter((d) => API_PRESENCE_REGEX.test(d.full_text));

  // 1. Authentication extraction strictly from fetched technical/auth docs
  const authentication_methods: string[] = [];
  const authentication_evidence: string[] = [];
  const docSupportingClaims = new Map<string, string[]>();

  const addDocClaim = (docUrl: string, claim: string) => {
    const existing = docSupportingClaims.get(docUrl) ?? [];
    if (!existing.includes(claim)) {
      existing.push(claim);
      docSupportingClaims.set(docUrl, existing);
    }
  };

  for (const rule of AUTH_RULES) {
    for (const doc of fallbackTechDocs) {
      const snippet = extractSnippet(doc.full_text, rule.regex);
      if (snippet) {
        if (!authentication_methods.includes(rule.label)) {
          authentication_methods.push(rule.label);
        }
        const evidenceLine = `${rule.label} (${doc.resolved_url ?? doc.original_url}): "${snippet}"`;
        if (!authentication_evidence.includes(evidenceLine)) {
          authentication_evidence.push(evidenceLine);
        }
        addDocClaim(doc.original_url, `Authentication (${rule.label})`);
        break;
      }
    }
  }

  // 2. API availability strictly from fetched content (never treat 403 as "no API")
  let api_available: boolean | null = null;
  if (
    registryEntry.source_kind === "cli_or_library" &&
    fetchedDocs.some((d) => CLI_ONLY_REGEX.test(d.full_text)) &&
    !registryEntry.api_reference
  ) {
    api_available = false;
    const cliDoc = fetchedDocs.find((d) => CLI_ONLY_REGEX.test(d.full_text));
    if (cliDoc) addDocClaim(cliDoc.original_url, "CLI / local library (not hosted SaaS API)");
  } else {
    const explicitNoApi = fetchedDocs.find((d) => NO_PUBLIC_API_REGEX.test(d.full_text));
    const apiDoc = fallbackTechDocs.find((d) => API_PRESENCE_REGEX.test(d.full_text));
    if (apiDoc) {
      api_available = true;
      addDocClaim(apiDoc.original_url, "Public developer API documentation");
    } else if (explicitNoApi) {
      api_available = false;
      addDocClaim(explicitNoApi.original_url, "Explicit statement of no public API");
    } else {
      api_available = null;
    }
  }

  // 3. API types & surface strictly from fetched docs
  const api_types: string[] = [];
  if (registryEntry.source_kind === "cli_or_library" && api_available === false) {
    api_types.push("CLI");
  } else {
    for (const rule of API_TYPE_RULES) {
      for (const doc of fallbackTechDocs) {
        if (rule.regex.test(doc.full_text)) {
          if (!api_types.includes(rule.label)) api_types.push(rule.label);
          addDocClaim(doc.original_url, `API type (${rule.label})`);
          break;
        }
      }
    }
  }

  const api_surface: string[] = [];
  for (const rule of API_SURFACE_RULES) {
    if (fetchedDocs.some((d) => rule.regex.test(d.full_text))) {
      api_surface.push(rule.label);
    }
  }

  const use_cases: string[] = [];
  for (const rule of USE_CASE_RULES) {
    if (fetchedDocs.some((d) => rule.regex.test(d.full_text))) {
      use_cases.push(rule.label);
    }
  }

  // 4. API access model strictly from fetched docs
  let api_access_model: ApiAccessModel = "unknown";
  let access_model_reasoning =
    "Insufficient retrieved documentation text to determine whether API access is self-serve or gated.";
  const access_restrictions: string[] = [];

  if (api_available === false) {
    api_access_model = "unknown";
    access_model_reasoning =
      registryEntry.source_kind === "cli_or_library"
        ? "Application is a CLI tool or local library rather than a hosted SaaS API."
        : "Retrieved official documentation indicates no public SaaS API.";
  } else if (fetchedDocs.length > 0) {
    const selfServeDoc = fetchedDocs.find((d) => SELF_SERVE_REGEX.test(d.full_text));
    const gatedDoc = fetchedDocs.find((d) => HARD_GATED_REGEX.test(d.full_text));
    const mixedDoc = fetchedDocs.find((d) => MIXED_TIER_REGEX.test(d.full_text));

    if (gatedDoc && !selfServeDoc) {
      api_access_model = "gated";
      const snip = extractSnippet(gatedDoc.full_text, HARD_GATED_REGEX);
      access_model_reasoning = `Retrieved documentation indicates gated/approval-based access at ${gatedDoc.resolved_url ?? gatedDoc.original_url}: "${snip ?? ""}"`;
      access_restrictions.push("Vendor approval, enterprise sales contact, or partner onboarding required.");
      addDocClaim(gatedDoc.original_url, "Gated API access terms");
    } else if (selfServeDoc && gatedDoc) {
      api_access_model = "mixed";
      access_model_reasoning = `Retrieved docs show both self-serve developer onboarding (${selfServeDoc.original_url}) and approval/partner gating (${gatedDoc.original_url}).`;
      access_restrictions.push("Self-serve developer setup exists, while advanced scopes or production access require approval.");
      addDocClaim(selfServeDoc.original_url, "Self-serve developer onboarding");
      addDocClaim(gatedDoc.original_url, "Gated/approval-based access controls");
    } else if (selfServeDoc && mixedDoc) {
      api_access_model = "mixed";
      access_model_reasoning = `Retrieved docs show self-serve developer onboarding (${selfServeDoc.original_url}) alongside plan/app-review gates (${mixedDoc.original_url}).`;
      access_restrictions.push("API features or publishing depend on paid plan tier or marketplace app review.");
      addDocClaim(selfServeDoc.original_url, "Self-serve developer onboarding");
      addDocClaim(mixedDoc.original_url, "Plan or app-review requirements");
    } else if (selfServeDoc) {
      api_access_model = "self_serve";
      const snip = extractSnippet(selfServeDoc.full_text, SELF_SERVE_REGEX);
      access_model_reasoning = `Retrieved documentation supports self-serve developer setup (${selfServeDoc.resolved_url ?? selfServeDoc.original_url}): "${snip ?? ""}"`;
      addDocClaim(selfServeDoc.original_url, "Self-serve API access");
    } else if (mixedDoc) {
      api_access_model = "mixed";
      const snip = extractSnippet(mixedDoc.full_text, MIXED_TIER_REGEX);
      access_model_reasoning = `Retrieved documentation references plan-tiered or review-gated API access (${mixedDoc.resolved_url ?? mixedDoc.original_url}): "${snip ?? ""}"`;
      addDocClaim(mixedDoc.original_url, "Plan/review gated API access");
    }
  }

  // 5. Rate limits & documentation quality
  let api_rate_limits: string | null = null;
  for (const doc of fallbackTechDocs) {
    const rl = extractSnippet(doc.full_text, RATE_LIMIT_REGEX, 220);
    if (rl) {
      api_rate_limits = rl;
      addDocClaim(doc.original_url, "Rate limits documented");
      break;
    }
  }

  let api_doc_quality: DocQuality = "unknown";
  const fetchedTechChars = fallbackTechDocs.reduce((sum, d) => sum + d.full_text.length, 0);
  if (registryEntry.developer_docs === null && registryEntry.api_reference === null) {
    api_doc_quality = "unavailable";
  } else if (fallbackTechDocs.length >= 2 && fetchedTechChars >= 2000 && api_available === true) {
    api_doc_quality = "high";
  } else if (fallbackTechDocs.length >= 1 && fetchedTechChars >= 400) {
    api_doc_quality = "moderate";
  } else if (fetchedDocs.length > 0) {
    api_doc_quality = "limited";
  } else {
    api_doc_quality = "unknown";
  }

  // 6. MCP Support (strictly verified against fetched docs & registry ownership)
  let mcp_status: McpStatus = "unknown";
  let mcp_server_name: string | null = null;
  let mcp_repository_url: string | null = null;
  let mcp_ownership: "official" | "third_party" | "none" | "unknown" = "unknown";
  const mcp_capabilities: string[] = [];
  let mcp_maintained: boolean | null = null;
  let mcp_limitations: string | null = null;

  const mcpRegex = /\bmodel context protocol\b|\bmcp\b/i;
  if (registryEntry.official_mcp) {
    const mcpDoc = fetchedDocs.find(
      (d) => d.original_url === registryEntry.official_mcp!.url || d.source_type === "official_mcp"
    );
    const anyOfficialMcpMention = fetchedDocs.find(
      (d) => d.source_type !== "github_repo" && mcpRegex.test(d.full_text)
    );
    if (mcpDoc && mcpRegex.test(mcpDoc.full_text)) {
      mcp_status = "official";
      mcp_ownership = "official";
      mcp_server_name = registryEntry.official_mcp.name;
      mcp_repository_url = registryEntry.official_mcp.url;
      mcp_maintained = true;
      addDocClaim(mcpDoc.original_url, "Official MCP server documentation");
      if (/\btools?\b/i.test(mcpDoc.full_text)) mcp_capabilities.push("MCP Tools");
      if (/\bresources?\b/i.test(mcpDoc.full_text)) mcp_capabilities.push("MCP Resources");
      if (/\bprompts?\b/i.test(mcpDoc.full_text)) mcp_capabilities.push("MCP Prompts");
    } else if (anyOfficialMcpMention) {
      mcp_status = "official";
      mcp_ownership = "official";
      mcp_server_name = registryEntry.official_mcp.name;
      mcp_repository_url = registryEntry.official_mcp.url;
      mcp_maintained = null;
      mcp_limitations = "Official MCP referenced in vendor docs, though dedicated MCP endpoint page could not be fully fetched.";
      addDocClaim(anyOfficialMcpMention.original_url, "Official MCP mention");
    } else {
      mcp_status = "unknown";
      mcp_ownership = "unknown";
      mcp_server_name = registryEntry.official_mcp.name;
      mcp_repository_url = registryEntry.official_mcp.url;
      mcp_limitations = "Official MCP candidate URL could not be fetched/verified over HTTP; requires human check.";
    }
  } else if (registryEntry.third_party_mcp) {
    const repoDoc = fetchedDocs.find(
      (d) => d.original_url === registryEntry.third_party_mcp!.url || d.source_type === "github_repo"
    );
    if (repoDoc && mcpRegex.test(repoDoc.full_text)) {
      mcp_status = "third_party";
      mcp_ownership = "third_party";
      mcp_server_name = registryEntry.third_party_mcp.name;
      mcp_repository_url = registryEntry.third_party_mcp.url;
      mcp_limitations = registryEntry.third_party_mcp.note;
      addDocClaim(repoDoc.original_url, "Third-party/community MCP repository");
    } else {
      mcp_status = "unknown";
      mcp_ownership = "unknown";
      mcp_repository_url = registryEntry.third_party_mcp.url;
      mcp_limitations = registryEntry.third_party_mcp.note;
    }
  } else if (registryEntry.source_kind === "cli_or_library") {
    mcp_status = "unavailable";
    mcp_ownership = "none";
  } else {
    const incidentalOfficialMcp = fallbackTechDocs.find((d) =>
      /\bmodel context protocol\b|\bmcp server\b/i.test(d.full_text)
    );
    if (incidentalOfficialMcp) {
      mcp_status = "official";
      mcp_ownership = "official";
      mcp_repository_url = incidentalOfficialMcp.resolved_url ?? incidentalOfficialMcp.original_url;
      addDocClaim(incidentalOfficialMcp.original_url, "Official MCP capability documented");
    } else {
      mcp_status = "unknown";
      mcp_ownership = "unknown";
      mcp_limitations = "No official MCP server confirmed in retrieved official sources.";
    }
  }

  // 7. Blockers & Commercial Restrictions (strict separation of documented vs engineering_concern)
  const blockers: ExtractedAppPayload["blockers"] = [];
  const commercial_restrictions: string[] = [];

  if (api_available === false) {
    blockers.push({
      description:
        registryEntry.source_kind === "cli_or_library"
          ? "Local CLI/library architecture without a hosted multi-tenant SaaS REST API."
          : "No public developer API confirmed in official sources.",
      kind: "documented",
      evidence_url: fetchedDocs[0]?.original_url ?? null,
    });
  }

  if (api_access_model === "gated") {
    blockers.push({
      description: "API access requires manual vendor approval, partner review, or enterprise agreement.",
      kind: "documented",
      evidence_url: fetchedDocs.find((d) => HARD_GATED_REGEX.test(d.full_text))?.original_url ?? null,
    });
    commercial_restrictions.push("Gated partner/enterprise API onboarding");
  } else if (api_access_model === "mixed") {
    commercial_restrictions.push("Higher API capabilities or app publishing require paid plans or review");
  }

  if (api_rate_limits) {
    blockers.push({
      description: `Documented rate limiting / quota rules: ${api_rate_limits.slice(0, 140)}`,
      kind: "documented",
      evidence_url: fallbackTechDocs.find((d) => RATE_LIMIT_REGEX.test(d.full_text))?.original_url ?? null,
    });
  }

  if (authentication_methods.includes("OAuth 2.0") && fetchedDocs.some((d) => /\bapp review\b|\bscopes?\b/i.test(d.full_text))) {
    blockers.push({
      description: "OAuth 2.0 scope management and potential marketplace/app review overhead.",
      kind: "engineering_concern",
      evidence_url: null,
    });
  }

  if (blockedDocs.length > 0) {
    const statuses = Array.from(
      new Set(
        blockedDocs.map((d) =>
          d.http_status ? `HTTP ${d.http_status}` : d.status
        )
      )
    ).join(", ");
    blockers.push({
      description: `Automated retrieval encountered ${statuses} on ${blockedDocs.length} source URL(s); manual verification required (does not imply absence of API).`,
      kind: "engineering_concern",
      evidence_url: null,
    });
  }

  if (fetchedDocs.length === 0) {
    blockers.push({
      description: "Zero curated documentation URLs returned readable text over HTTP; human inspection required.",
      kind: "engineering_concern",
      evidence_url: null,
    });
  }

  // 8. Conservative 8-Dimension Scoring (never inflate when docs are missing/blocked)
  const authScore =
    authentication_methods.includes("API Key") || authentication_methods.includes("Bearer Token / PAT")
      ? 5
      : authentication_methods.includes("OAuth 2.0")
      ? 4
      : authentication_methods.length > 0
      ? 3
      : 1;

  const apiAccessibilityScore =
    api_available === false
      ? 1
      : api_available === null
      ? 1
      : api_access_model === "self_serve"
      ? 5
      : api_access_model === "mixed"
      ? 3
      : api_access_model === "gated"
      ? 1
      : 2;

  const docQualityScore =
    api_doc_quality === "high"
      ? 5
      : api_doc_quality === "moderate"
      ? 4
      : api_doc_quality === "limited"
      ? 2
      : 1;

  const completenessScore =
    api_available === false
      ? 1
      : api_available === null
      ? 1
      : api_surface.length >= 3 && api_types.includes("Webhooks")
      ? 5
      : api_surface.length >= 2 || api_types.length >= 2
      ? 4
      : 3;

  const accessRestrictionsScore =
    api_access_model === "self_serve"
      ? 5
      : api_access_model === "mixed"
      ? 3
      : api_access_model === "gated"
      ? 1
      : 2;

  const ecosystemScore =
    api_types.includes("Official SDK") || mcp_status === "official"
      ? 5
      : api_types.includes("REST") || api_types.includes("GraphQL")
      ? 4
      : fetchedDocs.length > 0
      ? 2
      : 1;

  const mcpScore =
    mcp_status === "official"
      ? 5
      : mcp_status === "third_party"
      ? 3
      : 1;

  const operationalScore =
    api_rate_limits && api_available === true
      ? 4
      : api_available === true && blockedDocs.length === 0
      ? 4
      : api_available === true
      ? 3
      : 2;

  const dimensions = {
    authentication_complexity: authScore,
    api_accessibility: apiAccessibilityScore,
    documentation_quality: docQualityScore,
    api_completeness: completenessScore,
    access_restrictions: accessRestrictionsScore,
    developer_ecosystem: ecosystemScore,
    mcp_availability: mcpScore,
    operational_constraints: operationalScore,
  };

  const scorePreview = computeBuildabilityScore(dimensions, api_available, api_access_model);

  const buildability_reasoning =
    fetchedDocs.length === 0
      ? `Buildability set to "unknown" because 0 of ${retrievedDocs.length} curated documentation URLs returned readable content over HTTP.`
      : scorePreview.explanation;

  // 9. Evidence array: strictly built from fetchedDocs with real verbatim excerpts
  const evidence: ExtractedAppPayload["evidence"] = fetchedDocs
    .filter((d) => isValidHttpUrl(d.resolved_url ?? d.original_url) && d.excerpt.trim().length >= 12)
    .map((d) => {
      const claims = docSupportingClaims.get(d.original_url);
      return {
        source_title: d.title,
        url: d.resolved_url ?? d.original_url,
        source_type: d.source_type,
        claim_supported:
          claims && claims.length > 0
            ? `Supports: ${claims.join("; ")}`
            : `Retrieved primary ${d.source_type.replace("_", " ")} source (${d.http_status ?? 200} OK)`,
        excerpt: d.excerpt.slice(0, 420),
        researched_at: d.retrieved_at,
      };
    });

  // 10. Conservative confidence calculation based solely on real retrieval & evidence coverage
  const totalSources = Math.max(1, retrievedDocs.length);
  const fetchRatio = fetchedDocs.length / totalSources;
  let confidence = Math.round(fetchRatio * 55);
  if (api_available !== null) confidence += 15;
  if (authentication_methods.length > 0) confidence += 15;
  if (api_access_model !== "unknown") confidence += 10;
  if (mcp_status === "official" || mcp_status === "third_party") confidence += 5;
  if (fetchedDocs.length === 0) confidence = Math.min(confidence, 15);
  confidence = Math.max(5, Math.min(98, confidence));

  const allowedUrls = [
    ...retrievedDocs.map((d) => d.original_url),
    ...retrievedDocs.map((d) => d.resolved_url).filter((u): u is string => Boolean(u)),
  ];

  const payload = {
    official_website: isValidHttpUrl(registryEntry.official_website)
      ? registryEntry.official_website
      : null,
    description: buildDescriptionFromDocs(appName, fetchedDocs),
    primary_purpose: buildPrimaryPurpose(appName, category, fetchedDocs),
    use_cases,
    authentication_methods,
    authentication_evidence,
    api_available,
    api_types,
    api_surface,
    api_access_model,
    access_model_reasoning,
    access_restrictions,
    api_rate_limits,
    api_doc_quality,
    mcp_status,
    mcp_server_name,
    mcp_repository_url: isValidHttpUrl(mcp_repository_url) ? mcp_repository_url : null,
    mcp_ownership,
    mcp_capabilities,
    mcp_maintained,
    mcp_limitations,
    buildability: scorePreview.mapped_verdict,
    buildability_reasoning,
    dimensions,
    blockers,
    commercial_restrictions,
    evidence,
    confidence,
    notes,
  };

  return validateAndSanitizeExtraction(payload, allowedUrls);
}
