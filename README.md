# AppIntel AI

**Research smarter. Integrate strategically.**

---

## 1. Project Name & Description

**AppIntel AI** is a full-stack application-research, evidence-verification, and integration-intelligence platform built for **Composio's AI Product Ops Intern take-home assignment**. It evaluates **100 applications across 10 categories** to determine authentication methods, public API availability, self-serve vs. gated access models, Model Context Protocol (MCP) support, technical/commercial blockers, and integration buildability.

---

## 2. Problem Statement

Before building or maintaining external toolkits, Composio needs structured answers for each application: what it does, how developers authenticate, whether APIs are public and self-serve or enterprise-gated, whether official or community MCP servers exist, and what engineering or commercial blockers stand in the way. Doing this manually across 100 apps is slow, inconsistent, and error-prone—while unverified AI summaries frequently hallucinate OAuth support, public APIs, or "official" MCP status.

AppIntel AI automates discovery, structured extraction, and adversarial evidence verification while keeping unresearched and uncertain claims transparently separated from verified facts.

---

## 3. Key Features

- **Canonical 100-App Registry:** Initializes all 100 exact applications across 10 categories as `pending` and `unverified` (never pre-populated with fabricated findings).
- **Automated Multi-Stage Research Agent:** Runs Google Search Grounding, live HTTP documentation retrieval, structured Gemini extraction, Zod schema validation, and verification.
- **Evidence-Based Verification Loop:** Audits 8 claims per app against primary sources, preserves the first-pass AI snapshot, records corrections, and supports human reviewer overrides and manual sample-check logging.
- **8-Dimension Buildability Scoring Framework:** Transparent 1.00–5.00 weighted feasibility score that prevents MCP hype from masking gated or unavailable APIs.
- **Ecosystem Analytics & Clustering:** Real-time distributions, category comparisons, common blockers, evidence-based integration clusters, and **"What this means for Composio"** recommendations calculated strictly from completed records.
- **Standalone HTML Report & JSON Export:** Self-contained executive report at `/report.html` (with download support) and full dataset export at `/api/export/json`.

---

## 4. Architecture Overview

```text
appintel-ai/
├── shared/
│   └── types.ts                  # Canonical TypeScript schemas shared by frontend & backend
├── server/
│   ├── seed.ts                   # 100 exact applications across 10 categories (initialized pending)
│   ├── storage.ts                # Atomic JSON persistence (data/research-db.json, logs, sample checks)
│   ├── geminiClient.ts           # Server-side @google/genai client with retry & backoff
│   ├── pipeline/
│   │   ├── sourceDiscovery.ts    # Stage 1: Google Search grounding & official URL discovery
│   │   ├── docRetrieval.ts       # Stage 2: HTTP documentation fetch & HTML-to-text extraction
│   │   ├── extractor.ts          # Stage 3: Structured Gemini extraction via responseSchema
│   │   ├── validator.ts          # Stage 4: Zod schema validation & URL provenance check
│   │   ├── buildabilityScorer.ts # Stage 5: Weighted 8-dimension buildability score (1.00–5.00)
│   │   ├── verifier.ts           # Stage 6: 8-claim adversarial audit & correction loop
│   │   ├── composioProbe.ts      # Optional live Composio catalog probe (transparent if unset)
│   │   └── researchRunner.ts     # Rate-limited single/batch runner with cancel & retry
│   └── analysis/
│       ├── analytics.ts          # Distributions, category matrix, clustering, accuracy metrics
│       └── reportGenerator.ts    # Self-contained standalone HTML report builder (/report.html)
├── src/
│   ├── api.ts                    # Typed HTTP client for /api/* endpoints
│   ├── components/               # Sidebar, StatusLabel, AppDetailPanel (slide-over record view)
│   ├── pages/                    # Overview, AppResearch, Insights, ResearchAgent, Verification, Methodology
│   └── App.tsx                   # Application shell & live polling
└── server.ts                     # Express API + Vite dev middleware / production static server
```

---

## 5. Technology Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Recharts, Lucide React
- **Backend:** Node.js, Express 4, `tsx`, Zod
- **AI & Search Grounding:** `@google/genai` (`gemini-4-hydrogen`) with `googleSearch` tool and `responseSchema`
- **Persistence:** Atomic local JSON file store under `data/` (auto-initialized on boot; see Section 19 for production database options)

---

## 6. Research Pipeline Explanation

Every research run executes sequentially through eight modular stages:

1. **Source Discovery (`sourceDiscovery.ts`):** Queries Gemini with `{ googleSearch: {} }` to locate official sites, API docs, auth docs, pricing pages, and MCP links, capturing grounded URLs.
2. **Official Documentation Retrieval (`docRetrieval.ts`):** Fetches up to 5 discovered URLs over HTTP with a 7s timeout and extracts clean text excerpts.
3. **Structured Extraction (`extractor.ts`):** Prompts Gemini with `responseMimeType: "application/json"` and strict `responseSchema` grounded in the retrieved excerpts.
4. **Schema & Provenance Validation (`validator.ts`):** Validates types via Zod and verifies that cited URLs match valid HTTP(S) domains from search grounding.
5. **Buildability Scoring (`buildabilityScorer.ts`):** Computes the weighted 8-dimension score and maps to `easy | moderate | difficult | unknown`.
6. **Independent Verification (`verifier.ts`):** Tests cited URL reachability via HTTP `HEAD`/`GET`, runs an independent search-grounded audit across 8 claims, applies verified corrections only where contradicted by evidence, and classifies each claim (`verified`, `corrected`, `needs_human_review`, `unsupported`, `not_verifiable`).
7. **Persistent Storage (`storage.ts`):** Atomically writes updated records and preserves `first_pass_snapshot` for auditability.
8. **Analytics & Report Generation (`analytics.ts`, `reportGenerator.ts`):** Updates live dashboards, clusters, accuracy stats, and `/report.html`.

---

## 7. Buildability Scoring Methodology

Each completed application is scored from `1` (hardest/most restricted) to `5` (easiest/most open) across 8 weighted dimensions:

| Dimension | Weight | What It Evaluates |
| :--- | :---: | :--- |
| API Accessibility | 22% | Self-serve public API vs. mixed/paid vs. gated/unavailable |
| Auth Simplicity | 16% | API key / standard OAuth 2.0 vs. complex app review or custom auth |
| Documentation Quality | 14% | OpenAPI/SDK reference completeness vs. login-walled/sparse docs |
| API Completeness | 14% | Full CRUD + webhooks vs. narrow read-only endpoints |
| Access Openness | 14% | Free developer sandbox vs. paid tier or manual partner approval |
| MCP Availability | 8% | Official vendor MCP vs. 3P community MCP vs. none (capped at 8%) |
| Developer Ecosystem | 6% | Official TypeScript/Python SDKs and developer tooling |
| Operational Predictability | 6% | Transparent rate limits, quotas, and stability |

**Verdict Mapping:**
- **Easy:** Weighted score $\ge 3.80$ and `api_access_model !== "gated"`
- **Moderate:** Weighted score $2.60\text{–}3.79$ (or $\ge 3.80$ when gated)
- **Difficult:** Weighted score $< 2.60$ or `api_available === false`
- **Unknown:** Insufficient evidence (`api_available === null` with low accessibility/doc scores)

---

## 8. Verification Methodology

AppIntel AI maintains separate `research_status` (`pending | running | completed | failed`) and `verification_status` (`unverified | verified | needs_review`) fields. An application is **never** marked `verified` merely because Gemini returned JSON.

For every researched application, the verifier audits 8 claims (`authentication_methods`, `api_available`, `api_types`, `api_access_model`, `mcp_status`, `buildability`, `technical_restrictions`, `evidence_urls`):
- Preserves `first_pass_snapshot` before any changes.
- Verifies HTTP reachability of cited URLs.
- Flags uncertain or login-walled claims as `needs_human_review`, `unsupported`, or `not_verifiable`.
- Allows human reviewers to override any claim outcome in **Application Details → Verification Loop Audit** and log cross-category audits in **Verification → Manual Sample-Check Audit Log**.

---

## 9. Accuracy Calculation & Denominator

Accuracy metrics strictly use **audited claims across completed applications** as the denominator—never `100` when apps remain pending:

$$\text{First-Pass Claim Accuracy} = \frac{\text{claims\_verified\_first\_pass}}{\text{total\_claims\_checked}}$$

$$\text{Post-Verification Resolved Rate} = \frac{\text{claims\_verified\_first\_pass} + \text{claims\_corrected}}{\text{total\_claims\_checked}}$$

If 0 applications have been researched, accuracy displays `N/A`.

---

## 10. Setup Instructions

### Linux / macOS
```bash
git clone <your-repo-url>
cd <repo-folder>
cp .env.example .env
# Edit .env and add GEMINI_API_KEY
npm install
npm run dev
```

### Windows PowerShell
```powershell
git clone <your-repo-url>
cd <repo-folder>
Copy-Item .env.example .env
# Edit .env in Notepad or VS Code and set GEMINI_API_KEY
notepad .env
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 11. Required Environment Variables

Configure these in `.env` (never commit `.env` or real keys to GitHub):

| Variable | Required | Description |
| :--- | :---: | :--- |
| `GEMINI_API_KEY` | **Yes** (for live agent runs) | Google AI Studio API key used **server-side only** by `@google/genai`. Note: Google Search Grounding requests require a billing-enabled project if free-tier quota/permissions return `403 PERMISSION_DENIED`. |
| `APP_URL` | Optional | Public URL of the deployed service (defaults to local `http://localhost:3000`). |
| `COMPOSIO_API_KEY` | Optional | Enables the optional live Composio catalog lookup (`https://backend.composio.dev/api/v1/apps`). If omitted, the probe reports `not_configured` transparently and the core pipeline runs independently. |

---

## 12. How to Run One Application

1. Open `http://localhost:3000` and navigate to **Research Agent** (or click any row in **App Research** and click **Run Research**).
2. In **Single Application**, choose an app (e.g., `GitHub` or `Stripe`) and click **Run App**.
3. Watch the 6-stage pipeline monitor and live **Research Activity Log** update in real time.

---

## 13. How to Run One Category

1. Navigate to **Research Agent**.
2. Under **Category Batch (10 Apps)**, select one of the 10 categories (e.g., `CRM / Sales`).
3. Click **Run Category**. Applications execute sequentially with polite rate limiting (900ms spacing).

---

## 14. How to Run All 100 Applications

1. Navigate to **Research Agent**.
2. Under **Full Batch & Recovery**, click **Resume Incomplete** (for remaining `pending` apps) or **Re-run All 100**.
3. Click **Stop After Current App** at any time to gracefully cancel without corrupting completed records.

---

## 15. How to Resume or Retry Research

- **Resume Incomplete:** Processes only records still in `pending` state.
- **Retry Failed:** Re-runs only records whose previous run ended in `failed` (preserving any prior completed data if a re-run fails).

---

## 16. How to Generate the HTML Report

- **View Live:** Visit `http://localhost:3000/report.html` (or `/report.html` on your deployed URL).
- **Download Standalone Snapshot:** Click **Export HTML Report** in the top bar (or navigate to `/report.html?download=1`) to download `appintel-ai-report.html`, dynamically rendered from current stored research data.

---

## 17. How to Export JSON

Download the complete 100-app dataset, analytics summary, and manual sample checks from:
- Sidebar → **Export JSON**, or
- `GET /api/export/json` (`appintel-100-apps.json`).

---

## 18. How to Run Tests & Build the Project

### Linux / macOS
```bash
npm run lint       # TypeScript typecheck (tsc --noEmit)
npm run build      # Production Vite client bundle -> dist/
npm start          # Run production Express server on port 3000
```

### Windows PowerShell
```powershell
npm run lint
npm run build
$env:NODE_ENV="production"; npx tsx server.ts
```

Smoke-test endpoints after starting the server:
```powershell
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:3000/api/analytics
```

---

## 19. Known Limitations

1. **Ephemeral Hosting Filesystems:** The current implementation persists records to atomic JSON files (`data/research-db.json`, `data/activity-log.json`, `data/sample-checks.json`). On hosts with ephemeral container disks (such as Cloud Run, Render free tier, or serverless platforms), disk changes reset across cold restarts/redeploys unless a persistent volume is mounted or `server/storage.ts` is backed by a managed database (PostgreSQL/Drizzle or Firestore).
2. **Gemini Tier & Grounding Requirements:** Live research requires a valid `GEMINI_API_KEY` with access to `gemini-4-hydrogen` and Google Search Grounding; free-tier keys without billing enabled may return `403 PERMISSION_DENIED`.
3. **Login-Walled & Bot-Protected Docs:** Developer portals requiring account sign-in, NDAs, or returning HTTP `403`/`429` cannot be scraped autonomously; affected claims are flagged `needs_human_review`.
4. **Partner/Commercial Opacity:** Enterprise-gated APIs and commercial licensing restrictions often require manual vendor/BD follow-up.

---

## 20. Composio SDK / MCP Exploration Status

- **What was implemented:** `server/pipeline/composioProbe.ts` integrates an optional live lookup against `https://backend.composio.dev/api/v1/apps` using `process.env.COMPOSIO_API_KEY`.
- **Current status without credentials:** When `COMPOSIO_API_KEY` is not set, `/api/health` and the Research Agent page honestly report `not_configured` without fabricating toolkit matches.
- **Independent core pipeline:** The research, extraction, verification, scoring, and reporting workflows run independently of Composio credentials.
