import { AnalyticsSummary, AppCategory, AppRecord } from "../../shared/types.ts";
import { CATEGORY_LIST } from "../seed.ts";
import { storage } from "../storage.ts";

function toDistribution(
  counts: Map<string, number>,
  denominator: number
): Array<{ label: string; count: number; pct: number }> {
  return Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
      pct: denominator > 0 ? Number(((count / denominator) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function computeAnalytics(): AnalyticsSummary {
  const apps = storage.getAllApps();
  const sampleChecks = storage.getSampleChecks();

  const completed = apps.filter((a) => a.research_status === "completed");
  const pending = apps.filter((a) => a.research_status === "pending");
  const running = apps.filter((a) => a.research_status === "running");
  const failed = apps.filter((a) => a.research_status === "failed");

  const verified = apps.filter((a) => a.verification_status === "verified");
  const needsReview = apps.filter((a) => a.verification_status === "needs_review");
  const unverified = apps.filter((a) => a.verification_status === "unverified");

  const denom = completed.length;

  // Authentication distribution (multi-label across researched apps)
  const authCounts = new Map<string, number>();
  const apiAvailCounts = new Map<string, number>();
  const accessCounts = new Map<string, number>();
  const mcpCounts = new Map<string, number>();
  const buildCounts = new Map<string, number>();
  const docCounts = new Map<string, number>();
  const blockerCounts = new Map<string, { count: number; kind: "documented" | "engineering_concern" }>();

  for (const app of completed) {
    if (app.authentication_methods.length === 0) {
      authCounts.set("Unknown / None Documented", (authCounts.get("Unknown / None Documented") ?? 0) + 1);
    } else {
      const seenAuth = new Set<string>();
      for (const m of app.authentication_methods) {
        const clean = m.trim() || "Other";
        if (!seenAuth.has(clean)) {
          seenAuth.add(clean);
          authCounts.set(clean, (authCounts.get(clean) ?? 0) + 1);
        }
      }
    }

    const availLabel =
      app.api_available === true
        ? "Public API Available"
        : app.api_available === false
        ? "No Public API"
        : "Unknown";
    apiAvailCounts.set(availLabel, (apiAvailCounts.get(availLabel) ?? 0) + 1);

    accessCounts.set(app.api_access_model, (accessCounts.get(app.api_access_model) ?? 0) + 1);
    mcpCounts.set(app.mcp_status, (mcpCounts.get(app.mcp_status) ?? 0) + 1);
    buildCounts.set(app.buildability, (buildCounts.get(app.buildability) ?? 0) + 1);
    docCounts.set(app.api_doc_quality, (docCounts.get(app.api_doc_quality) ?? 0) + 1);

    for (const b of app.blockers) {
      const key = b.description.trim();
      if (!key) continue;
      const existing = blockerCounts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        blockerCounts.set(key, { count: 1, kind: b.kind });
      }
    }
  }

  // Category comparisons
  const category_metrics = CATEGORY_LIST.map(({ category }) => {
    const catApps = apps.filter((a) => a.category === category);
    const catDone = catApps.filter((a) => a.research_status === "completed");
    const scores = catDone
      .map((a) => a.buildability_score?.weighted_score)
      .filter((s): s is number => typeof s === "number");

    return {
      category: category as AppCategory,
      total: catApps.length,
      researched: catDone.length,
      verified: catApps.filter((a) => a.verification_status === "verified").length,
      needs_review: catApps.filter((a) => a.verification_status === "needs_review").length,
      failed: catApps.filter((a) => a.research_status === "failed").length,
      self_serve_count: catDone.filter((a) => a.api_access_model === "self_serve").length,
      gated_count: catDone.filter((a) => a.api_access_model === "gated").length,
      mixed_count: catDone.filter((a) => a.api_access_model === "mixed").length,
      easy_count: catDone.filter((a) => a.buildability === "easy").length,
      moderate_count: catDone.filter((a) => a.buildability === "moderate").length,
      difficult_count: catDone.filter((a) => a.buildability === "difficult").length,
      official_mcp_count: catDone.filter((a) => a.mcp_status === "official").length,
      third_party_mcp_count: catDone.filter((a) => a.mcp_status === "third_party").length,
      avg_buildability_score:
        scores.length > 0
          ? Number((scores.reduce((acc, s) => acc + s, 0) / scores.length).toFixed(2))
          : null,
    };
  });

  // Evidence-based clustering across completed apps
  const toClusterRef = (a: AppRecord) => ({
    id: a.id,
    app_name: a.app_name,
    category: a.category,
    buildability: a.buildability,
    api_access_model: a.api_access_model,
    mcp_status: a.mcp_status,
  });

  const clusters = [
    {
      id: "api_ready_self_serve",
      name: "API-ready & self-serve",
      description:
        "Researched apps with confirmed public APIs, self-serve credentials, and Easy/Moderate buildability.",
      apps: completed
        .filter(
          (a) =>
            a.api_available === true &&
            a.api_access_model === "self_serve" &&
            (a.buildability === "easy" || a.buildability === "moderate")
        )
        .map(toClusterRef),
    },
    {
      id: "oauth_heavy",
      name: "OAuth-heavy integrations",
      description:
        "Apps requiring OAuth 2.0 flows (consent screens, app review, or token refresh management).",
      apps: completed
        .filter((a) =>
          a.authentication_methods.some((m) => m.toLowerCase().includes("oauth"))
        )
        .map(toClusterRef),
    },
    {
      id: "gated_access",
      name: "API available but gated",
      description:
        "Apps whose APIs require manual vendor approval, partner review, or enterprise contracts.",
      apps: completed
        .filter((a) => a.api_available === true && a.api_access_model === "gated")
        .map(toClusterRef),
    },
    {
      id: "official_mcp_ready",
      name: "Official MCP-ready applications",
      description: "Apps with vendor-maintained official MCP server support.",
      apps: completed.filter((a) => a.mcp_status === "official").map(toClusterRef),
    },
    {
      id: "third_party_mcp",
      name: "Third-party MCP ecosystem",
      description: "Apps where only community or external MCP servers were observed.",
      apps: completed.filter((a) => a.mcp_status === "third_party").map(toClusterRef),
    },
    {
      id: "complex_enterprise",
      name: "Complex enterprise integrations",
      description:
        "Difficult buildability or mixed/gated commercial access with strict compliance or multi-tenant constraints.",
      apps: completed
        .filter(
          (a) =>
            a.buildability === "difficult" ||
            a.commercial_restrictions.length >= 2
        )
        .map(toClusterRef),
    },
    {
      id: "limited_undocumented",
      name: "Limited or undocumented API access",
      description:
        "Apps with no confirmed public API, unavailable/limited docs, or unknown API availability.",
      apps: completed
        .filter(
          (a) =>
            a.api_available === false ||
            a.api_available === null ||
            a.api_doc_quality === "limited" ||
            a.api_doc_quality === "unavailable"
        )
        .map(toClusterRef),
    },
    {
      id: "needs_followup",
      name: "Requires human or commercial follow-up",
      description:
        "Researched apps flagged for human review due to uncertain claims, unreachable docs, or partner gating.",
      apps: completed
        .filter((a) => a.verification_status === "needs_review")
        .map(toClusterRef),
    },
  ];

  // Verification & Accuracy metrics computed strictly from real claims
  const appsWithVerification = completed.filter((a) => a.verification_items.length > 0);
  const allClaims = appsWithVerification.flatMap((a) => a.verification_items);
  const verifiedFirstPass = allClaims.filter((c) => c.verification_result === "verified").length;
  const corrected = allClaims.filter((c) => c.verification_result === "corrected").length;
  const unsupported = allClaims.filter((c) => c.verification_result === "unsupported").length;
  const needsHuman = allClaims.filter((c) => c.verification_result === "needs_human_review").length;
  const notVerifiable = allClaims.filter((c) => c.verification_result === "not_verifiable").length;

  const totalClaims = allClaims.length;
  const firstPassAccuracyPct =
    totalClaims > 0 ? Number(((verifiedFirstPass / totalClaims) * 100).toFixed(1)) : null;
  // Post-verification resolved = verified initially + successfully corrected against evidence
  const postVerificationAccuracyPct =
    totalClaims > 0
      ? Number((((verifiedFirstPass + corrected) / totalClaims) * 100).toFixed(1))
      : null;

  // Dynamic "What this means for Composio" grounded strictly in researched records
  const evidence_backed_findings: string[] = [];
  const strategic_recommendations: string[] = [];
  const hypotheses_requiring_followup: string[] = [];

  if (completed.length === 0) {
    evidence_backed_findings.push(
      "0 of 100 applications have been researched yet. Execute single-app, category, or full-batch research to generate evidence-backed ecosystem findings."
    );
    strategic_recommendations.push(
      "Start with a pilot batch across 1–2 high-priority categories (e.g., Developer / Infrastructure or CRM / Sales) via the Research Agent page."
    );
    hypotheses_requiring_followup.push(
      "Verify first-pass extraction accuracy on a cross-category sample once initial research records are populated."
    );
  } else {
    const selfServeCount = completed.filter((a) => a.api_access_model === "self_serve").length;
    const gatedCount = completed.filter((a) => a.api_access_model === "gated").length;
    const easyCount = completed.filter((a) => a.buildability === "easy").length;
    const officialMcpCount = completed.filter((a) => a.mcp_status === "official").length;
    const thirdPartyMcpCount = completed.filter((a) => a.mcp_status === "third_party").length;

    evidence_backed_findings.push(
      `Across ${completed.length} researched applications (${100 - completed.length} still pending/unprocessed), ${selfServeCount} (${((selfServeCount / completed.length) * 100).toFixed(1)}%) offer self-serve API access while ${gatedCount} (${((gatedCount / completed.length) * 100).toFixed(1)}%) are gated.`
    );
    evidence_backed_findings.push(
      `${easyCount} researched apps achieved an "Easy" buildability verdict, and ${officialMcpCount} have verified official MCP servers (plus ${thirdPartyMcpCount} with third-party community MCP repositories).`
    );

    const bestCategory = [...category_metrics]
      .filter((c) => c.researched > 0 && c.avg_buildability_score !== null)
      .sort((a, b) => (b.avg_buildability_score ?? 0) - (a.avg_buildability_score ?? 0))[0];

    if (bestCategory) {
      strategic_recommendations.push(
        `Prioritize quick-win toolkit coverage in "${bestCategory.category}" (avg buildability score ${bestCategory.avg_buildability_score}/5.0 across ${bestCategory.researched} researched apps, ${bestCategory.self_serve_count} self-serve).`
      );
    }

    if (officialMcpCount > 0) {
      const mcpApps = completed
        .filter((a) => a.mcp_status === "official")
        .slice(0, 5)
        .map((a) => a.app_name)
        .join(", ");
      strategic_recommendations.push(
        `Evaluate official vendor MCP servers (${mcpApps}) as fast-path adapters or reference tool schemas rather than hand-coding every endpoint from scratch.`
      );
    }

    if (gatedCount > 0) {
      const gatedNames = completed
        .filter((a) => a.api_access_model === "gated")
        .slice(0, 4)
        .map((a) => a.app_name)
        .join(", ");
      strategic_recommendations.push(
        `Route gated enterprise apps (${gatedNames}) through Composio's partner/BD approval queue before allocating engineering sprint capacity.`
      );
    }

    if (needsReview.length > 0) {
      hypotheses_requiring_followup.push(
        `${needsReview.length} researched application(s) currently require human review due to unverified URLs, ambiguous access terms, or insufficient public docs.`
      );
    }
    if (completed.length < 100) {
      hypotheses_requiring_followup.push(
        `Current findings cover ${completed.length}/100 applications; distributions may shift as remaining ${100 - completed.length} records are researched.`
      );
    }
  }

  return {
    totals: {
      total_apps: 100,
      researched: completed.length,
      pending: pending.length,
      running: running.length,
      failed: failed.length,
      verified: verified.length,
      needs_review: needsReview.length,
      unverified: unverified.length,
      completion_pct: Number(((completed.length / 100) * 100).toFixed(1)),
    },
    distributions: {
      authentication: toDistribution(authCounts, denom),
      api_availability: toDistribution(apiAvailCounts, denom),
      access_model: toDistribution(accessCounts, denom),
      mcp_status: toDistribution(mcpCounts, denom),
      buildability: toDistribution(buildCounts, denom),
      doc_quality: toDistribution(docCounts, denom),
    },
    category_metrics,
    top_blockers: Array.from(blockerCounts.entries())
      .map(([blocker, info]) => ({ blocker, count: info.count, kind: info.kind }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    clusters,
    accuracy: {
      researched_apps_with_verification: appsWithVerification.length,
      total_claims_checked: totalClaims,
      claims_verified_first_pass: verifiedFirstPass,
      claims_corrected: corrected,
      claims_unsupported: unsupported,
      claims_needs_human_review: needsHuman,
      claims_not_verifiable: notVerifiable,
      first_pass_accuracy_pct: firstPassAccuracyPct,
      post_verification_accuracy_pct: postVerificationAccuracyPct,
      sample_checks_count: sampleChecks.length,
    },
    composio_recommendations: {
      evidence_backed_findings,
      strategic_recommendations,
      hypotheses_requiring_followup,
    },
  };
}
