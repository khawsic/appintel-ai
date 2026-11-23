import { getGeminiClient, GEMINI_MODEL, withRetry } from "../geminiClient.ts";

export interface DiscoveredSource {
  title: string;
  url: string;
  category:
    | "official_website"
    | "developer_docs"
    | "api_reference"
    | "auth_docs"
    | "pricing_access"
    | "mcp_source"
    | "other";
}

export interface SourceDiscoveryResult {
  searchSummary: string;
  discoveredSources: DiscoveredSource[];
  groundingUrls: Array<{ title: string; url: string }>;
}

function classifyUrl(url: string, title: string): DiscoveredSource["category"] {
  const combined = `${url} ${title}`.toLowerCase();
  if (combined.includes("mcp") || combined.includes("modelcontextprotocol") || combined.includes("github.com")) {
    if (combined.includes("mcp")) return "mcp_source";
  }
  if (combined.includes("auth") || combined.includes("oauth") || combined.includes("token")) {
    return "auth_docs";
  }
  if (combined.includes("pricing") || combined.includes("plan") || combined.includes("enterprise") || combined.includes("partner")) {
    return "pricing_access";
  }
  if (combined.includes("reference") || combined.includes("api.") || combined.includes("/api")) {
    return "api_reference";
  }
  if (combined.includes("developer") || combined.includes("docs.") || combined.includes("/docs")) {
    return "developer_docs";
  }
  return "other";
}

export async function discoverAppSources(
  appName: string,
  category: string
): Promise<SourceDiscoveryResult> {
  const ai = getGeminiClient();

  const prompt = `Search for official technical documentation and integration details for the application "${appName}" (category: ${category}).
Find and summarize ONLY verifiable facts from official sources:
1. Official product website.
2. Official developer documentation, API reference, and authentication docs (OAuth 2.0, API keys, PAT, JWT, etc.).
3. API access model (whether developer API access is self-serve, gated/requires approval/enterprise contract, or mixed) and pricing/plan limits.
4. Model Context Protocol (MCP) support: whether an official MCP server exists (from the vendor itself) or only third-party/community MCP servers exist on GitHub/npm, or none found.

Cite the exact URLs found in search results. Do not guess URLs.`;

  const response = await withRetry(
    () =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      }),
    { label: `sourceDiscovery:${appName}`, retries: 2 }
  );

  const searchSummary = response.text ?? "";
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

  const groundingUrls: Array<{ title: string; url: string }> = [];
  const seen = new Set<string>();

  for (const chunk of chunks) {
    const uri = chunk.web?.uri;
    const title = chunk.web?.title || uri || "Web Source";
    if (uri && uri.startsWith("http") && !seen.has(uri)) {
      seen.add(uri);
      groundingUrls.push({ title, url: uri });
    }
  }

  // Also extract explicit https URLs mentioned in grounded search text if valid
  const urlRegex = /https?:\/\/[^\s)>\]"',]+/g;
  const textMatches = searchSummary.match(urlRegex) ?? [];
  for (const rawUrl of textMatches) {
    const cleaned = rawUrl.replace(/[.,;:]+$/, "");
    if (!seen.has(cleaned) && cleaned.length < 240) {
      seen.add(cleaned);
      groundingUrls.push({ title: cleaned, url: cleaned });
    }
  }

  const discoveredSources: DiscoveredSource[] = groundingUrls.slice(0, 14).map((item) => ({
    title: item.title,
    url: item.url,
    category: classifyUrl(item.url, item.title),
  }));

  return {
    searchSummary,
    discoveredSources,
    groundingUrls,
  };
}
