import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateAnswerAgainstReference,
  shouldRunAnswerReview,
} from "../lib/answer-review.mjs";

const question = {
  title: "NCC 模板匹配为什么要先对图像和模板去均值？",
  source: "专业",
  keywords: ["减去平均灰度", "归一化", "亮度偏移", "局部阴影"],
};
const bestAnswer = "NCC 先分别减去模板和搜索窗口的平均灰度，再用两侧能量进行归一化，因此对整体亮度偏移更稳健，但局部阴影仍可能导致匹配下降。";

test("built-in review checks coverage of reference answer points instead of answer length", () => {
  const result = evaluateAnswerAgainstReference({
    answer: "NCC 先去均值，再做归一化，所以整体亮度偏移的影响较小。",
    bestAnswer,
    question,
  });

  assert.deepEqual(result.coveredPoints, ["减去平均灰度", "归一化", "亮度偏移"]);
  assert.deepEqual(result.missingPoints, ["局部阴影"]);
  assert.equal(result.conclusion, "存在关键遗漏");
  assert.equal(result.score, undefined);
});

test("built-in review marks an answer complete when every reference point is covered", () => {
  const result = evaluateAnswerAgainstReference({
    answer: "先减去平均灰度，再归一化，因此能减弱整体亮度偏移；但局部阴影仍会影响匹配。",
    bestAnswer,
    question,
  });

  assert.equal(result.conclusion, "回答完整");
  assert.deepEqual(result.missingPoints, []);
});

test("built-in review uses blueprint critical points instead of relying only on keywords", () => {
  const result = evaluateAnswerAgainstReference({
    answer: "需要根据目标尺寸选择窗口，并验证局部光照变化。",
    bestAnswer: "窗口大小应与目标尺寸匹配，并验证局部光照变化造成的误检。",
    question: {
      ...question,
      keywords: ["阈值"],
      blueprint: {
        criticalPoints: ["窗口大小", "目标尺寸", "局部光照变化"],
        supportingPoints: ["误检验证"],
      },
    },
  });

  assert.deepEqual(result.missingPoints, ["误检验证"]);
  assert.deepEqual(result.criticalMissingPoints, []);
});

test("review can be disabled independently from the AI review switch", () => {
  assert.equal(shouldRunAnswerReview({ reviewEnabled: false, aiScoring: true }), false);
  assert.equal(shouldRunAnswerReview({ reviewEnabled: true, aiScoring: false }), true);
  assert.equal(shouldRunAnswerReview({ reviewEnabled: true, aiScoring: true }), true);
});
