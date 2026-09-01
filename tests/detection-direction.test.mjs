import assert from "node:assert/strict";
import test from "node:test";

import {
  detectionDirectionsForTechStack,
  hasDetectionDirections,
  inferDetectionDirection,
  normalizeDetectionDirection,
} from "../lib/detection-direction.mjs";
import { filterAiGeneratedQuestions } from "../lib/ai-question-bank.ts";

test("shows stack-specific detection directions only for vision platforms", () => {
  assert.deepEqual(detectionDirectionsForTechStack("HALCON"), ["随机方向", "传统 2D 视觉", "3D 视觉", "深度学习"]);
  assert.deepEqual(detectionDirectionsForTechStack("OpenCV"), ["随机方向", "传统 2D 算法", "3D 视觉", "DNN/深度学习"]);
  assert.deepEqual(detectionDirectionsForTechStack("VisionPro"), ["随机方向", "传统 2D 工具链", "3D 视觉", "深度学习"]);
  assert.deepEqual(detectionDirectionsForTechStack("C#"), []);
  assert.deepEqual(detectionDirectionsForTechStack("WPF"), []);
  assert.equal(hasDetectionDirections("HALCON"), true);
  assert.equal(hasDetectionDirections("OpenCV"), true);
  assert.equal(hasDetectionDirections("VisionPro"), true);
  assert.equal(hasDetectionDirections("C#"), false);
  assert.equal(hasDetectionDirections("WPF"), false);
});

test("normalizes detection direction aliases without mixing knowledge categories", () => {
  assert.equal(normalizeDetectionDirection("传统2D视觉"), "传统 2D 视觉");
  assert.equal(normalizeDetectionDirection("传统2D算法"), "传统 2D 算法");
  assert.equal(normalizeDetectionDirection("DNN / 深度学习"), "DNN/深度学习");
  assert.equal(normalizeDetectionDirection("定位与检测"), "定位与检测");
});

test("infers a local question direction from its technical clues", () => {
  assert.equal(inferDetectionDirection({ title: "HALCON 点云表面模型匹配", tags: ["3D视觉"] }, "HALCON"), "3D 视觉");
  assert.equal(inferDetectionDirection({ title: "OpenCV DNN 分类模型", tags: ["深度学习"] }, "OpenCV"), "DNN/深度学习");
  assert.equal(inferDetectionDirection({ title: "VisionPro CogCaliper 边缘测量", tags: ["卡尺"] }, "VisionPro"), "传统 2D 工具链");
  assert.equal(inferDetectionDirection({ title: "C# 视觉程序线程设计", tags: ["线程"] }, "C#"), "");
});

test("filters generated questions by detection direction when requested", () => {
  const base = {
    type: "算法原理",
    category: "图像处理基础",
    source: "专业",
    difficulty: "中等",
    tags: ["视觉"],
    keywords: ["算法"],
    followUp: "如何验证？",
    hint: "说明原理。",
    bestAnswer: "标准回答。",
    principle: "技术原理。",
    techStacks: ["HALCON"],
  };
  const result = filterAiGeneratedQuestions([
    { ...base, title: "传统题", detectionDirection: "传统2D视觉" },
    { ...base, title: "三维题", detectionDirection: "3D视觉" },
  ], {
    source: "专业",
    techStack: "HALCON",
    detectionDirection: "3D 视觉",
  });
  assert.deepEqual(result.map((question) => question.title), ["三维题"]);
});
