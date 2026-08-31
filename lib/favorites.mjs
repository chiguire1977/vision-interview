export const FAVORITES_STORAGE_KEY = "vision-interview-favorite-questions";

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanText).filter(Boolean).filter((item, index, items) => items.indexOf(item) === index).slice(0, 16);
}

function normalizeSource(value) {
  const source = cleanText(value).toLocaleLowerCase();
  if (source === "专业" || source === "专业知识" || source === "professional" || source === "knowledge") return "专业";
  if (source === "项目" || source === "项目答辩" || source === "project") return "项目";
  return "";
}

function normalizeReference(value) {
  if (!value || typeof value !== "object") return undefined;
  const record = value;
  const title = cleanText(record.title);
  const url = cleanText(record.url);
  return title && /^https?:\/\//i.test(url) ? { title, url } : undefined;
}

export function favoriteQuestionKey(value) {
  if (!value || typeof value !== "object") return "";
  const record = value;
  const title = cleanText(record.title ?? record.question);
  const source = normalizeSource(record.source) || "历史";
  if (!title) return "";
  return `${source}|${title.toLocaleLowerCase().replace(/\s+/g, "")}`;
}

export function normalizeFavoriteQuestion(value) {
  if (!value || typeof value !== "object") return null;
  const record = value;
  const title = cleanText(record.title ?? record.question);
  const source = normalizeSource(record.source);
  if (!title || !source) return null;
  const category = cleanText(record.category) || "未分类";
  const type = cleanText(record.type) || "面试题";
  const difficulty = cleanText(record.difficulty) || "未标注";
  const reference = normalizeReference(record.reference);
  return {
    title,
    type,
    category,
    source,
    difficulty,
    tags: cleanArray(record.tags),
    keywords: cleanArray(record.keywords),
    followUp: cleanText(record.followUp),
    hint: cleanText(record.hint),
    ...(cleanText(record.basis) ? { basis: cleanText(record.basis) } : {}),
    ...(cleanText(record.sourceType) ? { sourceType: cleanText(record.sourceType) } : {}),
    ...(cleanArray(record.knowledgePoints).length ? { knowledgePoints: cleanArray(record.knowledgePoints) } : {}),
    ...(cleanArray(record.techStacks).length ? { techStacks: cleanArray(record.techStacks) } : {}),
    ...(reference ? { reference } : {}),
    ...(cleanText(record.bestAnswer) ? { bestAnswer: cleanText(record.bestAnswer) } : {}),
    ...(cleanText(record.principle) ? { principle: cleanText(record.principle) } : {}),
    origin: record.origin === "AI" ? "AI" : "本地题库",
  };
}

export function normalizeFavoriteQuestions(values) {
  if (!Array.isArray(values)) return [];
  const unique = new Map();
  for (const value of values) {
    const question = normalizeFavoriteQuestion(value);
    const key = favoriteQuestionKey(question);
    if (!question || !key || unique.has(key)) continue;
    unique.set(key, question);
  }
  return [...unique.values()];
}

export function isFavoriteQuestion(values, question) {
  const key = favoriteQuestionKey(question);
  return Boolean(key && normalizeFavoriteQuestions(values).some((item) => favoriteQuestionKey(item) === key));
}

export function toggleFavoriteQuestion(values, question) {
  const normalized = normalizeFavoriteQuestions(values);
  const candidate = normalizeFavoriteQuestion(question);
  const key = favoriteQuestionKey(candidate);
  if (!candidate || !key) return normalized;
  if (normalized.some((item) => favoriteQuestionKey(item) === key)) {
    return normalized.filter((item) => favoriteQuestionKey(item) !== key);
  }
  return [candidate, ...normalized];
}

export function filterFavoriteQuestions(values, query = "", sourceFilter = "全部") {
  const needle = cleanText(query).toLocaleLowerCase();
  return normalizeFavoriteQuestions(values).filter((item) => {
    if (sourceFilter === "AI" && item.origin !== "AI") return false;
    if (sourceFilter === "专业" && item.source !== "专业") return false;
    if (sourceFilter === "项目" && item.source !== "项目") return false;
    if (!needle) return true;
    return [item.title, item.type, item.category, item.source, item.difficulty, ...item.tags, ...item.keywords, ...(item.knowledgePoints ?? [])]
      .join(" ")
      .toLocaleLowerCase()
      .includes(needle);
  });
}

export function groupFavoriteQuestions(values) {
  const groups = new Map();
  for (const item of normalizeFavoriteQuestions(values)) {
    const current = groups.get(item.category) ?? [];
    current.push(item);
    groups.set(item.category, current);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, "zh-CN"));
}
