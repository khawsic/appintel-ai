import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  Play,
  RotateCcw,
  Square,
  Trash2,
} from "lucide-react";
import {
  ActivityLogEntry,
  AppCategory,
  AppRecord,
  BatchJobState,
  PipelineStage,
} from "../../shared/types";
import { HealthStatus } from "../api";
import {
  formatAccessModel,
  formatBuildability,
  formatMcpStatus,
  StatusIndicator,
} from "../components/StatusLabel";

interface ResearchAgentPageProps {
  apps: AppRecord[];
  batch: BatchJobState;
  logs: ActivityLogEntry[];
  health: HealthStatus | null;
  onStartResearch: (payload: {
    mode: "single" | "category" | "all" | "resume" | "retry_failed";
    appId?: string;
    category?: AppCategory;
  }) => Promise<void>;
  onCancelBatch: () => Promise<void>;
  onResetDataset: () => Promise<void>;
  onClearLogs: () => Promise<void>;
  onSelectApp: (app: AppRecord) => void;
}

const PIPELINE_STAGES: Array<{ id: PipelineStage; label: string }> = [
  { id: "source_discovery", label: "Source Discovery" },
  { id: "doc_retrieval", label: "Doc Retrieval" },
  { id: "gemini_extraction", label: "Gemini Extraction" },
  { id: "schema_validation", label: "Schema Validation" },
  { id: "evidence_verification", label: "Verification Loop" },
  { id: "saving", label: "Storage" },
];

export function ResearchAgentPage({
  apps,
  batch,
  logs,
  health,
  onStartResearch,
  onCancelBatch,
  onResetDataset,
  onClearLogs,
  onSelectApp,
}: ResearchAgentPageProps) {
  const [selectedAppId, setSelectedAppId] = useState(apps[0]?.id ?? "");
  const categories = useMemo(
    () => Array.from(new Set(apps.map((a) => a.category))),
    [apps]
  );
  const [selectedCategory, setSelectedCategory] = useState<AppCategory>(
    categories[0] ?? "CRM / Sales"
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const pendingCount = apps.filter((a) => a.research_status === "pending").length;
  const failedCount = apps.filter((a) => a.research_status === "failed").length;
  const completedApps = apps
    .filter((a) => a.research_status === "completed")
    .sort((a, b) =>
      (b.last_researched ?? "").localeCompare(a.last_researched ?? "")
    );
  const latestApp = completedApps[0] ?? null;

  const trigger = async (payload: {
    mode: "single" | "category" | "all" | "resume" | "retry_failed";
    appId?: string;
    category?: AppCategory;
  }) => {
    setActionError(null);
    try {
      await onStartResearch(payload);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const currentStageIdx = PIPELINE_STAGES.findIndex(
    (s) => s.id === batch.current_stage
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#172033] tracking-tight">
            Automated Research Agent
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Execute real-time source discovery, structured Gemini extraction,
            and claim verification across individual apps or batches.
          </p>
        </div>
        {batch.active && (
          <button
            type="button"
            onClick={onCancelBatch}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-[#DC2626] text-white hover:bg-[#B91C1C] whitespace-nowrap shrink-0"
          >
            <Square className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Stop After Current App</span>
          </button>
        )}
      </div>

      {/* Environment Readiness & Composio Probe Notice */}
      {health && (
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <StatusIndicator
              label={
                health.geminiConfigured
                  ? "Gemini Search & Extraction Ready"
                  : "GEMINI_API_KEY Not Configured"
              }
              tone={health.geminiConfigured ? "success" : "error"}
            />
            <span className="text-[#CBD5E1]" aria-hidden="true">
              |
            </span>
            <span className="text-[#64748B]">
              <strong className="text-[#172033] font-medium">
                Composio Probe:
              </strong>{" "}
              {health.composio.status === "connected"
                ? `Connected (${health.composio.catalog_count} toolkits)`
                : health.composio.status === "not_configured"
                ? "Not configured (COMPOSIO_API_KEY unset; core pipeline runs independently)"
                : health.composio.message}
            </span>
          </div>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 rounded-md border border-[#FECACA] bg-[#FEF2F2] text-xs text-[#DC2626] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {!actionError && !batch.active && logs[0]?.status === "error" && (
        <div className="p-3.5 rounded-md border border-[#FECACA] bg-[#FEF2F2] text-xs text-[#DC2626] space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Latest Pipeline Error ({logs[0].app_name})</span>
          </div>
          <p className="break-words">{logs[0].message}</p>
          {(logs[0].message.includes("PERMISSION_DENIED") ||
            logs[0].message.includes("API_KEY_INVALID") ||
            logs[0].message.includes("RESOURCE_EXHAUSTED")) && (
            <p className="text-[#991B1B]">
              Check your Gemini API key or billing tier in{" "}
              <strong>Settings &gt; Secrets</strong>, then click{" "}
              <strong>Retry Failed</strong>.
            </p>
          )}
        </div>
      )}

      {/* Execution Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Single App */}
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[#172033]">
            Single Application
          </h2>
          <p className="text-xs text-[#64748B]">
            Run the full discovery, extraction, and verification pipeline for
            one application.
          </p>
          <div className="flex gap-2">
            <select
              aria-label="Select application"
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-[#E5E7EB] rounded-md text-[#172033]"
            >
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  #{String(a.index).padStart(3, "0")} {a.app_name} (
                  {a.research_status})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={batch.active || !selectedAppId}
              onClick={() => trigger({ mode: "single", appId: selectedAppId })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#635BFF] text-white hover:bg-[#5249F5] disabled:opacity-50 whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Run App</span>
            </button>
          </div>
        </div>

        {/* Category Batch */}
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[#172033]">
            Category Batch (10 Apps)
          </h2>
          <p className="text-xs text-[#64748B]">
            Sequentially research and verify all 10 applications in a category
            with rate limiting.
          </p>
          <div className="flex gap-2">
            <select
              aria-label="Select category"
              value={selectedCategory}
              onChange={(e) =>
                setSelectedCategory(e.target.value as AppCategory)
              }
              className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-[#E5E7EB] rounded-md text-[#172033]"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={batch.active}
              onClick={() =>
                trigger({ mode: "category", category: selectedCategory })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#172033] text-white hover:bg-[#172033]/90 disabled:opacity-50 whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Run Category</span>
            </button>
          </div>
        </div>

        {/* Full & Recovery Actions */}
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[#172033]">
            Full Batch & Recovery
          </h2>
          <p className="text-xs text-[#64748B]">
            {pendingCount} pending · {failedCount} failed ·{" "}
            {100 - pendingCount - failedCount} completed
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={batch.active || pendingCount === 0}
              onClick={() => trigger({ mode: "resume" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#635BFF] text-white hover:bg-[#5249F5] disabled:opacity-50 whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Resume Incomplete ({pendingCount})</span>
            </button>
            <button
              type="button"
              disabled={batch.active || failedCount === 0}
              onClick={() => trigger({ mode: "retry_failed" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[#E5E7EB] text-[#172033] hover:bg-[#F8FAFC] disabled:opacity-50 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Retry Failed ({failedCount})</span>
            </button>
            <button
              type="button"
              disabled={batch.active}
              onClick={() => trigger({ mode: "all" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[#E5E7EB] text-[#172033] hover:bg-[#F8FAFC] disabled:opacity-50 whitespace-nowrap"
            >
              <span>Re-run All 100</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Pipeline Stage Monitor */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#172033]">
              Pipeline Execution Monitor
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              {batch.active
                ? `Processing ${batch.current_app_name ?? "..."} (${batch.target_label})`
                : batch.finished_at
                ? `Last run finished (${batch.succeeded} succeeded, ${batch.failed} failed)`
                : "Ready to execute research"}
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-[#172033]">
            {batch.total_queued > 0
              ? `${batch.processed}/${batch.total_queued} processed`
              : "0 queued"}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-[#F1F5F9] rounded-sm overflow-hidden">
          <div
            className="h-full bg-[#635BFF] transition-all duration-300"
            style={{
              width: `${
                batch.total_queued > 0
                  ? Math.round((batch.processed / batch.total_queued) * 100)
                  : 0
              }%`,
            }}
          />
        </div>

        {/* 6-Stage Stepper */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
          {PIPELINE_STAGES.map((stage, idx) => {
            const isCurrent = batch.active && batch.current_stage === stage.id;
            const isDone = batch.active && currentStageIdx > idx;
            return (
              <div
                key={stage.id}
                className={`px-3 py-2 rounded-md border text-xs ${
                  isCurrent
                    ? "border-[#635BFF] bg-[#F5F3FF] text-[#635BFF] font-medium"
                    : isDone
                    ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]"
                    : "border-[#E5E7EB] bg-[#F8FAFC] text-[#64748B]"
                }`}
              >
                <div className="font-mono text-[10px] mb-0.5">
                  0{idx + 1}
                </div>
                <div className="truncate">{stage.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Latest Extracted Output + Live Activity Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Extracted Record Preview */}
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
            <h2 className="text-sm font-semibold text-[#172033]">
              Latest Researched Record
            </h2>
            {latestApp && (
              <button
                type="button"
                onClick={() => onSelectApp(latestApp)}
                className="text-xs text-[#635BFF] hover:underline"
              >
                Open full record
              </button>
            )}
          </div>

          {!latestApp ? (
            <p className="text-xs text-[#64748B] py-8 text-center">
              Run an application above to inspect extracted properties,
              evidence URLs, and uncertain fields in real time.
            </p>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#172033]">
                  {latestApp.app_name}
                </span>
                <StatusIndicator
                  label={formatBuildability(latestApp.buildability).label}
                  tone={formatBuildability(latestApp.buildability).tone}
                />
              </div>
              <p className="text-[#64748B]">{latestApp.description}</p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-[#64748B]">Auth: </span>
                  <span className="text-[#172033] font-medium">
                    {latestApp.authentication_methods.join(", ") || "Unknown"}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B]">Access: </span>
                  <span className="text-[#172033] font-medium">
                    {formatAccessModel(latestApp.api_access_model)}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B]">MCP: </span>
                  <span className="text-[#172033] font-medium">
                    {formatMcpStatus(latestApp.mcp_status)}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B]">Score: </span>
                  <span className="font-mono text-[#172033] font-medium">
                    {latestApp.buildability_score
                      ? `${latestApp.buildability_score.weighted_score}/5`
                      : "—"}
                  </span>
                </div>
              </div>

              {latestApp.evidence.length > 0 && (
                <div className="pt-2 border-t border-[#E5E7EB] space-y-1">
                  <div className="font-medium text-[#172033]">
                    Evidence Links ({latestApp.evidence.length})
                  </div>
                  {latestApp.evidence.slice(0, 4).map((ev) => (
                    <a
                      key={ev.id}
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[#635BFF] hover:underline truncate"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{ev.source_title}</span>
                    </a>
                  ))}
                </div>
              )}

              {latestApp.verification_items.filter(
                (v) =>
                  v.verification_result === "needs_human_review" ||
                  v.verification_result === "unsupported"
              ).length > 0 && (
                <div className="pt-2 border-t border-[#E5E7EB] text-[#D97706]">
                  <strong>Uncertain / Flagged Fields:</strong>{" "}
                  {latestApp.verification_items
                    .filter(
                      (v) =>
                        v.verification_result === "needs_human_review" ||
                        v.verification_result === "unsupported"
                    )
                    .map((v) => v.claim_label)
                    .join(", ")}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Activity Log */}
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5 flex flex-col">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2 mb-3">
            <h2 className="text-sm font-semibold text-[#172033]">
              Research Activity Log
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClearLogs}
                className="text-xs text-[#64748B] hover:text-[#172033]"
              >
                Clear Log
              </button>
              {!confirmReset ? (
                <button
                  type="button"
                  disabled={batch.active}
                  onClick={() => setConfirmReset(true)}
                  className="text-xs text-[#DC2626] hover:underline disabled:opacity-40"
                >
                  Reset 100 Apps
                </button>
              ) : (
                <span className="inline-flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={async () => {
                      await onResetDataset();
                      setConfirmReset(false);
                    }}
                    className="inline-flex items-center gap-1 text-[#DC2626] font-medium hover:underline"
                  >
                    <Trash2 className="w-3 h-3" aria-hidden="true" />
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="text-[#64748B] hover:text-[#172033]"
                  >
                    Cancel
                  </button>
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 max-h-[340px] overflow-y-auto divide-y divide-[#F1F5F9] font-mono text-[11px]">
            {logs.length === 0 ? (
              <p className="text-[#64748B] font-sans text-xs py-8 text-center">
                Activity logs will stream here as the agent processes
                applications.
              </p>
            ) : (
              logs.slice(0, 60).map((entry) => (
                <div key={entry.id} className="py-2 space-y-0.5">
                  <div className="flex items-center justify-between text-[#64748B]">
                    <span
                      className={
                        entry.status === "error"
                          ? "text-[#DC2626] font-semibold"
                          : entry.status === "warning"
                          ? "text-[#D97706] font-semibold"
                          : entry.status === "success"
                          ? "text-[#15803D] font-semibold"
                          : "text-[#172033] font-semibold"
                      }
                    >
                      [{entry.stage}] {entry.app_name}
                    </span>
                    <span className="tabular-nums">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-[#172033] font-sans text-xs">
                    {entry.message}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
