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

test("AI chat route allows enough output tokens for a complete 10-question group", async () => {
  const route = await vite.ssrLoadModule("/app/api/ai/chat/route.ts");
  const previousKey = process.env.DEEPSEEK_API_KEY;
  const previousFetch = globalThis.fetch;
  let upstreamBody;
  process.env.DEEPSEEK_API_KEY = "test-key";
  globalThis.fetch = async (_url, init = {}) => {
    upstreamBody = JSON.parse(init.body);
    return Response.json({
      choices: [{ message: { content: "{\"questions\":[]}" }, finish_reason: "stop" }],
    });
  };
  try {
    const response = await route.POST(new Request("http://localhost/api/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "deepseek",
        model: "test-model",
        messages: [{ role: "user", content: "generate ten complete questions" }],
        maxTokens: 7000,
      }),
    }));
    assert.equal(response.status, 200);
    assert.equal(upstreamBody.max_tokens, 7000);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousKey;
  }
});

test("AI chat route sends Responses requests and normalizes output_text", async () => {
  const route = await vite.ssrLoadModule("/app/api/ai/chat/route.ts");
  const previousFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init = {}) => {
    captured = { url: String(url), init };
    return Response.json({ output_text: "responses answer" });
  };
  try {
    const response = await route.POST(new Request("http://localhost/api/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "opencode-go",
        baseUrl: "https://opencode.ai/zen/go/v1",
        apiKey: "test-key",
        model: "gpt-5.6-luna",
        upstreamFormat: "responses",
        messages: [{ role: "user", content: "hello" }],
        maxTokens: 120,
      }),
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, content: "responses answer" });
    assert.equal(captured.url, "https://opencode.ai/zen/go/v1/responses");
    assert.equal(captured.init.headers.Authorization, "Bearer test-key");
    assert.equal(JSON.parse(captured.init.body).max_output_tokens, 120);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("AI chat route sends Anthropic Messages requests and normalizes text blocks", async () => {
  const route = await vite.ssrLoadModule("/app/api/ai/chat/route.ts");
  const previousFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init = {}) => {
    captured = { url: String(url), init };
    return Response.json({ content: [{ type: "text", text: "messages answer" }] });
  };
  try {
    const response = await route.POST(new Request("http://localhost/api/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "opencode-go",
        baseUrl: "https://opencode.ai/zen/go/v1",
        apiKey: "test-key",
        model: "qwen3.8-max",
        upstreamFormat: "anthropic-messages",
        messages: [
          { role: "system", content: "system" },
          { role: "user", content: "hello" },
        ],
        maxTokens: 120,
      }),
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, content: "messages answer" });
    assert.equal(captured.url, "https://opencode.ai/zen/go/v1/messages");
    assert.equal(captured.init.headers["x-api-key"], "test-key");
    assert.equal(captured.init.headers["anthropic-version"], "2023-06-01");
    assert.equal(JSON.parse(captured.init.body).system, "system");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("AI chat route reports upstream timeouts as gateway timeouts", async () => {
  const route = await vite.ssrLoadModule("/app/api/ai/chat/route.ts");
  const previousKey = process.env.DEEPSEEK_API_KEY;
  const previousFetch = globalThis.fetch;
  const previousTimeout = AbortSignal.timeout;
  let timeoutMs;
  process.env.DEEPSEEK_API_KEY = "test-key";
  AbortSignal.timeout = (milliseconds) => {
    timeoutMs = milliseconds;
    return new AbortController().signal;
  };
  globalThis.fetch = async () => { throw new DOMException("timed out", "TimeoutError"); };
  try {
    const response = await route.POST(new Request("http://localhost/api/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "deepseek",
        model: "test-model",
        messages: [{ role: "user", content: "hello" }],
      }),
    }));
    assert.equal(response.status, 504);
    assert.equal(timeoutMs, 15000);
    assert.deepEqual(await response.json(), { ok: false, message: "AI 请求超时，请稍后重试。" });
  } finally {
    globalThis.fetch = previousFetch;
    AbortSignal.timeout = previousTimeout;
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousKey;
  }
});
