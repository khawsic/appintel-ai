import { ComposioIntegrationCheck } from "../../shared/types.ts";

export interface ComposioProbeSummary {
  configured: boolean;
  endpoint_tested: string;
  status: "connected" | "not_configured" | "error";
  message: string;
  catalog_count: number | null;
}

let cachedCatalog: Array<{ key?: string; name?: string; appId?: string }> | null = null;
let lastProbeStatus: ComposioProbeSummary | null = null;

export async function probeComposioEnvironment(): Promise<ComposioProbeSummary> {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  const endpoint = "https://backend.composio.dev/api/v1/apps";

  if (!apiKey) {
    lastProbeStatus = {
      configured: false,
      endpoint_tested: endpoint,
      status: "not_configured",
      message:
        "COMPOSIO_API_KEY is not set in environment secrets. Live Composio toolkit catalog lookup was skipped honestly; core research runs independently via the deterministic evidence-first pipeline.",
      catalog_count: null,
    };
    return lastProbeStatus;
  }

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(endpoint, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
    });
    clearTimeout(t);

    if (!res.ok) {
      lastProbeStatus = {
        configured: true,
        endpoint_tested: endpoint,
        status: "error",
        message: `Composio API responded with HTTP ${res.status}. Verify COMPOSIO_API_KEY permissions.`,
        catalog_count: null,
      };
      return lastProbeStatus;
    }

    const body = (await res.json()) as { items?: Array<{ key?: string; name?: string; appId?: string }> } | Array<{ key?: string; name?: string; appId?: string }>;
    const items = Array.isArray(body) ? body : body.items ?? [];
    cachedCatalog = items;

    lastProbeStatus = {
      configured: true,
      endpoint_tested: endpoint,
      status: "connected",
      message: `Connected to Composio Apps API (${items.length} toolkits indexed).`,
      catalog_count: items.length,
    };
    return lastProbeStatus;
  } catch (err: unknown) {
    lastProbeStatus = {
      configured: true,
      endpoint_tested: endpoint,
      status: "error",
      message: `Failed to reach Composio API: ${err instanceof Error ? err.message : String(err)}`,
      catalog_count: null,
    };
    return lastProbeStatus;
  }
}

export async function checkAppInComposio(appName: string): Promise<ComposioIntegrationCheck> {
  const now = new Date().toISOString();
  const probe = lastProbeStatus ?? (await probeComposioEnvironment());

  if (probe.status === "not_configured") {
    return {
      checked: false,
      mode: "not_configured",
      in_catalog: null,
      toolkit_slug: null,
      note: "COMPOSIO_API_KEY not configured; catalog presence not checked.",
      checked_at: now,
    };
  }

  if (probe.status === "error" || !cachedCatalog) {
    return {
      checked: false,
      mode: "error",
      in_catalog: null,
      toolkit_slug: null,
      note: probe.message,
      checked_at: now,
    };
  }

  const normalized = appName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const match = cachedCatalog.find((item) => {
    const keyNorm = (item.key ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const nameNorm = (item.name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return keyNorm === normalized || nameNorm === normalized;
  });

  return {
    checked: true,
    mode: "live_api",
    in_catalog: Boolean(match),
    toolkit_slug: match?.key ?? null,
    note: match
      ? `Found in Composio catalog under slug "${match.key}".`
      : "Not found in queried Composio v1 apps endpoint.",
    checked_at: now,
  };
}
