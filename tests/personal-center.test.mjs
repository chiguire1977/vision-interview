import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeLearningMastery,
  createImprovementPlan,
} from "../lib/personal-center.mjs";

test("analyzeLearningMastery groups records by knowledge category and summarizes mastery", () => {
  const analysis = analyzeLearningMastery([
    { question: "Q1", category: "图像处理基础", score: 86, mastery: "高", action: "完成答题", date: "2026-08-31" },
    { question: "Q2", category: "图像处理基础", score: 62, mastery: "中", action: "完成答题", date: "2026-08-30" },
    { question: "Q3", category: "标定与坐标", mastery: "低", action: "跳过题目", date: "2026-08-29", reviewIssues: ["遗漏坐标变换关系"] },
  ]);

  assert.equal(analysis.totalRecords, 3);
  assert.equal(analysis.answeredCount, 2);
  assert.equal(analysis.skippedCount, 1);
  assert.equal(analysis.averageScore, 74);
  assert.deepEqual(analysis.masteryCounts, { 低: 1, 中: 1, 高: 1 });
  assert.deepEqual(analysis.categories.map((item) => item.category), ["标定与坐标", "图像处理基础"]);
  assert.deepEqual(analysis.categories[0], {
    category: "标定与坐标",
    attempts: 1,
    answeredCount: 0,
    skippedCount: 1,
    averageScore: null,
    mastery: "低",
    masteryScore: 0,
    masteryCounts: { 低: 1, 中: 0, 高: 0 },
    issues: ["遗漏坐标变换关系"],
    suggestions: [],
    latestDate: "2026-08-29",
  });
});

test("analyzeLearningMastery does not invent scores when records have no score", () => {
  const analysis = analyzeLearningMastery([
    { question: "Q1", category: "边缘与特征", mastery: "中", action: "完成答题", date: "2026-08-31" },
  ]);

  assert.equal(analysis.averageScore, null);
  assert.equal(analysis.categories[0].averageScore, null);
  assert.equal(analysis.categories[0].mastery, "中");
});

test("createImprovementPlan prioritizes weak categories and turns review data into actions", () => {
  const analysis = analyzeLearningMastery([
    { question: "Q1", category: "标定与坐标", mastery: "低", action: "跳过题目", date: "2026-08-31", reviewIssues: ["遗漏坐标变换关系"] },
    { question: "Q2", category: "标定与坐标", mastery: "低", action: "完成答题", date: "2026-08-30", reviewSuggestions: ["补充标定误差分析"] },
    { question: "Q3", category: "图像处理基础", mastery: "高", action: "完成答题", date: "2026-08-29" },
  ]);

  const plan = createImprovementPlan(analysis);

  assert.equal(plan.length, 1);
  assert.equal(plan[0].category, "标定与坐标");
  assert.equal(plan[0].priority, "高");
  assert.match(plan[0].reason, /坐标变换关系/);
  assert.match(plan[0].actions.join(" "), /标定误差分析/);
  assert.equal(plan[0].target, "连续完成 3 道本分类题目，并将掌握度提升到中及以上");
});

test("createImprovementPlan returns an empty plan without learning records", () => {
  assert.deepEqual(createImprovementPlan(analyzeLearningMastery([])), []);
});
