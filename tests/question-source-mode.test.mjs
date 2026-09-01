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

const sourceMode = await vite.ssrLoadModule("/lib/question-source-mode.ts");

test("uses network retrieval by default and switches to the question bank only when explicitly disabled", () => {
  assert.equal(sourceMode.resolveQuestionSourceMode(undefined), "network");
  assert.equal(sourceMode.resolveQuestionSourceMode({}), "network");
  assert.equal(sourceMode.resolveQuestionSourceMode({ webQuestions: true }), "network");
  assert.equal(sourceMode.resolveQuestionSourceMode({ webQuestions: false }), "bank");
});

test("updates the retrieval mode without discarding the remaining AI preferences", () => {
  const original = { provider: "deepseek", model: "deepseek-chat", aiScoring: true };

  assert.deepEqual(sourceMode.withQuestionSourceMode(original, "bank"), {
    provider: "deepseek",
    model: "deepseek-chat",
    aiScoring: true,
    webQuestions: false,
  });
  assert.deepEqual(sourceMode.withQuestionSourceMode(original, "network"), {
    provider: "deepseek",
    model: "deepseek-chat",
    aiScoring: true,
    webQuestions: true,
  });
});

test("ignores malformed saved preferences when updating the retrieval mode", () => {
  assert.deepEqual(sourceMode.withQuestionSourceMode(null, "bank"), { webQuestions: false });
  assert.deepEqual(sourceMode.withQuestionSourceMode("broken", "network"), { webQuestions: true });
});
