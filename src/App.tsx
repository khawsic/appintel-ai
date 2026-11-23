import { useCallback, useEffect, useState } from "react";
import { Download, Menu } from "lucide-react";
import {
  ActivityLogEntry,
  AnalyticsSummary,
  AppCategory,
  AppRecord,
  BatchJobState,
  ClaimVerificationResult,
  SampleCheckRecord,
} from "../shared/types";
import { api, HealthStatus } from "./api";
import { NavPage, Sidebar } from "./components/Sidebar";
import { AppDetailPanel } from "./components/AppDetailPanel";
import { OverviewPage } from "./pages/OverviewPage";
import { AppResearchPage } from "./pages/AppResearchPage";
import { InsightsPage } from "./pages/InsightsPage";
import { ResearchAgentPage } from "./pages/ResearchAgentPage";
import { VerificationPage } from "./pages/VerificationPage";
import { MethodologyPage } from "./pages/MethodologyPage";

const EMPTY_BATCH: BatchJobState = {
  active: false,
  mode: null,
  target_label: null,
  total_queued: 0,
  processed: 0,
  succeeded: 0,
  failed: 0,
  current_app_id: null,
  current_app_name: null,
  current_stage: "idle",
  cancel_requested: false,
  started_at: null,
  finished_at: null,
};

export default function App() {
  const [activePage, setActivePage] = useState<NavPage>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [apps, setApps] = useState<AppRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [batch, setBatch] = useState<BatchJobState>(EMPTY_BATCH);
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [sampleChecks, setSampleChecks] = useState<SampleCheckRecord[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    try {
      const [appsResp, analyticsResp, statusResp, checksResp, healthResp] =
        await Promise.all([
          api.getApps(),
          api.getAnalytics(),
          api.getResearchStatus(),
          api.getSampleChecks(),
          api.getHealth(),
        ]);
      setApps(appsResp.apps);
      setBatch(statusResp.batch);
      setLogs(statusResp.logs);
      setAnalytics(analyticsResp);
      setSampleChecks(checksResp.checks);
      setHealth(healthResp);
      setLoadError(null);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // Poll every 2.2s while a batch or single-app research job is active
  useEffect(() => {
    if (!batch.active) return;
    const id = setInterval(() => {
      void refreshAll();
    }, 2200);
    return () => clearInterval(id);
  }, [batch.active, refreshAll]);

  const handleStartResearch = async (payload: {
    mode: "single" | "category" | "all" | "resume" | "retry_failed";
    appId?: string;
    category?: AppCategory;
  }) => {
    const res = await api.startResearch(payload);
    setBatch(res.batch);
    await refreshAll();
  };

  const handleCancelBatch = async () => {
    const res = await api.cancelResearch();
    setBatch(res.batch);
  };

  const handleResetDataset = async () => {
    await api.resetDataset();
    setSelectedAppId(null);
    await refreshAll();
  };

  const handleClearLogs = async () => {
    await api.clearLogs();
    await refreshAll();
  };

  const handleRunSingleFromDrawer = async (appId: string) => {
    await handleStartResearch({ mode: "single", appId });
  };

  const handleAddNote = async (appId: string, note: string) => {
    await api.addAppNote(appId, note);
    await refreshAll();
  };

  const handleOverrideClaim = async (
    appId: string,
    claimId: string,
    payload: {
      verification_result: ClaimVerificationResult;
      corrected_finding?: string | null;
      explanation?: string;
    }
  ) => {
    await api.overrideClaimVerification(appId, claimId, payload);
    await refreshAll();
  };

  const handleCreateSampleCheck = async (payload: {
    app_id: string;
    reviewer: string;
    fields_checked: string[];
    first_pass_reported: string;
    official_docs_stated: string;
    errors_detected: string;
    corrections_applied: string;
    remaining_uncertainty: string;
    outcome: "accurate" | "corrected" | "uncertain";
  }) => {
    await api.createSampleCheck(payload);
    await refreshAll();
  };

  const handleDeleteSampleCheck = async (id: string) => {
    await api.deleteSampleCheck(id);
    await refreshAll();
  };

  const selectedApp =
    selectedAppId !== null
      ? apps.find((a) => a.id === selectedAppId) ?? null
      : null;

  const pageTitleMap: Record<NavPage, string> = {
    overview: "Overview",
    research: "App Research",
    insights: "Insights",
    agent: "Research Agent",
    verification: "Verification",
    methodology: "Methodology",
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-[#172033]">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        researchedCount={analytics?.totals.researched ?? 0}
        verifiedCount={analytics?.totals.verified ?? 0}
        batchActive={batch.active}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Top Breadcrumb Bar */}
        <header className="h-14 bg-[#FFFFFF] border-b border-[#E5E7EB] px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-md border border-[#E5E7EB] text-[#64748B] hover:text-[#172033]"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-[#64748B] truncate">
              <span className="whitespace-nowrap">AppIntel AI</span>
              <span aria-hidden="true">/</span>
              <span className="font-medium text-[#172033] whitespace-nowrap">
                {pageTitleMap[activePage]}
              </span>
              {batch.active && (
                <>
                  <span aria-hidden="true">/</span>
                  <span className="text-[#635BFF] font-mono tabular-nums whitespace-nowrap">
                    Running {batch.current_app_name} ({batch.processed}/
                    {batch.total_queued})
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/report.html?download=1"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[#E5E7EB] bg-[#FFFFFF] text-[#172033] hover:bg-[#F8FAFC] whitespace-nowrap shrink-0 transition-colors"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export HTML Report</span>
            </a>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 px-4 sm:px-8 py-6 max-w-[1280px] w-full mx-auto">
          {loading ? (
            <div className="space-y-4">
              <div className="h-8 w-56 bg-[#E5E7EB] rounded animate-pulse" />
              <div className="h-24 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg animate-pulse" />
              <div className="h-64 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg animate-pulse" />
            </div>
          ) : loadError || !analytics ? (
            <div className="p-6 bg-[#FFFFFF] border border-[#FECACA] rounded-lg text-sm text-[#DC2626] space-y-2">
              <div className="font-semibold">Failed to load AppIntel AI data</div>
              <p className="text-xs">{loadError ?? "Analytics unavailable"}</p>
              <button
                type="button"
                onClick={() => void refreshAll()}
                className="px-3 py-1.5 text-xs font-medium bg-[#172033] text-white rounded-md"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {activePage === "overview" && (
                <OverviewPage
                  analytics={analytics}
                  apps={apps}
                  logs={logs}
                  onSelectApp={(a) => setSelectedAppId(a.id)}
                  onNavigate={setActivePage}
                />
              )}
              {activePage === "research" && (
                <AppResearchPage
                  apps={apps}
                  onSelectApp={(a) => setSelectedAppId(a.id)}
                />
              )}
              {activePage === "insights" && (
                <InsightsPage
                  analytics={analytics}
                  apps={apps}
                  onSelectApp={(a) => setSelectedAppId(a.id)}
                />
              )}
              {activePage === "agent" && (
                <ResearchAgentPage
                  apps={apps}
                  batch={batch}
                  logs={logs}
                  health={health}
                  onStartResearch={handleStartResearch}
                  onCancelBatch={handleCancelBatch}
                  onResetDataset={handleResetDataset}
                  onClearLogs={handleClearLogs}
                  onSelectApp={(a) => setSelectedAppId(a.id)}
                />
              )}
              {activePage === "verification" && (
                <VerificationPage
                  analytics={analytics}
                  apps={apps}
                  sampleChecks={sampleChecks}
                  onSelectApp={(a) => setSelectedAppId(a.id)}
                  onCreateSampleCheck={handleCreateSampleCheck}
                  onDeleteSampleCheck={handleDeleteSampleCheck}
                />
              )}
              {activePage === "methodology" && <MethodologyPage />}
            </>
          )}
        </main>
      </div>

      {/* Page 3: Application Detail Slide-over */}
      {selectedApp && (
        <AppDetailPanel
          app={selectedApp}
          batchActive={batch.active}
          onClose={() => setSelectedAppId(null)}
          onRunResearch={handleRunSingleFromDrawer}
          onAddNote={handleAddNote}
          onOverrideClaim={handleOverrideClaim}
        />
      )}
    </div>
  );
}
