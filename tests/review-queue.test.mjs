import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReviewQueue,
  REVIEW_INTERVAL_DAYS,
  scheduleReview,
  selectReviewQuestions,
  summarizeReviewQueue,
} from "../lib/review-queue.mjs";

const NOW = new Date("2026-09-19T12:00:00.000Z");

test("builds a priority queue from low mastery, skipped, and issue records", () => {
  const queue = buildReviewQueue([
    { question: "普通题", category: "相机与光源", mastery: "中", reviewIssues: [] },
    { question: "跳过题", category: "通讯协议", action: "跳过题目", mastery: "低" },
    { question: "低掌握题", category: "标定与坐标", mastery: "低", reviewIssues: ["遗漏误差验证"] },
    { question: "高掌握题", category: "边缘与特征", mastery: "高" },
    { question: "中等问题题", category: "模板与定位", mastery: "中", reviewIssues: ["没有说明旋转边界"] },
  ]);

  assert.deepEqual(queue.map((item) => item.question), ["低掌握题", "跳过题", "中等问题题"]);
  assert.equal(queue[0].priority, "高");
  assert.match(queue[0].reason, /低掌握/);
  assert.match(queue[1].reason, /跳过/);
  assert.deepEqual(summarizeReviewQueue(queue), { total: 3, high: 2, categories: 3 });
});

test("selects review questions in queue order and moves the requested title first", () => {
  const questions = [
    { title: "普通题", category: "相机与光源" },
    { title: "低掌握题", category: "标定与坐标" },
    { title: "跳过题", category: "通讯协议" },
  ];
  const records = [
    { question: "跳过题", action: "跳过题目", mastery: "低" },
    { question: "低掌握题", mastery: "低" },
    { question: "题库中不存在的历史题", mastery: "低" },
  ];

  const selected = selectReviewQuestions(questions, records, "跳过题");
  assert.deepEqual(selected.map((item) => item.title), ["跳过题", "低掌握题"]);
  assert.deepEqual(selectReviewQuestions(questions, records, "不存在的题"), [questions[2], questions[1]]);
});

test("schedules successful reviews through the 1/3/7/15/30/60 day ladder", () => {
  assert.deepEqual(REVIEW_INTERVAL_DAYS, [1, 3, 7, 15, 30, 60]);
  const first = scheduleReview({}, "remembered", NOW);
  assert.equal(first.reviewCount, 1);
  assert.equal(first.reviewLevel, 0);
  assert.equal(first.nextReviewAt, "2026-09-20T12:00:00.000Z");
  const second = scheduleReview(first, "remembered", new Date(first.nextReviewAt));
  assert.equal(second.reviewLevel, 1);
  assert.equal(second.nextReviewAt, "2026-09-23T12:00:00.000Z");
  const forgotten = scheduleReview({ ...second, easeFactor: 2.5 }, "forgotten", NOW);
  assert.equal(forgotten.reviewLevel, 0);
  assert.ok(forgotten.easeFactor < 2.5);
  const partial = scheduleReview({ ...second, easeFactor: 2.5 }, "partial", NOW);
  assert.equal(partial.reviewLevel, second.reviewLevel);
});

test("shows only due weak records and keeps the newest record per question", () => {
  const queue = buildReviewQueue([
    { question: "重复题", source: "专业", masteryStage: "未掌握", date: "2026-09-18T00:00:00.000Z", nextReviewAt: "2026-09-18T12:00:00.000Z" },
    { question: "重复题", source: "专业", masteryStage: "已掌握", date: "2026-09-19T01:00:00.000Z", nextReviewAt: "2026-09-20T12:00:00.000Z" },
    { question: "到期题", source: "专业", masteryStage: "部分掌握", date: "2026-09-17T00:00:00.000Z", nextReviewAt: "2026-09-19T11:00:00.000Z" },
    { question: "未到期题", source: "专业", masteryStage: "未掌握", nextReviewAt: "2026-09-20T12:00:00.000Z" },
  ], NOW);
  assert.deepEqual(queue.map((item) => item.question), ["到期题"]);
  assert.ok(queue[0].overdueMs > 0);
});

test("includes mastered records after their scheduled review date", () => {
  const queue = buildReviewQueue([
    { question: "已掌握到期", masteryStage: "已掌握", nextReviewAt: "2026-09-19T11:00:00.000Z" },
    { question: "熟练到期", masteryStage: "熟练", nextReviewAt: "2026-09-19T10:00:00.000Z" },
  ], NOW);
  assert.deepEqual(queue.map((item) => item.question).sort(), ["已掌握到期", "熟练到期"]);
});
