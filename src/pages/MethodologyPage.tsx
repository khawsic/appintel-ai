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
            02. Source Hierarchy & Documentation Retrieval
          </h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            The automated pipeline queries Google Search Grounding via Gemini to
            locate primary vendor documentation: official product sites,
            developer portals, API references, authentication guides, pricing or
            partner access pages, and official/community MCP repositories. Up to
            five discovered URLs per app are fetched over HTTP with timeouts and
            HTML-to-text extraction so both extraction and verification inspect
            actual page content rather than relying purely on model memory.
          </p>
        </section>

        <section className="p-6 space-y-2">
          <h2 className="text-sm font-semibold text-[#172033]">
            03. Structured AI Extraction & Validation
          </h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Gemini extracts a strict JSON schema validated by Zod. Claims are
            explicitly separated into verified facts (with attached source URLs),
            missing/unknown states (never guessing an auth method or API simply
            because peers have one), and engineering concerns vs. documented
            blockers. URL provenance checks flag any citation that did not come
            from discovered search results.
          </p>
        </section>

        <section className="p-6 space-y-2">
          <h2 className="text-sm font-semibold text-[#172033]">
            04. Evidence-Based Verification Loop & Accuracy Measurement
          </h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Every researched app immediately enters an adversarial verification
            pass. First-pass findings across 8 core claim groups (authentication,
            API availability, API types, access model, MCP ownership,
            buildability, technical restrictions, and evidence URLs) are audited
            against HTTP reachability checks and independent search verification.
            Each claim receives one of five outcomes:{" "}
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
            07. Known Limitations & Human Intervention Points
          </h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Automated retrieval cannot bypass vendor developer logins, NDA-gated
            enterprise documentation, or strict anti-bot firewalls (HTTP 403/429).
            Any record with unreachable primary citations or ambiguous access
            terms is automatically marked{" "}
            <span className="font-mono text-[#D97706]">needs_review</span> for
            human inspection and override in the Verification tab or Application
            Detail drawer.
          </p>
        </section>
      </div>
    </div>
  );
}
