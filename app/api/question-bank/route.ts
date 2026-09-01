export const dynamic = "force-dynamic";

const DEFAULT_REPOSITORY = "chiguire1977/vision-interview";
const DEFAULT_BRANCH = "main";
const DEFAULT_ARCHIVE_PATH = "data/ai-question-bank.json";
const GITHUB_API_VERSION = "2022-11-28";

function githubHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": "VisionInterview-question-bank-sync",
  };
}

function decodeBase64Utf8(value: string) {
  const binary = atob(value.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  const token = process.env.VISION_INTERVIEW_GITHUB_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim() || "";
  if (!token) return json({ ok: true, available: false, reason: "github_not_configured", questions: [], updatedAt: "" });

  const repository = process.env.VISION_INTERVIEW_GITHUB_REPOSITORY?.trim() || process.env.GITHUB_REPOSITORY?.trim() || DEFAULT_REPOSITORY;
  const branch = process.env.VISION_INTERVIEW_GITHUB_BRANCH?.trim() || DEFAULT_BRANCH;
  const archivePath = process.env.VISION_INTERVIEW_GITHUB_ARCHIVE_PATH?.trim() || DEFAULT_ARCHIVE_PATH;
  const endpoint = `https://api.github.com/repos/${repository}/contents/${encodeURIComponent(archivePath)}?ref=${encodeURIComponent(branch)}`;

  try {
    const response = await fetch(endpoint, { headers: githubHeaders(token), cache: "no-store" });
    if (response.status === 404) return json({ ok: true, available: true, questions: [], questionCount: 0, updatedAt: "", repository, branch, path: archivePath });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return json({ ok: false, available: false, questions: [], updatedAt: "", reason: `GitHub 题库读取失败（HTTP ${response.status}）${detail ? `：${detail.slice(0, 180)}` : ""}` }, 502);
    }
    const body = await response.json() as { content?: unknown };
    const content = typeof body.content === "string" ? body.content : "";
    const parsed = content ? JSON.parse(decodeBase64Utf8(content)) as unknown : {};
    const archive = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as { questions?: unknown[]; updatedAt?: unknown }
      : null;
    const questions = Array.isArray(parsed) ? parsed : Array.isArray(archive?.questions) ? archive.questions : [];
    return json({ ok: true, available: true, questions, questionCount: questions.length, updatedAt: typeof archive?.updatedAt === "string" ? archive.updatedAt : "", repository, branch, path: archivePath });
  } catch (error) {
    return json({ ok: false, available: false, questions: [], updatedAt: "", reason: error instanceof Error ? error.message : "GitHub 题库读取失败。" }, 502);
  }
}
