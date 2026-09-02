const LOW_QUALITY_HOSTS = [
  /(^|\.)wenku\.baidu\.com$/i,
  /(^|\.)zhidao\.baidu\.com$/i,
  /(^|\.)docin\.com$/i,
  /(^|\.)book118\.com$/i,
  /(^|\.)360doc\.com$/i,
  /(^|\.)scribd\.com$/i,
  /(^|\.)bit\.ly$/i,
  /(^|\.)t\.co$/i,
];

const TRACKING_KEYS = new Set(["spm", "from", "source", "ref", "ref_", "campaign", "share"]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function key(value) {
  return text(value).toLocaleLowerCase().replace(/\s+/g, "");
}

function isPrivateHostname(hostname) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host === "::1" || host.endsWith(".local")) return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  const match = host.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function normalizeUrl(raw) {
  try {
    const url = new URL(text(raw));
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password || isPrivateHostname(url.hostname)) return null;
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (LOW_QUALITY_HOSTS.some((pattern) => pattern.test(hostname))) return null;
    url.hash = "";
    for (const name of [...url.searchParams.keys()]) {
      const lowered = name.toLowerCase();
      if (lowered.startsWith("utm_") || TRACKING_KEYS.has(lowered)) url.searchParams.delete(name);
    }
    return { url: url.toString(), hostname };
  } catch {
    return null;
  }
}

function authorityScore(hostname) {
  if (/^(docs\.)?(opencv\.org|mvtec\.com|halcon\.com)$/i.test(hostname)) return 110;
  if (/^(support|docs)\.cognex\.com$/i.test(hostname)) return 108;
  if (/^(learn|docs)\.microsoft\.com$/i.test(hostname)) return 106;
  if (/^(docs\.)?python\.org$/i.test(hostname)) return 104;
  if (/^(arxiv\.org|doi\.org|ieeexplore\.ieee\.org|openaccess\.thecvf\.com|dl\.acm\.org)$/i.test(hostname)) return 100;
  if (/^(docs\.github\.com|github\.com)$/i.test(hostname)) return 96;
  if (/^(docs|developer|developers|reference)\./i.test(hostname)) return 90;
  if (/\.(edu|gov)$/i.test(hostname)) return 86;
  return 50;
}

export function filterHighQualityWebResearchSources(values, options = {}) {
  const maxSources = Math.max(1, Math.floor(options.maxSources ?? 8));
  const maxPerDomain = Math.max(1, Math.floor(options.maxPerDomain ?? 2));
  const normalized = (Array.isArray(values) ? values : []).flatMap((value, index) => {
    if (!value || typeof value !== "object") return [];
    const title = text(value.title);
    const snippet = text(value.snippet);
    const normalizedUrl = normalizeUrl(value.url);
    if (!title || !normalizedUrl) return [];
    return [{ title, snippet, url: normalizedUrl.url, hostname: normalizedUrl.hostname, score: authorityScore(normalizedUrl.hostname), index }];
  }).sort((a, b) => b.score - a.score || a.index - b.index);

  const result = [];
  const seenUrls = new Set();
  const seenTitles = new Set();
  const domains = new Map();
  for (const source of normalized) {
    if (result.length >= maxSources) break;
    const titleKey = key(source.title);
    if (seenUrls.has(source.url) || seenTitles.has(titleKey)) continue;
    const domainCount = domains.get(source.hostname) ?? 0;
    if (domainCount >= maxPerDomain) continue;
    seenUrls.add(source.url);
    seenTitles.add(titleKey);
    domains.set(source.hostname, domainCount + 1);
    result.push({ title: source.title, url: source.url, snippet: source.snippet });
  }
  return result;
}

export function countCompleteStreamedQuestions(content) {
  if (typeof content !== "string" || !content) return 0;
  const match = /"questions"\s*:\s*\[/i.exec(content);
  if (!match) return 0;
  const arrayStart = content.indexOf("[", match.index);
  let depth = 0;
  let inString = false;
  let escaped = false;
  let count = 0;
  for (let i = arrayStart + 1; i < content.length; i += 1) {
    const char = content[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0) count += 1;
    } else if (char === "]" && depth === 0) break;
  }
  return count;
}

function coverageKeys(question) {
  const primary = Array.isArray(question?.knowledgePoints) && question.knowledgePoints.length
    ? question.knowledgePoints
    : [...(Array.isArray(question?.tags) ? question.tags : []), ...(Array.isArray(question?.keywords) ? question.keywords : [])].slice(0, 6);
  return [...new Set(primary.map(key).filter(Boolean))];
}

export function createKnowledgeCoverageState() {
  return { knowledge: new Set(), types: new Set(), categories: new Set(), titles: new Set() };
}

export function selectKnowledgeDiverseQuestions(values, state = createKnowledgeCoverageState(), limit = Infinity) {
  const candidates = (Array.isArray(values) ? values : []).filter((q) => q && typeof q === "object" && text(q.title));
  const remaining = [...candidates];
  const selected = [];
  const max = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : remaining.length;

  while (remaining.length && selected.length < max) {
    let bestIndex = -1;
    let bestScore = -1;
    for (let index = 0; index < remaining.length; index += 1) {
      const question = remaining[index];
      const titleKey = key(question.title);
      if (!titleKey || state.titles.has(titleKey)) continue;
      const keys = coverageKeys(question);
      const unseenKnowledge = keys.filter((item) => !state.knowledge.has(item)).length;
      const typeKey = key(question.type);
      const categoryKey = key(question.category);
      const newType = Boolean(typeKey && !state.types.has(typeKey));
      const newCategory = Boolean(categoryKey && !state.categories.has(categoryKey));
      if (selected.length > 0 || state.titles.size > 0) {
        if (unseenKnowledge === 0 && !newType && !newCategory) continue;
      }
      const score = unseenKnowledge * 20 + (newType ? 5 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    if (bestIndex < 0) break;
    const [question] = remaining.splice(bestIndex, 1);
    selected.push(question);
    state.titles.add(key(question.title));
    coverageKeys(question).forEach((item) => state.knowledge.add(item));
    const typeKey = key(question.type);
    const categoryKey = key(question.category);
    if (typeKey) state.types.add(typeKey);
    if (categoryKey) state.categories.add(categoryKey);
  }
  return selected;
}

export function buildKnowledgeCoverageMatrix(values) {
  return (Array.isArray(values) ? values : []).map((question, index) => ({
    index: index + 1,
    title: text(question?.title),
    type: text(question?.type),
    category: text(question?.category),
    knowledgePoints: Array.isArray(question?.knowledgePoints) && question.knowledgePoints.length
      ? question.knowledgePoints.map(text).filter(Boolean)
      : [...(Array.isArray(question?.tags) ? question.tags : []), ...(Array.isArray(question?.keywords) ? question.keywords : [])].map(text).filter(Boolean).slice(0, 6),
    coverageKeys: coverageKeys(question),
  }));
}

function extractJsonObject(content) {
  if (typeof content !== "string") return null;
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}

export function filterGeneratedQuestionContent(content, state = createKnowledgeCoverageState()) {
  const parsed = extractJsonObject(content);
  if (!parsed || !Array.isArray(parsed.questions)) return { content, acceptedCount: 0, matrix: [] };
  const selected = selectKnowledgeDiverseQuestions(parsed.questions, state, parsed.questions.length);
  const matrix = buildKnowledgeCoverageMatrix(selected);
  return { content: JSON.stringify({ ...parsed, questions: selected }), acceptedCount: selected.length, matrix };
}

export function isQuestionGenerationPayload(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.messages)) return false;
  return payload.messages.some((message) => {
    const content = typeof message?.content === "string" ? message.content : "";
    return /"outputSchema"/.test(content) && /"questions"/.test(content);
  });
}
