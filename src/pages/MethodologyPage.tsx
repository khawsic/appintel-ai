export function MethodologyPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-[#172033] tracking-tight">
          Research Methodology & Scoring Framework
        </h1>
        <p className="text-sm text-[#64748B] mt-1">
          A plain-language explanation of how AppIntel AI discovers sources,
          extracts properties, verifies claims, measures accuracy, and scores
          integration feasibility.
        </p>
      </div>

      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg divide-y divide-[#E5E7EB]">
        <section className="p-6 space-y-2">
          <h2 className="text-sm font-semibold text-[#172033]">
            01. Why This Research Was Conducted & 100-App Scope
          </h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Before committing engineering time to build or upgrade integrations,
            Composio needs reliable operational intelligence: how an app
            authenticates, whether its developer API is public or gated behind
            enterprise contracts, whether an official MCP server already exists,
            and what technical or commercial blockers exist. The dataset covers
            100 named applications grouped evenly across 10 strategic categories
            (CRM/Sales, Support/Helpdesk, Communications, Marketing/Ads,
            Ecommerce, Data/SEO/Scraping, Developer/Infra, Productivity,
            Finance/Fintech, and AI/Media-native). Every record initializes as{" "}
            <span className="font-mono text-[#172033]">pending</span> and{" "}
            <span className="font-mono text-[#172033]">unverified</span> so
            incomplete coverage is never masked.
          </p>
        </section>

        <section className="p-6 space-y-2">
          <h2 className="text-sm font-semibold text-[#172033]">
            02. Curated Official-Source Registry &amp; HTTP Retrieval
          </h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            The pipeline maps every canonical application to a curated official
            source registry containing verified primary URLs: official product
            sites, developer portals, API references, authentication guides,
            pricing/access pages, and official vs. community MCP repositories
            (leaving unconfirmed entries as <span className="font-mono text-[#172033]">null</span>).
            Up to six source URLs per app are fetched directly over HTTP with
            redirect tracking, 8-second timeouts, bot/SPA detection, and
            HTML/JSON-to-text extraction.
          </p>
        </section>

        <section className="p-6 space-y-2">
          <h2 className="text-sm font-semibold text-[#172033]">
            03. Deterministic Evidence Extraction &amp; Provenance Validation
          </h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            A deterministic rule-based extractor inspects only fetched page text
            and produces a strict JSON payload validated by Zod. Every extracted
            factual claim attaches a real URL, retrieval timestamp, and verbatim
            supporting excerpt. Unfetched, HTTP 403/429-blocked, or ambiguous
            fields remain <span className="font-mono text-[#172033]">null</span>{" "}
            or <span className="font-mono text-[#172033]">unknown</span>—never
            guessed or treated as proof that no API exists.
          </p>
        </section>

        <section className="p-6 space-y-2">
          <h2 className="text-sm font-semibold text-[#172033]">
            04. Independent Evidence Audit &amp; Accuracy Measurement
          </h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Every researched app enters an independent deterministic verification
            audit across 8 core claim groups (authentication, API availability,
            API types, access model, MCP ownership, buildability, technical
            restrictions, and evidence excerpts). URL reachability alone never
            marks a claim verified: each claim must match corroborating text in
            retrieved excerpts without contradiction, and prior human-reviewed
            overrides are preserved across re-runs. Outcomes are tagged{" "}
            <span className="font-mono text-[#15803D]">verified</span>,{" "}
            <span className="font-mono text-[#635BFF]">corrected</span>,{" "}
            <span className="font-mono text-[#D97706]">needs_human_review</span>,{" "}
            <span className="font-mono text-[#DC2626]">unsupported</span>, or{" "}
            <span className="font-mono text-[#64748B]">not_verifiable</span>.
            First-pass accuracy equals{" "}
            <span className="font-mono text-[#172033]">
              verified_first_pass / total_claims_checked
            </span>
            , using only audited claims as the denominator.
          </p>
        </section>

        <section className="p-6 space-y-3">
          <h2 className="text-sm font-semibold text-[#172033]">
            05. 8-Dimension Buildability Scoring Framework (1.00–5.00)
          </h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Each application is scored across eight 1–5 dimensions (1 = severe
            friction, 5 = frictionless). Notice MCP availability receives only an
            8% weight so an app with a community MCP repo but gated or broken API
            access cannot receive an artificially high score.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-[11px] text-[#64748B]">
                  <th className="py-2 pr-4">Dimension</th>
                  <th className="py-2 pr-4 text-right">Weight</th>
                  <th className="py-2">Scoring Rule (1–5)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-[#172033]">
                <tr>
                  <td className="py-2 pr-4 font-medium">API Accessibility</td>
                  <td className="py-2 pr-4 text-right font-mono">22%</td>
                  <td className="py-2 text-[#64748B]">5 = self-serve public API; 3 = mixed/paid tier; 1 = gated or no public API</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">Auth Simplicity</td>
                  <td className="py-2 pr-4 text-right font-mono">16%</td>
                  <td className="py-2 text-[#64748B]">5 = clean API key / standard OAuth2; 3 = multi-step OAuth review; 1 = custom/mTLS/manual</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">Documentation Quality</td>
                  <td className="py-2 pr-4 text-right font-mono">14%</td>
                  <td className="py-2 text-[#64748B]">5 = interactive OpenAPI/SDK reference; 3 = partial guides; 1 = login-walled or missing</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">API Completeness</td>
                  <td className="py-2 pr-4 text-right font-mono">14%</td>
                  <td className="py-2 text-[#64748B]">5 = full CRUD + webhooks/events; 3 = core read/write; 1 = narrow or read-only endpoints</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">Access Openness</td>
                  <td className="py-2 pr-4 text-right font-mono">14%</td>
                  <td className="py-2 text-[#64748B]">5 = free sandbox/dev tier; 3 = paid plan required; 1 = partner/enterprise approval</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">MCP Availability</td>
                  <td className="py-2 pr-4 text-right font-mono">8%</td>
                  <td className="py-2 text-[#64748B]">5 = maintained official MCP; 3 = active 3P MCP; 1 = none available</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">Developer Ecosystem</td>
                  <td className="py-2 pr-4 text-right font-mono">6%</td>
                  <td className="py-2 text-[#64748B]">5 = official TypeScript/Python SDKs; 3 = REST examples; 1 = minimal tooling</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">Operational Predictability</td>
                  <td className="py-2 pr-4 text-right font-mono">6%</td>
                  <td className="py-2 text-[#64748B]">5 = transparent generous rate limits; 3 = moderate quotas; 1 = strict throttling/instability</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[#64748B]">
            <strong className="text-[#172033]">Verdict Mapping:</strong>{" "}
            <span className="font-mono">Easy</span> (≥ 3.80 and not gated) ·{" "}
            <span className="font-mono">Moderate</span> (2.60–3.79) ·{" "}
            <span className="font-mono">Difficult</span> (&lt; 2.60 or no public API) ·{" "}
            <span className="font-mono">Unknown</span> (insufficient documentation).
          </p>
        </section>

        <section className="p-6 space-y-2">
          <h2 className="text-sm font-semibold text-[#172033]">
            06. Clustering, Persistence & Composio SDK Status
          </h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Applications are clustered dynamically from verified attributes (e.g.,
            API-ready & self-serve, OAuth-heavy, API available but gated,
            Official MCP-ready). Research persists across page refreshes and
            server restarts in atomic JSON storage under{" "}
            <span className="font-mono text-[#172033]">data/research-db.json</span>{" "}
            (and can be backed by PostgreSQL or Firestore without schema changes).
            When <span className="font-mono text-[#172033]">COMPOSIO_API_KEY</span>{" "}
            is present, the pipeline probes Composio&apos;s Apps API live; otherwise
            it discloses the unconfigured state honestly and runs autonomously.
          </p>
        </section>

        <section className="p-6 space-y-2">
          <h2 className="text-sm font-semibold text-[#172033]">
            07. Known Limitations &amp; Human Intervention Points
          </h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Deterministic HTTP retrieval runs with zero paid AI API keys,
            eliminating model billing barriers and hallucinations, but cannot
            bypass login-walled developer portals, NDA-gated specs, JavaScript-only
            SPAs, or anti-bot firewalls (HTTP 403/429). Any record with
            blocked/thin documentation or unconfirmed claims is automatically marked{" "}
            <span className="font-mono text-[#D97706]">needs_review</span> for
            human inspection and override in the Verification tab or Application
            Detail drawer.
          </p>
        </section>
      </div>
    </div>
  );
}
