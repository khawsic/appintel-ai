import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { AppCategory, ClaimVerificationResult } from "./shared/types.ts";
import { storage } from "./server/storage.ts";
import { researchRunner } from "./server/pipeline/researchRunner.ts";
import { computeAnalytics } from "./server/analysis/analytics.ts";
import { probeComposioEnvironment } from "./server/pipeline/composioProbe.ts";
import { generateStandaloneHtmlReport } from "./server/analysis/reportGenerator.ts";

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  storage.init();
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  // Health & environment readiness
  app.get("/api/health", async (_req, res) => {
    const composio = await probeComposioEnvironment();
    res.json({
      ok: true,
      researchReady: true,
      pipelineMode: "deterministic_evidence_first",
      composio,
    });
  });

  // Dataset endpoints
  app.get("/api/apps", (_req, res) => {
    res.json({
      apps: storage.getAllApps(),
      batch: researchRunner.getBatchState(),
    });
  });

  app.get("/api/apps/:id", (req, res) => {
    const record = storage.getAppById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: "Application not found" });
    }
    res.json(record);
  });

  // Update notes or manual verification overrides for an application
  app.patch("/api/apps/:id/notes", (req, res) => {
    const record = storage.getAppById(req.params.id);
    if (!record) return res.status(404).json({ error: "Application not found" });
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
    if (!note) return res.status(400).json({ error: "Note text is required" });

    const updated = storage.upsertApp({
      ...record,
      notes: [note, ...record.notes],
    });
    storage.addLog({
      app_id: record.id,
      app_name: record.app_name,
      stage: "human_review",
      status: "info",
      message: `Reviewer added note: "${note.slice(0, 80)}"`,
    });
    res.json(updated);
  });

  // Human review override on a specific verification claim
  app.patch("/api/apps/:id/verification/:claimId", (req, res) => {
    const record = storage.getAppById(req.params.id);
    if (!record) return res.status(404).json({ error: "Application not found" });

    const { verification_result, corrected_finding, explanation } = req.body as {
      verification_result?: ClaimVerificationResult;
      corrected_finding?: string | null;
      explanation?: string;
    };

    const allowed: ClaimVerificationResult[] = [
      "verified",
      "corrected",
      "needs_human_review",
      "unsupported",
      "not_verifiable",
    ];
    if (!verification_result || !allowed.includes(verification_result)) {
      return res.status(400).json({ error: "Invalid verification_result" });
    }

    const now = new Date().toISOString();
    const updatedItems = record.verification_items.map((item) => {
      if (item.id !== req.params.claimId) return item;
      return {
        ...item,
        verification_result,
        corrected_finding:
          corrected_finding !== undefined ? corrected_finding : item.corrected_finding,
        explanation: explanation?.trim() ? explanation.trim() : item.explanation,
        human_override: true,
        reviewed_at: now,
      };
    });

    const hasFlagged = updatedItems.some(
      (v) =>
        v.verification_result === "needs_human_review" ||
        v.verification_result === "unsupported" ||
        v.verification_result === "not_verifiable"
    );

    const updated = storage.upsertApp({
      ...record,
      verification_items: updatedItems,
      verification_status:
        updatedItems.length > 0 && !hasFlagged ? "verified" : "needs_review",
    });

    storage.addLog({
      app_id: record.id,
      app_name: record.app_name,
      stage: "human_review",
      status: "success",
      message: `Human reviewer updated claim verification to "${verification_result}".`,
    });

    res.json(updated);
  });

  // Research Agent endpoints
  app.get("/api/research/status", (_req, res) => {
    res.json({
      batch: researchRunner.getBatchState(),
      logs: storage.getLogs(150),
    });
  });

  app.post("/api/research/run", async (req, res) => {
    const { mode, appId, category } = req.body as {
      mode?: "single" | "category" | "all" | "resume" | "retry_failed";
      appId?: string;
      category?: AppCategory;
    };

    if (!mode) {
      return res.status(400).json({ error: "Research mode is required." });
    }

    try {
      const state = await researchRunner.startBatch({ mode, appId, category });
      res.json({ started: true, batch: state });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: msg });
    }
  });

  app.post("/api/research/cancel", (_req, res) => {
    const state = researchRunner.requestCancel();
    res.json({ batch: state });
  });

  app.post("/api/research/reset", (_req, res) => {
    if (researchRunner.getBatchState().active) {
      return res
        .status(400)
        .json({ error: "Cannot reset dataset while a research job is actively running." });
    }
    const apps = storage.resetAllApps();
    res.json({ apps });
  });

  app.delete("/api/research/logs", (_req, res) => {
    storage.clearLogs();
    res.json({ ok: true });
  });

  // Analytics & Insights
  app.get("/api/analytics", (_req, res) => {
    res.json(computeAnalytics());
  });

  // Manual sample-check audits (Part 6.4)
  app.get("/api/sample-checks", (_req, res) => {
    res.json({ checks: storage.getSampleChecks() });
  });

  app.post("/api/sample-checks", (req, res) => {
    const body = req.body as {
      app_id?: string;
      reviewer?: string;
      fields_checked?: string[];
      first_pass_reported?: string;
      official_docs_stated?: string;
      errors_detected?: string;
      corrections_applied?: string;
      remaining_uncertainty?: string;
      outcome?: "accurate" | "corrected" | "uncertain";
    };

    const appRecord = body.app_id ? storage.getAppById(body.app_id) : undefined;
    if (!appRecord) {
      return res.status(400).json({ error: "Valid app_id is required." });
    }
    if (!body.official_docs_stated?.trim()) {
      return res.status(400).json({ error: "official_docs_stated is required." });
    }

    const created = storage.addSampleCheck({
      app_id: appRecord.id,
      app_name: appRecord.app_name,
      category: appRecord.category,
      reviewer: body.reviewer?.trim() || "Product Ops Reviewer",
      fields_checked: body.fields_checked?.length
        ? body.fields_checked
        : ["Authentication", "API Access Model", "MCP Status"],
      first_pass_reported: body.first_pass_reported?.trim() || "Not specified",
      official_docs_stated: body.official_docs_stated.trim(),
      errors_detected: body.errors_detected?.trim() || "None",
      corrections_applied: body.corrections_applied?.trim() || "None",
      remaining_uncertainty: body.remaining_uncertainty?.trim() || "None",
      outcome: body.outcome ?? "accurate",
    });

    storage.addLog({
      app_id: appRecord.id,
      app_name: appRecord.app_name,
      stage: "human_review",
      status: "info",
      message: `Manual sample check logged for ${appRecord.app_name} (${created.outcome}).`,
    });

    res.json(created);
  });

  app.delete("/api/sample-checks/:id", (req, res) => {
    const deleted = storage.deleteSampleCheck(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Sample check not found" });
    res.json({ ok: true });
  });

  // Standalone HTML Report (Deliverable 1)
  app.get("/report.html", async (req, res) => {
    const analytics = computeAnalytics();
    const apps = storage.getAllApps();
    const sampleChecks = storage.getSampleChecks();
    const composio = await probeComposioEnvironment();
    const html = generateStandaloneHtmlReport(analytics, apps, sampleChecks, composio);
    if (req.query.download === "1") {
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="appintel-ai-report.html"'
      );
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  // JSON dataset export for reproducibility
  app.get("/api/export/json", (_req, res) => {
    res.setHeader("Content-Disposition", 'attachment; filename="appintel-100-apps.json"');
    res.json({
      exported_at: new Date().toISOString(),
      analytics: computeAnalytics(),
      sample_checks: storage.getSampleChecks(),
      applications: storage.getAllApps(),
    });
  });

  // Vite middleware in development; static dist in production
  const isProd =
    process.env.NODE_ENV === "production" ||
    process.argv.includes("--production");
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get("/{*path}", (_req, res) => {
        res.sendFile(path.join(distDir, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AppIntel AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
