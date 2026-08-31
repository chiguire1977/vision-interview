import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PARALLEL_REQUESTS,
  DEFAULT_QUESTION_GROUP_SIZE,
  MAX_PARALLEL_REQUESTS,
  MAX_QUESTION_GROUP_SIZE,
  normalizeParallelRequests,
  normalizeQuestionGroupSettings,
  normalizeQuestionGroupSize,
} from "../lib/question-group-settings.mjs";

test("normalizes question group settings with safe defaults and bounds", () => {
  assert.equal(DEFAULT_QUESTION_GROUP_SIZE, 10);
  assert.equal(DEFAULT_PARALLEL_REQUESTS, 3);
  assert.equal(normalizeQuestionGroupSize(undefined), 10);
  assert.equal(normalizeQuestionGroupSize(0), 1);
  assert.equal(normalizeQuestionGroupSize(99), MAX_QUESTION_GROUP_SIZE);
  assert.equal(normalizeQuestionGroupSize("12.4"), 12);
  assert.equal(normalizeParallelRequests(undefined), 3);
  assert.equal(normalizeParallelRequests(0), 1);
  assert.equal(normalizeParallelRequests(99), MAX_PARALLEL_REQUESTS);
  assert.deepEqual(normalizeQuestionGroupSettings({ questionGroupSize: 15, parallelRequests: 4 }), {
    questionGroupSize: 15,
    parallelRequests: 4,
  });
});
