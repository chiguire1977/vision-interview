import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeTrainingRecord,
  normalizeTrainingRecords,
} from "../lib/training-records.mjs";

test("migrates a legacy record idempotently", () => {
  const legacy = {
    question: "什么是 Blob 分析？",
    category: "Blob 分析",
    mastery: "中",
    action: "完成答题",
    timestamp: "2026-09-01T00:00:00Z",
    seconds: 0,
    score: 62,
  };

  const once = normalizeTrainingRecord(legacy);
  const twice = normalizeTrainingRecord(once);

  assert.equal(once.category, "边缘与特征");
  assert.equal(once.masteryStage, "部分掌握");
  assert.equal(once.reviewCount, 0);
  assert.equal(once.reviewLevel, 0);
  assert.equal(once.easeFactor, 2.5);
  assert.equal("mastery" in once, false);
  assert.equal("seconds" in once, false);
  assert.equal("score" in once, false);
  assert.deepEqual(twice, once);
});

test("drops invalid entries and maps missing categories to other", () => {
  const normalized = normalizeTrainingRecords([
    null,
    {},
    { question: "未知分类题", category: "AI 新分类", mastery: "低" },
  ]);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].category, "其他");
  assert.equal(normalized[0].masteryStage, "未掌握");
});

test("preserves valid scheduling fields and clamps unsafe values", () => {
  const record = normalizeTrainingRecord({
    question: "复习题",
    category: "通讯协议",
    masteryStage: "熟练",
    reviewCount: 4.8,
    reviewLevel: 99,
    easeFactor: 1,
    nextReviewAt: "2026-09-20T00:00:00Z",
    skipReason: "too-hard",
  });

  assert.equal(record.reviewCount, 4);
  assert.equal(record.reviewLevel, 5);
  assert.equal(record.easeFactor, 1.3);
  assert.equal(record.nextReviewAt, "2026-09-20T00:00:00.000Z");
  assert.equal(record.skipReason, "太难");
});
