export const dynamic = "force-dynamic";

const SEARCH_ENDPOINT = "https://html.duckduckgo.com/html/";
const SEARCH_USER_AGENT = "VisionInterview-web-research";
const MAX_QUERY_LENGTH = 320;
const MAX_RESULTS = 8;
const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
const SEARCH_CACHE_LIMIT = 200;

type SearchSource = { title: string; url: string; snippet: string };
type SearchCacheEntry = { savedAt: number; sources: SearchSource[] };
const searchCache = new Map<string, SearchCacheEntry>();

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function cacheKey(query: string) {
  return query.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function readSearchCache(query: string) {
  const key = cacheKey(query);
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > SEARCH_CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }
  return entry.sources;
}

function writeSearchCache(query: string, sources: SearchSource[]) {
  const key = cacheKey(query);
  searchCache.delete(key);
  searchCache.set(key, { savedAt: Date.now(), sources });
  while (searchCache.size > SEARCH_CACHE_LIMIT) {
    const oldest = searchCache.keys().next().value;
    if (typeof oldest !== "string") break;
    searchCache.delete(oldest);
  }
}

function decodeHtml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => {
      const number = Number.parseInt(code, 16);
      return Number.isFinite(number) && number >= 0 && number <= 0x10ffff ? String.fromCodePoint(number) : "";
    })
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const number = Number.parseInt(code, 10);
      return Number.isFinite(number) && number >= 0 && number <= 0x10ffff ? String.fromCodePoint(number) : "";
    })
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripMarkup(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function normalizeResultUrl(raw: string) {
  try {
    const candidate = decodeHtml(raw).trim();
    const redirectUrl = new URL(candidate.startsWith("//") ? `https:${candidate}` : candidate, "https://duckduckgo.com");
    const encodedTarget = redirectUrl.searchParams.get("uddg");
    const target = encodedTarget ? decodeURIComponent(encodedTarget) : redirectUrl.toString();
    const url = new URL(target);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function parseSearchResults(html: string): SearchSource[] {
  const anchors: Array<{ start: number; end: number; attributes: string; content: string }> = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const attributes = match[1] || "";
    if (!/class\s*=\s*["'][^"']*\bresult__a\b[^"']*["']/i.test(attributes)) continue;
    const start = match.index ?? 0;
    anchors.push({ start, end: start + match[0].length, attributes, content: match[2] || "" });
  }

  const results: SearchSource[] = [];
  const seenUrls = new Set<string>();
  anchors.forEach((anchor, index) => {
    const href = anchor.attributes.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] || "";
    const url = normalizeResultUrl(href);
    const title = stripMarkup(anchor.content);
    if (!url || !title || seenUrls.has(url)) return;
    const nextStart = anchors[index + 1]?.start ?? Math.min(html.length, anchor.end + 5000);
    const followingHtml = html.slice(anchor.end, nextStart);
    const snippetMatch = followingHtml.match(/<(?:a|div|span)\b[^>]*class\s*=\s*["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|span)>/i);
    const snippet = snippetMatch ? stripMarkup(snippetMatch[1] || "") : "";
    seenUrls.add(url);
    results.push({ title, url, snippet });
  });
  return results.slice(0, MAX_RESULTS);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { query?: unknown };
    const query = typeof body.query === "string" ? body.query.trim().slice(0, MAX_QUERY_LENGTH) : "";
    if (!query) return json({ ok: false, message: "缺少网络检索关键词。" }, 400);

    const cached = readSearchCache(query);
    if (cached) return json({ ok: true, query, sources: cached, cached: true });

    const endpoint = `${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`;
    const response = await fetch(endpoint, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": SEARCH_USER_AGENT,
      },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (response.status >= 300 && response.status < 400) {
      return json({ ok: false, message: "网络检索服务发生重定向。" }, 502);
    }
    if (!response.ok) return json({ ok: false, message: `网络检索失败（HTTP ${response.status}）。` }, 502);

    const sources = parseSearchResults(await response.text());
    if (sources.length) writeSearchCache(query, sources);
    return json({ ok: true, query, sources, cached: false });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "网络检索超时，请稍后重试。"
      : error instanceof Error ? error.message : "网络检索发生异常。";
    return json({ ok: false, message }, 502);
  }
}
