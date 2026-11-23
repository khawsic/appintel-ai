import { AppCategory, AppRecord, BatchJobState, PipelineStage } from "../../shared/types.ts";
import { storage } from "../storage.ts";
import { getCuratedSourcesForApp } from "./sourceRegistry.ts";
import { retrieveDocumentation } from "./docRetrieval.ts";
import { extractAppIntelligence } from "./extractor.ts";
import { computeBuildabilityScore } from "./buildabilityScorer.ts";
import { runVerificationLoop } from "./verifier.ts";
import { checkAppInComposio } from "./composioProbe.ts";

class ResearchRunner {
  private batchState: BatchJobState = {
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

  getBatchState(): BatchJobState {
    return { ...this.batchState };
  }

  requestCancel(): BatchJobState {
    if (this.batchState.active) {
      this.batchState.cancel_requested = true;
      storage.addLog({
        app_id: "batch",
        app_name: "Batch Runner",
        stage: "batch",
        status: "warning",
        message: "Cancellation requested. Finishing current application before stopping.",
      });
    }
    return this.getBatchState();
  }

  private setStage(app: AppRecord, stage: PipelineStage, message: string): void {
    this.batchState.current_app_id = app.id;
    this.batchState.current_app_name = app.app_name;
    this.batchState.current_stage = stage;
    storage.addLog({
      app_id: app.id,
      app_name: app.app_name,
      stage,
      status: "info",
      message,
    });
  }

  async researchSingleApp(appId: string): Promise<AppRecord> {
    const existing = storage.getAppById(appId);
    if (!existing) {
      throw new Error(`Application "${appId}" not found.`);
    }

    const runningRecord: AppRecord = {
      ...existing,
      research_status: "running",
      error_message: null,
    };
    storage.upsertApp(runningRecord);

    try {
      // Stage 1: Curated Official Source Registry
      this.setStage(
        existing,
        "source_registry",
        `Resolving curated official website, API docs, auth docs, pricing, and MCP URLs for ${existing.app_name}.`
      );
      const { entry: registryEntry, urlsToFetch } = getCuratedSourcesForApp(existing.id);

      // Stage 2: Public HTTP Documentation Retrieval
      this.setStage(
        existing,
        "doc_retrieval",
        `Fetching ${urlsToFetch.length} curated documentation URL(s) over HTTP.`
      );
      const retrievedDocs = await retrieveDocumentation(urlsToFetch);
      const fetchedCount = retrievedDocs.filter((d) => d.status === "fetched").length;

      // Stage 3 & 4: Deterministic Evidence Extraction + Zod Provenance Validation
      this.setStage(
        existing,
        "evidence_extraction",
        `Extracting structured integration intelligence from ${fetchedCount}/${retrievedDocs.length} fetched official docs.`
      );
      const extracted = extractAppIntelligence(
        existing.app_name,
        existing.category,
        registryEntry,
        retrievedDocs
      );

      this.setStage(
        existing,
        "evidence_validation",
        `Validated evidence excerpts and URL provenance (${extracted.evidence.length} cited evidence item(s)).`
      );

      // Stage 5: Deterministic Independent Verification Audit
      this.setStage(
        existing,
        "evidence_verification",
        `Auditing 8 claims against retrieved text excerpts and guarding official vs. third-party MCP and access claims.`
      );
      const verification = await runVerificationLoop(
        existing.app_name,
        extracted,
        registryEntry,
        retrievedDocs,
        existing
      );

      // Recompute buildability score after verified updates
      const score = computeBuildabilityScore(
        extracted.dimensions,
        verification.updatedApiAvailable,
        verification.updatedAccessModel
      );

      // Optional Composio catalog check
      const composioCheck = await checkAppInComposio(existing.app_name);

      // Stage 6: Persistent Storage
      this.setStage(existing, "saving", `Saving verified record for ${existing.app_name}.`);
      const now = new Date().toISOString();

      const mergedNotes = Array.from(new Set([...extracted.notes, ...existing.notes]));

      const completedRecord: AppRecord = {
        ...existing,
        official_website: extracted.official_website,
        description: extracted.description,
        primary_purpose: extracted.primary_purpose,
        use_cases: extracted.use_cases,
        authentication_methods: verification.updatedAuthMethods,
        authentication_evidence: extracted.authentication_evidence,
        api_available: verification.updatedApiAvailable,
        api_types: verification.updatedApiTypes,
        api_surface: extracted.api_surface,
        api_access_model: verification.updatedAccessModel,
        access_model_reasoning: extracted.access_model_reasoning,
        access_restrictions: extracted.access_restrictions,
        api_rate_limits: extracted.api_rate_limits,
        api_doc_quality: extracted.api_doc_quality,
        mcp_status: verification.updatedMcpStatus,
        mcp_server_name: extracted.mcp_server_name,
        mcp_repository_url: extracted.mcp_repository_url,
        mcp_ownership: extracted.mcp_ownership,
        mcp_capabilities: extracted.mcp_capabilities,
        mcp_maintained: extracted.mcp_maintained,
        mcp_limitations: extracted.mcp_limitations,
        buildability: verification.updatedBuildability,
        buildability_reasoning: extracted.buildability_reasoning,
        buildability_score: score,
        blockers: extracted.blockers.map((b) => ({
          description: b.description,
          kind: b.kind,
          evidence_url: b.evidence_url ?? undefined,
        })),
        commercial_restrictions: extracted.commercial_restrictions,
        evidence: verification.updatedEvidence,
        research_status: "completed",
        verification_status: verification.verificationStatus,
        verification_items: verification.verificationItems,
        first_pass_snapshot: verification.firstPassSnapshot,
        composio_check: composioCheck,
        confidence: extracted.confidence,
        last_researched: now,
        error_message: null,
        notes: mergedNotes,
      };

      storage.upsertApp(completedRecord);

      const correctedCount = verification.verificationItems.filter(
        (v) => v.verification_result === "corrected"
      ).length;

      storage.addLog({
        app_id: existing.id,
        app_name: existing.app_name,
        stage: "saving",
        status: verification.verificationStatus === "verified" ? "success" : "warning",
        message: `Completed ${existing.app_name}: ${completedRecord.buildability} buildability (${score.weighted_score}/5), access=${completedRecord.api_access_model}, MCP=${completedRecord.mcp_status}, verification=${completedRecord.verification_status} (${correctedCount} corrections).`,
      });

      return completedRecord;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);

      const failedRecord: AppRecord = {
        ...existing,
        research_status: "failed",
        error_message: msg,
        last_researched: new Date().toISOString(),
      };
      storage.upsertApp(failedRecord);
      storage.addLog({
        app_id: existing.id,
        app_name: existing.app_name,
        stage: "error",
        status: "error",
        message: `Research failed for ${existing.app_name}: ${msg}`,
      });
      throw err;
    }
  }

  async startBatch(params: {
    mode: "single" | "category" | "all" | "resume" | "retry_failed";
    appId?: string;
    category?: AppCategory;
  }): Promise<BatchJobState> {
    if (this.batchState.active) {
      throw new Error("A research job is already running. Wait for completion or cancel it first.");
    }

    const allApps = storage.getAllApps();
    let queue: AppRecord[] = [];
    let targetLabel = "";

    if (params.mode === "single") {
      const target = allApps.find((a) => a.id === params.appId);
      if (!target) throw new Error("Target application not found.");
      queue = [target];
      targetLabel = target.app_name;
    } else if (params.mode === "category") {
      if (!params.category) throw new Error("Category is required.");
      queue = allApps.filter((a) => a.category === params.category);
      targetLabel = params.category;
    } else if (params.mode === "all") {
      queue = [...allApps];
      targetLabel = "All 100 Applications";
    } else if (params.mode === "resume") {
      queue = allApps.filter(
        (a) => a.research_status === "pending" || a.research_status === "running"
      );
      targetLabel = `Resume Incomplete (${queue.length} pending)`;
    } else if (params.mode === "retry_failed") {
      queue = allApps.filter((a) => a.research_status === "failed");
      targetLabel = `Retry Failed (${queue.length} failed)`;
    }

    if (queue.length === 0) {
      throw new Error("No applications matched the selected queue criteria.");
    }

    this.batchState = {
      active: true,
      mode: params.mode,
      target_label: targetLabel,
      total_queued: queue.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      current_app_id: queue[0].id,
      current_app_name: queue[0].app_name,
      current_stage: "source_registry",
      cancel_requested: false,
      started_at: new Date().toISOString(),
      finished_at: null,
    };

    storage.addLog({
      app_id: "batch",
      app_name: "Batch Runner",
      stage: "batch",
      status: "info",
      message: `Started ${params.mode} batch for "${targetLabel}" (${queue.length} queued).`,
    });

    // Execute sequentially in background with polite 450ms spacing between apps
    void this.runQueueAsync(queue);

    return this.getBatchState();
  }

  private async runQueueAsync(queue: AppRecord[]): Promise<void> {
    try {
      for (let i = 0; i < queue.length; i++) {
        if (this.batchState.cancel_requested) {
          storage.addLog({
            app_id: "batch",
            app_name: "Batch Runner",
            stage: "batch",
            status: "warning",
            message: `Batch stopped after ${this.batchState.processed}/${this.batchState.total_queued} applications.`,
          });
          break;
        }

        const item = queue[i];
        try {
          await this.researchSingleApp(item.id);
          this.batchState.succeeded += 1;
        } catch {
          this.batchState.failed += 1;
        } finally {
          this.batchState.processed += 1;
        }

        // Polite rate limiting pause between applications
        if (i < queue.length - 1 && !this.batchState.cancel_requested) {
          await new Promise((resolve) => setTimeout(resolve, 450));
        }
      }
    } finally {
      this.batchState.active = false;
      this.batchState.current_stage = "idle";
      this.batchState.current_app_id = null;
      this.batchState.current_app_name = null;
      this.batchState.finished_at = new Date().toISOString();
      storage.addLog({
        app_id: "batch",
        app_name: "Batch Runner",
        stage: "batch",
        status: this.batchState.failed === 0 ? "success" : "warning",
        message: `Batch finished: ${this.batchState.succeeded} succeeded, ${this.batchState.failed} failed out of ${this.batchState.processed} processed.`,
      });
    }
  }
}

export const researchRunner = new ResearchRunner();
