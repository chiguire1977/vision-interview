import assert from "node:assert/strict";
import test from "node:test";

const productTitle = /<title>VisionInterview 机器视觉面试训练台<\/title>/i;
const productDescription =
  /<meta(?=[^>]*\bname=["']description["'])(?=[^>]*\bcontent=["']通过项目连续追问、题组回答审阅和薄弱点复习，提高机器视觉工程师面试表达能力。["'])[^>]*>/i;
const temporaryPreviewMeta = /<meta(?=[^>]*\bname=["']codex-preview["'])[^>]*>/i;

test("renders product metadata without the temporary starter marker", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, productTitle);
  assert.match(html, productDescription);
  assert.doesNotMatch(html, temporaryPreviewMeta);
});
