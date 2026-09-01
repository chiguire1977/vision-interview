import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { GET, POST } from "../app/api/backup/route.ts";

const originalFetch = globalThis.fetch;
const originalToken = process.env.GITHUB_BACKUP_TOKEN;
const originalVisionToken = process.env.VISION_INTERVIEW_GITHUB_TOKEN;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.GITHUB_BACKUP_TOKEN;
  else process.env.GITHUB_BACKUP_TOKEN = originalToken;
  if (originalVisionToken === undefined) delete process.env.VISION_INTERVIEW_GITHUB_TOKEN;
  else process.env.VISION_INTERVIEW_GITHUB_TOKEN = originalVisionToken;
});

test("GET loads the approved startup configuration from GitHub", async () => {
  const archive = {
    version: 2,
    updatedAt: "2026-08-31T02:00:00.000Z",
    data: {
      "vision-interview-project-view": "list",
      "vision-interview-ai-preferences": { provider: "deepseek", token: "discard" },
    },
  };
  globalThis.fetch = async () => new Response(JSON.stringify({
    sha: "data-sha",
    encoding: "base64",
    content: Buffer.from(JSON.stringify(archive), "utf8").toString("base64"),
  }), { status: 200 });

  const response = await GET();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.available, true);
  assert.equal(body.updatedAt, "2026-08-31T02:00:00.000Z");
  assert.deepEqual(body.data, {
    "vision-interview-project-view": "list",
    "vision-interview-ai-preferences": { provider: "deepseek" },
  });
});

test("GET uses the configured repository and branch from the connection settings", async () => {
  process.env.VISION_INTERVIEW_GITHUB_TOKEN = "server-secret";
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ sha: "data-sha", encoding: "base64", content: Buffer.from(JSON.stringify({ version: 2, data: {} }), "utf8").toString("base64") }), { status: 200 });
  };

  const response = await GET(new Request("http://localhost/api/backup?repository=acme%2Fvision-bank&branch=release"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.repository, "acme/vision-bank");
  assert.equal(body.branch, "release");
  assert.match(requestedUrl, /repos\/acme\/vision-bank\/contents\/data\/vision-interview-data\.json\?ref=release/);
});

test("POST refuses GitHub writes when the server credential is not configured", async () => {
  delete process.env.GITHUB_BACKUP_TOKEN;
  delete process.env.VISION_INTERVIEW_GITHUB_TOKEN;
  let requested = false;
  globalThis.fetch = async () => {
    requested = true;
    return new Response(null, { status: 500 });
  };

  const response = await POST(new Request("http://localhost/api/backup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { "vision-interview-project-view": "grid" } }),
  }));
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.ok, false);
  assert.equal(body.available, false);
  assert.equal(requested, false);
});

test("POST writes a sanitized runtime snapshot to GitHub", async () => {
  delete process.env.GITHUB_BACKUP_TOKEN;
  process.env.VISION_INTERVIEW_GITHUB_TOKEN = "server-secret";
  const requests = [];
  const responses = [
    new Response(JSON.stringify({ sha: "data-sha" }), { status: 200 }),
    new Response(JSON.stringify({ commit: { sha: "commit-sha" } }), { status: 200 }),
  ];
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    return responses.shift();
  };

  const response = await POST(new Request("http://localhost/api/backup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: {
        "vision-interview-project-view": "grid",
        "vision-interview-runtime-logs": [{
          id: "log-1",
          timestamp: "2026-08-31T02:01:00.000Z",
          level: "INFO",
          event: "app.start",
          message: "配置加载完成",
          context: { token: "discard", source: "github" },
        }],
      },
    }),
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.commitSha, "commit-sha");
  const uploaded = JSON.parse(requests[1].init.body);
  const archive = JSON.parse(Buffer.from(uploaded.content, "base64").toString("utf8"));
  assert.deepEqual(archive.data["vision-interview-runtime-logs"][0].context, { source: "github" });
});
