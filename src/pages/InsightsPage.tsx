import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnalyticsSummary, AppRecord } from "../../shared/types";
import { formatAccessModel, formatMcpStatus } from "../components/StatusLabel";

interface InsightsPageProps {
  analytics: AnalyticsSummary;
  apps: AppRecord[];
  onSelectApp: (app: AppRecord) => void;
}

export function InsightsPage({
  analytics,
  apps,
  onSelectApp,
}: InsightsPageProps) {
  const {
    totals,
    distributions,
    category_metrics,
    top_blockers,
    clusters,
    composio_recommendations,
  } = analytics;

  const appById = new Map(apps.map((a) => [a.id, a]));

  const buildabilityChartData = distributions.buildability.map((d) => ({
    name: d.label.charAt(0).toUpperCase() + d.label.slice(1),
    Count: d.count,
  }));

  const apiAvailChartData = distributions.api_availability.map((d) => ({
    name: d.label,
    Count: d.count,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#172033] tracking-tight">
          Ecosystem Insights & Patterns
        </h1>
        <p className="text-sm text-[#64748B] mt-1">
          Cross-category integration intelligence derived strictly from{" "}
          <span className="font-mono tabular-nums font-medium text-[#172033]">
            {totals.researched}
          </span>{" "}
          completed research records ({100 - totals.researched} remaining).
        </p>
      </div>

      {/* Prominent "What this means for Composio" Section */}
      <section className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
          <h2 className="text-base font-semibold text-[#172033]">
            What this means for Composio
          </h2>
          <span className="text-xs text-[#64748B]">
            Evidence-backed findings separated from strategic recommendations
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[#172033]">
              Evidence-Backed Findings
            </h3>
            <ul className="space-y-2 text-xs text-[#64748B] list-disc pl-4">
              {composio_recommendations.evidence_backed_findings.map(
                (item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {item}
                  </li>
                )
              )}
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[#635BFF]">
              Actionable Recommendations
            </h3>
            <ul className="space-y-2 text-xs text-[#172033] list-disc pl-4">
              {composio_recommendations.strategic_recommendations.map(
                (item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {item}
                  </li>
                )
              )}
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[#D97706]">
              Hypotheses & Follow-Up
            </h3>
            {composio_recommendations.hypotheses_requiring_followup.length ===
            0 ? (
              <p className="text-xs text-[#64748B]">
                All 100 applications researched and verified without pending
                follow-ups.
              </p>
            ) : (
              <ul className="space-y-2 text-xs text-[#64748B] list-disc pl-4">
                {composio_recommendations.hypotheses_requiring_followup.map(
                  (item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {item}
                    </li>
                  )
                )}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Distributions Grid */}
      {totals.researched > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#172033]">
                Buildability Verdict Distribution
              </h2>
              <span className="text-xs font-mono text-[#64748B]">
                n = {totals.researched}
              </span>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={buildabilityChartData}
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

          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#172033]">
                Public API Availability
              </h2>
              <span className="text-xs font-mono text-[#64748B]">
                n = {totals.researched}
              </span>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={apiAvailChartData}
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
                  <Bar dataKey="Count" fill="#172033" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Category Comparison Matrix */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#172033]">
            Category Comparison Matrix
          </h2>
          <span className="text-xs text-[#64748B]">
            10 categories × 10 applications
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                <th className="px-4 py-2.5">Category</th>
                <th className="px-3 py-2.5 text-right">Researched</th>
                <th className="px-3 py-2.5 text-right">Verified</th>
                <th className="px-3 py-2.5 text-right">Self-Serve</th>
                <th className="px-3 py-2.5 text-right">Gated</th>
                <th className="px-3 py-2.5 text-right">Easy</th>
                <th className="px-3 py-2.5 text-right">Difficult</th>
                <th className="px-3 py-2.5 text-right">Official MCP</th>
                <th className="px-3 py-2.5 text-right">3P MCP</th>
                <th className="px-4 py-2.5 text-right">Avg Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {category_metrics.map((c) => (
                <tr key={c.category} className="hover:bg-[#F8FAFC]">
                  <td className="px-4 py-2.5 font-medium text-[#172033] whitespace-nowrap">
                    {c.category}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {c.researched}/{c.total}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[#15803D]">
                    {c.verified}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {c.self_serve_count}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {c.gated_count}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {c.easy_count}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {c.difficult_count}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {c.official_mcp_count}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {c.third_party_mcp_count}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-medium text-[#172033]">
                    {c.avg_buildability_score !== null
                      ? `${c.avg_buildability_score.toFixed(2)}/5`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evidence-Based Integration Clusters */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
          <h2 className="text-sm font-semibold text-[#172033]">
            Evidence-Based Integration Clusters
          </h2>
          <span className="text-xs text-[#64748B]">
            Click any application to inspect its full record
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {clusters.map((cluster) => (
            <div
              key={cluster.id}
              className="border border-[#E5E7EB] rounded-md p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-[#172033]">
                  {cluster.name}
                </h3>
                <span className="text-xs font-mono tabular-nums text-[#635BFF]">
                  {cluster.apps.length} apps
                </span>
              </div>
              <p className="text-xs text-[#64748B]">{cluster.description}</p>
              {cluster.apps.length > 0 ? (
                <div className="flex flex-wrap gap-x-2 gap-y-1 pt-1 text-xs">
                  {cluster.apps.map((ref, idx) => {
                    const full = appById.get(ref.id);
                    return (
                      <span key={ref.id} className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => full && onSelectApp(full)}
                          className="text-[#172033] hover:text-[#635BFF] underline decoration-[#E5E7EB] hover:decoration-[#635BFF]"
                          title={`${ref.category} · ${formatAccessModel(
                            ref.api_access_model
                          )} · MCP: ${formatMcpStatus(ref.mcp_status)}`}
                        >
                          {ref.app_name}
                        </button>
                        {idx < cluster.apps.length - 1 && (
                          <span className="text-[#CBD5E1]" aria-hidden="true">
                            ·
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-[#64748B] italic">
                  No researched apps currently match this cluster.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Common Blockers */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
          <h2 className="text-sm font-semibold text-[#172033]">
            Most Frequent Technical & Commercial Blockers
          </h2>
          <span className="text-xs text-[#64748B]">
            Observed across researched records
          </span>
        </div>
        {top_blockers.length === 0 ? (
          <p className="text-xs text-[#64748B] py-3">
            No blockers recorded yet. Run research to surface recurring
            technical and commercial constraints.
          </p>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {top_blockers.map((b, i) => (
              <div
                key={i}
                className="py-2 flex items-center justify-between gap-4 text-xs"
              >
                <span className="text-[#172033]">{b.blocker}</span>
                <span className="font-mono text-[11px] text-[#64748B] whitespace-nowrap shrink-0">
                  {b.kind === "documented" ? "Documented" : "Concern"} ·{" "}
                  {b.count}x
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
