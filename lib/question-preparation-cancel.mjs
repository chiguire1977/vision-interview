export function combineAbortSignals(...signals) {
  const activeSignals = signals.filter(Boolean);
  if (activeSignals.length === 0) return undefined;
  if (activeSignals.length === 1) return activeSignals[0];

  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
    return AbortSignal.any(activeSignals);
  }

  const controller = new AbortController();
  const abortFrom = (signal) => {
    if (!controller.signal.aborted) controller.abort(signal.reason);
  };

  for (const signal of activeSignals) {
    if (signal.aborted) {
      abortFrom(signal);
      break;
    }
    signal.addEventListener("abort", () => abortFrom(signal), { once: true });
  }

  return controller.signal;
}

export function createQuestionPreparationAbortManager() {
  let controller = null;

  return {
    begin() {
      if (!controller || controller.signal.aborted) controller = new AbortController();
      return controller.signal;
    },
    abort(reason = "用户中断题组准备") {
      if (!controller || controller.signal.aborted) return false;
      controller.abort(reason);
      return true;
    },
    reset() {
      controller = null;
    },
    isActive() {
      return Boolean(controller && !controller.signal.aborted);
    },
  };
}
