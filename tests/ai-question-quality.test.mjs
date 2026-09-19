import assert from "node:assert/strict";
import test from "node:test";
import {
  filterHighQualityWebResearchSources,
  countCompleteStreamedQuestions,
  createKnowledgeCoverageState,
  selectKnowledgeDiverseQuestions,
  buildKnowledgeCoverageMatrix,
  isQuestionGenerationPayload,
  filterGeneratedQuestionContent,
  parseJsonRobust,
  validateQuestionTerminology,
  buildInterviewQuestionJsonSchema,
} from "../lib/ai-question-quality.mjs";

test("prioritizes authoritative sources and filters bad URLs / duplicate domains", () => {
  const result = filterHighQualityWebResearchSources([
    { title: "OpenCV threshold docs", url: "https://docs.opencv.org/4.x/d7/d4d/tutorial_py_thresholding.html?utm_source=test", snippet: "official" },
    { title: "OpenCV duplicate", url: "https://docs.opencv.org/4.x/d7/d4d/tutorial_py_thresholding.html?utm_medium=chat", snippet: "duplicate" },
    { title: "OpenCV SIFT docs", url: "https://docs.opencv.org/4.x/da/df5/tutorial_py_sift_intro.html", snippet: "official" },
    { title: "OpenCV third page", url: "https://docs.opencv.org/4.x/d1/de0/tutorial_py_feature_homography.html", snippet: "official" },
    { title: "Paper", url: "https://arxiv.org/abs/1506.02640", snippet: "paper" },
    { title: "GitHub docs", url: "https://docs.github.com/en/rest", snippet: "github" },
    { title: "Aggregator", url: "https://wenku.baidu.com/view/123", snippet: "bad" },
    { title: "Local", url: "http://localhost/private", snippet: "bad" },
    { title: "FTP", url: "ftp://example.com/a", snippet: "bad" },
  ], { maxSources: 8, maxPerDomain: 2 });

  assert.equal(result[0].url, "https://docs.opencv.org/4.x/d7/d4d/tutorial_py_thresholding.html");
  assert.equal(result.filter((item) => new URL(item.url).hostname === "docs.opencv.org").length, 2);
  assert.ok(result.some((item) => item.url === "https://arxiv.org/abs/1506.02640"));
  assert.ok(result.some((item) => item.url === "https://docs.github.com/en/rest"));
  assert.ok(result.every((item) => !item.url.includes("utm_")));
  assert.ok(result.every((item) => !item.url.includes("wenku.baidu.com") && !item.url.includes("localhost")));
});

test("counts only complete question objects in partial streamed JSON", () => {
  const partial = '{"questions":[{"title":"A","hint":"brace } inside"},{"title":"B","reference":{"url":"https://x"}},{"title":"C"';
  assert.equal(countCompleteStreamedQuestions(partial), 2);
  assert.equal(countCompleteStreamedQuestions('{"questions":['), 0);
});

test("filters semantically repetitive questions with a shared coverage state", () => {
  const state = createKnowledgeCoverageState();
  const batch = [
    { title: "NCC 1", type: "算法原理", category: "模板与定位", knowledgePoints: ["NCC", "归一化"], tags: [], keywords: [] },
    { title: "NCC 2", type: "算法原理", category: "模板与定位", knowledgePoints: ["NCC", "归一化"], tags: [], keywords: [] },
    { title: "现场光照漂移", type: "现场故障", category: "模板与定位", knowledgePoints: ["光照漂移", "曝光"], tags: [], keywords: [] },
    { title: "阈值参数影响", type: "参数影响", category: "图像处理基础", knowledgePoints: ["阈值", "噪声"], tags: [], keywords: [] },
  ];
  const selected = selectKnowledgeDiverseQuestions(batch, state, 10);
  assert.deepEqual(selected.map((q) => q.title), ["NCC 1", "现场光照漂移", "阈值参数影响"]);
  const matrix = buildKnowledgeCoverageMatrix(selected);
  assert.equal(matrix.length, 3);
  assert.ok(new Set(matrix.flatMap((row) => row.coverageKeys)).size >= 6);

  const secondBatch = selectKnowledgeDiverseQuestions([
    { title: "NCC 3", type: "算法原理", category: "模板与定位", knowledgePoints: ["NCC", "归一化"], tags: [], keywords: [] },
    { title: "标定验证", type: "工程实践", category: "标定与坐标", knowledgePoints: ["重投影误差", "验证点"], tags: [], keywords: [] },
  ], state, 10);
  assert.deepEqual(secondBatch.map((q) => q.title), ["标定验证"]);
});

test("detects only AI question-generation payloads", () => {
  assert.equal(isQuestionGenerationPayload({ messages: [{ role: "user", content: '{"outputSchema":{"questions":[]},"requirements":[]}' }] }), true);
  assert.equal(isQuestionGenerationPayload({ messages: [{ role: "user", content: "score this answer" }] }), false);
});

test("filters a completed AI JSON payload through the shared coverage matrix", () => {
  const state = createKnowledgeCoverageState();
  const input = JSON.stringify({ questions: [
    { title: "A", type: "算法原理", category: "图像处理基础", knowledgePoints: ["梯度", "边缘"], tags: [], keywords: [] },
    { title: "A2", type: "算法原理", category: "图像处理基础", knowledgePoints: ["梯度", "边缘"], tags: [], keywords: [] },
    { title: "B", type: "工程实践", category: "图像处理基础", knowledgePoints: ["噪声", "滤波"], tags: [], keywords: [] },
  ] });
  const filtered = filterGeneratedQuestionContent(input, state);
  assert.equal(filtered.acceptedCount, 2);
  assert.deepEqual(JSON.parse(filtered.content).questions.map((q) => q.title), ["A", "B"]);
  assert.equal(filtered.matrix.length, 2);
});

test("repairs common JSON mode fallbacks and recovers complete questions from truncation", () => {
  const repaired = parseJsonRobust('说明文字 {"questions":[{"title":"中文“引号”题","tags":["阈值"],},]}');
  assert.equal(repaired.questions.length, 1);
  assert.equal(repaired.questions[0].title, "中文\"引号\"题");

  const partial = parseJsonRobust('{"questions":[{"title":"第一题","bestAnswer":"完整"},{"title":"第二题"');
  assert.equal(partial.partial, true);
  assert.deepEqual(partial.questions.map((question) => question.title), ["第一题"]);
});

test("flags suspicious cross-stack or unknown HALCON terminology for human review", () => {
  assert.deepEqual(validateQuestionTerminology({
    techStacks: ["HALCON"],
    title: "如何调整 find_shape_model 参数",
    bestAnswer: "不要在 HALCON 题目中调用 cv2.threshold，再检查 mystery_operator 的参数。",
    principle: "",
  }), ["可疑 HALCON 算子：mystery_operator", "HALCON 题目中出现 OpenCV API"]);
  assert.deepEqual(validateQuestionTerminology({ techStacks: ["OpenCV"], title: "cv2.threshold", bestAnswer: "" }), []);
});

test("locks generated question categories in the strict provider schema", () => {
  const schema = buildInterviewQuestionJsonSchema(["图像处理基础", "通讯协议"]);
  const question = schema.properties.questions.items;
  assert.deepEqual(question.properties.category.enum, ["图像处理基础", "通讯协议"]);
  assert.equal(question.properties.source.enum.includes("项目"), true);
  assert.equal(question.properties.reference.type.includes("null"), true);
});
