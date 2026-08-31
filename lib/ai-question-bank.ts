export type AiGeneratedQuestion = {
  title: string;
  type: string;
  category: string;
  source: string;
  difficulty: string;
  tags: string[];
  keywords: string[];
  followUp: string;
  hint: string;
  techStacks?: string[];
  bestAnswer: string;
  principle: string;
  basis?: string;
  reference?: { title: string; url: string };
};

export type QuestionBankArchiveEntry = AiGeneratedQuestion & {
  id: string;
  generatedAt: string;
  provider?: string;
  model?: string;
  project?: string;
  trainingMode?: string;
  categoryFilter?: string;
  difficultyFilter?: string;
  techStackFilter?: string;
};

export type QuestionBankArchiveMetadata = {
  generatedAt?: string;
  provider?: string;
  model?: string;
  project?: string;
  trainingMode?: string;
  categoryFilter?: string;
  difficultyFilter?: string;
  techStackFilter?: string;
};

export type AiQuestionSourceFilter = "专业" | "项目" | "专业或项目";
export type AiQuestionSelectionFilter = {
  source: AiQuestionSourceFilter;
  category?: string;
  difficulty?: string;
  techStack?: string;
  forbiddenPhrases?: string[];
};

export function normalizeTrainingMode(value: unknown): "专业知识" | "项目答辩" | "综合模拟" {
  if (value === "项目答辩") return "项目答辩";
  if (value === "综合模拟") return "综合模拟";
  return "专业知识";
}

export function questionSourceForTrainingMode(value: unknown): AiQuestionSourceFilter {
  const mode = normalizeTrainingMode(value);
  return mode === "项目答辩" ? "项目" : mode === "综合模拟" ? "专业或项目" : "专业";
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}
function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedComparison(value: unknown) {
  return cleanString(value).toLocaleLowerCase().replace(/\s+/g, "");
}

function matchesSource(value: string, expected: AiQuestionSourceFilter) {
  const source = normalizedComparison(value);
  const isProfessional = source === "专业" || source === "professional" || source === "knowledge";
  const isProject = source === "项目" || source === "project";
  return expected === "专业或项目"
    ? isProfessional || isProject
    : expected === "专业" ? isProfessional : isProject;
}

function matchesDifficulty(value: string, expected: string) {
  const difficulty = normalizedComparison(value);
  const target = normalizedComparison(expected);
  if (!target || target === "随机难度") return true;
  const aliases: Record<string, string[]> = {
    基础: ["基础", "basic", "easy", "beginner"],
    中等: ["中等", "medium", "normal", "intermediate"],
    困难: ["困难", "hard", "difficult", "advanced"],
  };
  return Object.entries(aliases).some(([canonical, values]) => target === normalizedComparison(canonical) && values.includes(difficulty));
}

function matchesTechStack(values: string[] | undefined, expected: string) {
  const target = normalizedComparison(expected);
  if (!target || target === "随机技术栈") return true;
  return (values ?? []).some((value) => normalizedComparison(value) === target);
}

export function filterAiGeneratedQuestions(values: unknown[], selection: AiQuestionSelectionFilter) {
  const forbiddenPhrases = (selection.forbiddenPhrases ?? [])
    .map((value) => normalizedComparison(value))
    .filter(Boolean);
  return normalizeAiGeneratedQuestions(values).filter((question) => {
    if (!matchesSource(question.source, selection.source)) return false;
    if (selection.category && selection.category !== "随机类型" && question.category !== selection.category) return false;
    if (selection.difficulty && !matchesDifficulty(question.difficulty, selection.difficulty)) return false;
    if (selection.techStack && !matchesTechStack(question.techStacks, selection.techStack)) return false;
    if (forbiddenPhrases.length) {
      const searchable = normalizedComparison([
        question.title,
        question.type,
        question.category,
        ...question.tags,
        ...question.keywords,
        question.followUp,
        question.hint,
        question.basis,
        question.bestAnswer,
        question.principle,
      ].filter(Boolean).join("|"));
      if (forbiddenPhrases.some((phrase) => searchable.includes(phrase))) return false;
    }
    return true;
  });
}

function cleanStringArray(value: unknown, limit = 16) {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const text = cleanString(item);
    if (!text) continue;
    const key = text.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

export function normalizeQuestionTitleKey(value: unknown) {
  return cleanString(value).toLocaleLowerCase();
}

function normalizeReference(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const title = cleanString(record.title);
  const url = cleanString(record.url);
  return title && url ? { title, url } : undefined;
}

function normalizeAiGeneratedQuestion(value: unknown): AiGeneratedQuestion | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const title = cleanString(record.title ?? record.question);
  const type = cleanString(record.type);
  const category = cleanString(record.category);
  const source = cleanString(record.source);
  const difficulty = cleanString(record.difficulty);
  const tags = cleanStringArray(record.tags);
  const keywords = cleanStringArray(record.keywords);
  const followUp = cleanText(record.followUp);
  const hint = cleanText(record.hint);
  const bestAnswer = cleanText(record.bestAnswer);
  const principle = cleanText(record.principle);
  if (!title || !type || !category || !source || !difficulty || !tags.length || !keywords.length || !followUp || !hint || !bestAnswer || !principle) {
    return null;
  }

  const techStacks = cleanStringArray(record.techStacks, 8);
  const basis = cleanText(record.basis);
  const reference = normalizeReference(record.reference);
  return {
    title,
    type,
    category,
    source,
    difficulty,
    tags,
    keywords,
    followUp,
    hint,
    ...(techStacks.length ? { techStacks } : {}),
    bestAnswer,
    principle,
    ...(basis ? { basis } : {}),
    ...(reference ? { reference } : {}),
  };
}

export function normalizeAiGeneratedQuestions(values: unknown[]) {
  const result: AiGeneratedQuestion[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const question = normalizeAiGeneratedQuestion(value);
    if (!question) continue;
    const key = normalizeQuestionTitleKey(question.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(question);
  }
  return result;
}

export async function collectAiQuestionGroup(
  request: (count: number, excludedTitles: string[], attempt: number) => Promise<unknown[]>,
  targetCount: number,
  maxAttempts = 2,
) {
  const target = Math.max(0, Math.floor(targetCount));
  const attempts = Math.max(1, Math.floor(maxAttempts));
  let collected: AiGeneratedQuestion[] = [];
  for (let attempt = 1; attempt <= attempts && collected.length < target; attempt += 1) {
    const missing = target - collected.length;
    try {
      const batch = await request(missing, collected.map((question) => question.title), attempt);
      collected = normalizeAiGeneratedQuestions([...collected, ...(Array.isArray(batch) ? batch : [])]).slice(0, target);
    } catch {
      // Retry until maxAttempts is reached; caller will apply local fallback afterward.
    }
  }
  return collected;
}

export function fillQuestionGroup(aiValues: unknown[], fallbackValues: unknown[], targetCount: number) {
  const target = Math.max(0, Math.floor(targetCount));
  const ai = normalizeAiGeneratedQuestions(aiValues).slice(0, target);
  const fallback = normalizeAiGeneratedQuestions(fallbackValues);
  const questions: AiGeneratedQuestion[] = [...ai];
  const seen = new Set(questions.map((question) => normalizeQuestionTitleKey(question.title)));

  for (const question of fallback) {
    if (questions.length >= target) break;
    const key = normalizeQuestionTitleKey(question.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    questions.push(question);
  }

  return { questions, aiCount: ai.length };
}

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function metadataString(value: unknown) {
  const text = cleanString(value);
  return text || undefined;
}

export function createQuestionBankArchiveEntries(
  questions: unknown[],
  metadata: QuestionBankArchiveMetadata = {},
): QuestionBankArchiveEntry[] {
  const generatedAt = cleanString(metadata.generatedAt) || new Date().toISOString();
  return normalizeAiGeneratedQuestions(questions).map((question) => ({
    ...question,
    id: `aiq-${stableHash(normalizeQuestionTitleKey(question.title))}`,
    generatedAt,
    ...(metadataString(metadata.provider) ? { provider: metadataString(metadata.provider) } : {}),
    ...(metadataString(metadata.model) ? { model: metadataString(metadata.model) } : {}),
    ...(metadataString(metadata.project) ? { project: metadataString(metadata.project) } : {}),
    ...(metadataString(metadata.trainingMode) ? { trainingMode: metadataString(metadata.trainingMode) } : {}),
    ...(metadataString(metadata.categoryFilter) ? { categoryFilter: metadataString(metadata.categoryFilter) } : {}),
    ...(metadataString(metadata.difficultyFilter) ? { difficultyFilter: metadataString(metadata.difficultyFilter) } : {}),
    ...(metadataString(metadata.techStackFilter) ? { techStackFilter: metadataString(metadata.techStackFilter) } : {}),
  }));
}

function normalizeArchiveEntry(value: unknown): QuestionBankArchiveEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const question = normalizeAiGeneratedQuestion(record);
  if (!question) return null;
  const id = cleanString(record.id) || `aiq-${stableHash(normalizeQuestionTitleKey(question.title))}`;
  const generatedAt = cleanString(record.generatedAt) || new Date(0).toISOString();
  const optional = {
    provider: metadataString(record.provider),
    model: metadataString(record.model),
    project: metadataString(record.project),
    trainingMode: metadataString(record.trainingMode),
    categoryFilter: metadataString(record.categoryFilter),
    difficultyFilter: metadataString(record.difficultyFilter),
    techStackFilter: metadataString(record.techStackFilter),
  };
  return {
    ...question,
    id,
    generatedAt,
    ...(optional.provider ? { provider: optional.provider } : {}),
    ...(optional.model ? { model: optional.model } : {}),
    ...(optional.project ? { project: optional.project } : {}),
    ...(optional.trainingMode ? { trainingMode: optional.trainingMode } : {}),
    ...(optional.categoryFilter ? { categoryFilter: optional.categoryFilter } : {}),
    ...(optional.difficultyFilter ? { difficultyFilter: optional.difficultyFilter } : {}),
    ...(optional.techStackFilter ? { techStackFilter: optional.techStackFilter } : {}),
  };
}

export function mergeQuestionBankArchive(existingValues: unknown[], incomingValues: unknown[]) {
  const merged = new Map<string, QuestionBankArchiveEntry>();
  for (const value of existingValues) {
    const entry = normalizeArchiveEntry(value);
    if (!entry) continue;
    merged.set(normalizeQuestionTitleKey(entry.title), entry);
  }
  for (const value of incomingValues) {
    const entry = normalizeArchiveEntry(value);
    if (!entry) continue;
    merged.set(normalizeQuestionTitleKey(entry.title), entry);
  }
  return [...merged.values()];
}
