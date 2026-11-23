import { AnalyticsSummary, AppRecord, SampleCheckRecord } from "../../shared/types.ts";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateStandaloneHtmlReport(
  analytics: AnalyticsSummary,
  apps: AppRecord[],
  sampleChecks: SampleCheckRecord[],
  composioProbeStatus: { status: string; message: string }
): string {
  const generatedAt = new Date().toISOString().split("T")[0];
  const researchedApps = apps.filter((a) => a.research_status === "completed");
  const easierApps = researchedApps.filter((a) => a.buildability === "easy");
  const investigationApps = researchedApps.filter(
    (a) =>
      a.verification_status === "needs_review" ||
      a.api_access_model === "gated" ||
      a.api_available === null
  );

  const distList = (items: Array<{ label: string; count: number; pct: number }>) => {
    if (items.length === 0) {
      return `<p class="muted">No completed research records yet. Percentages will populate as applications complete the pipeline.</p>`;
    }
    return `<ul class="kv-list">${items
      .slice(0, 8)
      .map(
        (i) =>
          `<li><span>${escapeHtml(i.label)}</span><strong>${i.count} (${i.pct}%)</strong></li>`
      )
      .join("")}</ul>`;
  };

  const blockerBlock =
    analytics.top_blockers.length === 0
      ? `<p class="muted">No technical or commercial blockers recorded yet.</p>`
      : `<ul class="kv-list">${analytics.top_blockers
          .slice(0, 10)
          .map(
            (b) =>
              `<li><span>${escapeHtml(b.blocker)}</span><strong>${escapeHtml(
                b.kind === "documented" ? "Documented" : "Engineering Concern"
              )} · ${b.count}x</strong></li>`
          )
          .join("")}</ul>`;

  const categoryRows = analytics.category_metrics
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.category)}</td>
        <td class="num">${c.researched}/${c.total}</td>
        <td class="num">${c.self_serve_count}</td>
        <td class="num">${c.gated_count}</td>
        <td class="num">${c.easy_count}</td>
        <td class="num">${c.moderate_count}</td>
        <td class="num">${c.difficult_count}</td>
        <td class="num">${c.official_mcp_count} / ${c.third_party_mcp_count}</td>
        <td class="num">${c.avg_buildability_score !== null ? c.avg_buildability_score.toFixed(2) : "—"}</td>
      </tr>`
    )
    .join("");

  const clusterBlocks = analytics.clusters
    .map(
      (cl) => `
      <div class="cluster-item">
        <div class="cluster-head">
          <strong>${escapeHtml(cl.name)}</strong>
          <span class="num">${cl.apps.length} apps</span>
        </div>
        <p class="muted">${escapeHtml(cl.description)}</p>
        ${
          cl.apps.length > 0
            ? `<p class="app-list">${cl.apps
                .slice(0, 14)
                .map((a) => escapeHtml(a.app_name))
                .join(" · ")}${cl.apps.length > 14 ? ` (+${cl.apps.length - 14} more)` : ""}</p>`
            : ""
        }
      </div>`
    )
    .join("");

  const sampleRows =
    sampleChecks.length === 0
      ? `<tr><td colspan="5" class="muted">No manual sample checks logged yet. Record cross-category manual audits in the Verification tab.</td></tr>`
      : sampleChecks
          .map(
            (s) => `
          <tr>
            <td>${escapeHtml(s.app_name)}</td>
            <td>${escapeHtml(s.category)}</td>
            <td>${escapeHtml(s.fields_checked.join(", "))}</td>
            <td>${escapeHtml(s.errors_detected || "None")}</td>
            <td>${escapeHtml(s.outcome)}</td>
          </tr>`
          )
          .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AppIntel AI — Ecosystem Integration Intelligence Report</title>
  <style>
    :root {
      --bg: #F8FAFC;
      --surface: #FFFFFF;
      --ink: #172033;
      --muted: #64748B;
      --border: #E5E7EB;
      --accent: #635BFF;
      --success: #15803D;
      --warning: #D97706;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.55;
      padding: 36px 20px 72px;
    }
    .container { max-width: 1060px; margin: 0 auto; }
    header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 22px;
      margin-bottom: 28px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
    }
    .kicker { font-size: 13px; color: var(--accent); font-weight: 600; margin-bottom: 6px; }
    h1 { font-size: 30px; margin: 0 0 8px; letter-spacing: -0.02em; }
    .subtitle { color: var(--muted); font-size: 15px; margin: 0; max-width: 720px; }
    .meta { margin-top: 12px; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .btn {
      display: inline-block;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--ink);
    }
    .btn-primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #FFFFFF;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(165px, 1fr));
      gap: 14px;
      margin-bottom: 28px;
    }
    .kpi {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 16px;
    }
    .kpi-label { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
    .kpi-val { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
    section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 20px;
    }
    h2 { font-size: 18px; margin: 0 0 12px; letter-spacing: -0.01em; border-bottom: 1px solid #F1F5F9; padding-bottom: 8px; }
    h3 { font-size: 14px; margin: 16px 0 8px; color: var(--ink); }
    p { font-size: 14px; margin: 8px 0; }
    .two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 24px; }
    .kv-list { list-style: none; padding: 0; margin: 0; }
    .kv-list li {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 6px 0;
      border-bottom: 1px solid #F1F5F9;
      font-size: 13px;
    }
    .bullets { list-style: disc; padding-left: 20px; margin: 8px 0; }
    .bullets li { padding: 4px 0; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
    th, td { text-align: left; padding: 9px 8px; border-bottom: 1px solid var(--border); }
    th { color: var(--muted); font-weight: 600; font-size: 12px; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .muted { color: var(--muted); font-size: 13px; }
    .cluster-item { padding: 12px 0; border-bottom: 1px solid var(--border); }
    .cluster-item:last-child { border-bottom: none; }
    .cluster-head { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px; }
    .app-list { font-size: 13px; color: var(--ink); margin: 4px 0 0; }
    .disclosure {
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      color: #92400E;
      padding: 14px 16px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 24px;
    }
    @media print {
      .actions { display: none; }
      body { padding: 0; background: #FFFFFF; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <div class="kicker">AppIntel AI · Composio AI Product Ops Deliverable</div>
        <h1>Ecosystem Integration Intelligence Report</h1>
        <p class="subtitle">Research smarter. Integrate strategically. Evidence-backed evaluation across 100 applications and 10 categories.</p>
        <div class="meta">Generated: ${generatedAt} · Coverage: ${analytics.totals.researched}/100 researched (${analytics.totals.completion_pct}%) · Verified: ${analytics.totals.verified} · Needs Review: ${analytics.totals.needs_review} · Failed: ${analytics.totals.failed}</div>
      </div>
      <div class="actions">
        <a class="btn" href="/">Open Interactive App</a>
        <a class="btn btn-primary" href="/report.html?download=1" download="appintel-ai-report.html">Download HTML</a>
      </div>
    </header>

    ${
      analytics.totals.researched < 100
        ? `<div class="disclosure"><strong>Honest Coverage Disclosure:</strong> ${analytics.totals.researched} of 100 applications have completed automated research and verification (${analytics.totals.pending} remain pending, ${analytics.totals.failed} failed). All percentages and distributions below use <strong>${analytics.totals.researched} researched records</strong> as the denominator—never 100.</div>`
        : ""
    }

    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Canonical Scope</div><div class="kpi-val">100 apps</div></div>
      <div class="kpi"><div class="kpi-label">Researched</div><div class="kpi-val">${analytics.totals.researched}</div></div>
      <div class="kpi"><div class="kpi-label">Verified</div><div class="kpi-val">${analytics.totals.verified}</div></div>
      <div class="kpi"><div class="kpi-label">Needs Review</div><div class="kpi-val">${analytics.totals.needs_review}</div></div>
      <div class="kpi"><div class="kpi-label">1st-Pass Accuracy</div><div class="kpi-val">${analytics.accuracy.first_pass_accuracy_pct !== null ? `${analytics.accuracy.first_pass_accuracy_pct}%` : "N/A"}</div></div>
      <div class="kpi"><div class="kpi-label">Post-Verify Resolved</div><div class="kpi-val">${analytics.accuracy.post_verification_accuracy_pct !== null ? `${analytics.accuracy.post_verification_accuracy_pct}%` : "N/A"}</div></div>
    </div>

    <section>
      <h2>1. Executive Summary</h2>
      <p><strong>What AppIntel AI does:</strong> AppIntel AI is an automated research, evidence-verification, and integration intelligence system evaluating 100 ecosystem applications across 10 categories.</p>
      <p><strong>Why Composio needs this research:</strong> Before scoping engineering sprints or partner outreach for new toolkits, Composio needs structured answers on authentication protocols, public API availability, self-serve vs. gated developer onboarding, Model Context Protocol (MCP) maturity, and commercial or technical blockers.</p>
      <p><strong>How the automated pipeline works:</strong> App Input → Google Search Source Discovery → Official Documentation Retrieval → Structured Gemini Extraction → Zod Schema & Provenance Validation → 8-Dimension Buildability Scoring → Independent Verification Loop → Persistent Storage → Analytics & Reporting.</p>
      <p class="muted"><strong>Composio SDK/MCP Probe Status:</strong> ${escapeHtml(composioProbeStatus.message)}</p>
    </section>

    <section>
      <h2>2. Research Methodology</h2>
      <ul class="bullets">
        <li><strong>Source Discovery & Documentation Retrieval:</strong> Queries Google Search Grounding via Gemini to locate official websites, API references, auth guides, pricing/access pages, and MCP repositories, then fetches up to 5 discovered URLs directly over HTTP with HTML-to-text extraction.</li>
        <li><strong>Structured Extraction & Provenance Validation:</strong> Extracts a strict JSON schema validated by Zod, preserving explicit nulls/unknowns rather than guessing missing fields and cross-checking URLs against discovered search results.</li>
        <li><strong>Independent Verification & Human Review:</strong> Audits 8 core claims per app against live URL reachability and independent search verification, tagging each claim as <em>verified</em>, <em>corrected</em>, <em>needs_human_review</em>, <em>unsupported</em>, or <em>not_verifiable</em> while preserving the original first-pass AI snapshot.</li>
        <li><strong>8-Dimension Buildability Scoring (1.00–5.00):</strong> Weighted rubric covering API Accessibility (22%), Auth Simplicity (16%), Documentation Quality (14%), API Completeness (14%), Access Openness (14%), MCP Availability (8% — capped so MCP repos never mask gated APIs), Developer Ecosystem (6%), and Operational Predictability (6%).</li>
      </ul>
      <p class="muted">Claims audited: <strong>${analytics.accuracy.total_claims_checked}</strong> across ${analytics.accuracy.researched_apps_with_verification} researched apps · Verified first-pass: <strong>${analytics.accuracy.claims_verified_first_pass}</strong> · Corrected: <strong>${analytics.accuracy.claims_corrected}</strong> · Needs human review: <strong>${analytics.accuracy.claims_needs_human_review}</strong> · Unsupported: <strong>${analytics.accuracy.claims_unsupported}</strong></p>
      <h3>Manual Sample-Check Audit Log (n = ${sampleChecks.length})</h3>
      <table>
        <thead>
          <tr><th>Application</th><th>Category</th><th>Fields Checked</th><th>Errors Detected</th><th>Outcome</th></tr>
        </thead>
        <tbody>${sampleRows}</tbody>
      </table>
    </section>

    <section>
      <h2>3. Findings (n = ${researchedApps.length} researched)</h2>
      <div class="two-col">
        <div>
          <h3>Authentication Distribution</h3>
          ${distList(analytics.distributions.authentication)}
          <h3>Public API Availability</h3>
          ${distList(analytics.distributions.api_availability)}
          <h3>API Access Model</h3>
          ${distList(analytics.distributions.access_model)}
        </div>
        <div>
          <h3>MCP Support Coverage</h3>
          ${distList(analytics.distributions.mcp_status)}
          <h3>Buildability Distribution</h3>
          ${distList(analytics.distributions.buildability)}
          <h3>Common Technical & Commercial Blockers</h3>
          ${blockerBlock}
        </div>
      </div>

      <h3>Category Comparison (10 Categories × 10 Applications)</h3>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th class="num">Researched</th>
            <th class="num">Self-Serve</th>
            <th class="num">Gated</th>
            <th class="num">Easy</th>
            <th class="num">Mod.</th>
            <th class="num">Diff.</th>
            <th class="num">MCP (Off / 3P)</th>
            <th class="num">Avg Score</th>
          </tr>
        </thead>
        <tbody>${categoryRows}</tbody>
      </table>
    </section>

    <section>
      <h2>4. Integration Opportunities & Clusters</h2>
      <div class="two-col" style="margin-bottom: 16px;">
        <div>
          <h3>Easier to Integrate (${easierApps.length})</h3>
          <p class="muted">${
            easierApps.length > 0
              ? easierApps.map((a) => escapeHtml(a.app_name)).join(" · ")
              : "No applications researched into the Easy buildability tier yet."
          }</p>
        </div>
        <div>
          <h3>Requires Additional Investigation (${investigationApps.length})</h3>
          <p class="muted">${
            investigationApps.length > 0
              ? investigationApps.map((a) => escapeHtml(a.app_name)).join(" · ")
              : "No researched applications currently flagged for follow-up."
          }</p>
        </div>
      </div>
      ${clusterBlocks}
    </section>

    <section>
      <h2>5. Recommendations — What This Means for Composio</h2>
      <h3>Evidence-Backed Findings</h3>
      <ul class="bullets">
        ${analytics.composio_recommendations.evidence_backed_findings.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
      </ul>
      <h3>Practical Next Steps & Strategic Recommendations</h3>
      <ul class="bullets">
        ${analytics.composio_recommendations.strategic_recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
      </ul>
      <h3>Hypotheses & Follow-Up Queue</h3>
      <ul class="bullets">
        ${analytics.composio_recommendations.hypotheses_requiring_followup.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}
      </ul>
    </section>

    <section>
      <h2>6. Limitations & Known Uncertainties</h2>
      <ul class="bullets">
        <li><strong>Unresearched Applications:</strong> ${analytics.totals.pending} applications remain in <em>pending</em> status and ${analytics.totals.failed} in <em>failed</em> status; aggregate charts and ratios exclude unresearched apps.</li>
        <li><strong>Unverified Claims:</strong> Claims lacking corroboration in accessible primary docs are tagged <em>needs_human_review</em>, <em>unsupported</em>, or <em>not_verifiable</em> rather than forced to verified.</li>
        <li><strong>Inaccessible Documentation:</strong> Login-walled developer portals, NDA-gated specifications, and sites returning HTTP 403/429 bot blocks cannot be scraped directly.</li>
        <li><strong>API Access Restrictions:</strong> Partner-program approvals, enterprise-only APIs, and region-locked payment rails require commercial follow-up.</li>
        <li><strong>Gemini & Search Grounding Limitations:</strong> Model extraction depends on indexed public documentation and requires a billing-enabled Gemini API key when free-tier quotas/permissions do not cover grounded requests.</li>
        <li><strong>MCP Uncertainty:</strong> Community MCP repositories change rapidly; third-party repos are strictly separated from vendor-maintained official MCP servers.</li>
        <li><strong>Manual Research Required:</strong> Final verification of partner-gated scopes, commercial licensing, and cross-category sample checks requires human Product Ops review.</li>
      </ul>
    </section>
  </div>
</body>
</html>`;
}
