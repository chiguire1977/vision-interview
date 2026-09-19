import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { GITHUB_TOKEN_COOKIE_NAME } from "../lib/github-credentials.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});
after(async () => { await vite.close(); });

function entry(title, techStacks = ["general"]) {
  return {
    id: `id-${title}`,
    title,
    type: "Algorithm",
    category: "Matching",
    source: "professional",
    difficulty: "medium",
    tags: ["NCC"],
    keywords: ["NCC"],
    followUp: "Follow up",
    hint: "Hint",
    techStacks,
    bestAnswer: "Answer",
    principle: "Principle",
    generatedAt: "2026-08-31T00:00:00.000Z",
    provider: "deepseek",
    model: "test-model",
  };
}

test("question bank sync degrades safely when GitHub token is absent", async () => {
  const previous = process.env.VISION_INTERVIEW_GITHUB_TOKEN;
  delete process.env.VISION_INTERVIEW_GITHUB_TOKEN;
  try {
    const route = await vite.ssrLoadModule("/app/api/question-bank/sync/route.ts");
    const response = await route.POST(new Request("http://localhost/api/question-bank/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entries: [entry("Q1")] }),
    }));
    const body = await response.json();
    assert.equal(response.status, 202);
    assert.equal(body.archived, false);
    assert.equal(body.reason, "github_not_configured");
  } finally {
    if (previous === undefined) delete process.env.VISION_INTERVIEW_GITHUB_TOKEN;
    else process.env.VISION_INTERVIEW_GITHUB_TOKEN = previous;
  }
});
test("question bank sync creates the GitHub archive through the contents API", async () => {
  const route = await vite.ssrLoadModule("/app/api/question-bank/sync/route.ts");
  const previousToken = process.env.VISION_INTERVIEW_GITHUB_TOKEN;
  const previousFetch = globalThis.fetch;
  const calls = [];
  process.env.VISION_INTERVIEW_GITHUB_TOKEN = "test-token";
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (!init.method || init.method === "GET") return new Response("not found", { status: 404 });
    return Response.json({ commit: { sha: "abc123" } }, { status: 200 });
  };

  try {
    const response = await route.POST(new Request("http://localhost/api/question-bank/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entries: [entry("Q1"), entry("Q2")], complete: true }),
    }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.archived, true);
    assert.equal(body.total, 2);
    assert.equal(body.complete, true);
    assert.equal(body.markdownPath, "data/ai-question-bank.md");
    const puts = calls.filter((call) => call.init.method === "PUT");
    assert.equal(puts.length, 2);
    assert.ok(puts.some((call) => call.url.includes("halcon.json") || call.url.includes("general.json")));
    assert.ok(puts.some((call) => call.url.includes("halcon.md") || call.url.includes("general.md")));
    const jsonPut = puts.find((call) => call.url.includes("general.json")) ?? puts.find((call) => call.url.includes("halcon.json"));
    const putBody = JSON.parse(jsonPut.init.body);
    const archiveJson = Buffer.from(putBody.content, "base64").toString("utf8");
    const archive = JSON.parse(archiveJson);
    assert.equal(archive.questions.length, 2);
    assert.equal(archive.questions[0].title, "Q1");
    const markdownPut = puts.find((call) => call.url.includes("general.md")) ?? puts.find((call) => call.url.includes("halcon.md"));
    const markdownBody = JSON.parse(markdownPut.init.body);
    const markdown = Buffer.from(markdownBody.content, "base64").toString("utf8");
    assert.match(markdown, /^# AI 生成题库/m);
    assert.match(markdown, /^## 模板与定位/m);
    assert.match(markdown, /### 1\. Q1/);
    assert.match(markdown, /### 2\. Q2/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.VISION_INTERVIEW_GITHUB_TOKEN;
    else process.env.VISION_INTERVIEW_GITHUB_TOKEN = previousToken;
  }
});

test("question bank GET uses the HttpOnly token cookie when no server token is configured", async () => {
  const route = await vite.ssrLoadModule("/app/api/question-bank/route.ts");
  const previousToken = process.env.VISION_INTERVIEW_GITHUB_TOKEN;
  const previousFetch = globalThis.fetch;
  let authorization = "";
  delete process.env.VISION_INTERVIEW_GITHUB_TOKEN;
  globalThis.fetch = async (_url, init = {}) => {
    authorization = new Headers(init.headers).get("Authorization") || "";
    return Response.json({ sha: "bank-sha", content: Buffer.from(JSON.stringify({ questions: [] }), "utf8").toString("base64") }, { status: 200 });
  };

  try {
    const response = await route.GET(new Request("http://localhost/api/question-bank", {
      headers: { Cookie: `${GITHUB_TOKEN_COOKIE_NAME}=cookie-token` },
    }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.available, true);
    assert.equal(authorization, "Bearer cookie-token");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.VISION_INTERVIEW_GITHUB_TOKEN;
    else process.env.VISION_INTERVIEW_GITHUB_TOKEN = previousToken;
  }
});

test("question bank sync writes questions into separate technology stack archives", async () => {
  const route = await vite.ssrLoadModule("/app/api/question-bank/sync/route.ts");
  const previousToken = process.env.VISION_INTERVIEW_GITHUB_TOKEN;
  const previousFetch = globalThis.fetch;
  const calls = [];
  process.env.VISION_INTERVIEW_GITHUB_TOKEN = "test-token";
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (!init.method || init.method === "GET") return new Response("not found", { status: 404 });
    return Response.json({ commit: { sha: "stack-commit" } }, { status: 200 });
  };

  try {
    const response = await route.POST(new Request("http://localhost/api/question-bank/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entries: [entry("HALCON-Q", ["HALCON"]), entry("OpenCV-Q", ["OpenCV"])], complete: true }),
    }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.archived, true);
    const putUrls = calls.filter((call) => call.init.method === "PUT").map((call) => call.url);
    assert.ok(putUrls.some((url) => url.includes("halcon.json")));
    assert.ok(putUrls.some((url) => url.includes("halcon.md")));
    assert.ok(putUrls.some((url) => url.includes("opencv.json")));
    assert.ok(putUrls.some((url) => url.includes("opencv.md")));
  } finally {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.VISION_INTERVIEW_GITHUB_TOKEN;
    else process.env.VISION_INTERVIEW_GITHUB_TOKEN = previousToken;
  }
});
