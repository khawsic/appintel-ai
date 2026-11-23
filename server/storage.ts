import fs from "fs";
import path from "path";
import {
  ActivityLogEntry,
  AppRecord,
  SampleCheckRecord,
} from "../shared/types.ts";
import { createInitial100Apps } from "./seed.ts";

const DATA_DIR = path.resolve(process.cwd(), "data");
const APPS_FILE = path.join(DATA_DIR, "research-db.json");
const LOGS_FILE = path.join(DATA_DIR, "activity-log.json");
const SAMPLE_CHECKS_FILE = path.join(DATA_DIR, "sample-checks.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function atomicWriteJson(filePath: string, data: unknown): void {
  ensureDataDir();
  const tempPath = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tempPath, filePath);
}

function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

class ResearchStorage {
  private apps: AppRecord[] = [];
  private logs: ActivityLogEntry[] = [];
  private sampleChecks: SampleCheckRecord[] = [];
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    ensureDataDir();

    if (!fs.existsSync(APPS_FILE)) {
      this.apps = createInitial100Apps();
      atomicWriteJson(APPS_FILE, this.apps);
    } else {
      const loaded = readJsonSafe<AppRecord[]>(APPS_FILE, []);
      if (loaded.length !== 100) {
        const seeded = createInitial100Apps();
        const byId = new Map(loaded.map((a) => [a.id, a]));
        this.apps = seeded.map((s) => byId.get(s.id) ?? s);
        atomicWriteJson(APPS_FILE, this.apps);
      } else {
        this.apps = loaded;
      }
    }

    // Recover any interrupted running states on server restart
    let recovered = false;
    for (const app of this.apps) {
      if (app.research_status === "running") {
        app.research_status = "pending";
        recovered = true;
      }
    }
    if (recovered) {
      atomicWriteJson(APPS_FILE, this.apps);
    }

    this.logs = readJsonSafe<ActivityLogEntry[]>(LOGS_FILE, []);
    this.sampleChecks = readJsonSafe<SampleCheckRecord[]>(SAMPLE_CHECKS_FILE, []);
    this.initialized = true;
  }

  getAllApps(): AppRecord[] {
    this.init();
    return this.apps;
  }

  getAppById(id: string): AppRecord | undefined {
    this.init();
    return this.apps.find((a) => a.id === id);
  }

  upsertApp(updated: AppRecord): AppRecord {
    this.init();
    const idx = this.apps.findIndex((a) => a.id === updated.id);
    if (idx === -1) {
      throw new Error(`Unknown application ID: ${updated.id}`);
    }
    this.apps[idx] = updated;
    atomicWriteJson(APPS_FILE, this.apps);
    return updated;
  }

  resetAllApps(): AppRecord[] {
    this.init();
    this.apps = createInitial100Apps();
    atomicWriteJson(APPS_FILE, this.apps);
    this.addLog({
      app_id: "system",
      app_name: "Dataset",
      stage: "batch",
      status: "info",
      message: "Reset all 100 application records to initial pending state.",
    });
    return this.apps;
  }

  getLogs(limit = 200): ActivityLogEntry[] {
    this.init();
    return this.logs.slice(0, limit);
  }

  addLog(entry: Omit<ActivityLogEntry, "id" | "timestamp">): ActivityLogEntry {
    this.init();
    const fullEntry: ActivityLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.logs.unshift(fullEntry);
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(0, 500);
    }
    atomicWriteJson(LOGS_FILE, this.logs);
    return fullEntry;
  }

  clearLogs(): void {
    this.init();
    this.logs = [];
    atomicWriteJson(LOGS_FILE, this.logs);
  }

  getSampleChecks(): SampleCheckRecord[] {
    this.init();
    return this.sampleChecks;
  }

  addSampleCheck(check: Omit<SampleCheckRecord, "id" | "checked_at">): SampleCheckRecord {
    this.init();
    const item: SampleCheckRecord = {
      id: `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      checked_at: new Date().toISOString(),
      ...check,
    };
    this.sampleChecks.unshift(item);
    atomicWriteJson(SAMPLE_CHECKS_FILE, this.sampleChecks);
    return item;
  }

  deleteSampleCheck(id: string): boolean {
    this.init();
    const before = this.sampleChecks.length;
    this.sampleChecks = this.sampleChecks.filter((c) => c.id !== id);
    if (this.sampleChecks.length !== before) {
      atomicWriteJson(SAMPLE_CHECKS_FILE, this.sampleChecks);
      return true;
    }
    return false;
  }
}

export const storage = new ResearchStorage();
