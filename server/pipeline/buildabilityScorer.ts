import {
  BuildabilityDimensions,
  BuildabilityScore,
  BuildabilityVerdict,
} from "../../shared/types.ts";

/**
 * Transparent 8-dimension Buildability Scoring Framework (Part 8).
 * Each dimension is scored 1 (most constrained / hardest) to 5 (most accessible / easiest).
 * Weights sum to 1.00. Notice MCP availability carries only 8% weight so an app with
 * an MCP repo but gated/unusable API access never receives an inflated score.
 */
export const BUILDABILITY_WEIGHTS: Record<keyof BuildabilityDimensions, number> = {
  authentication_complexity: 0.16,
  api_accessibility: 0.22,
  documentation_quality: 0.14,
  api_completeness: 0.14,
  access_restrictions: 0.14,
  developer_ecosystem: 0.06,
  mcp_availability: 0.08,
  operational_constraints: 0.06,
};

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, Math.round(n)));
}

export function computeBuildabilityScore(
  rawDimensions: BuildabilityDimensions,
  apiAvailable: boolean | null,
  accessModel: string
): BuildabilityScore {
  const dimensions: BuildabilityDimensions = {
    authentication_complexity: clampScore(rawDimensions.authentication_complexity),
    api_accessibility: clampScore(rawDimensions.api_accessibility),
    documentation_quality: clampScore(rawDimensions.documentation_quality),
    api_completeness: clampScore(rawDimensions.api_completeness),
    access_restrictions: clampScore(rawDimensions.access_restrictions),
    developer_ecosystem: clampScore(rawDimensions.developer_ecosystem),
    mcp_availability: clampScore(rawDimensions.mcp_availability),
    operational_constraints: clampScore(rawDimensions.operational_constraints),
  };

  let weighted = 0;
  for (const key of Object.keys(BUILDABILITY_WEIGHTS) as Array<keyof BuildabilityDimensions>) {
    weighted += dimensions[key] * BUILDABILITY_WEIGHTS[key];
  }
  const weighted_score = Number(weighted.toFixed(2));

  let mapped_verdict: BuildabilityVerdict = "unknown";
  if (apiAvailable === false) {
    mapped_verdict = "difficult";
  } else if (apiAvailable === null && dimensions.api_accessibility <= 2 && dimensions.documentation_quality <= 2) {
    mapped_verdict = "unknown";
  } else if (weighted_score >= 3.8 && accessModel !== "gated") {
    mapped_verdict = "easy";
  } else if (weighted_score >= 2.6) {
    mapped_verdict = "moderate";
  } else {
    mapped_verdict = "difficult";
  }

  const explanation = `Weighted score ${weighted_score}/5.00 across 8 dimensions (API accessibility ${dimensions.api_accessibility}/5, auth ${dimensions.authentication_complexity}/5, docs ${dimensions.documentation_quality}/5, restrictions ${dimensions.access_restrictions}/5, MCP ${dimensions.mcp_availability}/5). Mapped to "${mapped_verdict}".`;

  return {
    dimensions,
    weighted_score,
    mapped_verdict,
    explanation,
  };
}
