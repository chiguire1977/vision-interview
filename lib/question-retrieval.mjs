const GITHUB_QUERY_SUFFIX = "site:github.com (面试题 OR interview questions OR interview) (stars OR trending OR discussions OR issues)";
const PRACTICE_QUERY_SUFFIX = "官方文档 论文 工程实践 排障";

export const WEB_SOURCE_WHITELIST_STORAGE_KEY = "vision-interview-web-source-whitelist";

function canonicalizeWebSourceUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.username || url.password) return "";
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizedWhitelistEntry(value) {
  if (!value || typeof value !== "object") return null;
  const record = value;
  const url = canonicalizeWebSourceUrl(record.url);
  if (!url) return null;
  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : url,
    url,
    enabled: record.enabled !== false,
    ...(typeof record.displayName === "string" && record.displayName.trim() ? { displayName: record.displayName.trim() } : {}),
    ...(typeof record.available === "boolean" ? { available: record.available } : {}),
    ...(typeof record.lastCheckedAt === "string" && record.lastCheckedAt.trim() ? { lastCheckedAt: record.lastCheckedAt.trim() } : {}),
    ...(typeof record.checkError === "string" && record.checkError.trim() ? { checkError: record.checkError.trim() } : {}),
  };
}

export function normalizeWebSourceWhitelist(values) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const entry = normalizedWhitelistEntry(value);
    if (!entry || seen.has(entry.url)) continue;
    seen.add(entry.url);
    result.push(entry);
  }
  return result;
}

export function readWebSourceWhitelist(storage) {
  if (!storage) return [];
  try {
    return normalizeWebSourceWhitelist(JSON.parse(storage.getItem(WEB_SOURCE_WHITELIST_STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
}

export function reorderWebSourceWhitelist(values, fromIndex, toIndex) {
  const result = normalizeWebSourceWhitelist(values);
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex < 0 || toIndex < 0 || fromIndex >= result.length || toIndex >= result.length || fromIndex === toIndex) {
    return result;
  }
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
}

function whitelistHostname(value) {
  try { return new URL(value).hostname.toLocaleLowerCase(); } catch { return ""; }
}

export function sourceMatchesWhitelist(sourceUrl, whitelistUrl) {
  const source = canonicalizeWebSourceUrl(sourceUrl);
  const entry = canonicalizeWebSourceUrl(whitelistUrl);
  if (!source || !entry) return false;
  const sourceValue = new URL(source);
  const entryValue = new URL(entry);
  if (sourceValue.protocol !== entryValue.protocol || sourceValue.hostname.toLocaleLowerCase() !== entryValue.hostname.toLocaleLowerCase() || sourceValue.port !== entryValue.port) return false;
  const entryPath = entryValue.pathname.replace(/\/+$/, "") || "/";
  const sourcePath = sourceValue.pathname.replace(/\/+$/, "") || "/";
  return entryPath === "/" || sourcePath === entryPath || sourcePath.startsWith(entryPath + "/");
}

function whitelistRank(sourceUrl, whitelist) {
  const active = normalizeWebSourceWhitelist(whitelist).filter((entry) => entry.enabled && entry.available !== false);
  const index = active.findIndex((entry) => sourceMatchesWhitelist(sourceUrl, entry.url));
  const hostname = whitelistHostname(sourceUrl);
  return index >= 0 ? index : active.length + (hostname === "github.com" || hostname.endsWith(".github.com") ? 0 : 1);
}

export function sortSourcesByWhitelist(values, whitelist = []) {
  const sources = Array.isArray(values) ? values : [];
  return sources
    .map((source, index) => ({ source, index, rank: whitelistRank(source?.url, whitelist) }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(({ source }) => source);
}

export function buildResearchQueries(baseQuery, whitelist = []) {
  const query = String(baseQuery || "").trim().replace(/\s+/g, " ");
  if (!query) return [];
  const prioritizedQueries = normalizeWebSourceWhitelist(whitelist)
    .filter((entry) => entry.enabled && entry.available !== false)
    .map((entry) => {
      const hostname = whitelistHostname(entry.url);
      return hostname ? query + " site:" + hostname : "";
    })
    .filter(Boolean);
  return [...prioritizedQueries, query, query + " " + GITHUB_QUERY_SUFFIX, query + " " + PRACTICE_QUERY_SUFFIX];
}

export function normalizeQuestionRetrievalOptions(value = {}) {
  const options = value && typeof value === "object" ? value : {};
  const parallel = Number(options.parallelRequests);
  const timeout = Number(options.requestTimeoutMs);
  const cacheTtl = Number(options.cacheTtlMs);
  return {
    parallelRequests: Number.isFinite(parallel) ? Math.min(4, Math.max(1, Math.round(parallel))) : 3,
    requestTimeoutMs: Number.isFinite(timeout) && timeout >= 8000 ? Math.min(30000, Math.round(timeout)) : 8000,
    cacheTtlMs: Number.isFinite(cacheTtl) && cacheTtl >= 0 ? Math.min(3600000, Math.round(cacheTtl)) : 600000,
    whitelist: normalizeWebSourceWhitelist(options.whitelist),
  };
}

function normalizeSources(values, limit = 8) {
  const seen = new Set();
  const normalized = [];
  for (const value of Array.isArray(values) ? values : []) {
    if (!value || typeof value !== "object") continue;
    const title = typeof value.title === "string" ? value.title.trim() : "";
    const url = typeof value.url === "string" ? value.url.trim() : "";
    const snippet = typeof value.snippet === "string" ? value.snippet.trim() : "";
    if (!title || !/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    normalized.push({ title, url, snippet });
    if (normalized.length >= limit) break;
  }
  return normalized;
}

function mergeSources(existing, incoming, limit = 8, whitelist = []) {
  const combined = normalizeSources([...(existing || []), ...(incoming || [])], Number.POSITIVE_INFINITY);
  return sortSourcesByWhitelist(combined, whitelist).slice(0, limit);
}

function cacheKey(query, whitelist = []) {
  const normalizedQuery = String(query || "").trim().toLowerCase().replace(/\s+/g, " ");
  const whitelistKey = normalizeWebSourceWhitelist(whitelist).map((entry) => (entry.enabled ? "1" : "0") + ":" + (entry.available === false ? "0" : "1") + ":" + entry.url).join("|");
  return "vision-interview-web-research-" + encodeURIComponent(normalizedQuery + "::" + whitelistKey);
}

function readCache(storage, query, ttlMs, now, whitelist = []) {
  if (!storage || ttlMs <= 0) return null;
  try {
    const raw = JSON.parse(storage.getItem(cacheKey(query, whitelist)) || "null");
    if (!raw || !Number.isFinite(raw.savedAt) || now - raw.savedAt > ttlMs) return null;
    const sources = normalizeSources(raw.sources);
    return sources.length ? sources : null;
  } catch {
    return null;
  }
}

function writeCache(storage, query, sources, now, whitelist = []) {
  if (!storage || !sources.length) return;
  try { storage.setItem(cacheKey(query, whitelist), JSON.stringify({ savedAt: now, sources })); } catch { /* 缓存不可用不影响联网取题 */ }
}

export async function retrieveWebSources({ query, excludedTitles = [], fetchImpl = globalThis.fetch, storage, now = Date.now(), options = {}, signal } = {}) {
  const normalizedOptions = normalizeQuestionRetrievalOptions(options);
  const queries = buildResearchQueries(query, normalizedOptions.whitelist).slice(0, normalizedOptions.parallelRequests);
  const cached = readCache(storage, query, normalizedOptions.cacheTtlMs, now, normalizedOptions.whitelist);
  if (cached) return { sources: sortSourcesByWhitelist(cached, normalizedOptions.whitelist), cached: true };
  if (!queries.length || typeof fetchImpl !== "function") return { sources: [], cached: false, error: "联网检索参数无效" };

  const requests = queries.map(async (researchQuery) => {
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(new DOMException("联网检索超时", "TimeoutError")), normalizedOptions.requestTimeoutMs);
    const combinedSignal = signal && typeof AbortSignal.any === "function"
      ? AbortSignal.any([signal, timeoutController.signal])
      : signal || timeoutController.signal;
    try {
      const response = await fetchImpl("/api/web-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: combinedSignal,
        body: JSON.stringify({ query: researchQuery, excludedTitles }),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.message || `HTTP ${response.status}`);
      return normalizeSources(result.sources);
    } finally {
      clearTimeout(timer);
    }
  });
  const settled = await Promise.allSettled(requests);
  if (signal?.aborted) throw signal.reason ?? new DOMException("联网检索已终止", "AbortError");
  const sources = settled.reduce((merged, item) => item.status === "fulfilled" ? mergeSources(merged, item.value, 8, normalizedOptions.whitelist) : merged, []);
  if (sources.length) writeCache(storage, query, sources, now, normalizedOptions.whitelist);
  const failures = settled.filter((item) => item.status === "rejected");
  return { sources, cached: false, ...(failures.length === settled.length ? { error: "联网检索暂不可用" } : {}) };
}

export function normalizeQuestionRetrievalResult(result, fallbackQuestions = []) {
  const hasQuestions = Array.isArray(result?.questions) && result.questions.length > 0;
  const questions = hasQuestions ? result.questions : fallbackQuestions;
  const source = result?.source === "AI" || result?.source === "缓存" || result?.source === "本地规则" ? result.source : "本地规则";
  return {
    questions,
    source,
    message: typeof result?.message === "string" && result.message.trim() ? result.message.trim() : "联网题目获取失败，已使用本地题库。",
    aiCount: hasQuestions && Number.isFinite(Number(result?.aiCount)) ? Math.max(0, Number(result.aiCount)) : 0,
  };
}
