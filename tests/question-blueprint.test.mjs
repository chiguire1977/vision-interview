import assert from "node:assert/strict";
import test from "node:test";

import {
  buildQuestionBlueprint,
  normalizeQuestionBlueprint,
} from "../lib/question-blueprint.mjs";

test("builds a question blueprint with critical and supporting points", () => {
  const blueprint = buildQuestionBlueprint({
    title: "光照不均时如何选择动态阈值参数？",
    type: "参数选择",
    category: "图像处理基础",
    techStacks: ["HALCON"],
    knowledgePoints: ["局部阈值", "窗口大小", "光照不均", "误检验证"],
    tags: ["阈值分割"],
  });

  assert.equal(blueprint.knowledgeKey, "图像处理基础|HALCON|局部阈值,窗口大小,光照不均,误检验证");
  assert.deepEqual(blueprint.criticalPoints, ["局部阈值", "窗口大小", "光照不均"]);
  assert.deepEqual(blueprint.supportingPoints, ["误检验证"]);
  assert.ok(blueprint.ability.includes("参数判断"));
});

test("normalizes incomplete AI blueprint data with safe defaults", () => {
  assert.deepEqual(normalizeQuestionBlueprint({ criticalPoints: ["去均值"] }), {
    version: 1,
    knowledgeKey: "",
    corePoints: ["去均值"],
    criticalPoints: ["去均值"],
    supportingPoints: [],
    ability: [],
    scenario: "",
    commonMistakes: [],
  });
});
