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

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
