export const DEFAULT_QUESTION_GROUP_SIZE = 10;
export const MIN_QUESTION_GROUP_SIZE = 1;
export const MAX_QUESTION_GROUP_SIZE = 20;
export const DEFAULT_PARALLEL_REQUESTS = 3;
export const MIN_PARALLEL_REQUESTS = 1;
export const MAX_PARALLEL_REQUESTS = 6;

export function normalizeQuestionGroupSize(value) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_QUESTION_GROUP_SIZE;
  return Math.min(MAX_QUESTION_GROUP_SIZE, Math.max(MIN_QUESTION_GROUP_SIZE, Math.round(numeric)));
}

export function normalizeParallelRequests(value) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_PARALLEL_REQUESTS;
  return Math.min(MAX_PARALLEL_REQUESTS, Math.max(MIN_PARALLEL_REQUESTS, Math.round(numeric)));
}

export function normalizeQuestionGroupSettings(value = {}) {
  const settings = value && typeof value === "object" ? value : {};
  return {
    questionGroupSize: normalizeQuestionGroupSize(settings.questionGroupSize),
    parallelRequests: normalizeParallelRequests(settings.parallelRequests),
  };
}
