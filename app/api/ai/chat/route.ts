import {
  buildAiUpstreamRequest,
  extractAiContent,
  extractAiError,
  resolveAiUpstreamFormat,
} from "@/lib/ai-adapters.mjs";
import { AI_REQUEST_TIMEOUT_MS } from "@/lib/ai-request-timeout.mjs";
import { classifyAiFailure, createCircuitBreaker, requestWithRetry } from "@/lib/ai-reliability.mjs";

const providerCircuit = createCircuitBreaker();

function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host === "::1" || host.endsWith(".local")) return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  const match = host.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function normalizeBaseUrl(raw: string) {
  const url = new URL(raw.trim());
  if (url.protocol !== "https:") throw new Error("AI 请求地址必须使用 HTTPS。");
  if (url.username || url.password || isPrivateHostname(url.hostname)) throw new Error("该 AI 请求地址不允许访问。");
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type ChatBody = {
  sessionId?: string;
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  messages?: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  upstreamFormat?: string;
};

export async function POST(request: Request) {
  const startedAt = Date.now();
  let provider = "";
  let model = "";
  let attempt = 1;
  let circuitKey = "";
  try {
    const body = await request.json() as ChatBody;
    provider = typeof body.provider === "string" ? body.provider.trim() : "";
    model = typeof body.model === "string" ? body.model.trim() : "";
    const messages = Array.isArray(body.messages) ? body.messages.filter((item) => item && typeof item.content === "string") : [];
    circuitKey = `${provider}:${typeof body.sessionId === "string" && body.sessionId.trim() ? body.sessionId.trim() : crypto.randomUUID()}`;
    if (!provider || !model || !messages.length) return Response.json({ ok: false, message: "缺少 AI 服务商、模型或消息内容。", status: 400, errorType: "validation", retryable: false, provider, model, attempt, elapsedMs: Date.now() - startedAt, upstreamMessage: "" }, { status: 400 });
    const fallbackBaseUrl = provider === "deepseek" ? "https://api.deepseek.com" : provider === "openai" ? "https://api.openai.com/v1" : "";
    const baseUrl = normalizeBaseUrl(body.baseUrl || fallbackBaseUrl);
    const envKey = provider === "deepseek" ? process.env.DEEPSEEK_API_KEY : provider === "openai" ? process.env.OPENAI_API_KEY : undefined;
    const apiKey = body.apiKey?.trim() || envKey;
    if (!apiKey) return Response.json({ ok: false, message: "请先配置当前 AI 服务商的 API Key。", status: 400, errorType: "authentication", retryable: false, provider, model, attempt, elapsedMs: Date.now() - startedAt, upstreamMessage: "" }, { status: 400 });

    const format = resolveAiUpstreamFormat(baseUrl, model, body.upstreamFormat);
    const upstreamRequest = buildAiUpstreamRequest({
      format,
      baseUrl,
      model,
      apiKey,
      messages,
      maxTokens: body.maxTokens,
      temperature: body.temperature,
      provider,
    });
    if (!providerCircuit.canRequest(circuitKey)) {
      return Response.json({ ok: false, message: "AI 服务暂时不可用，已自动切换为本地题库。", status: 503, errorType: "circuit_open", retryable: false, provider, model, attempt: 0, elapsedMs: Date.now() - startedAt, upstreamMessage: "" }, { status: 503 });
    }
    const requestInit: RequestInit = {
      ...upstreamRequest.init,
    } as RequestInit;
    const result = await requestWithRetry(async () => {
      const response = await fetch(upstreamRequest.endpoint, { ...requestInit, signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS) });
      if (response.ok) {
        let preview: Record<string, unknown> = {};
        try {
          preview = await response.clone().json() as Record<string, unknown>;
        } catch {
          const invalid = new Error("AI 返回了无法解析的响应。");
          invalid.name = "InvalidAiResponseError";
          throw invalid;
        }
        if (!extractAiContent(format, preview)) {
          const invalid = new Error("AI 没有返回有效内容。");
          invalid.name = "InvalidAiResponseError";
          throw invalid;
        }
      }
      return response;
    });
    attempt = result.attempt;
    if ("error" in result && result.error) throw result.error;
    const response = "response" in result ? result.response : undefined;
    if (!response) throw new Error("AI 请求未返回响应。");
    if (response.status >= 300 && response.status < 400) return Response.json({ ok: false, message: "AI 地址发生重定向，请填写最终 HTTPS 地址。", status: response.status, errorType: "redirect", retryable: false, provider, model, attempt, elapsedMs: Date.now() - startedAt, upstreamMessage: response.headers.get("location") || "" }, { status: 502 });
    let payload: Record<string, unknown> = {};
    try {
      const parsed = await response.json() as unknown;
      if (parsed && typeof parsed === "object") payload = parsed as Record<string, unknown>;
    } catch {
      if (!response.ok) return Response.json({ ok: false, message: `AI 请求失败（HTTP ${response.status}）。`, status: response.status, errorType: result.errorType, retryable: result.retryable, provider, model, attempt, elapsedMs: Date.now() - startedAt, upstreamMessage: "" }, { status: 502 });
    }
    if (!response.ok) {
      if (result.retryable) providerCircuit.recordFailure(circuitKey);
      const upstreamMessage = extractAiError(payload, `AI 请求失败（HTTP ${response.status}）。`);
      return Response.json({ ok: false, message: "AI 服务暂时不可用，已自动切换为本地题库。", status: response.status, errorType: result.errorType, retryable: result.retryable, provider, model, attempt, elapsedMs: Date.now() - startedAt, upstreamMessage }, { status: 502 });
    }
    const content = extractAiContent(format, payload);
    if (!content) {
      const choices = Array.isArray(payload.choices) ? payload.choices : [];
      const firstChoice = choices[0] && typeof choices[0] === "object" ? choices[0] as Record<string, unknown> : null;
      const hint = firstChoice?.finish_reason === "length"
        ? "AI 输出被长度限制截断（思考模式可能占满 token）。"
        : "AI 没有返回有效内容。";
      return Response.json({ ok: false, message: hint, status: 502, errorType: "invalid_response", retryable: true, provider, model, attempt, elapsedMs: Date.now() - startedAt, upstreamMessage: hint, format }, { status: 502 });
    }
    providerCircuit.recordSuccess(circuitKey);
    return Response.json({ ok: true, content }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = classifyAiFailure(0, error);
    const isTimeout = failure.errorType === "timeout";
    const message = isTimeout ? "AI 请求超时，请稍后重试。" : error instanceof Error ? error.message : "AI 请求发生异常。";
    const status = isTimeout ? 504 : failure.errorType === "cancelled" ? 499 : 400;
    if (circuitKey && failure.retryable) providerCircuit.recordFailure(circuitKey);
    return Response.json({ ok: false, message, status, errorType: failure.errorType, retryable: failure.retryable, provider, model, attempt, elapsedMs: Date.now() - startedAt, upstreamMessage: error instanceof Error ? error.message : "" }, { status });
  }
}
