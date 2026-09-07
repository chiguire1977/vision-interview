import { AI_REQUEST_TIMEOUT_MS } from "@/lib/ai-request-timeout.mjs";

function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host === "::1" || host.endsWith(".local")) return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  const match = host.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function normalizeBaseUrl(raw: string) {
  const url = new URL(raw.trim());
  if (url.protocol !== "https:") throw new Error("API 地址必须使用 HTTPS。 ");
  if (url.username || url.password || isPrivateHostname(url.hostname)) throw new Error("该 API 地址不允许访问。");
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { provider?: string; baseUrl?: string; apiKey?: string };
    const provider = typeof body.provider === "string" ? body.provider.trim() : "";
    if (!provider) {
      return Response.json({ ok: false, message: "请先选择或添加 AI 服务商。" }, { status: 400 });
    }

    const fallbackBaseUrl = provider === "deepseek" ? "https://api.deepseek.com" : provider === "openai" ? "https://api.openai.com/v1" : "";
    const baseUrl = normalizeBaseUrl(body.baseUrl || fallbackBaseUrl);
    const envKey = provider === "deepseek" ? process.env.DEEPSEEK_API_KEY : provider === "openai" ? process.env.OPENAI_API_KEY : undefined;
    const apiKey = body.apiKey?.trim() || envKey;
    if (!apiKey) {
      return Response.json({ ok: false, message: "请先填写 API Key。" }, { status: 400 });
    }

    const endpoint = baseUrl.endsWith("/models") ? baseUrl : `${baseUrl}/models`;
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      // Edge 运行时仅支持 follow/manual；使用 manual 后显式拒绝重定向，
      // 避免在 Cloudflare/Vinext 中因 redirect: "error" 直接抛出异常。
      redirect: "manual",
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    });

    if (response.status >= 300 && response.status < 400) {
      return Response.json({
        ok: false,
        message: "API 地址发生了重定向，请填写中转站要求的最终 HTTPS 地址。",
      }, { status: 502 });
    }

    if (!response.ok) {
      return Response.json({
        ok: false,
        message: response.status === 401 || response.status === 403
          ? "API Key 无效，或中转站拒绝访问。"
          : `获取模型失败（HTTP ${response.status}）。`,
      }, { status: 502 });
    }

    const payload = await response.json() as { data?: unknown } | unknown[];
    const rows = Array.isArray(payload) ? payload : Array.isArray(payload.data) ? payload.data : [];
    const models = rows
      .map((item) => typeof item === "string" ? item : item && typeof item === "object" && "id" in item ? String(item.id) : "")
      .filter(Boolean)
      .slice(0, 200)
      .sort((a, b) => a.localeCompare(b));

    if (!models.length) {
      return Response.json({ ok: false, message: "接口连接成功，但没有返回可用模型。" }, { status: 502 });
    }

    return Response.json({ ok: true, models, message: `连接成功，共获取 ${models.length} 个可用模型。` }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "连接超时，请检查中转站地址。"
      : error instanceof Error ? error.message : "获取模型时发生异常。";
    return Response.json({ ok: false, message }, { status: error instanceof Error && error.name === "TimeoutError" ? 504 : 400 });
  }
}
