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
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const originalFetch = globalThis.fetch;

test("web search route returns trusted result fields from the upstream search page", async () => {
  const route = await vite.ssrLoadModule("/app/api/web-search/route.ts");
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    return new Response(`
      <div class="result">
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fdocs.opencv.org%2F4.x%2Fd7%2Fd4d%2Ftutorial_py_thresholding.html">OpenCV Thresholding</a>
        <a class="result__snippet">Official thresholding tutorial &amp; adaptive methods.</a>
      </div>
    `, { status: 200, headers: { "content-type": "text/html" } });
  };

  const response = await route.POST(new Request("http://localhost/api/web-search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "OpenCV thresholding" }),
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.sources, [{
    title: "OpenCV Thresholding",
    url: "https://docs.opencv.org/4.x/d7/d4d/tutorial_py_thresholding.html",
    snippet: "Official thresholding tutorial & adaptive methods.",
  }]);
  assert.match(requests[0].url, /html\.duckduckgo\.com\/html\/\?q=OpenCV%20thresholding/);
  assert.equal(requests[0].init.headers["User-Agent"], "VisionInterview-web-research");
});

test("web search route reports upstream failures without exposing response bodies", async () => {
  const route = await vite.ssrLoadModule("/app/api/web-search/route.ts");
  globalThis.fetch = async () => new Response("secret upstream detail", { status: 503 });

  const response = await route.POST(new Request("http://localhost/api/web-search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "机器视觉" }),
  }));
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.equal(body.ok, false);
  assert.doesNotMatch(JSON.stringify(body), /secret upstream detail/);
});
