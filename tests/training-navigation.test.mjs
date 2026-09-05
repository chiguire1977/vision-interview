import test from "node:test";
import assert from "node:assert/strict";
import {
  getAnswerCompletionAction,
  shouldRestartQuestionGroupPreparation,
} from "../lib/training-navigation.mjs";

test("does not restart a prepared group when an answer record changes", () => {
  assert.equal(shouldRestartQuestionGroupPreparation({
    trainingStarted: true,
    reviewSessionActive: false,
    hasPreparedQuestions: true,
  }), false);
});

test("starts preparation for a new training group", () => {
  assert.equal(shouldRestartQuestionGroupPreparation({
    trainingStarted: true,
    reviewSessionActive: false,
    hasPreparedQuestions: false,
  }), true);
});

test("completing a non-final answer advances to the next question", () => {
  assert.equal(getAnswerCompletionAction({ questionIndex: 2, totalQuestions: 10 }), "next-question");
});

test("completing the final answer opens the group review state", () => {
  assert.equal(getAnswerCompletionAction({ questionIndex: 9, totalQuestions: 10 }), "review-group");
});
