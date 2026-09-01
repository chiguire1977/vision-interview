import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import {
  clearGitHubTokenCookie,
  GITHUB_TOKEN_COOKIE_NAME,
  readGitHubTokenFromRequest,
} from "../lib/github-credentials.mjs";
import { DELETE, POST } from "../app/api/github/credentials/route.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("reads the HttpOnly GitHub token cookie without exposing it to client code", () => {
  const request = new Request("https://vision-interview.example", {
    headers: { Cookie: `${GITHUB_TOKEN_COOKIE_NAME}=github%2Dpat%5Fsecret; other=value` },
  });

  assert.equal(readGitHubTokenFromRequest(request), "github-pat_secret");
  assert.match(clearGitHubTokenCookie(), new RegExp(`${GITHUB_TOKEN_COOKIE_NAME}=;`));
  assert.match(clearGitHubTokenCookie(), /HttpOnly/);
});

test("validates GitHub repository access before issuing a token cookie", async () => {
  const token = "github-pat-secret";
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    if (String(url).includes("/git/ref/heads/main")) return Response.json({ ref: "refs/heads/main" });
    return Response.json({ permissions: { pull: true, push: true } });
  };

  const response = await POST(new Request("https://vision-interview.example/api/github/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, repository: "acme/vision-bank", branch: "main" }),
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true, configured: true, repository: "acme/vision-bank", branch: "main" });
  assert.match(response.headers.get("set-cookie") || "", new RegExp(`${GITHUB_TOKEN_COOKIE_NAME}=`));
  assert.match(response.headers.get("set-cookie") || "", /HttpOnly/);
  assert.match(response.headers.get("set-cookie") || "", /Secure/);
  assert.match(response.headers.get("set-cookie") || "", /SameSite=Strict/);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].init.headers.Authorization, `Bearer ${token}`);
});

test("does not issue a cookie when the GitHub token cannot push", async () => {
  globalThis.fetch = async () => Response.json({ permissions: { pull: true, push: false } });

  const response = await POST(new Request("https://vision-interview.example/api/github/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "github-pat-secret", repository: "acme/vision-bank", branch: "main" }),
  }));
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.ok, false);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("clears the browser token cookie without affecting the server credential", async () => {
  const response = await DELETE();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true, configured: false });
  assert.match(response.headers.get("set-cookie") || "", new RegExp(`${GITHUB_TOKEN_COOKIE_NAME}=;`));
  assert.match(response.headers.get("set-cookie") || "", /Max-Age=0/);
});
