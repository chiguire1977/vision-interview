import assert from "node:assert/strict";
import test from "node:test";

import { shouldShowTrainingSettings } from "../lib/training-ui.mjs";

test("training settings stay visible while a group is preparing", () => {
  assert.equal(shouldShowTrainingSettings(true, false), true);
});

test("training settings collapse after a prepared group starts", () => {
  assert.equal(shouldShowTrainingSettings(false, false), false);
});

test("learners can reopen collapsed training settings", () => {
  assert.equal(shouldShowTrainingSettings(false, true), true);
});
