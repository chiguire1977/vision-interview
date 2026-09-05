export const DEFAULT_AI_UPSTREAM_FORMAT = "chat-completions";

export const AI_UPSTREAM_FORMAT_OPTIONS = Object.freeze([
  Object.freeze({
    value: "chat-completions",
    label: "Chat Completions（兼容 OpenAI）",
    description: "请求 /chat/completions，使用 Bearer Token 认证。",
  }),
  Object.freeze({
    value: "responses",
    label: "Responses（OpenAI 原生）",
    description: "请求 /responses，使用 input 和 max_output_tokens。",
  }),
  Object.freeze({
    value: "anthropic-messages",
    label: "Anthropic Messages",
    description: "请求 /messages，使用 x-api-key 和 Anthropic 消息格式。",
  }),
]);

const FORMAT_VALUES = new Set(AI_UPSTREAM_FORMAT_OPTIONS.map((option) => option.value));
const RESPONSES_MODELS = new Set(["grok-4.6", "gpt-5.6-luna", "muse-spark-1.2-contributor"]);
const ANTHROPIC_MODELS = new Set([
  "minimax-m3", "minimax-m2.7", "minimax-m2.5",
  "qwen3.8-max", "qwen3.8-flash", "qwen3.7-max", "qwen3.7-plus", "qwen3.6-plus",
]);

export function normalizeAiUpstreamFormat(value) {
  return FORMAT_VALUES.has(value) ? value : DEFAULT_AI_UPSTREAM_FORMAT;
}

function normalizeModelId(model) {
  return String(model || "").trim().replace(/^opencode-go\//i, "").toLowerCase();
}

function isOpenCodeGoBaseUrl(baseUrl) {
  try {
    const url = new URL(String(baseUrl || "").trim());
    return url.hostname.toLowerCase() === "opencode.ai" && url.pathname.replace(/\/+$/, "").toLowerCase().endsWith("/zen/go/v1");
  } catch {
    return false;
  }
}

export function resolveAiUpstreamFormat(baseUrl, model, requestedFormat) {
  const normalizedRequested = normalizeAiUpstreamFormat(requestedFormat);
  if (!isOpenCodeGoBaseUrl(baseUrl)) return normalizedRequested;
  const modelId = normalizeModelId(model);
  if (RESPONSES_MODELS.has(modelId)) return "responses";
  if (ANTHROPIC_MODELS.has(modelId)) return "anthropic-messages";
  return "chat-completions";
}

function normalizeBaseUrl(baseUrl) {
  const normalized = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!normalized) throw new Error("缺少 AI 请求地址。");
  return normalized;
}

function endpointForFormat(baseUrl, format) {
  const endpoint = normalizeBaseUrl(baseUrl);
  const suffix = format === "responses"
    ? "/responses"
    : format === "anthropic-messages"
      ? "/messages"
      : "/chat/completions";
  return endpoint.toLowerCase().endsWith(suffix) ? endpoint : `${endpoint}${suffix}`;
}

function clampTemperature(value) {
  return typeof value === "number" ? Math.max(0, Math.min(value, 1)) : 0.2;
}

function outputLimit(value) {
  return typeof value === "number" && value > 0 ? Math.min(Math.floor(value), 8000) : 1000;
}

function responsesInput(messages) {
  return messages.map((message) => ({
    role: message.role,
    content: [{
      type: message.role === "assistant" ? "output_text" : "input_text",
      text: message.content,
    }],
  }));
}

function anthropicMessages(messages) {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map(({ role, content }) => ({ role, content }));
}

export function buildAiUpstreamRequest({ format, baseUrl, model, apiKey, messages, maxTokens, temperature, provider }) {
  const normalizedFormat = normalizeAiUpstreamFormat(format);
  const safeMessages = Array.isArray(messages)
    ? messages.filter((message) => message && typeof message.content === "string" && ["system", "user", "assistant"].includes(message.role))
    : [];
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  let body;

  if (normalizedFormat === "responses") {
    headers.Authorization = `Bearer ${apiKey}`;
    body = {
      model,
      input: responsesInput(safeMessages),
      max_output_tokens: outputLimit(maxTokens),
    };
  } else if (normalizedFormat === "anthropic-messages") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    const system = safeMessages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
    body = {
      model,
      ...(system ? { system } : {}),
      messages: anthropicMessages(safeMessages),
      max_tokens: outputLimit(maxTokens),
      temperature: clampTemperature(temperature),
    };
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
    body = {
      model,
      messages: safeMessages,
      temperature: clampTemperature(temperature),
      max_tokens: outputLimit(maxTokens),
      stream: false,
      ...(provider === "deepseek" ? { thinking: { type: "disabled" } } : {}),
    };
  }

  return {
    endpoint: endpointForFormat(baseUrl, normalizedFormat),
    format: normalizedFormat,
    init: {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      redirect: "manual",
    },
  };
}

function firstText(value) {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) {
    const parts = value.map(firstText).filter(Boolean);
    return parts.length ? parts.join("\n") : null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value;
  if (typeof record.text === "string" && record.text.trim()) return record.text;
  if (typeof record.content === "string" && record.content.trim()) return record.content;
  if (record.content) return firstText(record.content);
  if (record.type === "output_text" || record.type === "text" || record.type === "input_text") {
    return firstText(record.text);
  }
  return null;
}

export function extractAiContent(format, payload) {
  if (!payload || typeof payload !== "object") return null;
  if (format === "responses") {
    return firstText(payload.output_text) || firstText(payload.output) || firstText(payload.response?.output_text) || null;
  }
  if (format === "anthropic-messages") {
    return firstText(payload.content) || null;
  }
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  return firstText(choice?.message?.content) || firstText(choice?.message?.reasoning_content) || null;
}

export function extractAiError(payload, fallback) {
  if (payload && typeof payload === "object") {
    const error = payload.error;
    if (typeof error === "string" && error.trim()) return error;
    if (error && typeof error === "object" && typeof error.message === "string" && error.message.trim()) return error.message;
    if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
  }
  return fallback;
}
