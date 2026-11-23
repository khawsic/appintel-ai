import { useState } from "react";
import {
  ExternalLink,
  Play,
  RefreshCw,
  X,
} from "lucide-react";
import { AppRecord, ClaimVerificationResult } from "../../shared/types";
import {
  formatAccessModel,
  formatBuildability,
  formatMcpStatus,
  formatResearchStatus,
  formatVerificationStatus,
  StatusIndicator,
} from "./StatusLabel";

interface AppDetailPanelProps {
  app: AppRecord;
  batchActive: boolean;
  onClose: () => void;
  onRunResearch: (appId: string) => Promise<void>;
  onAddNote: (appId: string, note: string) => Promise<void>;
  onOverrideClaim: (
    appId: string,
    claimId: string,
    payload: {
      verification_result: ClaimVerificationResult;
      corrected_finding?: string | null;
      explanation?: string;
    }
  ) => Promise<void>;
}

const DIMENSION_LABELS: Array<{
  key: keyof NonNullable<AppRecord["buildability_score"]>["dimensions"];
  label: string;
  weight: string;
}> = [
  { key: "api_accessibility", label: "API Accessibility", weight: "22%" },
  { key: "authentication_complexity", label: "Auth Simplicity", weight: "16%" },
  { key: "documentation_quality", label: "Documentation Quality", weight: "14%" },
  { key: "api_completeness", label: "API Completeness", weight: "14%" },
  { key: "access_restrictions", label: "Access Openness", weight: "14%" },
  { key: "mcp_availability", label: "MCP Availability", weight: "8%" },
  { key: "developer_ecosystem", label: "Developer Ecosystem", weight: "6%" },
  { key: "operational_constraints", label: "Operational Predictability", weight: "6%" },
];

export function AppDetailPanel({
  app,
  batchActive,
  onClose,
  onRunResearch,
  onAddNote,
  onOverrideClaim,
}: AppDetailPanelProps) {
  const [noteInput, setNoteInput] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [runningSingle, setRunningSingle] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [overrideResult, setOverrideResult] =
    useState<ClaimVerificationResult>("verified");
  const [overrideCorrection, setOverrideCorrection] = useState("");
  const [overrideExplanation, setOverrideExplanation] = useState("");
  const [savingClaim, setSavingClaim] = useState(false);

  const resStatus = formatResearchStatus(app.research_status);
  const verStatus = formatVerificationStatus(app.verification_status);
  const buildStatus = formatBuildability(app.buildability);

  const handleRun = async () => {
    setRunError(null);
    setRunningSingle(true);
    try {
      await onRunResearch(app.id);
    } catch (err: unknown) {
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningSingle(false);
    }
  };

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    setSubmittingNote(true);
    try {
      await onAddNote(app.id, noteInput.trim());
      setNoteInput("");
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleClaimSave = async (claimId: string) => {
    setSavingClaim(true);
    try {
      await onOverrideClaim(app.id, claimId, {
        verification_result: overrideResult,
        corrected_finding: overrideCorrection.trim() || null,
        explanation: overrideExplanation.trim() || undefined,
      });
      setEditingClaimId(null);
    } finally {
      setSavingClaim(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-[#172033]/25"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="relative z-10 w-full max-w-[780px] h-full bg-[#FFFFFF] border-l border-[#E5E7EB] flex flex-col"
        aria-label={`${app.app_name} details`}
      >
        {/* Top Attio-style Record Header */}
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
              <span className="font-mono tabular-nums">
                #{String(app.index).padStart(3, "0")}
              </span>
              <span aria-hidden="true">·</span>
              <span>{app.category}</span>
              {app.last_researched && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    Updated {new Date(app.last_researched).toLocaleDateString()}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-semibold text-[#172033] tracking-tight">
                {app.app_name}
              </h2>
              {app.official_website && (
                <a
                  href={app.official_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#635BFF] hover:underline"
                >
                  <span>{app.official_website.replace(/^https?:\/\//, "")}</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              )}
            </div>
            <div className="mt-2 flex items-center gap-4 flex-wrap">
              <StatusIndicator
                label={resStatus.label}
                tone={resStatus.tone}
                spinning={resStatus.spinning}
              />
              <StatusIndicator label={verStatus.label} tone={verStatus.tone} />
              <StatusIndicator
                label={`Buildability: ${buildStatus.label}`}
                tone={buildStatus.tone}
              />
              {app.confidence !== null && (
                <span className="text-xs text-[#64748B] font-mono tabular-nums">
                  Confidence: {app.confidence}%
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={batchActive || runningSingle}
              onClick={handleRun}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#635BFF] text-white hover:bg-[#5249F5] disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors"
            >
              {app.research_status === "completed" ? (
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>
                {runningSingle
                  ? "Running..."
                  : app.research_status === "completed"
                  ? "Re-run Research"
                  : "Run Research"}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md border border-[#E5E7EB] text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]"
              aria-label="Close application detail"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {(runError || app.error_message) && (
            <div className="p-3.5 rounded-md border border-[#FECACA] bg-[#FEF2F2] text-xs text-[#DC2626] space-y-1">
              <div>
                <strong>Last Research Error:</strong> {runError ?? app.error_message}
              </div>
            </div>
          )}

          {app.research_status === "pending" || (!app.description && app.research_status === "failed") ? (
            <div className="p-6 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] text-center space-y-2">
              <p className="text-sm font-medium text-[#172033]">
                {app.research_status === "failed"
                  ? "Research Failed Before Completion"
                  : "Not Researched Yet"}
              </p>
              <p className="text-xs text-[#64748B] max-w-md mx-auto">
                {app.research_status === "failed"
                  ? `No structured findings were saved for ${app.app_name} because the previous run failed. Resolve the error above and click Re-run Research.`
                  : `${app.app_name} is initialized in the canonical 100-app registry as Pending. Click Run Research above to discover official documentation, extract structured capabilities, and verify claims.`}
              </p>
            </div>
          ) : (
            <>
              {/* 1. Overview & Properties */}
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                  <h3 className="text-sm font-semibold text-[#172033]">
                    Application Overview
                  </h3>
                  <span className="text-[11px] text-[#64748B]">
                    Structured Record
                  </span>
                </div>
                <p className="text-sm text-[#172033] leading-relaxed">
                  {app.description ?? "No description extracted."}
                </p>
                {app.primary_purpose && (
                  <p className="text-xs text-[#64748B]">
                    <strong className="text-[#172033] font-medium">
                      Primary Purpose:
                    </strong>{" "}
                    {app.primary_purpose}
                  </p>
                )}
                {app.use_cases.length > 0 && (
                  <div className="text-xs text-[#64748B]">
                    <strong className="text-[#172033] font-medium">
                      Use Cases:
                    </strong>{" "}
                    {app.use_cases.join(" · ")}
                  </div>
                )}
              </section>

              {/* 2. Authentication & API Properties */}
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                  <h3 className="text-sm font-semibold text-[#172033]">
                    Authentication & API Surface
                  </h3>
                  <span className="text-[11px] text-[#64748B]">
                    Evidence-checked properties
                  </span>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
                  <div>
                    <dt className="text-[#64748B] mb-0.5">
                      Authentication Methods
                    </dt>
                    <dd className="text-[#172033] font-medium">
                      {app.authentication_methods.length > 0
                        ? app.authentication_methods.join(" · ")
                        : "Unknown / Not documented"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#64748B] mb-0.5">API Availability</dt>
                    <dd className="text-[#172033] font-medium">
                      {app.api_available === true
                        ? "Public Developer API Available"
                        : app.api_available === false
                        ? "No Public Developer API"
                        : "Unknown"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#64748B] mb-0.5">API Access Model</dt>
                    <dd className="text-[#172033] font-medium">
                      {formatAccessModel(app.api_access_model)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#64748B] mb-0.5">API Types</dt>
                    <dd className="text-[#172033] font-medium">
                      {app.api_types.length > 0
                        ? app.api_types.join(" · ")
                        : "Unknown"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#64748B] mb-0.5">
                      Documentation Quality
                    </dt>
                    <dd className="text-[#172033] font-medium capitalize">
                      {app.api_doc_quality}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#64748B] mb-0.5">Rate Limits</dt>
                    <dd className="text-[#172033]">
                      {app.api_rate_limits || "Not specified in retrieved docs"}
                    </dd>
                  </div>
                </dl>
                {app.access_model_reasoning && (
                  <p className="text-xs text-[#64748B] bg-[#F8FAFC] border border-[#E5E7EB] rounded-md p-3">
                    <strong className="text-[#172033]">
                      Access Classification Reasoning:
                    </strong>{" "}
                    {app.access_model_reasoning}
                  </p>
                )}
                {app.api_surface.length > 0 && (
                  <div className="text-xs text-[#64748B]">
                    <strong className="text-[#172033] font-medium">
                      Core Resources & Operations:
                    </strong>{" "}
                    {app.api_surface.join(" · ")}
                  </div>
                )}
                {app.authentication_evidence.length > 0 && (
                  <div className="text-xs text-[#64748B]">
                    <strong className="text-[#172033] font-medium">
                      Authentication Details:
                    </strong>{" "}
                    {app.authentication_evidence.join(" · ")}
                  </div>
                )}
                {app.access_restrictions.length > 0 && (
                  <div className="text-xs text-[#64748B]">
                    <strong className="text-[#172033] font-medium">
                      Access Restrictions:
                    </strong>{" "}
                    {app.access_restrictions.join(" · ")}
                  </div>
                )}
              </section>

              {/* 3. MCP Intelligence */}
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                  <h3 className="text-sm font-semibold text-[#172033]">
                    MCP Support
                  </h3>
                  <span className="text-[11px] text-[#64748B]">
                    Official vs. Third-Party Distinction
                  </span>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
                  <div>
                    <dt className="text-[#64748B] mb-0.5">MCP Status</dt>
                    <dd className="text-[#172033] font-medium">
                      {formatMcpStatus(app.mcp_status)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#64748B] mb-0.5">Ownership</dt>
                    <dd className="text-[#172033] font-medium capitalize">
                      {app.mcp_ownership.replace("_", " ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#64748B] mb-0.5">MCP Server Name</dt>
                    <dd className="text-[#172033] font-mono">
                      {app.mcp_server_name ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#64748B] mb-0.5">Maintained</dt>
                    <dd className="text-[#172033]">
                      {app.mcp_maintained === true
                        ? "Yes"
                        : app.mcp_maintained === false
                        ? "No / Stale"
                        : "Unknown"}
                    </dd>
                  </div>
                </dl>
                {app.mcp_repository_url && (
                  <div className="text-xs">
                    <span className="text-[#64748B]">Repository / Docs: </span>
                    <a
                      href={app.mcp_repository_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#635BFF] hover:underline font-mono break-all"
                    >
                      {app.mcp_repository_url}
                    </a>
                  </div>
                )}
                {app.mcp_capabilities.length > 0 && (
                  <div className="text-xs text-[#64748B]">
                    <strong className="text-[#172033] font-medium">
                      Documented Tools:
                    </strong>{" "}
                    {app.mcp_capabilities.join(" · ")}
                  </div>
                )}
                {app.mcp_limitations && (
                  <p className="text-xs text-[#64748B]">
                    <strong className="text-[#172033] font-medium">
                      Limitations:
                    </strong>{" "}
                    {app.mcp_limitations}
                  </p>
                )}
              </section>

              {/* 4. Buildability Verdict & 8-Dimension Breakdown */}
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                  <h3 className="text-sm font-semibold text-[#172033]">
                    Buildability Assessment
                  </h3>
                  <span className="text-[11px] text-[#64748B]">
                    Model Assessment & Rubric Score
                  </span>
                </div>
                {app.buildability_reasoning && (
                  <p className="text-xs text-[#172033] leading-relaxed">
                    {app.buildability_reasoning}
                  </p>
                )}
                {app.buildability_score && (
                  <div className="border border-[#E5E7EB] rounded-md p-4 bg-[#F8FAFC] space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#172033]">
                        Weighted Feasibility Score
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-[#635BFF]">
                        {app.buildability_score.weighted_score.toFixed(2)} / 5.00
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {DIMENSION_LABELS.map((dim) => {
                        const val = app.buildability_score!.dimensions[dim.key];
                        return (
                          <div key={dim.key} className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-[#64748B]">
                                {dim.label} ({dim.weight})
                              </span>
                              <span className="font-mono tabular-nums text-[#172033]">
                                {val}/5
                              </span>
                            </div>
                            <div className="w-full h-1 bg-[#E5E7EB] rounded-sm overflow-hidden">
                              <div
                                className="h-full bg-[#172033]"
                                style={{ width: `${(val / 5) * 100}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              {/* 5. Technical & Commercial Blockers */}
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                  <h3 className="text-sm font-semibold text-[#172033]">
                    Blockers & Restrictions
                  </h3>
                  <span className="text-[11px] text-[#64748B]">
                    Documented vs. Engineering Concerns
                  </span>
                </div>
                {app.blockers.length === 0 ? (
                  <p className="text-xs text-[#64748B]">
                    No major technical blockers recorded.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {app.blockers.map((b, idx) => (
                      <li
                        key={idx}
                        className="text-xs flex items-start justify-between gap-3 py-1.5 border-b border-[#F1F5F9] last:border-b-0"
                      >
                        <span className="text-[#172033]">{b.description}</span>
                        <span className="text-[11px] text-[#64748B] whitespace-nowrap shrink-0 font-mono">
                          {b.kind === "documented"
                            ? "Documented"
                            : "Concern"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {app.commercial_restrictions.length > 0 && (
                  <div className="text-xs text-[#64748B]">
                    <strong className="text-[#172033] font-medium">
                      Commercial Restrictions:
                    </strong>{" "}
                    {app.commercial_restrictions.join(" · ")}
                  </div>
                )}
              </section>

              {/* 6. Evidence & Source URLs */}
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                  <h3 className="text-sm font-semibold text-[#172033]">
                    Traceable Evidence ({app.evidence.length})
                  </h3>
                  <span className="text-[11px] text-[#64748B]">
                    Verified Primary Sources
                  </span>
                </div>
                {app.evidence.length === 0 ? (
                  <p className="text-xs text-[#64748B]">
                    No evidence URLs attached.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {app.evidence.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-3 rounded-md border border-[#E5E7EB] bg-[#FFFFFF] space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-[#635BFF] hover:underline flex items-center gap-1 min-w-0 truncate"
                          >
                            <span className="truncate">{ev.source_title}</span>
                            <ExternalLink
                              className="w-3 h-3 shrink-0"
                              aria-hidden="true"
                            />
                          </a>
                          <span className="text-[11px] text-[#64748B] font-mono shrink-0">
                            {ev.source_type} · {ev.verification_status}
                          </span>
                        </div>
                        <p className="text-xs text-[#172033]">
                          {ev.claim_supported}
                        </p>
                        {ev.excerpt && (
                          <blockquote className="text-[11px] text-[#475569] bg-[#F8FAFC] border-l-2 border-[#CBD5E1] pl-2.5 py-1 italic line-clamp-3">
                            &ldquo;{ev.excerpt}&rdquo;
                          </blockquote>
                        )}
                        <div className="text-[11px] text-[#64748B] font-mono truncate">
                          {ev.url}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 7. Verification Audit History */}
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                  <h3 className="text-sm font-semibold text-[#172033]">
                    Verification Loop Audit ({app.verification_items.length} Claims)
                  </h3>
                  <span className="text-[11px] text-[#64748B]">
                    First-Pass vs. Verified
                  </span>
                </div>
                {app.verification_items.length === 0 ? (
                  <p className="text-xs text-[#64748B]">
                    No claim verification history recorded yet.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {app.verification_items.map((item) => {
                      const isEditing = editingClaimId === item.id;
                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-[#172033]">
                              {item.claim_label}
                            </span>
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`font-mono text-[11px] ${
                                  item.verification_result === "verified"
                                    ? "text-[#15803D]"
                                    : item.verification_result === "corrected"
                                    ? "text-[#635BFF]"
                                    : item.verification_result === "unsupported"
                                    ? "text-[#DC2626]"
                                    : "text-[#D97706]"
                                }`}
                              >
                                {item.verification_result}
                                {item.human_override ? " (human)" : ""}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isEditing) {
                                    setEditingClaimId(null);
                                  } else {
                                    setEditingClaimId(item.id);
                                    setOverrideResult(item.verification_result);
                                    setOverrideCorrection(
                                      item.corrected_finding ?? ""
                                    );
                                    setOverrideExplanation(item.explanation);
                                  }
                                }}
                                className="text-[11px] text-[#635BFF] hover:underline"
                              >
                                {isEditing ? "Cancel" : "Review"}
                              </button>
                            </div>
                          </div>
                          <div className="text-[#64748B]">
                            <strong className="text-[#172033] font-normal">
                              First-pass extracted:
                            </strong>{" "}
                            {item.original_ai_finding}
                          </div>
                          {item.corrected_finding && (
                            <div className="text-[#635BFF]">
                              <strong>Corrected:</strong> {item.corrected_finding}
                            </div>
                          )}
                          <div className="text-[#64748B]">{item.explanation}</div>

                          {isEditing && (
                            <div className="pt-2 mt-2 border-t border-[#E5E7EB] space-y-2">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <select
                                  value={overrideResult}
                                  onChange={(e) =>
                                    setOverrideResult(
                                      e.target.value as ClaimVerificationResult
                                    )
                                  }
                                  className="px-2 py-1.5 text-xs bg-white border border-[#E5E7EB] rounded-md"
                                >
                                  <option value="verified">verified</option>
                                  <option value="corrected">corrected</option>
                                  <option value="needs_human_review">
                                    needs_human_review
                                  </option>
                                  <option value="unsupported">unsupported</option>
                                  <option value="not_verifiable">
                                    not_verifiable
                                  </option>
                                </select>
                                <input
                                  type="text"
                                  value={overrideCorrection}
                                  onChange={(e) =>
                                    setOverrideCorrection(e.target.value)
                                  }
                                  placeholder="Corrected value (optional)"
                                  className="px-2 py-1.5 text-xs bg-white border border-[#E5E7EB] rounded-md"
                                />
                              </div>
                              <input
                                type="text"
                                value={overrideExplanation}
                                onChange={(e) =>
                                  setOverrideExplanation(e.target.value)
                                }
                                placeholder="Reviewer verification explanation"
                                className="w-full px-2 py-1.5 text-xs bg-white border border-[#E5E7EB] rounded-md"
                              />
                              <button
                                type="button"
                                disabled={savingClaim}
                                onClick={() => handleClaimSave(item.id)}
                                className="px-3 py-1.5 text-xs font-medium bg-[#172033] text-white rounded-md hover:bg-[#172033]/90 disabled:opacity-50"
                              >
                                {savingClaim ? "Saving..." : "Save Human Review"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* 8. Composio Catalog Check & Reviewer Notes */}
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                  <h3 className="text-sm font-semibold text-[#172033]">
                    Composio Probe & Notes
                  </h3>
                </div>
                {app.composio_check && (
                  <p className="text-xs text-[#64748B]">
                    <strong className="text-[#172033]">Composio API Probe:</strong>{" "}
                    {app.composio_check.note}
                  </p>
                )}
                <form onSubmit={handleNoteSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Add human reviewer note..."
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#635BFF]"
                  />
                  <button
                    type="submit"
                    disabled={submittingNote || !noteInput.trim()}
                    className="px-3 py-1.5 text-xs font-medium bg-[#172033] text-white rounded-md hover:bg-[#172033]/90 disabled:opacity-50 whitespace-nowrap"
                  >
                    Add Note
                  </button>
                </form>
                {app.notes.length > 0 && (
                  <ul className="space-y-1 text-xs text-[#64748B]">
                    {app.notes.map((n, i) => (
                      <li key={i} className="py-1 border-b border-[#F1F5F9]">
                        {n}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
