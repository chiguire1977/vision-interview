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

const bank = await vite.ssrLoadModule("/lib/ai-question-bank.ts");

function generated(title, overrides = {}) {
  return {
    title,
    type: "Algorithm",
    category: "Matching",
    source: "professional",
    difficulty: "medium",
    tags: ["NCC", "matching"],
    keywords: ["NCC", "normalization"],
    followUp: "What if illumination is uneven?",
    hint: "Answer with conclusion then principle.",
    techStacks: ["general"],
    bestAnswer: "A complete standard answer.",
    principle: "A complete technical principle.",
    ...overrides,
  };
}

test("normalizes and deduplicates AI generated questions", () => {
  const result = bank.normalizeAiGeneratedQuestions([
    generated("  Why subtract the NCC mean?  "),
    generated("Why subtract the NCC mean?"),
    generated("Why maximize Otsu between-class variance?", { difficulty: "hard" }),
    { title: "missing fields" },
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].title, "Why subtract the NCC mean?");
  assert.equal(result[1].difficulty, "hard");
});
test("fills only the missing slots with local fallback", () => {
  const ai = Array.from({ length: 7 }, (_, i) => generated(`AI-${i + 1}`));
  const fallback = Array.from({ length: 10 }, (_, i) => generated(`LOCAL-${i + 1}`));
  const merged = bank.fillQuestionGroup(ai, fallback, 10);
  assert.equal(merged.questions.length, 10);
  assert.equal(merged.aiCount, 7);
  assert.deepEqual(merged.questions.slice(0, 7).map((q) => q.title), ai.map((q) => q.title));
  assert.deepEqual(merged.questions.slice(7).map((q) => q.title), ["LOCAL-1", "LOCAL-2", "LOCAL-3"]);
});

test("merges GitHub archive entries by stable normalized title", () => {
  const oldEntry = { ...generated("Why subtract the NCC mean?"), id: "old", generatedAt: "2026-01-01T00:00:00.000Z", model: "old-model" };
  const replacement = { ...generated(" Why subtract the NCC mean? "), id: "new", generatedAt: "2026-08-31T00:00:00.000Z", model: "new-model" };
  const added = { ...generated("A new question"), id: "added", generatedAt: "2026-08-31T00:00:00.000Z", model: "new-model" };
  const merged = bank.mergeQuestionBankArchive([oldEntry], [replacement, added]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find((q) => q.title === "Why subtract the NCC mean?")?.model, "new-model");
  assert.ok(merged.some((q) => q.title === "A new question"));
});

test("collects a full AI group before falling back", async () => {
  const calls = [];
  const request = async (count, excludedTitles) => {
    calls.push({ count, excludedTitles });
    if (calls.length === 1) return Array.from({ length: 6 }, (_, i) => generated(`AI-${i + 1}`));
    return Array.from({ length: count }, (_, i) => generated(`AI-${6 + i + 1}`));
  };
  const result = await bank.collectAiQuestionGroup(request, 10, 2);
  assert.equal(result.length, 10);
  assert.deepEqual(calls.map((call) => call.count), [10, 4]);
  assert.equal(calls[1].excludedTitles.length, 6);
});
