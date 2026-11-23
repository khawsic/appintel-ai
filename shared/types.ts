export type AppCategory =
  | "CRM / Sales"
  | "Support / Helpdesk"
  | "Communications / Messaging"
  | "Marketing / Ads / Email / Social"
  | "Ecommerce"
  | "Data / SEO / Scraping"
  | "Developer / Infrastructure / Data"
  | "Productivity / Project Management"
  | "Finance / Fintech"
  | "AI / Research / Media-native";

export type ApiAccessModel = "self_serve" | "gated" | "mixed" | "unknown";

export type McpStatus = "official" | "third_party" | "unavailable" | "unknown";

export type BuildabilityVerdict = "easy" | "moderate" | "difficult" | "unknown";

export type ResearchStatus = "pending" | "running" | "completed" | "failed";

export type VerificationStatus = "unverified" | "verified" | "needs_review";

export type EvidenceVerificationStatus = "verified" | "needs_review" | "unsupported";

export type ClaimVerificationResult =
  | "verified"
  | "corrected"
  | "needs_human_review"
  | "unsupported"
  | "not_verifiable";

export type DocQuality = "high" | "moderate" | "limited" | "unavailable" | "unknown";

export interface EvidenceRecord {
  id: string;
  source_title: string;
  url: string;
  source_type:
    | "official_docs"
    | "api_reference"
    | "auth_docs"
    | "pricing_access"
    | "official_mcp"
    | "github_repo"
    | "technical_source";
  claim_supported: string;
  excerpt?: string;
  researched_at: string;
  verification_status: EvidenceVerificationStatus;
}

export interface BlockerItem {
  description: string;
  kind: "documented" | "engineering_concern";
  evidence_url?: string;
}

export interface BuildabilityDimensions {
  authentication_complexity: number; // 1 (hardest) to 5 (easiest)
  api_accessibility: number;
  documentation_quality: number;
  api_completeness: number;
  access_restrictions: number;
  developer_ecosystem: number;
  mcp_availability: number;
  operational_constraints: number;
}

export interface BuildabilityScore {
  dimensions: BuildabilityDimensions;
  weighted_score: number; // 1.00 - 5.00
  mapped_verdict: BuildabilityVerdict;
  explanation: string;
}

export interface ClaimVerificationItem {
  id: string;
  claim_key:
    | "authentication_methods"
    | "api_available"
    | "api_types"
    | "api_access_model"
    | "mcp_status"
    | "buildability"
    | "technical_restrictions"
    | "evidence_urls";
  claim_label: string;
  original_ai_finding: string;
  evidence_url: string | null;
  evidence_excerpt: string | null;
  verification_result: ClaimVerificationResult;
  corrected_finding: string | null;
  explanation: string;
  human_override?: boolean;
  reviewed_at?: string;
}

export interface FirstPassSnapshot {
  captured_at: string;
  authentication_methods: string[];
  api_available: boolean | null;
  api_types: string[];
  api_access_model: ApiAccessModel;
  mcp_status: McpStatus;
  buildability: BuildabilityVerdict;
  buildability_reasoning: string;
  blockers_summary: string[];
}

export interface ComposioIntegrationCheck {
  checked: boolean;
  mode: "live_api" | "not_configured" | "error";
  in_catalog: boolean | null;
  toolkit_slug: string | null;
  note: string;
  checked_at: string | null;
}

export interface AppRecord {
  id: string;
  index: number;
  app_name: string;
  category: AppCategory;
  official_website: string | null;
  description: string | null;
  primary_purpose: string | null;
  use_cases: string[];
  authentication_methods: string[];
  authentication_evidence: string[];
  api_available: boolean | null;
  api_types: string[];
  api_surface: string[];
  api_access_model: ApiAccessModel;
  access_model_reasoning: string | null;
  access_restrictions: string[];
  api_rate_limits: string | null;
  api_doc_quality: DocQuality;
  mcp_status: McpStatus;
  mcp_server_name: string | null;
  mcp_repository_url: string | null;
  mcp_ownership: "official" | "third_party" | "none" | "unknown";
  mcp_capabilities: string[];
  mcp_maintained: boolean | null;
  mcp_limitations: string | null;
  buildability: BuildabilityVerdict;
  buildability_reasoning: string | null;
  buildability_score: BuildabilityScore | null;
  blockers: BlockerItem[];
  commercial_restrictions: string[];
  evidence: EvidenceRecord[];
  research_status: ResearchStatus;
  verification_status: VerificationStatus;
  verification_items: ClaimVerificationItem[];
  first_pass_snapshot: FirstPassSnapshot | null;
  composio_check: ComposioIntegrationCheck | null;
  confidence: number | null;
  last_researched: string | null;
  error_message: string | null;
  notes: string[];
}

export type PipelineStage =
  | "idle"
  | "source_registry"
  | "doc_retrieval"
  | "evidence_extraction"
  | "evidence_validation"
  | "evidence_verification"
  | "saving";

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  app_id: string;
  app_name: string;
  stage: PipelineStage | "batch" | "human_review" | "error";
  status: "info" | "success" | "warning" | "error";
  message: string;
}

export interface SampleCheckRecord {
  id: string;
  app_id: string;
  app_name: string;
  category: AppCategory;
  checked_at: string;
  reviewer: string;
  fields_checked: string[];
  first_pass_reported: string;
  official_docs_stated: string;
  errors_detected: string;
  corrections_applied: string;
  remaining_uncertainty: string;
  outcome: "accurate" | "corrected" | "uncertain";
}

export interface BatchJobState {
  active: boolean;
  mode: "single" | "category" | "all" | "resume" | "retry_failed" | null;
  target_label: string | null;
  total_queued: number;
  processed: number;
  succeeded: number;
  failed: number;
  current_app_id: string | null;
  current_app_name: string | null;
  current_stage: PipelineStage;
  cancel_requested: boolean;
  started_at: string | null;
  finished_at: string | null;
}

export interface AnalyticsSummary {
  totals: {
    total_apps: 100;
    researched: number;
    pending: number;
    running: number;
    failed: number;
    verified: number;
    needs_review: number;
    unverified: number;
    completion_pct: number;
  };
  distributions: {
    authentication: Array<{ label: string; count: number; pct: number }>;
    api_availability: Array<{ label: string; count: number; pct: number }>;
    access_model: Array<{ label: string; count: number; pct: number }>;
    mcp_status: Array<{ label: string; count: number; pct: number }>;
    buildability: Array<{ label: string; count: number; pct: number }>;
    doc_quality: Array<{ label: string; count: number; pct: number }>;
  };
  category_metrics: Array<{
    category: AppCategory;
    total: number;
    researched: number;
    verified: number;
    needs_review: number;
    failed: number;
    self_serve_count: number;
    gated_count: number;
    mixed_count: number;
    easy_count: number;
    moderate_count: number;
    difficult_count: number;
    official_mcp_count: number;
    third_party_mcp_count: number;
    avg_buildability_score: number | null;
  }>;
  top_blockers: Array<{
    blocker: string;
    count: number;
    kind: "documented" | "engineering_concern";
  }>;
  clusters: Array<{
    id: string;
    name: string;
    description: string;
    apps: Array<{ id: string; app_name: string; category: AppCategory; buildability: BuildabilityVerdict; api_access_model: ApiAccessModel; mcp_status: McpStatus }>;
  }>;
  accuracy: {
    researched_apps_with_verification: number;
    total_claims_checked: number;
    claims_verified_first_pass: number;
    claims_corrected: number;
    claims_unsupported: number;
    claims_needs_human_review: number;
    claims_not_verifiable: number;
    first_pass_accuracy_pct: number | null;
    post_verification_accuracy_pct: number | null;
    sample_checks_count: number;
  };
  composio_recommendations: {
    evidence_backed_findings: string[];
    strategic_recommendations: string[];
    hypotheses_requiring_followup: string[];
  };
}
