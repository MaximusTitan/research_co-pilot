/**
 * Keeps AI-suggested sources honest. A source is only shown when its URL was
 * actually returned by a web search during this request, so the model cannot
 * pass off a link it made up.
 */

/** Lower-case host without "www.", no fragment, no trailing slash. */
export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//${host}${path}${url.search}`;
  } catch {
    return null;
  }
}

interface ContentLike {
  type: string;
}

/** URLs from every `web_search_tool_result` block in a response. */
export function searchedUrlsFrom(content: readonly ContentLike[]): Set<string> {
  const urls = new Set<string>();
  for (const block of content) {
    if (block.type !== "web_search_tool_result") continue;
    const results = (block as { content?: unknown }).content;
    if (!Array.isArray(results)) continue;
    for (const result of results) {
      const r = result as { type?: unknown; url?: unknown };
      if (r.type !== "web_search_result" || typeof r.url !== "string") continue;
      const normalized = normalizeUrl(r.url);
      if (normalized) urls.add(normalized);
    }
  }
  return urls;
}

/** Keeps only the suggestions whose URL was seen in search results. */
export function keepGroundedSources<T extends { url: string | null }>(sources: readonly T[], searched: ReadonlySet<string>): T[] {
  return sources.filter((s) => {
    const url = normalizeUrl(s.url);
    return url !== null && searched.has(url);
  });
}

/** Pulls the first JSON object out of a model reply, tolerating code fences or prose around it. */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
