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

export async function POST(request: Request) {
  try {
    const body = await request.json() as { provider?: string; baseUrl?: string; apiKey?: string; model?: string; messages?: ChatMessage[]; maxTokens?: number; temperature?: number };
    const provider = typeof body.provider === "string" ? body.provider.trim() : "";
    const model = typeof body.model === "string" ? body.model.trim() : "";
    const messages = Array.isArray(body.messages) ? body.messages.filter((item) => item && typeof item.content === "string") : [];
    if (!provider || !model || !messages.length) return Response.json({ ok: false, message: "缺少 AI 服务商、模型或消息内容。" }, { status: 400 });
    const fallbackBaseUrl = provider === "deepseek" ? "https://api.deepseek.com" : provider === "openai" ? "https://api.openai.com/v1" : "";
    const baseUrl = normalizeBaseUrl(body.baseUrl || fallbackBaseUrl);
    const envKey = provider === "deepseek" ? process.env.DEEPSEEK_API_KEY : provider === "openai" ? process.env.OPENAI_API_KEY : undefined;
    const apiKey = body.apiKey?.trim() || envKey;
    if (!apiKey) return Response.json({ ok: false, message: "请先配置当前 AI 服务商的 API Key。" }, { status: 400 });

    const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        model,
        messages,
        temperature: typeof body.temperature === "number" ? Math.max(0, Math.min(body.temperature, 1)) : 0.2,
        ...(typeof body.maxTokens === "number" && body.maxTokens > 0 ? { max_tokens: Math.min(Math.floor(body.maxTokens), 4000) } : {}),
        stream: false,
        // DeepSeek V4（v4-flash / v4-pro）默认开启思考模式，token 预算会被
        // reasoning_content 吃光，导致 content 返回空字符串，前端表现为
        // 「AI 没有返回有效内容」。本站只需要最终 JSON，故显式关闭思考模式。
        ...(provider === "deepseek" ? { thinking: { type: "disabled" } } : {}),
      }),
      redirect: "manual",
      // 90s 过长：前端会一直卡在「正在准备本题组」。
      // 缩短到 25s，超时后前端立即降级到本地题库。
      signal: AbortSignal.timeout(25000),
    });
    if (response.status >= 300 && response.status < 400) return Response.json({ ok: false, message: "AI 地址发生重定向，请填写最终 HTTPS 地址。" }, { status: 502 });
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: unknown; reasoning_content?: unknown }; finish_reason?: string }>;
      error?: { message?: string };
      usage?: Record<string, unknown>;
    };
    if (!response.ok) return Response.json({ ok: false, message: payload.error?.message || `AI 请求失败（HTTP ${response.status}）。` }, { status: 502 });
    const choice = payload.choices?.[0];
    let content = choice?.message?.content;
    // 兜底：若服务商忽略 thinking:disabled 仍走思考模式，content 可能为空，
    // 此时退而使用 reasoning_content，避免整轮请求白费。
    if (typeof content !== "string" || !content.trim()) {
      const reasoning = choice?.message?.reasoning_content;
      if (typeof reasoning === "string" && reasoning.trim()) content = reasoning;
    }
    if (typeof content !== "string" || !content.trim()) {
      // 附带 finish_reason 与 usage，便于定位是超长截断还是模型未产出
      const hint = choice?.finish_reason === "length"
        ? "AI 输出被长度限制截断（思考模式可能占满 token）。"
        : "AI 没有返回有效内容。";
      return Response.json({ ok: false, message: hint, finishReason: choice?.finish_reason ?? null, usage: payload.usage ?? null }, { status: 502 });
    }
    return Response.json({ ok: true, content }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError" ? "AI 请求超时，请稍后重试。" : error instanceof Error ? error.message : "AI 请求发生异常。";
    return Response.json({ ok: false, message }, { status: 400 });
  }
}
