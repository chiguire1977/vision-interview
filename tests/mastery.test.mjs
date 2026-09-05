import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveMasteryStage,
  masteryStageFromReview,
  normalizeMasteryStage,
} from "../lib/mastery.mjs";

test("maps review coverage to a four-level mastery stage", () => {
  assert.equal(masteryStageFromReview({ status: "skipped" }), "未掌握");
  assert.equal(masteryStageFromReview({ status: "answered", missingPoints: ["窗口大小"] }), "部分掌握");
  assert.equal(masteryStageFromReview({ status: "answered", missingPoints: [] }), "已掌握");
  assert.equal(normalizeMasteryStage("高"), "已掌握");
  assert.equal(normalizeMasteryStage("熟练"), "熟练");
});

test("requires different question types before promoting mastery", () => {
  const first = {
    knowledgeKey: "图像处理基础|HALCON|动态阈值",
    questionType: "算法原理",
    stage: "已掌握",
  };
  assert.equal(deriveMasteryStage([], first), "部分掌握");
  assert.equal(deriveMasteryStage([first], {
    knowledgeKey: first.knowledgeKey,
    questionType: "参数选择",
    stage: "已掌握",
  }), "已掌握");
  assert.equal(deriveMasteryStage([first, {
    knowledgeKey: first.knowledgeKey,
    questionType: "参数选择",
    stage: "已掌握",
  }], {
    knowledgeKey: first.knowledgeKey,
    questionType: "现场故障",
    stage: "已掌握",
  }), "熟练");
});
