import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});
after(async () => { await vite.close(); });

const bank = await vite.ssrLoadModule("/lib/ai-question-bank.ts");

function generated(title, overrides = {}) {
  return {
    title,
    type: "Algorithm",
    category: "Matching",
    source: "professional",
    difficulty: "medium",
    tags: ["NCC", "matching"],
    keywords: ["NCC", "normalization"],
    followUp: "What if illumination is uneven?",
    hint: "Answer with conclusion then principle.",
    techStacks: ["general"],
    bestAnswer: "A complete standard answer.",
    principle: "A complete technical principle.",
    ...overrides,
  };
}

test("normalizes the legacy professional training mode label", () => {
  assert.equal(bank.normalizeTrainingMode("专业专项"), "专业知识");
  assert.equal(bank.normalizeTrainingMode("专业知识"), "专业知识");
  assert.equal(bank.normalizeTrainingMode("项目答辩"), "项目答辩");
  assert.equal(bank.questionSourceForTrainingMode("专业专项"), "专业");
  assert.equal(bank.questionSourceForTrainingMode("项目答辩"), "项目");
  assert.equal(bank.questionSourceForTrainingMode("综合模拟"), "专业或项目");
});

test("filters AI questions by source and selected category, difficulty, stack, and project context", () => {
  const result = bank.filterAiGeneratedQuestions([
    generated("专业 HALCON 题", { source: "专业", category: "图像处理基础", difficulty: "中等", techStacks: ["HALCON"] }),
    generated("项目题", { source: "项目", category: "图像处理基础", difficulty: "中等", techStacks: ["HALCON"] }),
    generated("其他分类题", { source: "专业", category: "边缘与特征", difficulty: "中等", techStacks: ["HALCON"] }),
    generated("其他难度题", { source: "专业", category: "图像处理基础", difficulty: "困难", techStacks: ["HALCON"] }),
    generated("其他技术栈题", { source: "专业", category: "图像处理基础", difficulty: "中等", techStacks: ["OpenCV"] }),
    generated("轮胎字符深度 OCR 项目题", { source: "专业", category: "图像处理基础", difficulty: "中等", techStacks: ["HALCON"] }),
  ], {
    source: "专业",
    category: "图像处理基础",
    difficulty: "中等",
    techStack: "HALCON",
    forbiddenPhrases: ["轮胎字符深度 OCR"],
  });

  assert.deepEqual(result.map((question) => question.title), ["专业 HALCON 题"]);
});

test("rejects 3D content when traditional 2D direction is selected", () => {
  const result = bank.filterAiGeneratedQuestions([
    generated("HALCON 二维边缘提取", {
      source: "专业",
      category: "边缘与特征",
      techStacks: ["HALCON"],
      detectionDirection: "传统 2D 视觉",
    }),
    generated("HALCON 点云平面拟合", {
      source: "专业",
      category: "边缘与特征",
      techStacks: ["HALCON"],
      detectionDirection: "传统 2D 视觉",
      tags: ["3D视觉", "点云", "RANSAC"],
      keywords: ["法线估计", "平面拟合"],
      principle: "使用深度图和点云进行三维表面测量。",
    }),
  ], {
    source: "专业",
    category: "边缘与特征",
    difficulty: "中等",
    techStack: "HALCON",
    detectionDirection: "传统 2D 视觉",
  });

  assert.deepEqual(result.map((question) => question.title), ["HALCON 二维边缘提取"]);
});

test("keeps 3D content when 3D direction is selected", () => {
  const result = bank.filterAiGeneratedQuestions([
    generated("HALCON 点云平面拟合", {
      source: "专业",
      category: "边缘与特征",
      techStacks: ["HALCON"],
      detectionDirection: "3D 视觉",
      tags: ["3D视觉", "点云", "RANSAC"],
      keywords: ["法线估计", "平面拟合"],
      principle: "使用深度图和点云进行三维表面测量。",
    }),
  ], {
    source: "专业",
    category: "边缘与特征",
    difficulty: "中等",
    techStack: "HALCON",
    detectionDirection: "3D 视觉",
  });

  assert.equal(result.length, 1);
});

test("allows both sources for comprehensive simulation while retaining selected filters", () => {
  const result = bank.filterAiGeneratedQuestions([
    generated("专业题", { source: "专业", category: "图像处理基础", difficulty: "基础", techStacks: ["HALCON"] }),
    generated("项目题", { source: "项目", category: "图像处理基础", difficulty: "基础", techStacks: ["HALCON"] }),
    generated("错误分类", { source: "专业", category: "边缘与特征", difficulty: "基础", techStacks: ["HALCON"] }),
  ], {
    source: "专业或项目",
    category: "图像处理基础",
    difficulty: "基础",
    techStack: "HALCON",
  });

  assert.deepEqual(result.map((question) => question.title), ["专业题", "项目题"]);
});

test("normalizes and deduplicates AI generated questions", () => {
  const result = bank.normalizeAiGeneratedQuestions([
    generated("  Why subtract the NCC mean?  "),
    generated("Why subtract the NCC mean?"),
    generated("Why maximize Otsu between-class variance?", { difficulty: "hard" }),
    { title: "missing fields" },
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].title, "Why subtract the NCC mean?");
  assert.equal(result[1].difficulty, "hard");
});

test("normalizes legacy taxonomy labels without breaking technology-stack filtering", () => {
  const [question] = bank.normalizeAiGeneratedQuestions([generated("Legacy communication question", {
    category: "PLC与现场",
    techStacks: ["C#视觉开发"],
  })]);

  assert.equal(question.category, "通讯协议");
  assert.deepEqual(question.techStacks, ["C#"]);
  assert.equal(bank.filterAiGeneratedQuestions([{
    ...question,
    techStacks: ["C#视觉开发"],
  }], {
    source: "专业",
    category: "通讯协议",
    techStack: "C#",
  }).length, 1);
});

test("preserves knowledge-driven source metadata in normalized questions and markdown", () => {
  const question = bank.normalizeAiGeneratedQuestions([generated("What does Otsu optimize?", {
    sourceType: "官方文档整理",
    knowledgePoints: ["类间方差", "前景背景分离"],
    reference: { title: "OpenCV Thresholding", url: "https://docs.opencv.org/" },
  })])[0];

  assert.deepEqual(question.knowledgePoints, ["类间方差", "前景背景分离"]);
  assert.equal(question.sourceType, "官方文档整理");
  const markdown = bank.createQuestionBankMarkdown([question], "2026-08-31T00:00:00.000Z");
  assert.match(markdown, /- \*\*题源类型\*\*：官方文档整理/);
  assert.match(markdown, /- \*\*知识点\*\*：类间方差、前景背景分离/);
});

test("fills only the missing slots with local fallback", () => {
  const ai = Array.from({ length: 7 }, (_, i) => generated(`AI-${i + 1}`));
  const fallback = Array.from({ length: 10 }, (_, i) => generated(`LOCAL-${i + 1}`));
  const merged = bank.fillQuestionGroup(ai, fallback, 10);
  assert.equal(merged.questions.length, 10);
  assert.equal(merged.aiCount, 7);
  assert.deepEqual(merged.questions.slice(0, 7).map((q) => q.title), ai.map((q) => q.title));
  assert.deepEqual(merged.questions.slice(7).map((q) => q.title), ["LOCAL-1", "LOCAL-2", "LOCAL-3"]);
});

test("merges GitHub archive entries by stable normalized title", () => {
  const oldEntry = { ...generated("Why subtract the NCC mean?"), id: "old", generatedAt: "2026-01-01T00:00:00.000Z", model: "old-model" };
  const replacement = { ...generated(" Why subtract the NCC mean? "), id: "new", generatedAt: "2026-08-31T00:00:00.000Z", model: "new-model" };
  const added = { ...generated("A new question"), id: "added", generatedAt: "2026-08-31T00:00:00.000Z", model: "new-model" };
  const merged = bank.mergeQuestionBankArchive([oldEntry], [replacement, added]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find((q) => q.title === "Why subtract the NCC mean?")?.model, "new-model");
  assert.ok(merged.some((q) => q.title === "A new question"));
});

test("renders sanitized AI question archive entries as readable markdown", () => {
  const markdown = bank.createQuestionBankMarkdown([
    {
      ...generated("Why subtract the NCC mean?"),
      id: "aiq-1",
      generatedAt: "2026-08-31T01:00:00.000Z",
      provider: "deepseek",
      model: "test-model",
      apiKey: "must-not-be-rendered",
    },
  ], "2026-08-31T01:05:00.000Z");

  assert.match(markdown, /^# AI 生成题库/m);
  assert.match(markdown, /^## Matching/m);
  assert.match(markdown, /### 1\. Why subtract the NCC mean\?/);
  assert.match(markdown, /- \*\*分类\*\*：Matching/);
  assert.match(markdown, /### 最佳答案\n\nA complete standard answer\./);
  assert.match(markdown, /### 原理\n\nA complete technical principle\./);
  assert.doesNotMatch(markdown, /apiKey|must-not-be-rendered/);
});

test("collects a full AI group before falling back", async () => {
  const calls = [];
  const request = async (count, excludedTitles) => {
    calls.push({ count, excludedTitles });
    if (calls.length === 1) return Array.from({ length: 6 }, (_, i) => generated(`AI-${i + 1}`));
    return Array.from({ length: count }, (_, i) => generated(`AI-${6 + i + 1}`));
  };
  const result = await bank.collectAiQuestionGroup(request, 10, 2);
  assert.equal(result.length, 10);
  assert.deepEqual(calls.map((call) => call.count), [10, 4]);
  assert.equal(calls[1].excludedTitles.length, 6);
});

test("runs multiple AI workers in parallel and merges their unique questions", async () => {
  let active = 0;
  let peak = 0;
  const calls = [];
  const request = async (count, _excludedTitles, attempt, workerIndex) => {
    calls.push({ count, attempt, workerIndex });
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active -= 1;
    return Array.from({ length: count }, (_, index) => generated(`parallel-${workerIndex}-${index + 1}`));
  };

  const result = await bank.collectAiQuestionGroup(request, 6, 1, undefined, { parallelRequests: 3 });

  assert.equal(result.length, 6);
  assert.equal(peak, 3);
  assert.deepEqual(calls.map((call) => call.count), [2, 2, 2]);
  assert.deepEqual(calls.map((call) => call.workerIndex), [1, 2, 3]);
});

test("prepares one shared context per retry round for parallel workers", async () => {
  let prepareCalls = 0;
  const contexts = [];
  const request = async (count, _excludedTitles, _attempt, workerIndex, context) => {
    contexts.push(context);
    return Array.from({ length: count }, (_, index) => generated(`shared-context-${workerIndex}-${index + 1}`));
  };

  const result = await bank.collectAiQuestionGroup(request, 6, 1, undefined, {
    parallelRequests: 3,
    prepareAttempt: async (attempt, excludedTitles) => {
      prepareCalls += 1;
      return { attempt, excludedTitles, sources: ["shared-source"] };
    },
  });

  assert.equal(result.length, 6);
  assert.equal(prepareCalls, 1);
  assert.equal(contexts.length, 3);
  assert.ok(contexts.every((context) => context?.sources?.[0] === "shared-source"));
  assert.ok(contexts.every((context) => context === contexts[0]));
});

test("continues parallel rounds when one worker fails", async () => {
  const calls = [];
  const request = async (count, _excludedTitles, attempt, workerIndex) => {
    calls.push({ count, attempt, workerIndex });
    if (attempt === 1 && workerIndex === 1) throw new Error("worker unavailable");
    return Array.from({ length: count }, (_, index) => generated(`recovered-${attempt}-${workerIndex}-${index + 1}`));
  };

  const result = await bank.collectAiQuestionGroup(request, 4, 2, undefined, { parallelRequests: 2 });

  assert.equal(result.length, 4);
  assert.equal(calls.length, 4);
  assert.deepEqual(calls.map((call) => [call.attempt, call.workerIndex]), [[1, 1], [1, 2], [2, 1], [2, 2]]);
});

test("keeps requesting missing questions beyond the first two network attempts", async () => {
  const calls = [];
  const request = async (count, excludedTitles, attempt) => {
    calls.push({ count, excludedTitles, attempt });
    if (attempt < 3) return [];
    return Array.from({ length: count }, (_, i) => generated(`AI-after-retry-${i + 1}`));
  };
  const result = await bank.collectAiQuestionGroup(request, 10);
  assert.equal(result.length, 10);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((call) => call.attempt), [1, 2, 3]);
});

test("reports each AI attempt so the UI can show progress and safe failures", async () => {
  const progress = [];
  const request = async (count, _excludedTitles, attempt) => {
    if (attempt === 1) throw new Error("AI gateway rejected the request");
    return Array.from({ length: count }, (_, i) => generated(`AI-progress-${i + 1}`));
  };

  const result = await bank.collectAiQuestionGroup(request, 10, 2, (event) => progress.push(event));

  assert.equal(result.length, 10);
  assert.deepEqual(progress.map((event) => event.phase), ["requesting", "failed", "requesting", "received"]);
  assert.equal(progress[0].attempt, 1);
  assert.equal(progress[1].error, "AI gateway rejected the request");
  assert.equal(progress[3].collectedCount, 10);
});

test("continues to the AI generator when optional web research fails", async () => {
  let aiCalls = 0;
  const result = await bank.runWithOptionalWebResearch(
    true,
    async () => { throw new Error("网络检索超时，请稍后重试。"); },
    async (research) => {
      aiCalls += 1;
      return research;
    },
  );

  assert.equal(aiCalls, 1);
  assert.equal(result.value, undefined);
  assert.equal(result.error, "网络检索超时，请稍后重试。");
});

test("formats an attempt-specific preparation message", () => {
  assert.equal(bank.formatAiQuestionGroupProgress({
    phase: "search-completed",
    attempt: 2,
    maxAttempts: 6,
    targetCount: 10,
    collectedCount: 0,
    searchSourceCount: 5,
  }), "第 2/6 轮：联网搜索完成（5 条），正在请求 AI…");
  assert.equal(bank.formatAiQuestionGroupProgress({
    phase: "search-failed",
    attempt: 2,
    maxAttempts: 6,
    targetCount: 10,
    collectedCount: 0,
    error: "网络检索超时，请稍后重试。",
  }), "第 2/6 轮：联网检索不可用（网络检索超时，请稍后重试。），继续请求 AI…");
});

test("starts question-bank synchronization without waiting for it", async () => {
  let finish;
  const sync = new Promise((resolve) => { finish = resolve; });
  const events = [];

  const returned = bank.deferAsyncTask(
    () => sync,
    () => events.push("succeeded"),
    (error) => events.push(`failed:${error.message}`),
  );
  assert.equal(returned, undefined);
  assert.deepEqual(events, []);

  finish("saved");
  await sync;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(events, ["succeeded"]);
});
