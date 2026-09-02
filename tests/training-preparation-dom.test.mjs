import test from "node:test";
import assert from "node:assert/strict";
import {
  findTrainingPreparationContainer,
  shouldMountTrainingPreparationCancel,
} from "../lib/training-preparation-dom.mjs";

test("detects the real training preparation panel even before network progress starts", () => {
  const container = { id: "panel" };
  const heading = {
    textContent: "正在准备本题组",
    closest(selector) {
      assert.equal(selector, "section");
      return container;
    },
  };
  const root = {
    querySelectorAll(selector) {
      assert.equal(selector, "h1");
      return [heading];
    },
  };

  assert.equal(findTrainingPreparationContainer(root), container);
  assert.equal(shouldMountTrainingPreparationCancel({
    headingText: heading.textContent,
    hasExistingButton: false,
  }), true);
});

test("does not add a duplicate cancel button", () => {
  assert.equal(shouldMountTrainingPreparationCancel({
    headingText: "正在准备本题组",
    hasExistingButton: true,
  }), false);
});
