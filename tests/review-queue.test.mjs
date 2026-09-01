import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReviewQueue,
  selectReviewQuestions,
  summarizeReviewQueue,
} from "../lib/review-queue.mjs";

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
