import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyAiFailure,
  createCircuitBreaker,
  requestWithRetry,
} from "../lib/ai-reliability.mjs";

test("treats user cancellation as non-retryable but retries invalid upstream payloads", () => {
  assert.deepEqual(classifyAiFailure(0, new DOMException("cancelled", "AbortError")), { errorType: "cancelled", retryable: false });
  const invalid = new Error("invalid");
  invalid.name = "InvalidAiResponseError";
  assert.deepEqual(classifyAiFailure(0, invalid), { errorType: "invalid_response", retryable: true });
});

test("retries transient upstream failures with exponential backoff", async () => {
  let attempts = 0;
  const waits = [];
  const result = await requestWithRetry(async () => {
    attempts += 1;
    if (attempts < 3) return new Response("busy", { status: 503 });
    return Response.json({ ok: true });
  }, { retries: 2, sleep: async (ms) => waits.push(ms) });
  assert.equal(result.response.status, 200);
  assert.equal(result.attempt, 3);
  assert.deepEqual(waits, [250, 500]);
});

test("does not retry authentication or validation failures", async () => {
  let attempts = 0;
  const result = await requestWithRetry(async () => {
    attempts += 1;
    return new Response("denied", { status: 401 });
  }, { retries: 3, sleep: async () => {} });
  assert.equal(attempts, 1);
  assert.equal(result.errorType, "authentication");
});

test("opens a provider circuit after consecutive failures and recovers after cooldown", () => {
  let now = 1_000;
  const breaker = createCircuitBreaker({ threshold: 2, cooldownMs: 5_000, now: () => now });
  assert.equal(breaker.canRequest("deepseek"), true);
  breaker.recordFailure("deepseek");
  breaker.recordFailure("deepseek");
  assert.equal(breaker.canRequest("deepseek"), false);
  now += 5_001;
  assert.equal(breaker.canRequest("deepseek"), true);
  breaker.recordSuccess("deepseek");
  assert.equal(breaker.state("deepseek").failures, 0);
});
