import { RegistrySourceUrl } from "./sourceRegistry.ts";

export type RetrievalStatus =
  | "fetched"
  | "thin_content"
  | "http_error"
  | "timeout"
  | "network_error"
  | "invalid_url";

export interface RetrievedDoc {
  original_url: string;
  resolved_url: string | null;
  title: string;
  page_title: string | null;
  source_type: RegistrySourceUrl["source_type"];
  status: RetrievalStatus;
  http_status: number | null;
  content_type: string | null;
  retrieved_at: string;
  excerpt: string;
  full_text: string;
  error_detail: string | null;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, num) => {
      const code = Number(num);
      return Number.isFinite(code) ? String.fromCharCode(code) : " ";
    });
}

function extractHtmlTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  const cleaned = decodeHtmlEntities(m[1].replace(/\s+/g, " ").trim());
  return cleaned.length > 0 ? cleaned.slice(0, 160) : null;
}

function extractMetaDescription(html: string): string | null {
  const m =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i) ??
    html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["']/i);
  if (!m) return null;
  const cleaned = decodeHtmlEntities(m[1].replace(/\s+/g, " ").trim());
  return cleaned.length > 15 ? cleaned.slice(0, 400) : null;
}

function stripHtmlToText(html: string): string {
  const metaDesc = extractMetaDescription(html);
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, ". ")
    .replace(/<[^>]+>/g, " ");

  const decoded = decodeHtmlEntities(body).replace(/\s+/g, " ").trim();
  if (metaDesc && !decoded.toLowerCase().includes(metaDesc.slice(0, 40).toLowerCase())) {
    return `${metaDesc}. ${decoded}`.trim();
  }
  return decoded;
}

function formatJsonDoc(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const summaryParts: string[] = [];
    if (typeof parsed.openapi === "string") summaryParts.push(`OpenAPI ${parsed.openapi}`);
    if (typeof parsed.swagger === "string") summaryParts.push(`Swagger ${parsed.swagger}`);
    if (parsed.info && typeof parsed.info === "object") {
      const info = parsed.info as Record<string, unknown>;
      if (typeof info.title === "string") summaryParts.push(`Title: ${info.title}`);
      if (typeof info.description === "string") summaryParts.push(info.description);
    }
    if (parsed.paths && typeof parsed.paths === "object") {
      const pathKeys = Object.keys(parsed.paths).slice(0, 25);
      summaryParts.push(`Endpoints (${Object.keys(parsed.paths).length}): ${pathKeys.join(", ")}`);
    }
    if (summaryParts.length > 0) {
      return summaryParts.join(". ");
    }
    return JSON.stringify(parsed).slice(0, 12000);
  } catch {
    return raw.replace(/\s+/g, " ").trim();
  }
}

export async function fetchSingleDoc(
  source: RegistrySourceUrl,
  timeoutMs = 8000
): Promise<RetrievedDoc> {
  const retrieved_at = new Date().toISOString();

  if (!isValidHttpUrl(source.url)) {
    return {
      original_url: source.url,
      resolved_url: null,
      title: source.title,
      page_title: null,
      source_type: source.source_type,
      status: "invalid_url",
      http_status: null,
      content_type: null,
      retrieved_at,
      excerpt: "",
      full_text: "",
      error_detail: `Invalid URL format: "${source.url}"`,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(source.url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AppIntelAI-Researcher/2.0; +https://github.com/khawsic/appintel-ai)",
        Accept:
          "text/html,application/xhtml+xml,application/json,text/plain,text/markdown;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    clearTimeout(timeout);

    const contentType = res.headers.get("content-type") ?? "";
    const resolvedUrl = res.url || source.url;

    if (!res.ok) {
      const note =
        res.status === 403 || res.status === 429
          ? `Access blocked or rate-limited (HTTP ${res.status}); does not prove absence of documentation or API.`
          : res.status === 404
          ? `Page returned HTTP 404 Not Found at ${resolvedUrl}.`
          : `HTTP ${res.status} returned from ${resolvedUrl}.`;

      return {
        original_url: source.url,
        resolved_url: resolvedUrl,
        title: source.title,
        page_title: null,
        source_type: source.source_type,
        status: "http_error",
        http_status: res.status,
        content_type: contentType || null,
        retrieved_at,
        excerpt: "",
        full_text: "",
        error_detail: note,
      };
    }

    const rawText = await res.text();
    const pageTitle = contentType.includes("html") ? extractHtmlTitle(rawText) : null;

    let cleanText = "";
    if (contentType.includes("application/json")) {
      cleanText = formatJsonDoc(rawText);
    } else if (contentType.includes("html") || rawText.trimStart().startsWith("<")) {
      cleanText = stripHtmlToText(rawText);
    } else {
      cleanText = rawText.replace(/\s+/g, " ").trim();
    }

    const clipped = cleanText.slice(0, 18000);
    const isBotChallenge =
      /enable javascript|checking your browser|just a moment\.\.\.|access denied|cloudflare ray id/i.test(
        clipped.slice(0, 500)
      ) && clipped.length < 1500;

    if (clipped.length < 120 || isBotChallenge) {
      return {
        original_url: source.url,
        resolved_url: resolvedUrl,
        title: pageTitle || source.title,
        page_title: pageTitle,
        source_type: source.source_type,
        status: "thin_content",
        http_status: res.status,
        content_type: contentType || null,
        retrieved_at,
        excerpt: clipped.slice(0, 400),
        full_text: clipped,
        error_detail: isBotChallenge
          ? "Bot protection / JS challenge page encountered; readable documentation text unavailable."
          : "Retrieved page contains minimal readable text (likely client-side rendered SPA).",
      };
    }

    return {
      original_url: source.url,
      resolved_url: resolvedUrl,
      title: pageTitle || source.title,
      page_title: pageTitle,
      source_type: source.source_type,
      status: "fetched",
      http_status: res.status,
      content_type: contentType || null,
      retrieved_at,
      excerpt: clipped.slice(0, 650),
      full_text: clipped,
      error_detail: null,
    };
  } catch (err: unknown) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.toLowerCase().includes("abort");
    return {
      original_url: source.url,
      resolved_url: null,
      title: source.title,
      page_title: null,
      source_type: source.source_type,
      status: isTimeout ? "timeout" : "network_error",
      http_status: null,
      content_type: null,
      retrieved_at,
      excerpt: "",
      full_text: "",
      error_detail: isTimeout
        ? `Request timed out after ${timeoutMs}ms`
        : `Network error (${msg})`,
    };
  }
}

export async function retrieveDocumentation(
  sources: RegistrySourceUrl[],
  maxFetches = 6
): Promise<RetrievedDoc[]> {
  const candidates = sources.slice(0, maxFetches);
  const results = await Promise.all(candidates.map((s) => fetchSingleDoc(s)));
  return results;
}
