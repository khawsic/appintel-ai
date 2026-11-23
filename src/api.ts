import {
  ActivityLogEntry,
  AnalyticsSummary,
  AppCategory,
  AppRecord,
  BatchJobState,
  ClaimVerificationResult,
  SampleCheckRecord,
} from "../shared/types";

export interface HealthStatus {
  ok: boolean;
  geminiConfigured: boolean;
  composio: {
    configured: boolean;
    endpoint_tested: string;
    status: "connected" | "not_configured" | "error";
    message: string;
    catalog_count: number | null;
  };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getHealth: () => requestJson<HealthStatus>("/api/health"),

  getApps: () =>
    requestJson<{ apps: AppRecord[]; batch: BatchJobState }>("/api/apps"),

  getApp: (id: string) => requestJson<AppRecord>(`/api/apps/${id}`),

  getAnalytics: () => requestJson<AnalyticsSummary>("/api/analytics"),

  getResearchStatus: () =>
    requestJson<{ batch: BatchJobState; logs: ActivityLogEntry[] }>(
      "/api/research/status"
    ),

  startResearch: (payload: {
    mode: "single" | "category" | "all" | "resume" | "retry_failed";
    appId?: string;
    category?: AppCategory;
  }) =>
    requestJson<{ started: boolean; batch: BatchJobState }>("/api/research/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  cancelResearch: () =>
    requestJson<{ batch: BatchJobState }>("/api/research/cancel", {
      method: "POST",
    }),

  resetDataset: () =>
    requestJson<{ apps: AppRecord[] }>("/api/research/reset", {
      method: "POST",
    }),

  clearLogs: () =>
    requestJson<{ ok: boolean }>("/api/research/logs", {
      method: "DELETE",
    }),

  addAppNote: (appId: string, note: string) =>
    requestJson<AppRecord>(`/api/apps/${appId}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    }),

  overrideClaimVerification: (
    appId: string,
    claimId: string,
    payload: {
      verification_result: ClaimVerificationResult;
      corrected_finding?: string | null;
      explanation?: string;
    }
  ) =>
    requestJson<AppRecord>(`/api/apps/${appId}/verification/${claimId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  getSampleChecks: () =>
    requestJson<{ checks: SampleCheckRecord[] }>("/api/sample-checks"),

  createSampleCheck: (payload: {
    app_id: string;
    reviewer: string;
    fields_checked: string[];
    first_pass_reported: string;
    official_docs_stated: string;
    errors_detected: string;
    corrections_applied: string;
    remaining_uncertainty: string;
    outcome: "accurate" | "corrected" | "uncertain";
  }) =>
    requestJson<SampleCheckRecord>("/api/sample-checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  deleteSampleCheck: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/sample-checks/${id}`, {
      method: "DELETE",
    }),
};
