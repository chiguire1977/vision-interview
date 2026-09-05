import { normalizeKnowledgeCategory, normalizeTechStack } from "./taxonomy.mjs";
import { normalizeDetectionDirection } from "./detection-direction.mjs";
import { normalizeQuestionBlueprint } from "./question-blueprint.mjs";

export type AiQuestionBlueprint = {
  version: number;
  knowledgeKey: string;
  corePoints: string[];
  criticalPoints: string[];
  supportingPoints: string[];
  ability: string[];
  scenario: string;
  commonMistakes: string[];
};

export type AiGeneratedQuestion = {
  title: string;
  type: string;
  category: string;
  source: string;
  sourceType?: string;
  knowledgePoints?: string[];
  difficulty: string;
  tags: string[];
  keywords: string[];
  followUp: string;
  hint: string;
  techStacks?: string[];
  detectionDirection?: string;
  bestAnswer: string;
  principle: string;
  blueprint?: AiQuestionBlueprint;
  basis?: string;
  reference?: { title: string; url: string; snippet?: string };
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
  detectionDirectionFilter?: string;
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
  detectionDirectionFilter?: string;
};

export type AiQuestionSourceFilter = "专业" | "项目" | "专业或项目";
export const AI_QUESTION_MAX_ATTEMPTS = 6;
const AI_QUESTION_DIVERSITY_LANES = [
  "原理与机制",
  "参数与边界",
  "工程实践与性能",
  "现场故障与排查",
  "方案取舍与对比",
  "验证与项目落地",
];
export type AiQuestionGroupProgressPhase = "requesting" | "searching" | "search-completed" | "search-failed" | "ai-requesting" | "received" | "failed";
export type AiQuestionGroupProgress = {
  phase: AiQuestionGroupProgressPhase;
  attempt: number;
  maxAttempts: number;
  targetCount: number;
  collectedCount: number;
  workerIndex?: number;
  parallelRequests?: number;
  requestedCount?: number;
  searchSourceCount?: number;
  error?: string;
};
export type AiQuestionSelectionFilter = {
  source: AiQuestionSourceFilter;
  category?: string;
  difficulty?: string;
  techStack?: string;
  detectionDirection?: string;
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
  const target = normalizedComparison(normalizeTechStack(expected));
  if (!target || target === "随机技术栈") return true;
  return (values ?? []).some((value) => normalizedComparison(normalizeTechStack(value)) === target);
}

function matchesDetectionDirection(value: string | undefined, expected: string) {
  const target = normalizeDetectionDirection(expected);
  if (!target || target === "随机方向") return true;
  return normalizeDetectionDirection(value) === target;
}

function questionSearchText(question: Partial<AiGeneratedQuestion>) {
  return [
    question.title,
    question.type,
    question.category,
    question.sourceType,
    ...(question.knowledgePoints ?? []),
    ...(question.tags ?? []),
    ...(question.keywords ?? []),
    question.followUp,
    question.hint,
    question.basis,
    question.bestAnswer,
    question.principle,
    question.reference?.title,
    question.reference?.url,
    question.reference?.snippet,
  ].filter(Boolean).join("|");
}

const TRADITIONAL_2D_CONFLICT_PATTERNS = [
  /\b3d\b/i,
  /三维/,
  /点云/,
  /深度图|深度数据|深度相机/,
  /法线估计|法向量/,
  /平面拟合/,
  /表面模型/,
  /立体视觉/,
  /结构光/,
  /双目/,
  /\bxyz\b/i,
];

/** Checks semantic consistency in addition to the AI-provided direction field. */
export function isQuestionDirectionSemanticallyCompatible(question: unknown, expected: string) {
  const target = normalizeDetectionDirection(expected);
  if (!target || target === "随机方向" || !question || typeof question !== "object") return true;
  if (!target.includes("传统 2D")) return true;
  const text = questionSearchText(question as Partial<AiGeneratedQuestion>);
  return !TRADITIONAL_2D_CONFLICT_PATTERNS.some((pattern) => pattern.test(text));
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
    if (selection.detectionDirection && !matchesDetectionDirection(question.detectionDirection, selection.detectionDirection)) return false;
    if (selection.detectionDirection && !isQuestionDirectionSemanticallyCompatible(question, selection.detectionDirection)) return false;
    if (forbiddenPhrases.length) {
      const searchable = normalizedComparison(questionSearchText(question));
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

function questionSimilaritySignals(question: Partial<AiGeneratedQuestion>) {
  const title = normalizedComparison(question.title);
  const signals = new Set<string>();
  const chineseCharacters = Array.from(title).filter((character) => /[\u4e00-\u9fff]/.test(character));
  for (let index = 0; index < chineseCharacters.length - 1; index += 1) {
    signals.add(`${chineseCharacters[index]}${chineseCharacters[index + 1]}`);
  }
  for (const token of title.match(/[a-z0-9]+/g) ?? []) {
    if (token.length >= 3) signals.add(token);
  }
  return signals;
}

function questionClassSignals(question: Partial<AiGeneratedQuestion>) {
  const signals = new Set<string>();
  // Knowledge points are the explicit semantic contract from the generator.
  // Do not infer a whole class from generic tags/keywords when older records
  // do not contain knowledgePoints; title similarity remains the safe fallback.
  for (const value of question.knowledgePoints ?? []) {
    const token = normalizedComparison(value);
    if (token.length >= 2) signals.add(token);
  }
  return signals;
}

function questionScopeMatches(left: Partial<AiGeneratedQuestion>, right: Partial<AiGeneratedQuestion>) {
  const leftCategory = normalizedComparison(left.category);
  const rightCategory = normalizedComparison(right.category);
  if (leftCategory && rightCategory && leftCategory !== rightCategory) return false;
  const leftStacks = new Set((left.techStacks ?? []).map(normalizedComparison).filter(Boolean));
  const rightStacks = new Set((right.techStacks ?? []).map(normalizedComparison).filter(Boolean));
  if (leftStacks.size && rightStacks.size && ![...leftStacks].some((stack) => rightStacks.has(stack))) return false;
  const leftDirection = normalizedComparison(left.detectionDirection);
  const rightDirection = normalizedComparison(right.detectionDirection);
  return !leftDirection || !rightDirection || leftDirection === rightDirection;
}

/** Returns a stable class key used to coordinate parallel workers and retries. */
export function questionKnowledgeClassKey(question: Partial<AiGeneratedQuestion>) {
  const signals = [...questionClassSignals(question)].sort();
  if (!signals.length) return normalizeQuestionTitleKey(question.title);
  return [
    normalizedComparison(question.category),
    [...new Set((question.techStacks ?? []).map(normalizedComparison).filter(Boolean))].sort().join(","),
    signals.slice(0, 6).join(","),
  ].join("|");
}

function questionClassSimilarity(left: Partial<AiGeneratedQuestion>, right: Partial<AiGeneratedQuestion>) {
  if (!questionScopeMatches(left, right)) return 0;
  const leftSignals = questionClassSignals(left);
  const rightSignals = questionClassSignals(right);
  if (leftSignals.size < 2 || rightSignals.size < 2) return 0;
  let intersection = 0;
  for (const signal of leftSignals) if (rightSignals.has(signal)) intersection += 1;
  return intersection / Math.min(leftSignals.size, rightSignals.size);
}

function questionSimilarity(left: Partial<AiGeneratedQuestion>, right: Partial<AiGeneratedQuestion>) {
  if (questionClassSimilarity(left, right) >= 0.6) return 1;
  const leftSignals = questionSimilaritySignals(left);
  const rightSignals = questionSimilaritySignals(right);
  if (leftSignals.size < 3 || rightSignals.size < 3) return 0;
  let intersection = 0;
  for (const signal of leftSignals) if (rightSignals.has(signal)) intersection += 1;
  return intersection / Math.min(leftSignals.size, rightSignals.size);
}

/** Removes paraphrased questions from a single generated group without altering the archive. */
export function filterSimilarQuestionGroup(values: unknown[], threshold = 0.38) {
  const normalized = normalizeAiGeneratedQuestions(values);
  const result: AiGeneratedQuestion[] = [];
  for (const question of normalized) {
    if (result.some((existing) => questionSimilarity(existing, question) >= threshold)) continue;
    result.push(question);
  }
  return result;
}

function normalizeReference(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const title = cleanString(record.title);
  const url = cleanString(record.url);
  if (!title || !/^https?:\/\//i.test(url)) return undefined;
  const snippet = cleanText(record.snippet);
  return { title, url, ...(snippet ? { snippet } : {}) };
}

function normalizeAiGeneratedQuestion(value: unknown): AiGeneratedQuestion | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const title = cleanString(record.title ?? record.question);
  const type = cleanString(record.type);
  const category = normalizeKnowledgeCategory(record.category);
  const source = cleanString(record.source);
  const sourceType = cleanString(record.sourceType);
  const knowledgePoints = cleanStringArray(record.knowledgePoints ?? record.knowledgePoint, 8);
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

  const techStacks = cleanStringArray(record.techStacks, 8).map(normalizeTechStack);
  const detectionDirection = normalizeDetectionDirection(record.detectionDirection);
  const basis = cleanText(record.basis);
  const reference = normalizeReference(record.reference);
  const rawBlueprint = record.blueprint && typeof record.blueprint === "object"
    ? normalizeQuestionBlueprint(record.blueprint)
    : undefined;
  return {
    title,
    type,
    category,
    source,
    ...(sourceType ? { sourceType } : {}),
    ...(knowledgePoints.length ? { knowledgePoints } : {}),
    difficulty,
    tags,
    keywords,
    followUp,
    hint,
    ...(techStacks.length ? { techStacks } : {}),
    ...(detectionDirection ? { detectionDirection } : {}),
    bestAnswer,
    principle,
    ...(rawBlueprint ? { blueprint: rawBlueprint } : {}),
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

export function filterPersistableQuestions(values: unknown[], { requiresVerifiedReference = false } = {}) {
  const normalized = normalizeAiGeneratedQuestions(values);
  return requiresVerifiedReference ? normalized.filter((question) => Boolean(question.reference)) : normalized;
}

function safeAttemptError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "请求发生异常";
  return message
    .replace(/(api[_-]?key|authorization|bearer)\s*[:=]\s*[^\s,;]+/gi, "$1=[已隐藏]")
    .trim()
    .slice(0, 240) || "请求发生异常";
}

export async function runWithOptionalWebResearch<T, R>(
  needsWebResearch: boolean,
  search: () => Promise<T>,
  generate: (research: { value?: T; error?: string }) => Promise<R>,
) {
  if (!needsWebResearch) return generate({});
  let value: T;
  try {
    value = await search();
  } catch (error) {
    return generate({ error: safeAttemptError(error) });
  }
  return generate({ value });
}

export function formatAiQuestionGroupProgress(progress: AiQuestionGroupProgress) {
  const round = `第 ${progress.attempt}/${progress.maxAttempts} 轮`;
  const worker = progress.workerIndex && progress.parallelRequests && progress.parallelRequests > 1
    ? `（并行 ${progress.workerIndex}/${progress.parallelRequests}）`
    : "";
  if (progress.phase === "searching") return `${round}：正在联网搜索题目资料…`;
  if (progress.phase === "search-completed") return `${round}：联网搜索完成（${progress.searchSourceCount ?? 0} 条），正在请求 AI…`;
  if (progress.phase === "search-failed") return `${round}：联网检索不可用${progress.error ? `（${progress.error}）` : ""}，继续请求 AI…`;
  if (progress.phase === "ai-requesting") return `${round}${worker}：正在请求 AI 生成题目${progress.requestedCount ? `（${progress.requestedCount} 道）` : ""}…`;
  if (progress.phase === "received") {
    return `${round}：AI 已返回 ${progress.collectedCount}/${progress.targetCount} 道有效题目${progress.collectedCount < progress.targetCount ? "，继续补齐…" : "。"}`;
  }
  if (progress.phase === "failed") {
    return `${round}${worker}：本轮请求失败${progress.error ? `：${progress.error}` : ""}，准备下一轮…`;
  }
  return `${round}：开始准备本轮题目…`;
}

export function deferAsyncTask<T>(
  task: () => Promise<T> | T,
  onSuccess?: (value: T) => void,
  onFailure?: (error: Error) => void,
) {
  void Promise.resolve().then(task).then(
    (value) => {
      try { onSuccess?.(value); } catch { /* 后台回调不能影响主流程 */ }
    },
    (error) => {
      try {
        onFailure?.(error instanceof Error ? error : new Error(safeAttemptError(error)));
      } catch { /* 后台回调不能影响主流程 */ }
    },
  );
}

export async function collectAiQuestionGroup(
  request: (count: number, excludedTitles: string[], attempt: number, workerIndex?: number, roundContext?: unknown, workerContext?: unknown) => Promise<unknown[]>,
  targetCount: number,
  maxAttempts = AI_QUESTION_MAX_ATTEMPTS,
  onProgress?: (progress: AiQuestionGroupProgress) => void,
  options: {
    parallelRequests?: number;
    prepareAttempt?: (attempt: number, excludedTitles: string[]) => Promise<unknown>;
    initialExcludedTitles?: string[];
    initialExcludedQuestionClasses?: string[];
  } = {},
) {
  const target = Math.max(0, Math.floor(targetCount));
  const attempts = Math.max(1, Math.floor(maxAttempts));
  const parallelRequests = Math.max(1, Math.floor(options.parallelRequests ?? 1));
  let collected: AiGeneratedQuestion[] = [];
  const initialExcludedTitles = [...new Set((options.initialExcludedTitles ?? []).filter(Boolean))];
  const excludedQuestionClasses = new Set<string>((options.initialExcludedQuestionClasses ?? []).filter(Boolean));
  const report = (progress: AiQuestionGroupProgress) => {
    try { onProgress?.(progress); } catch { /* 进度回调不能影响题组生成 */ }
  };
  for (let attempt = 1; attempt <= attempts && collected.length < target; attempt += 1) {
    const missing = target - collected.length;
    report({ phase: "requesting", attempt, maxAttempts: attempts, targetCount: target, collectedCount: collected.length });

    const workerCount = Math.min(parallelRequests, missing);
    const baseCount = Math.floor(missing / workerCount);
    const remainder = missing % workerCount;
    const excludedTitles = [...initialExcludedTitles, ...collected.map((question) => question.title)];
    let roundContext: unknown;
    if (options.prepareAttempt) {
      try {
        roundContext = await options.prepareAttempt(attempt, excludedTitles);
      } catch (error) {
        const message = safeAttemptError(error);
        report({
          phase: "failed",
          attempt,
          maxAttempts: attempts,
          targetCount: target,
          collectedCount: collected.length,
          parallelRequests,
          error: message,
        });
      }
    }
    const workerRequests = Array.from({ length: workerCount }, (_, workerOffset) => {
      const workerIndex = workerOffset + 1;
      const count = baseCount + (workerOffset < remainder ? 1 : 0);
      const laneIndex = ((attempt - 1) * workerCount + workerOffset) % AI_QUESTION_DIVERSITY_LANES.length;
      const workerContext = {
        lane: AI_QUESTION_DIVERSITY_LANES[laneIndex],
        excludedQuestionClasses: [...excludedQuestionClasses],
      };
      return Promise.resolve().then(() => request(count, excludedTitles, attempt, workerIndex, roundContext, workerContext));
    });
    const results = await Promise.allSettled(workerRequests);
    const received: unknown[] = [];
    const errors: string[] = [];
    results.forEach((result, workerOffset) => {
      const workerIndex = workerOffset + 1;
      if (result.status === "fulfilled") {
        if (Array.isArray(result.value)) received.push(...result.value);
        return;
      }
      const error = safeAttemptError(result.reason);
      errors.push(error);
      report({
        phase: "failed",
        attempt,
        maxAttempts: attempts,
        targetCount: target,
        collectedCount: collected.length,
        workerIndex,
        parallelRequests,
        error,
      });
    });

    collected = filterSimilarQuestionGroup([...collected, ...received]).slice(0, target);
    for (const question of collected) {
      const key = questionKnowledgeClassKey(question);
      if (key) excludedQuestionClasses.add(key);
    }
    if (received.length > 0) {
      report({
        phase: "received",
        attempt,
        maxAttempts: attempts,
        targetCount: target,
        collectedCount: collected.length,
        parallelRequests,
        requestedCount: missing,
      });
    } else if (errors.length === 0) {
      report({
        phase: "failed",
        attempt,
        maxAttempts: attempts,
        targetCount: target,
        collectedCount: collected.length,
        parallelRequests,
        error: "AI 未返回有效题目",
      });
    }
    // Retry until maxAttempts is reached; caller will apply local fallback afterward.
  }
  return collected;
}

export function fillQuestionGroup(aiValues: unknown[], fallbackValues: unknown[], targetCount: number) {
  const target = Math.max(0, Math.floor(targetCount));
  const ai = filterSimilarQuestionGroup(aiValues).slice(0, target);
  const fallback = normalizeAiGeneratedQuestions(fallbackValues);
  const questions: AiGeneratedQuestion[] = [...ai];
  const seen = new Set(questions.map((question) => normalizeQuestionTitleKey(question.title)));

  for (const question of fallback) {
    if (questions.length >= target) break;
    const key = normalizeQuestionTitleKey(question.title);
    if (!key || seen.has(key) || questions.some((existing) => questionSimilarity(existing, question) >= 0.38)) continue;
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
    ...(metadataString(metadata.detectionDirectionFilter) ? { detectionDirectionFilter: metadataString(metadata.detectionDirectionFilter) } : {}),
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
    detectionDirectionFilter: metadataString(record.detectionDirectionFilter),
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
    ...(optional.detectionDirectionFilter ? { detectionDirectionFilter: optional.detectionDirectionFilter } : {}),
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

function markdownInline(value: unknown) {
  return cleanString(value).replace(/[\\`*_[\]{}<>]/g, "\\$&") || "未填写";
}

function markdownBody(value: unknown) {
  return cleanText(value).replace(/\r\n?/g, "\n") || "未填写";
}

function markdownReference(value: QuestionBankArchiveEntry["reference"]) {
  if (!value) return "未提供";
  const title = markdownInline(value.title);
  const url = value.url.trim();
  const link = /^https?:\/\//i.test(url) ? `[${title}](${url.replace(/[()]/g, "\\$&")})` : `${title}：${markdownInline(url)}`;
  return value.snippet ? `${link}\n\n> ${markdownBody(value.snippet)}` : link;
}

export function createQuestionBankMarkdown(values: unknown[], updatedAt = new Date().toISOString()) {
  const entries = values
    .map((value) => normalizeArchiveEntry(value))
    .filter((entry): entry is QuestionBankArchiveEntry => Boolean(entry));
  const groups = new Map<string, QuestionBankArchiveEntry[]>();
  for (const entry of entries) {
    const current = groups.get(entry.category) ?? [];
    current.push(entry);
    groups.set(entry.category, current);
  }
  const sections = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, "zh-CN")).map(([category, categoryEntries]) => [
    `## ${markdownInline(category)}`,
    "",
    `> 本分类共 ${categoryEntries.length} 道题`,
    "",
    categoryEntries.map((entry, index) => [
      `### ${index + 1}. ${markdownInline(entry.title)}`,
      "",
      `- **题型**：${markdownInline(entry.type)}`,
      `- **来源**：${markdownInline(entry.source)}`,
      ...(entry.sourceType ? [`- **题源类型**：${markdownInline(entry.sourceType)}`] : []),
      `- **分类**：${markdownInline(entry.category)}`,
      `- **难度**：${markdownInline(entry.difficulty)}`,
      `- **技术栈**：${entry.techStacks?.length ? entry.techStacks.map(markdownInline).join("、") : "未填写"}`,
      ...(entry.detectionDirection ? [`- **检测方向**：${markdownInline(entry.detectionDirection)}`] : []),
      ...(entry.knowledgePoints?.length ? [`- **知识点**：${entry.knowledgePoints.map(markdownInline).join("、")}`] : []),
      `- **标签**：${entry.tags.map(markdownInline).join("、")}`,
      `- **关键词**：${entry.keywords.map(markdownInline).join("、")}`,
      `- **生成时间**：${markdownInline(entry.generatedAt)}`,
      ...(entry.provider || entry.model ? [`- **生成模型**：${[entry.provider, entry.model].filter(Boolean).map(markdownInline).join(" / ")}`] : []),
      ...(entry.project ? [`- **关联项目**：${markdownInline(entry.project)}`] : []),
      ...(entry.trainingMode ? [`- **训练模式**：${markdownInline(entry.trainingMode)}`] : []),
      "",
      "### 最佳答案",
      "",
      markdownBody(entry.bestAnswer),
      "",
      "### 原理",
      "",
      markdownBody(entry.principle),
      "",
      "### 回答提示",
      "",
      markdownBody(entry.hint),
      "",
      "### 追问",
      "",
      markdownBody(entry.followUp),
      "",
      "### 参考资料",
      "",
      markdownReference(entry.reference),
      "",
    ].join("\n")).join("\n"),
  ].join("\n"));

  return [
    "# AI 生成题库",
    "",
    `> 共 ${entries.length} 道题 · 最后更新：${markdownInline(updatedAt)}`,
    "",
    sections.join("\n"),
  ].join("\n").trimEnd() + "\n";
}
