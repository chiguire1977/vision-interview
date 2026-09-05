import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_UPSTREAM_FORMAT_OPTIONS,
  extractAiContent,
  buildAiUpstreamRequest,
  resolveAiUpstreamFormat,
} from "../lib/ai-adapters.mjs";

const common = {
  baseUrl: "https://opencode.ai/zen/go/v1",
  model: "demo-model",
  apiKey: "secret-test-key",
  messages: [
    { role: "system", content: "只返回简短答案。" },
    { role: "user", content: "你好" },
  ],
  maxTokens: 120,
  temperature: 0.2,
};

test("builds a Chat Completions request", () => {
  const request = buildAiUpstreamRequest({ ...common, format: "chat-completions" });
  assert.equal(request.endpoint, "https://opencode.ai/zen/go/v1/chat/completions");
  assert.equal(request.init.headers.Authorization, "Bearer secret-test-key");
  assert.deepEqual(JSON.parse(request.init.body), {
    model: "demo-model",
    messages: common.messages,
    temperature: 0.2,
    max_tokens: 120,
    stream: false,
  });
});

test("builds a Responses request with input messages and output budget", () => {
  const request = buildAiUpstreamRequest({ ...common, format: "responses" });
  assert.equal(request.endpoint, "https://opencode.ai/zen/go/v1/responses");
  assert.equal(request.init.headers.Authorization, "Bearer secret-test-key");
  assert.deepEqual(JSON.parse(request.init.body), {
    model: "demo-model",
    input: [
      { role: "system", content: [{ type: "input_text", text: "只返回简短答案。" }] },
      { role: "user", content: [{ type: "input_text", text: "你好" }] },
    ],
    max_output_tokens: 120,
  });
});

test("builds an Anthropic Messages request with system separated", () => {
  const request = buildAiUpstreamRequest({ ...common, format: "anthropic-messages" });
  assert.equal(request.endpoint, "https://opencode.ai/zen/go/v1/messages");
  assert.equal(request.init.headers["x-api-key"], "secret-test-key");
  assert.equal(request.init.headers["anthropic-version"], "2023-06-01");
  assert.deepEqual(JSON.parse(request.init.body), {
    model: "demo-model",
    system: "只返回简短答案。",
    messages: [{ role: "user", content: "你好" }],
    max_tokens: 120,
    temperature: 0.2,
  });
});

test("extracts content from each upstream response shape", () => {
  assert.equal(extractAiContent("chat-completions", { choices: [{ message: { content: "chat answer" } }] }), "chat answer");
  assert.equal(extractAiContent("responses", { output_text: "responses answer" }), "responses answer");
  assert.equal(extractAiContent("responses", { output: [{ content: [{ type: "output_text", text: "nested answer" }] }] }), "nested answer");
  assert.equal(extractAiContent("anthropic-messages", { content: [{ type: "text", text: "messages answer" }] }), "messages answer");
});

test("infers OpenCode Go model protocols while preserving manual custom provider selection", () => {
  assert.equal(resolveAiUpstreamFormat("https://opencode.ai/zen/go/v1", "gpt-5.6-luna", "chat-completions"), "responses");
  assert.equal(resolveAiUpstreamFormat("https://opencode.ai/zen/go/v1", "qwen3.8-max", "chat-completions"), "anthropic-messages");
  assert.equal(resolveAiUpstreamFormat("https://opencode.ai/zen/go/v1", "deepseek-v4-flash", "responses"), "chat-completions");
  assert.equal(resolveAiUpstreamFormat("https://custom.example/v1", "any-model", "responses"), "responses");
});

test("exposes all supported upstream format choices", () => {
  assert.deepEqual(AI_UPSTREAM_FORMAT_OPTIONS.map((option) => option.value), [
    "chat-completions",
    "responses",
    "anthropic-messages",
  ]);
});
