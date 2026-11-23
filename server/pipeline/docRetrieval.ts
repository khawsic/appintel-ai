export interface RetrievedDoc {
  url: string;
  title: string;
  status: "fetched" | "blocked_or_unavailable";
  httpStatus?: number;
  resolvedUrl?: string;
  excerpt: string;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchSingleDoc(url: string, title: string): Promise<RetrievedDoc> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "AppIntelAI-ResearchBot/1.0 (+https://appintel.local)",
        Accept: "text/html,application/xhtml+xml,application/json,text/plain;q=0.9",
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return {
        url,
        title,
        status: "blocked_or_unavailable",
        httpStatus: res.status,
        resolvedUrl: res.url,
        excerpt: `HTTP ${res.status} returned when retrieving ${url}.`,
      };
    }

    const contentType = res.headers.get("content-type") ?? "";
    const rawText = await res.text();
    const cleaned = contentType.includes("html")
      ? stripHtmlToText(rawText)
      : rawText.replace(/\s+/g, " ").trim();

    return {
      url,
      title,
      status: cleaned.length > 80 ? "fetched" : "blocked_or_unavailable",
      httpStatus: res.status,
      resolvedUrl: res.url,
      excerpt: cleaned.slice(0, 3500),
    };
  } catch (err: unknown) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      url,
      title,
      status: "blocked_or_unavailable",
      excerpt: `Fetch failed (${msg}).`,
    };
  }
}

export async function retrieveDocumentation(
  sources: Array<{ url: string; title: string }>
): Promise<RetrievedDoc[]> {
  // Prioritize direct non-redirecting URLs, max 5 fetches per app to stay fast and polite
  const candidates = sources
    .filter((s) => s.url.startsWith("http"))
    .slice(0, 5);

  const results = await Promise.all(
    candidates.map((s) => fetchSingleDoc(s.url, s.title))
  );

  return results;
}
