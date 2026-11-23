import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, Play } from "lucide-react";
import { ActivityLogEntry, AnalyticsSummary, AppRecord } from "../../shared/types";
import {
  formatAccessModel,
  formatBuildability,
  formatMcpStatus,
  formatVerificationStatus,
  StatusIndicator,
} from "../components/StatusLabel";
import { NavPage } from "../components/Sidebar";

interface OverviewPageProps {
  analytics: AnalyticsSummary;
  apps: AppRecord[];
  logs: ActivityLogEntry[];
  onSelectApp: (app: AppRecord) => void;
  onNavigate: (page: NavPage) => void;
}

export function OverviewPage({
  analytics,
  apps,
  logs,
  onSelectApp,
  onNavigate,
}: OverviewPageProps) {
  const { totals, distributions, category_metrics } = analytics;
  const researchedApps = apps.filter((a) => a.research_status === "completed");
  const reviewApps = apps.filter((a) => a.verification_status === "needs_review");
  const verifiedHighlights = apps
    .filter((a) => a.research_status === "completed" && a.verification_status === "verified")
    .slice(0, 5);

  const categoryChartData = category_metrics.map((c) => ({
    name: c.category.split(" / ")[0],
    Researched: c.researched,
    Pending: c.total - c.researched,
  }));

  const authChartData = distributions.authentication.slice(0, 6).map((d) => ({
    name: d.label.length > 18 ? `${d.label.slice(0, 16)}…` : d.label,
    Count: d.count,
  }));

  const accessChartData = distributions.access_model.map((d) => ({
    name: formatAccessModel(d.label),
    Count: d.count,
  }));

  const mcpChartData = distributions.mcp_status.map((d) => ({
    name: formatMcpStatus(d.label),
    Count: d.count,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#172033] tracking-tight">
            Ecosystem Overview
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Research smarter. Integrate strategically. Real-time status across 100
            applications in 10 categories.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("agent")}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-[#635BFF] text-white hover:bg-[#5249F5] whitespace-nowrap shrink-0 transition-colors"
        >
          <Play className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Open Research Agent</span>
        </button>
      </div>

      {/* Compact KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-[#E5E7EB] border border-[#E5E7EB] rounded-lg overflow-hidden">
        {[
          { label: "Total Scope", value: totals.total_apps },
          { label: "Researched", value: totals.researched },
          { label: "Verified", value: totals.verified },
          { label: "Needs Review", value: totals.needs_review },
          { label: "Failed", value: totals.failed },
          { label: "Completion", value: `${totals.completion_pct}%` },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[#FFFFFF] px-4 py-3.5">
            <div className="text-xs text-[#64748B]">{kpi.label}</div>
            <div className="text-xl font-semibold text-[#172033] font-mono tabular-nums mt-1">
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State when 0 research executed */}
      {researchedApps.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-8 text-center space-y-3">
          <h2 className="text-base font-semibold text-[#172033]">
            100 Applications Initialized as Pending
          </h2>
          <p className="text-sm text-[#64748B] max-w-xl mx-auto">
            No applications have been researched yet. AppIntel AI never pre-fills
            simulated findings. Launch single-app, category, or full-batch
            research to discover official docs, extract structured capabilities,
            and run the evidence verification loop.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => onNavigate("agent")}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-[#635BFF] text-white hover:bg-[#5249F5]"
            >
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Run First Research Batch</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("research")}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md border border-[#E5E7EB] text-[#172033] hover:bg-[#F8FAFC]"
            >
              <span>Browse 100-App Registry</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        /* Max 4 Compact Charts */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Progress by Category */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#172033]">
                Research Progress by Category
              </h2>
              <span className="text-xs text-[#64748B] font-mono tabular-nums">
                {totals.researched}/100
              </span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryChartData}
                  margin={{ top: 4, right: 8, left: -18, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#64748B" }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#64748B" }} domain={[0, 10]} />
                  <Tooltip
                    contentStyle={{
                      fontSize: "12px",
                      borderColor: "#E5E7EB",
                      borderRadius: "6px",
                    }}
                  />
                  <Bar dataKey="Researched" stackId="a" fill="#635BFF" />
                  <Bar dataKey="Pending" stackId="a" fill="#E5E7EB" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Authentication Distribution */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#172033]">
                Authentication Methods
              </h2>
              <span className="text-xs text-[#64748B] font-mono tabular-nums">
                n = {totals.researched}
              </span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={authChartData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 20, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 11, fill: "#172033" }}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: "12px",
                      borderColor: "#E5E7EB",
                      borderRadius: "6px",
                    }}
                  />
                  <Bar dataKey="Count" fill="#172033" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: API Access Distribution */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#172033]">
                API Access Model
              </h2>
              <span className="text-xs text-[#64748B] font-mono tabular-nums">
                n = {totals.researched}
              </span>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={accessChartData}
                  margin={{ top: 4, right: 12, left: -18, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#172033" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748B" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      fontSize: "12px",
                      borderColor: "#E5E7EB",
                      borderRadius: "6px",
                    }}
                  />
                  <Bar dataKey="Count" fill="#635BFF" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: MCP Coverage */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#172033]">
                MCP Support Coverage
              </h2>
              <span className="text-xs text-[#64748B] font-mono tabular-nums">
                n = {totals.researched}
              </span>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={mcpChartData}
                  margin={{ top: 4, right: 12, left: -18, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#172033" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748B" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      fontSize: "12px",
                      borderColor: "#E5E7EB",
                      borderRadius: "6px",
                    }}
                  />
                  <Bar dataKey="Count" fill="#15803D" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Three Actionable Operational Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Verified Findings */}
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#172033]">
              Verified Findings
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("research")}
              className="text-xs text-[#635BFF] hover:underline"
            >
              View all
            </button>
          </div>
          {verifiedHighlights.length === 0 ? (
            <p className="text-xs text-[#64748B] py-4">
              Verified application records will appear here after running the
              research & verification pipeline.
            </p>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {verifiedHighlights.map((app) => {
                const b = formatBuildability(app.buildability);
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => onSelectApp(app)}
                    className="w-full py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F8FAFC] px-1 rounded transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#172033] truncate">
                        {app.app_name}
                      </div>
                      <div className="text-[11px] text-[#64748B] truncate">
                        {formatAccessModel(app.api_access_model)} · MCP:{" "}
                        {formatMcpStatus(app.mcp_status)}
                      </div>
                    </div>
                    <StatusIndicator label={b.label} tone={b.tone} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Items Needing Review */}
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#172033]">
              Needs Human Review
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("verification")}
              className="text-xs text-[#635BFF] hover:underline"
            >
              Audit queue
            </button>
          </div>
          {reviewApps.length === 0 ? (
            <p className="text-xs text-[#64748B] py-4">
              No records currently flagged for human review.
            </p>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {reviewApps.slice(0, 5).map((app) => {
                const v = formatVerificationStatus(app.verification_status);
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => onSelectApp(app)}
                    className="w-full py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F8FAFC] px-1 rounded transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#172033] truncate">
                        {app.app_name}
                      </div>
                      <div className="text-[11px] text-[#64748B] truncate">
                        {app.category}
                      </div>
                    </div>
                    <StatusIndicator label={v.label} tone={v.tone} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Research Activity */}
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#172033]">
              Recent Activity
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("agent")}
              className="text-xs text-[#635BFF] hover:underline"
            >
              Full log
            </button>
          </div>
          {logs.length === 0 ? (
            <p className="text-xs text-[#64748B] py-4">
              No pipeline execution logs yet.
            </p>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {logs.slice(0, 5).map((entry) => (
                <div key={entry.id} className="py-2 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                    <span className="font-medium text-[#172033]">
                      {entry.app_name}
                    </span>
                    <span className="font-mono tabular-nums">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B] line-clamp-2 mt-0.5">
                    {entry.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
