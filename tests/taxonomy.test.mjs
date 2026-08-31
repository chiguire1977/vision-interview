import assert from "node:assert/strict";
import test from "node:test";

import {
  KNOWLEDGE_CATEGORIES,
  TECH_STACKS,
  normalizeKnowledgeCategory,
  normalizeTechStack,
} from "../lib/taxonomy.mjs";

test("keeps knowledge categories and technology stacks as separate dimensions", () => {
  assert.deepEqual(KNOWLEDGE_CATEGORIES, [
    "图像处理基础",
    "边缘与特征",
    "模板与定位",
    "标定与坐标",
    "相机镜头光源",
    "C#与软件架构",
    "通讯协议",
  ]);
  assert.deepEqual(TECH_STACKS, ["HALCON", "OpenCV", "VisionPro", "C#", "WPF"]);
  assert.notEqual(KNOWLEDGE_CATEGORIES.includes("HALCON"), true);
  assert.notEqual(TECH_STACKS.includes("通讯协议"), true);
});

test("normalizes legacy category and technology-stack labels", () => {
  assert.equal(normalizeKnowledgeCategory("PLC与现场"), "通讯协议");
  assert.equal(normalizeKnowledgeCategory("通讯协议"), "通讯协议");
  assert.equal(normalizeTechStack("C#视觉开发"), "C#");
  assert.equal(normalizeTechStack("C#"), "C#");
  assert.equal(normalizeTechStack("通用原理"), "通用原理");
});
