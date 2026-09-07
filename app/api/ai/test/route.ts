import { AI_REQUEST_TIMEOUT_MS } from "@/lib/ai-request-timeout.mjs";

type ProviderName = "deepseek" | "openai";

const providers: Record<ProviderName, { keyName: string; baseUrl: string }> = {
  deepseek: { keyName: "DEEPSEEK_API_KEY", baseUrl: "https://api.deepseek.com" },
  openai: { keyName: "OPENAI_API_KEY", baseUrl: "https://api.openai.com/v1" },
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as { provider?: string; model?: string };
    if (body.provider !== "deepseek" && body.provider !== "openai") {
      return Response.json({ ok: false, message: "不支持的 AI 服务商。" }, { status: 400 });
    }

    const provider = providers[body.provider];
    const apiKey = process.env[provider.keyName];
    if (!apiKey) {
      return Response.json({
        ok: false,
        code: "MISSING_API_KEY",
        message: `服务器尚未配置 ${provider.keyName}。`,
      }, { status: 400 });
    }

    const response = await fetch(`${provider.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text();
      return Response.json({
        ok: false,
        message: response.status === 401 ? "API Key 无效或已失效。" : `服务连接失败（${response.status}）。`,
        detail: detail.slice(0, 180),
      }, { status: 502 });
    }

    return Response.json({
      ok: true,
      message: `${body.provider === "deepseek" ? "DeepSeek" : "OpenAI"} 连接正常。`,
      model: body.model || null,
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "连接超时，请稍后重试。"
      : "测试连接时发生异常。";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
