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

test("AI models route uses the 15 second request timeout", async () => {
  const route = await vite.ssrLoadModule("/app/api/ai/models/route.ts");
  const previousKey = process.env.DEEPSEEK_API_KEY;
  const previousFetch = globalThis.fetch;
  const previousTimeout = AbortSignal.timeout;
  let timeoutMs;
  process.env.DEEPSEEK_API_KEY = "test-key";
  AbortSignal.timeout = (milliseconds) => {
    timeoutMs = milliseconds;
    return new AbortController().signal;
  };
  globalThis.fetch = async () => Response.json({ data: [{ id: "test-model" }] });
  try {
    const response = await route.POST(new Request("http://localhost/api/ai/models", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "deepseek" }),
    }));
    assert.equal(response.status, 200);
    assert.equal(timeoutMs, 15000);
  } finally {
    globalThis.fetch = previousFetch;
    AbortSignal.timeout = previousTimeout;
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousKey;
  }
});
