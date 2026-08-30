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
