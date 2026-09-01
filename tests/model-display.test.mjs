import assert from "node:assert/strict";
import test from "node:test";

import { modelDisplayName } from "../lib/model-display.mjs";

test("displays only the model name without protocol or priority context", () => {
  assert.equal(modelDisplayName({ label: "DeepSeek V4 Flash（速度优先）", value: "deepseek-v4-flash" }), "DeepSeek V4 Flash");
  assert.equal(modelDisplayName({ label: "GLM-5.3-Flash · Chat Completions", value: "glm-5.3-flash" }), "GLM-5.3-Flash");
  assert.equal(modelDisplayName({ label: "GPT 5.6 Luna · Responses", value: "gpt-5.6-luna" }), "GPT 5.6 Luna");
  assert.equal(modelDisplayName({ label: "Qwen 3.8 Flash · Anthropic Messages", value: "qwen3.8-flash" }), "Qwen 3.8 Flash");
});

test("keeps custom model labels unchanged and falls back to the model id", () => {
  assert.equal(modelDisplayName({ label: "my-custom-model", value: "custom-id" }), "my-custom-model");
  assert.equal(modelDisplayName({ label: "", value: "custom-id" }), "custom-id");
});
