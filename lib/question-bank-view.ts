import { normalizeKnowledgeCategory, normalizeTechStack } from "./taxonomy.mjs";

export type QuestionBankViewOrigin = "AI" | "本地题库";
export type QuestionBankViewSource = "专业" | "项目";
export type QuestionBankSourceFilter = "全部" | "专业" | "项目" | "AI";

export type QuestionBankViewItem = {
  title: string;
  type: string;
  category: string;
  source: QuestionBankViewSource;
  difficulty: string;
  tags: string[];
  keywords: string[];
  followUp: string;
  hint: string;
  basis?: string;
  sourceType?: string;
  knowledgePoints?: string[];
  techStacks?: string[];
  reference?: { title: string; url: string };
  bestAnswer?: string;
  principle?: string;
  origin: QuestionBankViewOrigin;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanText).filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).slice(0, 16);
}

function normalizeSource(value: unknown): QuestionBankViewSource | null {
  const source = cleanText(value).toLocaleLowerCase();
  if (source === "专业" || source === "professional" || source === "knowledge") return "专业";
  if (source === "项目" || source === "project") return "项目";
  return null;
}

function normalizeReference(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const title = cleanText(record.title);
  const url = cleanText(record.url);
  return title && url ? { title, url } : undefined;
}

function normalizeTitle(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, "");
}

export function normalizeQuestionBankViewItem(value: unknown, origin: QuestionBankViewOrigin): QuestionBankViewItem | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const title = cleanText(record.title ?? record.question);
  const type = cleanText(record.type);
  const category = normalizeKnowledgeCategory(record.category) || "未分类";
  const source = normalizeSource(record.source);
  const difficulty = cleanText(record.difficulty) || "未标注";
  if (!title || !type || !source) return null;
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
    ...(cleanArray(record.techStacks).length ? { techStacks: cleanArray(record.techStacks).map(normalizeTechStack) } : {}),
    ...(normalizeReference(record.reference) ? { reference: normalizeReference(record.reference) } : {}),
    ...(cleanText(record.bestAnswer) ? { bestAnswer: cleanText(record.bestAnswer) } : {}),
    ...(cleanText(record.principle) ? { principle: cleanText(record.principle) } : {}),
    origin,
  };
}

export function mergeQuestionBankItems(localValues: unknown[], aiValues: unknown[]) {
  const merged = new Map<string, QuestionBankViewItem>();
  for (const value of localValues) {
    const item = normalizeQuestionBankViewItem(value, "本地题库");
    if (item) merged.set(normalizeTitle(item.title), item);
  }
  for (const value of aiValues) {
    const item = normalizeQuestionBankViewItem(value, "AI");
    if (item) merged.set(normalizeTitle(item.title), item);
  }
  return [...merged.values()];
}

export function filterQuestionBankItems(
  values: QuestionBankViewItem[],
  query = "",
  sourceFilter: QuestionBankSourceFilter = "全部",
) {
  const needle = query.trim().toLocaleLowerCase();
  return values.filter((item) => {
    if (sourceFilter === "AI" && item.origin !== "AI") return false;
    if (sourceFilter === "专业" && item.source !== "专业") return false;
    if (sourceFilter === "项目" && item.source !== "项目") return false;
    if (!needle) return true;
    const searchable = [item.title, item.type, item.category, item.source, item.difficulty, ...item.tags, ...item.keywords]
      .join(" ")
      .toLocaleLowerCase();
    return searchable.includes(needle);
  });
}

export function groupQuestionBankItems(values: QuestionBankViewItem[]) {
  const groups = new Map<string, QuestionBankViewItem[]>();
  for (const item of values) {
    const current = groups.get(item.category) ?? [];
    current.push(item);
    groups.set(item.category, current);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, "zh-CN"));
}
