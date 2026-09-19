import { normalizeMasteryStage } from "./mastery.mjs";
import { normalizeKnowledgeCategory } from "./taxonomy.mjs";

const SKIP_REASON_ALIASES = new Map([
  ["too-hard", "太难"], ["太难", "太难"],
  ["not-interested", "不感兴趣"], ["不感兴趣", "不感兴趣"],
  ["later", "稍后再学"], ["稍后再学", "稍后再学"],
]);

function integer(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(number)));
}

function finite(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function isoDate(value) {
  const milliseconds = Date.parse(String(value || ""));
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : undefined;
}

export function normalizeTrainingRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const question = typeof value.question === "string" ? value.question.trim() : "";
  if (!question || value.action === "查看答案") return null;

  const normalized = {
    ...value,
    question,
    category: normalizeKnowledgeCategory(value.category),
    action: value.action === "跳过题目" ? "跳过题目" : "完成答题",
    masteryStage: normalizeMasteryStage(value.masteryStage ?? value.mastery),
    reviewCount: integer(value.reviewCount, 0, 0, Number.MAX_SAFE_INTEGER),
    reviewLevel: integer(value.reviewLevel, 0, 0, 5),
    easeFactor: finite(value.easeFactor, 2.5, 1.3, 4),
  };

  const nextReviewAt = isoDate(value.nextReviewAt);
  if (nextReviewAt) normalized.nextReviewAt = nextReviewAt;
  else delete normalized.nextReviewAt;
  if (SKIP_REASON_ALIASES.has(value.skipReason)) normalized.skipReason = SKIP_REASON_ALIASES.get(value.skipReason);
  else delete normalized.skipReason;

  delete normalized.mastery;
  delete normalized.seconds;
  delete normalized.score;
  return normalized;
}

export function normalizeTrainingRecords(values) {
  if (!Array.isArray(values)) return [];
  return values.map(normalizeTrainingRecord).filter(Boolean);
}
