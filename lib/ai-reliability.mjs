export function classifyAiFailure(status, error) {
  if (error?.name === "TimeoutError") return { errorType: "timeout", retryable: true };
  if (error?.name === "AbortError") return { errorType: "cancelled", retryable: false };
  if (error?.name === "InvalidAiResponseError") return { errorType: "invalid_response", retryable: true };
  if (status === 401 || status === 403) return { errorType: "authentication", retryable: false };
  if (status === 400 || status === 404 || status === 422) return { errorType: "validation", retryable: false };
  if (status === 429) return { errorType: "rate_limit", retryable: true };
  if (status >= 500) return { errorType: "upstream", retryable: true };
  return { errorType: error ? "network" : "unknown", retryable: Boolean(error) };
}

export async function requestWithRetry(request, {
  retries = 2,
  baseDelayMs = 1000,
  jitter = () => Math.floor(Math.random() * 250),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  let lastError;
  let lastResponse;
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      lastResponse = await request(attempt);
      const failure = classifyAiFailure(lastResponse.status);
      if (lastResponse.ok || !failure.retryable || attempt > retries) {
        return { response: lastResponse, attempt, ...failure };
      }
    } catch (error) {
      lastError = error;
      const failure = classifyAiFailure(0, error);
      if (!failure.retryable || attempt > retries) return { error, attempt, ...failure };
    }
    await sleep(baseDelayMs * 2 ** (attempt - 1) + Math.max(0, Number(jitter()) || 0));
  }
  return { response: lastResponse, error: lastError, attempt: retries + 1, ...classifyAiFailure(lastResponse?.status || 0, lastError) };
}

export function createCircuitBreaker({ threshold = 5, cooldownMs = 60_000, now = Date.now } = {}) {
  const providers = new Map();
  const state = (provider) => providers.get(provider) || { failures: 0, openedAt: 0 };
  return {
    state,
    canRequest(provider) {
      const current = state(provider);
      return current.failures < threshold || now() - current.openedAt >= cooldownMs;
    },
    recordFailure(provider) {
      const current = state(provider);
      const failures = current.failures + 1;
      providers.set(provider, { failures, openedAt: failures >= threshold ? now() : current.openedAt });
    },
    recordSuccess(provider) {
      providers.set(provider, { failures: 0, openedAt: 0 });
    },
  };
}
