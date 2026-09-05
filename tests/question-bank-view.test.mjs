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

const view = await vite.ssrLoadModule("/lib/question-bank-view.ts");

function item(title, overrides = {}) {
  return {
    title,
    type: "算法原理",
    category: "图像处理基础",
    source: "专业",
    difficulty: "中等",
    tags: ["梯度"],
    keywords: ["边缘"],
    followUp: "追问",
    hint: "提示",
    bestAnswer: "答案",
    principle: "原理",
    origin: "本地题库",
    ...overrides,
  };
}

test("question bank view merges local and AI questions by title and groups them by category", () => {
  const merged = view.mergeQuestionBankItems(
    [item("本地题", { category: "图像处理基础" }), item("重复题", { category: "模板与定位" })],
    [item("AI 题", { category: "边缘与特征", origin: "AI" }), item("重复题", { category: "模板与定位", origin: "AI" })],
  );

  assert.equal(merged.length, 3);
  assert.equal(merged.find((entry) => entry.title === "重复题")?.origin, "AI");
  assert.deepEqual(view.groupQuestionBankItems(merged).map(([category]) => category), ["图像处理基础", "模板与定位", "边缘与特征"].sort((a, b) => a.localeCompare(b, "zh-CN")));
});

test("question bank view filters by search text and source", () => {
  const entries = [
    item("HALCON 梯度题", { origin: "AI" }),
    item("NCC 模板题", { category: "模板与定位", tags: ["NCC"], origin: "本地题库" }),
  ];

  assert.deepEqual(view.filterQuestionBankItems(entries, "halcon", "全部").map((entry) => entry.title), ["HALCON 梯度题"]);
  assert.deepEqual(view.filterQuestionBankItems(entries, "", "AI").map((entry) => entry.title), ["HALCON 梯度题"]);
  assert.deepEqual(view.filterQuestionBankItems(entries, "模板", "专业").map((entry) => entry.title), ["NCC 模板题"]);
});

test("question bank view keeps only valid source URLs and their excerpts", () => {
  const [valid, invalid] = view.mergeQuestionBankItems([
    item("有来源题", { reference: { title: "官方资料", url: "https://docs.example.com/a", snippet: "来源摘要" } }),
    item("无效来源题", { reference: { title: "无效", url: "javascript:alert(1)" } }),
  ], []);
  assert.deepEqual(valid.reference, { title: "官方资料", url: "https://docs.example.com/a", snippet: "来源摘要" });
  assert.equal(invalid.reference, undefined);
});
