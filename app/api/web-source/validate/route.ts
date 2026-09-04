export const dynamic = "force-dynamic";

const MAX_URL_LENGTH = 2048;
const MAX_TITLE_LENGTH = 160;
const VALIDATION_TIMEOUT_MS = 10000;
const VALIDATION_USER_AGENT = "VisionInterview-web-source-validator";

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function decodeHtml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => {
      const number = Number.parseInt(code, 16);
      return Number.isFinite(number) && number >= 0 && number <= 0x10ffff ? String.fromCodePoint(number) : "";
    })
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const number = Number.parseInt(code, 10);
      return Number.isFinite(number) && number >= 0 && number <= 0x10ffff ? String.fromCodePoint(number) : "";
    })
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeUrl(value: unknown) {
  if (typeof value !== "string" || value.trim().length > MAX_URL_LENGTH) return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.username || url.password || url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]") return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function extractPageName(html: string) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  const siteName = html.match(/<meta\b[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1] || "";
  const candidate = decodeHtml((siteName || title).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(0, MAX_TITLE_LENGTH);
  return candidate.trim();
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { url?: unknown };
  const url = normalizeUrl(body.url);
  if (!url) return json({ ok: false, message: "请输入有效的公开 http:// 或 https:// 网址。" }, 400);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": VALIDATION_USER_AGENT,
      },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
    });
    if (!response.ok) return json({ ok: false, message: `网址连接失败（HTTP ${response.status}）。` }, 502);
    const displayName = extractPageName((await response.text()).slice(0, 512 * 1024));
    if (!displayName) return json({ ok: false, message: "网址可以连接，但未能读取有效的网站名称。" }, 502);
    return json({ ok: true, url, displayName });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "网址连接超时，请检查地址后重试。"
      : "网址暂时无法连接，请检查地址后重试。";
    return json({ ok: false, message }, 502);
  }
}
