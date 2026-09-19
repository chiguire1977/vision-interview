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
  assert.equal("averageScore" in analysis, false);
  assert.deepEqual(analysis.masteryStageCounts, { 未掌握: 1, 部分掌握: 1, 已掌握: 1, 熟练: 0 });
  assert.deepEqual(analysis.categories.map((item) => item.category), ["标定与坐标", "图像处理基础"]);
  assert.deepEqual(analysis.categories[0], {
    category: "标定与坐标",
    attempts: 1,
    answeredCount: 0,
    skippedCount: 1,
    masteryStage: "未掌握",
    masteryStageCounts: { 未掌握: 1, 部分掌握: 0, 已掌握: 0, 熟练: 0 },
    issues: ["遗漏坐标变换关系"],
    suggestions: [],
    latestDate: "2026-08-29",
  });
});

test("analyzeLearningMastery uses masteryStage as the single mastery system", () => {
  const analysis = analyzeLearningMastery([
    { question: "Q1", category: "边缘与特征", mastery: "中", action: "完成答题", date: "2026-08-31" },
  ]);

  assert.equal("averageScore" in analysis, false);
  assert.equal("mastery" in analysis.categories[0], false);
  assert.equal("masteryScore" in analysis.categories[0], false);
  assert.equal(analysis.categories[0].masteryStage, "部分掌握");
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
  assert.equal(plan[0].target, "连续完成 3 道本分类题目，并将掌握阶段提升到部分掌握");
});

test("createImprovementPlan returns an empty plan without learning records", () => {
  assert.deepEqual(createImprovementPlan(analyzeLearningMastery([])), []);
});
