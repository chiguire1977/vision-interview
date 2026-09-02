import test from "node:test";
import assert from "node:assert/strict";
import {
  combineAbortSignals,
  createQuestionPreparationAbortManager,
} from "../lib/question-preparation-cancel.mjs";

test("one preparation session shares one abort signal and cancellation aborts the whole session", () => {
  const manager = createQuestionPreparationAbortManager();
  const first = manager.begin();
  const second = manager.begin();

  assert.equal(first, second);
  assert.equal(first.aborted, false);
  assert.equal(manager.abort("用户中断题组准备"), true);
  assert.equal(first.aborted, true);
  assert.equal(manager.abort("重复中断"), false);

  const next = manager.begin();
  assert.notEqual(next, first);
  assert.equal(next.aborted, false);
});

test("combined signal aborts when either existing timeout or preparation session aborts", () => {
  const existing = new AbortController();
  const preparation = new AbortController();
  const combined = combineAbortSignals(existing.signal, preparation.signal);

  assert.equal(combined.aborted, false);
  preparation.abort("cancel preparation");
  assert.equal(combined.aborted, true);
});

test("reset ends the active session without aborting already completed work", () => {
  const manager = createQuestionPreparationAbortManager();
  const signal = manager.begin();

  manager.reset();

  assert.equal(signal.aborted, false);
  assert.equal(manager.isActive(), false);
});
