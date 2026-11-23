import { useMemo, useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import {
  AnalyticsSummary,
  AppRecord,
  SampleCheckRecord,
} from "../../shared/types";
import { StatusIndicator } from "../components/StatusLabel";

interface VerificationPageProps {
  analytics: AnalyticsSummary;
  apps: AppRecord[];
  sampleChecks: SampleCheckRecord[];
  onSelectApp: (app: AppRecord) => void;
  onCreateSampleCheck: (payload: {
    app_id: string;
    reviewer: string;
    fields_checked: string[];
    first_pass_reported: string;
    official_docs_stated: string;
    errors_detected: string;
    corrections_applied: string;
    remaining_uncertainty: string;
    outcome: "accurate" | "corrected" | "uncertain";
  }) => Promise<void>;
  onDeleteSampleCheck: (id: string) => Promise<void>;
}

export function VerificationPage({
  analytics,
  apps,
  sampleChecks,
  onSelectApp,
  onCreateSampleCheck,
  onDeleteSampleCheck,
}: VerificationPageProps) {
  const { accuracy } = analytics;
  const [resultFilter, setResultFilter] = useState("all");
  const [showSampleForm, setShowSampleForm] = useState(false);

  const [sampleAppId, setSampleAppId] = useState(apps[0]?.id ?? "");
  const [reviewer, setReviewer] = useState("Product Ops Reviewer");
  const [fieldsChecked, setFieldsChecked] = useState(
    "Authentication, API Access Model, MCP Status"
  );
  const [firstPassReported, setFirstPassReported] = useState("");
  const [officialDocsStated, setOfficialDocsStated] = useState("");
  const [errorsDetected, setErrorsDetected] = useState("");
  const [correctionsApplied, setCorrectionsApplied] = useState("");
  const [remainingUncertainty, setRemainingUncertainty] = useState("");
  const [outcome, setOutcome] = useState<"accurate" | "corrected" | "uncertain">(
    "accurate"
  );
  const [savingSample, setSavingSample] = useState(false);

  const researchedApps = useMemo(
    () => apps.filter((a) => a.research_status === "completed"),
    [apps]
  );

  const reviewQueue = useMemo(
    () => apps.filter((a) => a.verification_status === "needs_review"),
    [apps]
  );

  const allClaimRows = useMemo(() => {
    const rows: Array<{
      app: AppRecord;
      claim: AppRecord["verification_items"][number];
    }> = [];
    for (const app of researchedApps) {
      for (const claim of app.verification_items) {
        if (
          resultFilter !== "all" &&
          claim.verification_result !== resultFilter
        ) {
          continue;
        }
        rows.push({ app, claim });
      }
    }
    return rows;
  }, [researchedApps, resultFilter]);

  const handleSampleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sampleAppId || !officialDocsStated.trim()) return;
    setSavingSample(true);
    try {
      await onCreateSampleCheck({
        app_id: sampleAppId,
        reviewer,
        fields_checked: fieldsChecked
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        first_pass_reported: firstPassReported,
        official_docs_stated: officialDocsStated,
        errors_detected: errorsDetected,
        corrections_applied: correctionsApplied,
        remaining_uncertainty: remainingUncertainty,
        outcome,
      });
      setFirstPassReported("");
      setOfficialDocsStated("");
      setErrorsDetected("");
      setCorrectionsApplied("");
      setRemainingUncertainty("");
      setShowSampleForm(false);
    } finally {
      setSavingSample(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#172033] tracking-tight">
          Verification & Accuracy Audit
        </h1>
        <p className="text-sm text-[#64748B] mt-1">
          Transparent comparison of first-pass AI claims against official
          documentation, evidence reachability, and manual sample checks.
        </p>
      </div>

      {/* Accuracy KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-px bg-[#E5E7EB] border border-[#E5E7EB] rounded-lg overflow-hidden">
        {[
          { label: "Claims Checked", value: accuracy.total_claims_checked },
          { label: "Verified 1st-Pass", value: accuracy.claims_verified_first_pass },
          { label: "Corrected", value: accuracy.claims_corrected },
          { label: "Needs Review", value: accuracy.claims_needs_human_review },
          { label: "Unsupported", value: accuracy.claims_unsupported },
          {
            label: "1st-Pass Accuracy",
            value:
              accuracy.first_pass_accuracy_pct !== null
                ? `${accuracy.first_pass_accuracy_pct}%`
                : "N/A",
          },
          {
            label: "Post-Verify Resolved",
            value:
              accuracy.post_verification_accuracy_pct !== null
                ? `${accuracy.post_verification_accuracy_pct}%`
                : "N/A",
          },
        ].map((item) => (
          <div key={item.label} className="bg-[#FFFFFF] px-4 py-3.5">
            <div className="text-[11px] text-[#64748B]">{item.label}</div>
            <div className="text-lg font-semibold text-[#172033] font-mono tabular-nums mt-1">
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Explicit Accuracy Methodology Disclosure */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg px-5 py-4 text-xs text-[#64748B] space-y-1">
        <div className="font-semibold text-[#172033]">
          Measurement Basis & Honest Sample Disclosure
        </div>
        <p>
          Calculations strictly use audited claims across{" "}
          <strong className="text-[#172033] font-mono tabular-nums">
            {accuracy.researched_apps_with_verification}
          </strong>{" "}
          researched applications (denominator ={" "}
          <strong className="text-[#172033] font-mono tabular-nums">
            {accuracy.total_claims_checked}
          </strong>{" "}
          claims).{" "}
          <strong className="text-[#172033]">First-Pass Accuracy</strong> ={" "}
          <span className="font-mono">
            verified_first_pass / total_claims_checked
          </span>
          .{" "}
          <strong className="text-[#172033]">Post-Verification Resolved</strong>{" "}
          ={" "}
          <span className="font-mono">
            (verified_first_pass + corrected) / total_claims_checked
          </span>
          .
          {accuracy.researched_apps_with_verification < 100 &&
            ` Because ${100 - accuracy.researched_apps_with_verification} apps have not yet completed verification, these metrics do not claim coverage of all 100 apps.`}
        </p>
      </div>

      {/* Records Requiring Human Review */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
          <h2 className="text-sm font-semibold text-[#172033]">
            Records Requiring Human Review ({reviewQueue.length})
          </h2>
          <span className="text-xs text-[#64748B]">
            Click any application to review or override claims
          </span>
        </div>
        {reviewQueue.length === 0 ? (
          <p className="text-xs text-[#64748B] py-3">
            No applications currently require human intervention.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {reviewQueue.map((app) => {
              const flagged = app.verification_items.filter(
                (v) =>
                  v.verification_result === "needs_human_review" ||
                  v.verification_result === "unsupported" ||
                  v.verification_result === "not_verifiable"
              );
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => onSelectApp(app)}
                  className="text-left p-3.5 rounded-md border border-[#E5E7EB] hover:border-[#635BFF] transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#172033]">
                      {app.app_name}
                    </span>
                    <StatusIndicator label="Needs Review" tone="warning" />
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    {app.category}
                  </div>
                  <div className="text-[11px] text-[#D97706]">
                    Flagged:{" "}
                    {flagged.map((f) => f.claim_label).join(", ") ||
                      "Unverified URLs"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Claim-by-Claim Audit Log */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#172033]">
              Claim-Level Verification Log ({allClaimRows.length})
            </h2>
            <p className="text-xs text-[#64748B]">
              Inspect original AI output alongside official evidence and
              corrections.
            </p>
          </div>
          <select
            aria-label="Filter claim verification result"
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white border border-[#E5E7EB] rounded-md text-[#172033]"
          >
            <option value="all">All Outcomes</option>
            <option value="verified">Verified</option>
            <option value="corrected">Corrected</option>
            <option value="needs_human_review">Needs Human Review</option>
            <option value="unsupported">Unsupported</option>
            <option value="not_verifiable">Not Verifiable</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                <th className="px-4 py-2.5">Application</th>
                <th className="px-3 py-2.5">Claim</th>
                <th className="px-3 py-2.5">Original AI Finding</th>
                <th className="px-3 py-2.5">Outcome</th>
                <th className="px-3 py-2.5">Corrected Finding</th>
                <th className="px-4 py-2.5">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {allClaimRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-[#64748B]"
                  >
                    No claim audits recorded yet. Run research on one or more
                    applications to populate the verification audit table.
                  </td>
                </tr>
              ) : (
                allClaimRows.slice(0, 80).map(({ app, claim }) => (
                  <tr
                    key={`${app.id}-${claim.id}`}
                    onClick={() => onSelectApp(app)}
                    className="hover:bg-[#F8FAFC] cursor-pointer"
                  >
                    <td className="px-4 py-2.5 font-medium text-[#172033] whitespace-nowrap">
                      {app.app_name}
                    </td>
                    <td className="px-3 py-2.5 text-[#64748B] whitespace-nowrap">
                      {claim.claim_label}
                    </td>
                    <td className="px-3 py-2.5 text-[#172033] max-w-[220px] truncate">
                      {claim.original_ai_finding}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] whitespace-nowrap">
                      <span
                        className={
                          claim.verification_result === "verified"
                            ? "text-[#15803D]"
                            : claim.verification_result === "corrected"
                            ? "text-[#635BFF]"
                            : claim.verification_result === "unsupported"
                            ? "text-[#DC2626]"
                            : "text-[#D97706]"
                        }
                      >
                        {claim.verification_result}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[#172033] max-w-[220px] truncate">
                      {claim.corrected_finding ?? "—"}
                    </td>
                    <td
                      className="px-4 py-2.5 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {claim.evidence_url ? (
                        <a
                          href={claim.evidence_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#635BFF] hover:underline"
                        >
                          <span>Source</span>
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="text-[#64748B]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Sample-Check Methodology & Log (Part 6.4) */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#172033]">
              Manual Sample-Check Audit Log ({sampleChecks.length})
            </h2>
            <p className="text-xs text-[#64748B]">
              Document representative manual inspections across categories
              comparing agent output to official vendor docs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSampleForm(!showSampleForm)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#172033] text-white hover:bg-[#172033]/90 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{showSampleForm ? "Close Form" : "Log Sample Check"}</span>
          </button>
        </div>

        {showSampleForm && (
          <form
            onSubmit={handleSampleSubmit}
            className="p-4 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] space-y-3 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[#64748B] mb-1">Application</label>
                <select
                  value={sampleAppId}
                  onChange={(e) => setSampleAppId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-md"
                >
                  {apps.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.app_name} ({a.category})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[#64748B] mb-1">Reviewer</label>
                <input
                  type="text"
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-md"
                />
              </div>
              <div>
                <label className="block text-[#64748B] mb-1">Outcome</label>
                <select
                  value={outcome}
                  onChange={(e) =>
                    setOutcome(
                      e.target.value as "accurate" | "corrected" | "uncertain"
                    )
                  }
                  className="w-full px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-md"
                >
                  <option value="accurate">Accurate (matched official docs)</option>
                  <option value="corrected">Corrected (error fixed)</option>
                  <option value="uncertain">Uncertain (remains ambiguous)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[#64748B] mb-1">
                Fields Checked (comma-separated)
              </label>
              <input
                type="text"
                value={fieldsChecked}
                onChange={(e) => setFieldsChecked(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-md"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[#64748B] mb-1">
                  First-Pass Agent Reported
                </label>
                <textarea
                  rows={2}
                  value={firstPassReported}
                  onChange={(e) => setFirstPassReported(e.target.value)}
                  placeholder="What did the first-pass extractor report?"
                  className="w-full px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-md"
                />
              </div>
              <div>
                <label className="block text-[#64748B] mb-1">
                  Official Documentation Stated *
                </label>
                <textarea
                  rows={2}
                  required
                  value={officialDocsStated}
                  onChange={(e) => setOfficialDocsStated(e.target.value)}
                  placeholder="What did you observe in the official docs?"
                  className="w-full px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-md"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={errorsDetected}
                onChange={(e) => setErrorsDetected(e.target.value)}
                placeholder="Errors detected (or None)"
                className="px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-md"
              />
              <input
                type="text"
                value={correctionsApplied}
                onChange={(e) => setCorrectionsApplied(e.target.value)}
                placeholder="Corrections applied"
                className="px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-md"
              />
              <input
                type="text"
                value={remainingUncertainty}
                onChange={(e) => setRemainingUncertainty(e.target.value)}
                placeholder="Remaining uncertainty"
                className="px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-md"
              />
            </div>

            <button
              type="submit"
              disabled={savingSample}
              className="px-4 py-1.5 bg-[#635BFF] text-white font-medium rounded-md hover:bg-[#5249F5] disabled:opacity-50"
            >
              {savingSample ? "Saving..." : "Save Sample Check"}
            </button>
          </form>
        )}

        {sampleChecks.length === 0 ? (
          <p className="text-xs text-[#64748B] py-3">
            No manual sample checks logged yet. Use{" "}
            <strong>Log Sample Check</strong> above to record representative
            cross-category inspections.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-[11px] text-[#64748B]">
                  <th className="py-2 pr-3">App</th>
                  <th className="py-2 pr-3">Fields</th>
                  <th className="py-2 pr-3">First-Pass vs Official Docs</th>
                  <th className="py-2 pr-3">Errors / Corrections</th>
                  <th className="py-2 pr-3">Outcome</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {sampleChecks.map((sc) => (
                  <tr key={sc.id}>
                    <td className="py-2.5 pr-3 font-medium text-[#172033] whitespace-nowrap">
                      {sc.app_name}
                      <div className="text-[11px] font-normal text-[#64748B]">
                        {sc.category}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-[#64748B]">
                      {sc.fields_checked.join(", ")}
                    </td>
                    <td className="py-2.5 pr-3 space-y-0.5 max-w-[280px]">
                      <div className="text-[#64748B]">
                        AI: {sc.first_pass_reported}
                      </div>
                      <div className="text-[#172033]">
                        Docs: {sc.official_docs_stated}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-[#64748B] max-w-[220px]">
                      <div>Errors: {sc.errors_detected}</div>
                      <div>Fix: {sc.corrections_applied}</div>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-[11px] whitespace-nowrap">
                      {sc.outcome}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteSampleCheck(sc.id)}
                        className="p-1 text-[#64748B] hover:text-[#DC2626]"
                        aria-label="Delete sample check"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
