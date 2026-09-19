import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLearningFocus,
  buildLearningFocusPrompt,
  prioritizeQuestionCandidates,
  recommendDifficultyAdjustment,
} from "../lib/adaptive-question-focus.mjs";

test("only low, medium, skipped and reviewed records create an active focus", () => {
  assert.equal(buildLearningFocus([]).active, false);
  assert.equal(buildLearningFocus([{ question: "已掌握", mastery: "高", category: "边缘与特征" }]).active, false);

  const focus = buildLearningFocus([
    {
      question: "边缘阈值怎么选？",
      mastery: "低",
      category: "边缘与特征",
      action: "完成答题",
      reviewIssues: ["没有说明噪声抑制和阈值验证"],
      answerKeywords: ["阈值", "噪声"],
    },
    {
      question: "标定误差如何排查？",
      mastery: "中",
      category: "标定与坐标",
      action: "跳过题目",
      reviewSuggestions: ["补充坐标系和误差验证"],
    },
    { question: "只看答案", mastery: "低", category: "相机与光源", action: "查看答案" },
  ]);

  assert.equal(focus.active, true);
  assert.deepEqual(focus.categories.map((item) => item.category), ["边缘与特征", "标定与坐标"]);
  assert.equal(focus.categories[0].lowCount, 1);
  assert.equal(focus.categories[1].skippedCount, 1);
  assert.ok(focus.keywords.includes("阈值"));
  assert.ok(focus.issues.some((item) => item.includes("噪声抑制")));
  assert.match(focus.summary, /边缘与特征/);
});

test("prioritizes weak categories and related variants without mutating candidates", () => {
  const candidates = [
    { title: "OpenCV 相机标定步骤", category: "标定与坐标", keywords: ["坐标系"] },
    { title: "HALCON 边缘阈值与噪声处理", category: "边缘与特征", keywords: ["阈值", "噪声"] },
    { title: "WPF 界面线程模型", category: "C#与软件架构", keywords: ["线程"] },
  ];
  const originalOrder = candidates.map((item) => item.title);
  const focus = buildLearningFocus([{ question: "边缘检测阈值怎么选？", mastery: "低", category: "边缘与特征", answerKeywords: ["阈值"] }]);
  const ordered = prioritizeQuestionCandidates(candidates, focus);

  assert.equal(ordered[0].title, "HALCON 边缘阈值与噪声处理");
  assert.deepEqual(candidates.map((item) => item.title), originalOrder);
});

test("prompt describes the focus as a constraint for targeted generation", () => {
  const focus = buildLearningFocus([{ question: "模板匹配", mastery: "低", category: "模板与定位", reviewSuggestions: ["补充旋转和尺度变化"] }]);
  const prompt = buildLearningFocusPrompt(focus);
  assert.match(prompt, /模板与定位/);
  assert.match(prompt, /低掌握/);
  assert.match(prompt, /变式/);
});

test("skip reasons avoid reinforcing disinterest and suggest easier questions after repeated difficulty skips", () => {
  const focus = buildLearningFocus([
    { question: "不想学", category: "通讯协议", masteryStage: "未掌握", action: "跳过题目", skipReason: "不感兴趣" },
    { question: "稍后", category: "相机镜头光源", masteryStage: "未掌握", action: "跳过题目", skipReason: "稍后再学" },
    { question: "太难 1", category: "标定与坐标", masteryStage: "未掌握", action: "跳过题目", skipReason: "太难", date: "2026-09-19T10:00:00.000Z" },
  ]);
  assert.deepEqual(focus.categories.map((item) => item.category), ["标定与坐标"]);
  assert.equal(recommendDifficultyAdjustment([
    { action: "跳过题目", skipReason: "太难", date: "2026-09-19T10:00:00.000Z" },
    { action: "跳过题目", skipReason: "太难", date: "2026-09-19T09:00:00.000Z" },
    { action: "跳过题目", skipReason: "太难", date: "2026-09-19T08:00:00.000Z" },
  ]), "降低难度");
  assert.equal(recommendDifficultyAdjustment([
    { action: "跳过题目", skipReason: "太难", date: "2026-09-19T10:00:00.000Z" },
    { action: "完成答题", date: "2026-09-19T09:30:00.000Z" },
    { action: "跳过题目", skipReason: "太难", date: "2026-09-19T09:00:00.000Z" },
    { action: "跳过题目", skipReason: "太难", date: "2026-09-19T08:00:00.000Z" },
  ]), null);
});
