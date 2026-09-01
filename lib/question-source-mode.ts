export type QuestionSourceMode = "network" | "bank";

function asPreferenceRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function resolveQuestionSourceMode(preferences: unknown): QuestionSourceMode {
  return asPreferenceRecord(preferences).webQuestions === false ? "bank" : "network";
}

export function withQuestionSourceMode(preferences: unknown, mode: QuestionSourceMode): Record<string, unknown> {
  return {
    ...asPreferenceRecord(preferences),
    webQuestions: mode === "network",
  };
}
