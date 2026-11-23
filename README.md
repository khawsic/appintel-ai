# AppIntel AI

**Research smarter. Integrate strategically.**

---

## 1. Project Name & Description

**AppIntel AI** is a free, deterministic, evidence-based application-research and integration-intelligence platform built for **Composio's AI Product Ops Intern take-home assignment**. It evaluates **100 applications across 10 categories** to determine authentication methods, public API availability, self-serve vs. gated access models, Model Context Protocol (MCP) support, technical/commercial blockers, and integration buildability—**with zero paid AI APIs or billing required**.

---

## 2. Problem Statement

Before building or maintaining external toolkits, Composio needs structured answers for each application: what it does, how developers authenticate, whether APIs are public and self-serve or enterprise-gated, whether official or community MCP servers exist, and what engineering or commercial blockers stand in the way. Doing this manually across 100 apps is slow and error-prone—while LLM-only pipelines frequently hallucinate OAuth support, public APIs, or "official" MCP ownership and break when paid API keys lack quota or billing permissions.

AppIntel AI replaces paid LLM inference with a **curated official-source registry, live HTTP documentation retrieval, deterministic rule-based extraction, Zod excerpt provenance validation, and an independent evidence verification audit**, keeping unresearched and uncertain claims transparently separated from verified facts.

---

## 3. Key Features

- **Zero Paid AI API Dependencies:** Runs completely free on Node.js/Express without `GEMINI_API_KEY`, paid LLM inference, or search API billing.
- **Canonical 100-App Registry:** Initializes all 100 exact applications across 10 categories as `pending` and `unverified` (never pre-populated with fabricated findings).
- **Curated Official-Source Registry & HTTP Retrieval:** Maps every app to verified primary URLs (website, developer portal, API reference, auth docs, pricing/access, official vs. third-party MCP) and fetches live HTML/JSON/plain-text documentation with redirect tracking, 8s timeouts, and bot/SPA detection.
- **Deterministic Rule-Based Extraction & Provenance:** Extracts structured capabilities exclusively from fetched page text, attaching verbatim supporting excerpts and retrieval timestamps while marking missing or blocked fields as `null`/`unknown`.
- **Evidence-Based Verification Audit:** Independently audits 8 claims per app against retrieved excerpts, preserves `first_pass_snapshot`, guards against misclassifying third-party MCPs or HTTP 403/429 blocks, and preserves human reviewer overrides across re-runs.
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
│   ├── pipeline/
│   │   ├── sourceRegistry.ts     # Stage 1: Curated official source URLs & MCP ownership registry
│   │   ├── docRetrieval.ts       # Stage 2: HTTP doc fetcher, redirect/timeout/403/SPA handling
│   │   ├── extractor.ts          # Stage 3: Deterministic rule-based extraction from fetched text
│   │   ├── validator.ts          # Stage 4: Zod schema, excerpt length & URL provenance check
│   │   ├── verifier.ts           # Stage 5: 8-claim deterministic audit & human override guard
│   │   ├── buildabilityScorer.ts # Stage 6: Weighted 8-dimension buildability score (1.00–5.00)
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
- **Research Engine:** Deterministic curated-source registry + native HTTP `fetch` + rule-based text extraction & independent verification (zero `@google/genai` or LLM runtime dependencies)
- **Persistence:** Atomic local JSON file store under `data/` (auto-initialized on boot; see Section 19 for Render ephemeral filesystem notes)

---

## 6. Research Pipeline Explanation

Every research run executes sequentially through the following modular stages:

1. **Curated Official-Source Registry (`sourceRegistry.ts`):** Resolves official website, developer docs, API reference, auth docs, pricing/access pages, and official vs. community MCP URLs for the app (explicitly marking non-SaaS CLI tools or sparse/ambiguous apps).
2. **HTTP Documentation Retrieval (`docRetrieval.ts`):** Fetches up to 6 registry URLs over HTTP with redirect tracking, an 8-second timeout, HTML/JSON/plain-text extraction, and explicit categorization (`fetched`, `thin_content`, `http_error`, `timeout`, `network_error`, `invalid_url`). HTTP 403/429 responses are **never** treated as proof that an API does not exist.
3. **Deterministic Evidence Extraction (`extractor.ts`):** Scans only `fetched` documentation text to detect authentication schemes, API availability, protocols (`REST`, `GraphQL`, `Webhooks`, `SDK`, etc.), self-serve vs. gated access, rate limits, MCP ownership, and documented vs. engineering blockers—attaching verbatim excerpts and retrieval timestamps.
4. **Zod & Excerpt Provenance Validation (`validator.ts`):** Validates the full payload, enforces non-empty supporting excerpts (`>= 12` chars) and valid HTTP(S) URLs grounded in the registry/redirects.
5. **Independent Evidence Audit (`verifier.ts`):** Captures `first_pass_snapshot`, audits 8 claims against retrieved text (never marking a claim `verified` from HTTP 200 status alone), corrects uncorroborated or contradictory findings, routes blocked/ambiguous claims to `needs_human_review` / `not_verifiable`, and preserves any prior human-reviewed overrides.
6. **Buildability Scoring (`buildabilityScorer.ts`):** Computes the weighted 8-dimension score (`1.00–5.00`) and maps to `easy | moderate | difficult | unknown`.
7. **Persistent Storage (`storage.ts`):** Atomically writes updated records to `data/research-db.json` without overwriting existing records on failure.
8. **Analytics & Report Generation (`analytics.ts`, `reportGenerator.ts`):** Dynamically updates dashboards, clusters, accuracy metrics, and `/report.html`.

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
- **Easy:** Weighted score >= `3.80` and `api_access_model !== "gated"`
- **Moderate:** Weighted score `2.60–3.79` (or >= `3.80` when gated)
- **Difficult:** Weighted score `< 2.60` or `api_available === false`
- **Unknown:** Insufficient evidence (`api_available === null` with low accessibility/doc scores)

---

## 8. Verification Methodology

AppIntel AI maintains separate `research_status` (`pending | running | completed | failed`) and `verification_status` (`unverified | verified | needs_review`) fields. An application is **never** marked `verified` merely because HTTP returned `200 OK`.

For every researched application, the verifier audits 8 claims (`authentication_methods`, `api_available`, `api_types`, `api_access_model`, `mcp_status`, `buildability`, `technical_restrictions`, `evidence_urls`):
- Preserves `first_pass_snapshot` before any changes.
- Verifies that every cited claim has verbatim text support in fetched documentation.
- Flags blocked (`403`/`429`), client-side SPA (`thin_content`), or unconfirmed claims as `needs_human_review`, `unsupported`, or `not_verifiable`.
- Preserves human reviewer overrides in **Application Details -> Verification Loop Audit** across re-runs and records cross-category manual audits in **Verification -> Manual Sample-Check Audit Log**.

---

## 9. Accuracy Calculation & Denominator

Accuracy metrics strictly use **audited claims across completed applications** as the denominator—never `100` when apps remain pending:

- **First-Pass Claim Accuracy** = `claims_verified_first_pass / total_claims_checked`
- **Post-Verification Resolved Rate** = `(claims_verified_first_pass + claims_corrected) / total_claims_checked`

If 0 applications have been researched, accuracy displays `N/A`.

---

## 10. Setup Instructions

No paid API keys are required to run AppIntel AI locally or in production.

### Linux / macOS
```bash
git clone https://github.com/khawsic/appintel-ai.git
cd appintel-ai
cp .env.example .env
npm install
npm run dev
```

### Windows PowerShell
```powershell
git clone https://github.com/khawsic/appintel-ai.git
cd appintel-ai
Copy-Item .env.example .env
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 11. Environment Variables

Configure these in `.env` (never commit `.env` or real keys to GitHub):

| Variable | Required | Description |
| :--- | :---: | :--- |
| `PORT` | Optional | Server HTTP port (defaults to `3000`; automatically injected by Render). |
| `APP_URL` | Optional | Public URL of the deployed service (defaults to local `http://localhost:3000`). |
| `COMPOSIO_API_KEY` | Optional | Enables the optional live Composio catalog lookup (`https://backend.composio.dev/api/v1/apps`). If omitted, the probe reports `not_configured` transparently and the core pipeline runs independently. |

*(Note: `GEMINI_API_KEY` has been completely removed and is no longer used or required anywhere in the application.)*

---

## 12. How to Run Research (Single, Category, All 100, Resume/Retry)

- **Single Application:** Open **Research Agent**, choose an app (e.g., `GitHub` or `Stripe`), and click **Run App** (or open any app row and click **Run Research**).
- **Category Batch (10 Apps):** In **Research Agent**, select a category and click **Run Category**. Apps run sequentially with polite 450ms spacing.
- **Full Batch & Recovery:** Click **Resume Incomplete** (processes only `pending` apps), **Retry Failed** (re-runs only `failed` apps without corrupting completed records), or **Re-run All 100**. Click **Stop After Current App** anytime to cancel safely.

---

## 13. Reports & Data Export

- **Live Standalone HTML Report:** Visit `/report.html` (or click **Export HTML Report** / `/report.html?download=1` to download `appintel-ai-report.html`).
- **JSON Dataset Export:** Click **Export JSON** in the sidebar or request `GET /api/export/json` (`appintel-100-apps.json`).

---

## 14. Tests & Build

### Linux / macOS
```bash
npm run lint       # TypeScript typecheck (tsc --noEmit)
npm run build      # Production Vite client bundle -> dist/
npm start          # Run production Express server on PORT (default 3000)
```

### Windows PowerShell
```powershell
npm run lint
npm run build
npm start
```

Smoke-test endpoints:
```powershell
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:3000/api/analytics
```

---

## 15. Deploying to Render

1. Push the repository to GitHub (e.g., `https://github.com/khawsic/appintel-ai`).
2. Create a **Web Service** on Render connected to the repository:
   - **Runtime:** Node (Node 20+ recommended)
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start` (runs `tsx server.ts --production` binding `0.0.0.0:$PORT`)
3. Environment Variables on Render:
   - No AI keys required!
   - Optionally set `APP_URL=https://appintel-ai.onrender.com` and `COMPOSIO_API_KEY` if desired.
4. Verify live endpoints after deploy:
   - `GET /api/health` -> returns `{ ok: true, researchReady: true, pipelineMode: "deterministic_evidence_first", ... }`
   - `GET /report.html` -> renders standalone executive report cleanly in incognito.

---

## 16. Known Limitations

1. **Render Ephemeral Filesystem:** `server/storage.ts` persists records to local atomic JSON files (`data/research-db.json`, `data/activity-log.json`, `data/sample-checks.json`). On Render's free tier (or other ephemeral container hosts), local disk writes reset across container restarts or redeployments unless a Render Persistent Disk is mounted at `/data` or `storage.ts` is backed by a managed database (PostgreSQL / Firestore).
2. **Bot Protection & Client-Side SPAs:** Some SaaS vendor portals return HTTP `403`/`429` anti-bot responses or render documentation purely client-side (`thin_content`). The pipeline records these transparently as retrieval blockers and routes affected claims to `needs_human_review` rather than guessing or misclassifying the app as having no API.
3. **Login-Walled / Partner-Gated Docs:** Documentation behind account sign-in or partner NDAs cannot be retrieved automatically and requires manual Product Ops verification.
4. **Curated Source Maintenance:** Because source discovery no longer relies on paid search APIs, adding brand-new documentation URLs or updated MCP repo links requires updating `server/pipeline/sourceRegistry.ts`.

---

## 17. Composio SDK / MCP Exploration Status

- `server/pipeline/composioProbe.ts` performs an optional live lookup against `https://backend.composio.dev/api/v1/apps` when `COMPOSIO_API_KEY` is configured.
- When `COMPOSIO_API_KEY` is absent, `/api/health` and the UI report `not_configured` transparently without fabricating toolkit matches.
