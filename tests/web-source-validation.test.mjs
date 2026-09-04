import assert from "node:assert/strict";
import test, { after, afterEach } from "node:test";
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
afterEach(() => { globalThis.fetch = originalFetch; });
const originalFetch = globalThis.fetch;

test("validates a whitelist URL and returns the page's actual title", async () => {
  const route = await vite.ssrLoadModule("/app/api/web-source/validate/route.ts");
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response("<html><head><title>OpenCV Documentation</title></head><body>docs</body></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  };

  const response = await route.POST(new Request("http://localhost/api/web-source/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: "https://docs.opencv.org/" }),
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    ok: true,
    url: "https://docs.opencv.org/",
    displayName: "OpenCV Documentation",
  });
  assert.equal(requestedUrl, "https://docs.opencv.org/");
});

test("rejects an unreachable whitelist URL without returning a name", async () => {
  const route = await vite.ssrLoadModule("/app/api/web-source/validate/route.ts");
  globalThis.fetch = async () => new Response("not found", { status: 404 });

  const response = await route.POST(new Request("http://localhost/api/web-source/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: "https://docs.opencv.org/" }),
  }));
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.equal(body.ok, false);
  assert.match(body.message, /HTTP 404/);
});
