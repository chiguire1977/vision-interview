import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_UPSTREAM_FORMAT_OPTIONS,
  DEFAULT_AI_UPSTREAM_FORMAT,
  normalizeAiUpstreamFormat,
} from "../lib/ai-settings.mjs";

test("defaults AI upstream format to Chat Completions and exposes all adapters", () => {
  assert.equal(DEFAULT_AI_UPSTREAM_FORMAT, "chat-completions");
  assert.deepEqual(AI_UPSTREAM_FORMAT_OPTIONS.map((option) => option.value), ["chat-completions", "responses", "anthropic-messages"]);
});

test("normalizes missing or unsupported upstream format values for old settings", () => {
  assert.equal(normalizeAiUpstreamFormat(undefined), DEFAULT_AI_UPSTREAM_FORMAT);
  assert.equal(normalizeAiUpstreamFormat("responses"), "responses");
  assert.equal(normalizeAiUpstreamFormat("anthropic-messages"), "anthropic-messages");
  assert.equal(normalizeAiUpstreamFormat("unsupported"), DEFAULT_AI_UPSTREAM_FORMAT);
  assert.equal(normalizeAiUpstreamFormat("chat-completions"), DEFAULT_AI_UPSTREAM_FORMAT);
});
