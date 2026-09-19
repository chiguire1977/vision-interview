function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 15, 30, 60];
const DAY_MS = 24 * 60 * 60 * 1000;

function stage(record) {
  if (record.masteryStage) return record.masteryStage;
  if (record.mastery === "高") return "已掌握";
  if (record.mastery === "中") return "部分掌握";
  return "未掌握";
}

function timestamp(value, fallback = 0) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function scheduleReview(record = {}, outcome = "remembered", now = new Date()) {
  const currentLevel = Math.max(0, Math.min(REVIEW_INTERVAL_DAYS.length - 1, Math.trunc(Number(record.reviewLevel) || 0)));
  const remembered = outcome === "remembered";
  const partial = outcome === "partial";
  const reviewLevel = remembered && Number(record.reviewCount) > 0
    ? Math.min(currentLevel + 1, REVIEW_INTERVAL_DAYS.length - 1)
    : partial ? currentLevel : 0;
  const easeDelta = remembered ? 0.05 : partial ? -0.05 : -0.2;
  const easeFactor = Math.max(1.3, Math.min(3, (Number(record.easeFactor) || 2.5) + easeDelta));
  return {
    ...record,
    reviewCount: Math.max(0, Math.trunc(Number(record.reviewCount) || 0)) + 1,
    reviewLevel,
    easeFactor: Number(easeFactor.toFixed(2)),
    nextReviewAt: new Date(now.getTime() + REVIEW_INTERVAL_DAYS[reviewLevel] * DAY_MS).toISOString(),
  };
}

function hasReviewIssues(record) {
  return (Array.isArray(record.reviewIssues) && record.reviewIssues.length > 0)
    || (Array.isArray(record.reviewSuggestions) && record.reviewSuggestions.length > 0);
}

function scoreRecord(record) {
  const low = stage(record) === "未掌握" ? 100 : 0;
  const skipped = record.action === "跳过题目" ? 2 : 0;
  const medium = stage(record) === "部分掌握" ? 55 : 0;
  const issueCount = (Array.isArray(record.reviewIssues) ? record.reviewIssues.length : 0)
    + (Array.isArray(record.reviewSuggestions) ? record.reviewSuggestions.length : 0);
  return low + skipped + medium + Math.min(issueCount, 4) * 5;
}

function reviewReason(record) {
  const reasons = [];
  if (stage(record) === "未掌握") reasons.push("低掌握");
  if (record.action === "跳过题目") reasons.push("跳过");
  if (hasReviewIssues(record)) reasons.push("存在审阅问题");
  return reasons.join("、") || "需要复习";
}

export function buildReviewQueue(records, now = new Date()) {
  if (!Array.isArray(records)) return [];
  const newest = new Map();
  records
    .filter((record) => record && typeof record === "object" && clean(record.question))
    .forEach((record, index) => {
      const key = `${clean(record.source) || "历史"}|${clean(record.question)}`;
      const candidate = { record, index, time: timestamp(record.date ?? record.createdAt, index) };
      if (!newest.has(key) || newest.get(key).time <= candidate.time) newest.set(key, candidate);
    });
  return [...newest.values()]
    .filter(({ record }) => Boolean(record.nextReviewAt)
      || stage(record) === "未掌握"
      || record.action === "跳过题目"
      || (stage(record) === "部分掌握" && (record.masteryStage === "部分掌握" || hasReviewIssues(record))))
    .filter(({ record }) => !record.nextReviewAt || timestamp(record.nextReviewAt, -1) <= now.getTime())
    .map(({ record }, index) => ({
      ...record,
      queueIndex: index,
      score: scoreRecord(record) + Math.min(30, Math.max(0, now.getTime() - timestamp(record.nextReviewAt, now.getTime())) / DAY_MS),
      overdueMs: Math.max(0, now.getTime() - timestamp(record.nextReviewAt, now.getTime())),
      priority: scoreRecord(record) >= 100 ? "高" : "中",
      reason: reviewReason(record),
    }))
    .sort((left, right) => right.score - left.score || left.queueIndex - right.queueIndex);
}

export function selectReviewQuestions(questions, records, startTitle = "", now = new Date()) {
  if (!Array.isArray(questions)) return [];
  const questionMap = new Map(questions.map((question) => [clean(question?.title), question]));
  const selected = buildReviewQueue(records, now)
    .map((record) => questionMap.get(clean(record.question)))
    .filter(Boolean);
  const startIndex = selected.findIndex((question) => clean(question.title) === clean(startTitle));
  if (startIndex > 0) return [selected[startIndex], ...selected.slice(0, startIndex), ...selected.slice(startIndex + 1)];
  return selected;
}

export function summarizeReviewQueue(queue) {
  const items = Array.isArray(queue) ? queue : [];
  return {
    total: items.length,
    high: items.filter((item) => item.priority === "高").length,
    categories: new Set(items.map((item) => clean(item.category) || "待分类")).size,
  };
}
