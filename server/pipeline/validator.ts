import { z } from "zod";

export const ExtractedEvidenceSchema = z.object({
  source_title: z.string().min(1),
  url: z.string().min(1),
  source_type: z.enum([
    "official_docs",
    "api_reference",
    "auth_docs",
    "pricing_access",
    "official_mcp",
    "github_repo",
    "technical_source",
  ]),
  claim_supported: z.string().min(1),
  excerpt: z.string().min(12),
  researched_at: z.string().min(1),
});

export const ExtractedBlockerSchema = z.object({
  description: z.string().min(1),
  kind: z.enum(["documented", "engineering_concern"]),
  evidence_url: z.string().nullable().optional(),
});

export const ExtractedAppSchema = z.object({
  official_website: z.string().nullable(),
  description: z.string().nullable(),
  primary_purpose: z.string().nullable(),
  use_cases: z.array(z.string()),
  authentication_methods: z.array(z.string()),
  authentication_evidence: z.array(z.string()),
  api_available: z.boolean().nullable(),
  api_types: z.array(z.string()),
  api_surface: z.array(z.string()),
  api_access_model: z.enum(["self_serve", "gated", "mixed", "unknown"]),
  access_model_reasoning: z.string().min(1),
  access_restrictions: z.array(z.string()),
  api_rate_limits: z.string().nullable(),
  api_doc_quality: z.enum(["high", "moderate", "limited", "unavailable", "unknown"]),
  mcp_status: z.enum(["official", "third_party", "unavailable", "unknown"]),
  mcp_server_name: z.string().nullable(),
  mcp_repository_url: z.string().nullable(),
  mcp_ownership: z.enum(["official", "third_party", "none", "unknown"]),
  mcp_capabilities: z.array(z.string()),
  mcp_maintained: z.boolean().nullable(),
  mcp_limitations: z.string().nullable(),
  buildability: z.enum(["easy", "moderate", "difficult", "unknown"]),
  buildability_reasoning: z.string().min(1),
  dimensions: z.object({
    authentication_complexity: z.number().min(1).max(5),
    api_accessibility: z.number().min(1).max(5),
    documentation_quality: z.number().min(1).max(5),
    api_completeness: z.number().min(1).max(5),
    access_restrictions: z.number().min(1).max(5),
    developer_ecosystem: z.number().min(1).max(5),
    mcp_availability: z.number().min(1).max(5),
    operational_constraints: z.number().min(1).max(5),
  }),
  blockers: z.array(ExtractedBlockerSchema),
  commercial_restrictions: z.array(z.string()),
  evidence: z.array(ExtractedEvidenceSchema),
  confidence: z.number().min(0).max(100),
  notes: z.array(z.string()),
});

export type ExtractedAppPayload = z.infer<typeof ExtractedAppSchema>;

export function isValidHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateAndSanitizeExtraction(
  rawPayload: unknown,
  allowedSourceUrls: string[]
): ExtractedAppPayload {
  const parsed =
    typeof rawPayload === "string"
      ? (() => {
          try {
            return JSON.parse(rawPayload);
          } catch (err) {
            throw new Error(
              `Invalid JSON returned by extractor: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
        })()
      : rawPayload;

  const result = ExtractedAppSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Schema validation failed: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }

  const data = result.data;
  const allowedSet = new Set(allowedSourceUrls.map((u) => u.trim()));
  const extraNotes = [...data.notes];

  // Validate evidence URLs strictly: must be valid HTTP(S), have non-empty excerpt,
  // and belong to an allowed registry/resolved URL (or same hostname on redirect).
  const validEvidence = data.evidence.filter((e) => {
    if (!isValidHttpUrl(e.url)) {
      extraNotes.push(`Rejected invalid evidence URL: "${e.url}".`);
      return false;
    }
    if (!e.excerpt || e.excerpt.trim().length < 12) {
      extraNotes.push(`Rejected evidence item for ${e.url} due to missing supporting excerpt.`);
      return false;
    }
    if (allowedSet.size > 0 && !allowedSet.has(e.url.trim())) {
      const hostMatch = allowedSourceUrls.some((u) => {
        try {
          return new URL(u).hostname === new URL(e.url).hostname;
        } catch {
          return false;
        }
      });
      if (!hostMatch) {
        extraNotes.push(
          `Rejected ungrounded evidence URL ${e.url} (not present in curated registry or retrieved redirects).`
        );
        return false;
      }
    }
    return true;
  });

  const validBlockers = data.blockers.map((b) => ({
    ...b,
    evidence_url:
      b.evidence_url && isValidHttpUrl(b.evidence_url) ? b.evidence_url : null,
  }));

  return {
    ...data,
    official_website: isValidHttpUrl(data.official_website) ? data.official_website : null,
    mcp_repository_url: isValidHttpUrl(data.mcp_repository_url) ? data.mcp_repository_url : null,
    blockers: validBlockers,
    evidence: validEvidence,
    notes: extraNotes,
  };
}
