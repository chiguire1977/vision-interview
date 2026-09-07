/**
 * Returns whether the question-group preparation effect should start a new run.
 * A prepared group must remain stable while answer/skip records are persisted.
 */
export function shouldRestartQuestionGroupPreparation({
  trainingStarted,
  reviewSessionActive,
  hasPreparedQuestions,
}) {
  if (!trainingStarted || reviewSessionActive) return false;
  return !hasPreparedQuestions;
}

export function getAnswerCompletionAction({ questionIndex, totalQuestions }) {
  return questionIndex >= totalQuestions - 1 ? "review-group" : "next-question";
}

export function getPreviousQuestionIndex({ questionIndex }) {
  if (questionIndex <= 0) return null;
  return questionIndex - 1;
}

export function isQuestionGroupPreparationCancelled(error) {
  return error?.name === "AbortError";
}
