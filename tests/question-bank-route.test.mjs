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

test("question bank GET loads the GitHub archive without exposing credentials", async () => {
  const previousToken = process.env.VISION_INTERVIEW_GITHUB_TOKEN;
  const previousFetch = globalThis.fetch;
  const archive = {
    version: 1,
    updatedAt: "2026-08-31T02:00:00.000Z",
    questions: [{
      id: "aiq-1",
      title: "远程 AI 题",
      type: "算法原理",
      category: "图像处理基础",
      source: "professional",
      difficulty: "medium",
      tags: ["梯度"],
      keywords: ["边缘"],
      followUp: "追问",
      hint: "提示",
      bestAnswer: "答案",
      principle: "原理",
      generatedAt: "2026-08-31T02:00:00.000Z",
    }, {
      id: "aiq-2",
      title: "第二道远程 AI 题",
      type: "工程实践",
      category: "模板匹配",
      source: "专业",
      difficulty: "困难",
      tags: ["匹配"],
      keywords: ["模板"],
      followUp: "追问",
      hint: "提示",
      bestAnswer: "答案",
      principle: "原理",
      generatedAt: "2026-08-31T02:00:00.000Z",
    }],
  };
  process.env.VISION_INTERVIEW_GITHUB_TOKEN = "server-only-token";
  globalThis.fetch = async (_url, init = {}) => {
    assert.equal(init.headers["User-Agent"], "VisionInterview-question-bank-sync");
    return Response.json({
      encoding: "base64",
      content: Buffer.from(JSON.stringify(archive), "utf8").toString("base64"),
    }, { status: 200 });
  };

  try {
    const route = await vite.ssrLoadModule("/app/api/question-bank/route.ts");
    const response = await route.GET();
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.available, true);
    assert.equal(body.updatedAt, archive.updatedAt);
    assert.equal(body.questionCount, archive.questions.length);
    assert.equal(body.questions.length, archive.questions.length);
    assert.equal(body.questions[0].title, "远程 AI 题");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.VISION_INTERVIEW_GITHUB_TOKEN;
    else process.env.VISION_INTERVIEW_GITHUB_TOKEN = previousToken;
  }
});
