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
const HALCON_OPERATORS = new Set([
  "gauss_filter", "median_image", "threshold", "connection", "select_shape",
  "find_shape_model", "create_shape_model", "edges_sub_pix", "reduce_domain",
  "inspect_shape_model", "find_scaled_shape_model", "affine_trans_image",
]);

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

function stripJsonFence(content) {
  return String(content ?? "")
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function parseJsonCandidate(candidate) {
  const value = stripJsonFence(candidate);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    // Models occasionally emit smart quotes or a trailing comma even when
    // JSON mode is unavailable. Keep this repair deliberately conservative.
    let inString = false;
    let escaped = false;
    let repairedQuotes = "";
    for (const character of value) {
      if (character === '"' && !escaped) inString = !inString;
      if (character === "\\" && !escaped) escaped = true;
      else escaped = false;
      if (inString && (character === "“" || character === "”")) repairedQuotes += '\\"';
      else if (!inString && (character === "“" || character === "”")) repairedQuotes += '"';
      else repairedQuotes += character === "‘" || character === "’" ? "'" : character;
    }
    const repaired = repairedQuotes.replace(/,\s*([}\]])/g, "$1");
    try { return JSON.parse(repaired); } catch { /* continue with partial recovery */ }
    const singleQuoted = repaired.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, inner) => `"${String(inner).replace(/"/g, '\\"')}"`);
    try { return JSON.parse(singleQuoted); } catch { return null; }
  }
}

function completeQuestionObjects(content) {
  const source = stripJsonFence(content);
  const match = /"questions"\s*:\s*\[/i.exec(source);
  if (!match) return [];
  const arrayStart = source.indexOf("[", match.index);
  const objects = [];
  let objectStart = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = arrayStart + 1; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{" && depth === 0) objectStart = index;
    if (character === "{") depth += 1;
    if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        const parsed = parseJsonCandidate(source.slice(objectStart, index + 1));
        if (parsed && typeof parsed === "object") objects.push(parsed);
        objectStart = -1;
      }
    }
    if (character === "]" && depth === 0) break;
  }
  return objects;
}

/** Parses AI JSON with tolerant repairs and partial-question recovery. */
export function parseJsonRobust(content) {
  const source = stripJsonFence(content);
  const direct = parseJsonCandidate(source);
  if (direct && typeof direct === "object") return direct;
  const objectStart = source.indexOf("{");
  const objectEnd = source.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    const extracted = parseJsonCandidate(source.slice(objectStart, objectEnd + 1));
    if (extracted && typeof extracted === "object") return extracted;
  }
  const arrayStart = source.indexOf("[");
  const arrayEnd = source.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    const extracted = parseJsonCandidate(source.slice(arrayStart, arrayEnd + 1));
    if (Array.isArray(extracted)) return { questions: extracted };
  }
  const recovered = completeQuestionObjects(source);
  return recovered.length ? { questions: recovered, partial: true } : null;
}

/** Returns conservative terminology warnings for generated technical content. */
export function validateQuestionTerminology(question) {
  if (!question || typeof question !== "object") return [];
  const record = question;
  const stacks = Array.isArray(record.techStacks) ? record.techStacks.map((value) => String(value)) : [];
  const textValue = [record.title, record.bestAnswer, record.principle, record.hint].filter(Boolean).join(" ");
  const issues = [];
  if (stacks.some((value) => value.toLocaleLowerCase() === "halcon")) {
    for (const match of textValue.matchAll(/\b[a-z]+(?:_[a-z]+){1,3}\b/g)) {
      if (!HALCON_OPERATORS.has(match[0].toLocaleLowerCase())) issues.push(`可疑 HALCON 算子：${match[0]}`);
    }
    if (/cv2\.|cv::/.test(textValue)) issues.push("HALCON 题目中出现 OpenCV API");
  }
  return [...new Set(issues)];
}

/** Builds an OpenAI-compatible strict schema while keeping the taxonomy explicit. */
export function buildInterviewQuestionJsonSchema(categories = []) {
  const categoryEnum = Array.isArray(categories) && categories.length ? categories : ["其他"];
  const questionProperties = {
    title: { type: "string", minLength: 15, maxLength: 200 },
    type: { type: "string", enum: ["算法原理", "工程实践", "现场故障", "项目深挖", "方案选型"] },
    category: { type: "string", enum: categoryEnum },
    source: { type: "string", enum: ["专业", "项目"] },
    sourceType: { type: "string" },
    knowledgePoints: { type: "array", minItems: 1, maxItems: 6, items: { type: "string" } },
    blueprint: {
      type: "object",
      additionalProperties: false,
      required: ["version", "knowledgeKey", "corePoints", "criticalPoints", "supportingPoints", "ability", "scenario", "commonMistakes"],
      properties: {
        version: { type: "number" }, knowledgeKey: { type: "string" },
        corePoints: { type: "array", items: { type: "string" } }, criticalPoints: { type: "array", items: { type: "string" } },
        supportingPoints: { type: "array", items: { type: "string" } }, ability: { type: "array", items: { type: "string" } },
        scenario: { type: "string" }, commonMistakes: { type: "array", items: { type: "string" } },
      },
    },
    difficulty: { type: "string", enum: ["基础", "中等", "困难"] },
    tags: { type: "array", minItems: 1, items: { type: "string" } },
    keywords: { type: "array", minItems: 1, items: { type: "string" } },
    followUp: { type: "string" }, hint: { type: "string" },
    techStacks: { type: "array", items: { type: "string" } },
    detectionDirection: { type: ["string", "null"] },
    bestAnswer: { type: "string", minLength: 100 }, principle: { type: "string", minLength: 80 },
    reference: { type: ["object", "null"], additionalProperties: false, required: ["title", "url", "snippet"], properties: {
      title: { type: "string" }, url: { type: "string" }, snippet: { type: "string" },
    } },
  };
  return {
    type: "object",
    additionalProperties: false,
    required: ["questions"],
    properties: { questions: { type: "array", minItems: 1, maxItems: 3, items: {
      type: "object", additionalProperties: false, required: Object.keys(questionProperties), properties: questionProperties,
    } } },
  };
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

export function filterGeneratedQuestionContent(content, state = createKnowledgeCoverageState()) {
  const parsed = parseJsonRobust(content);
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
