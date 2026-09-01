import { mergeQuestionBankArchive } from "@/lib/ai-question-bank";
import {
  QUESTION_BANK_ARCHIVE_DIRECTORY,
  questionBankArchiveFileInfo,
} from "@/lib/question-bank-archive";

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

function getConfig() {
  const token = process.env.VISION_INTERVIEW_GITHUB_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim() || "";
  const repository = process.env.VISION_INTERVIEW_GITHUB_REPOSITORY?.trim() || process.env.GITHUB_REPOSITORY?.trim() || DEFAULT_REPOSITORY;
  const branch = process.env.VISION_INTERVIEW_GITHUB_BRANCH?.trim() || DEFAULT_BRANCH;
  const archivePath = process.env.VISION_INTERVIEW_GITHUB_ARCHIVE_PATH?.trim() || DEFAULT_ARCHIVE_PATH;
  return { token, repository, branch, archivePath };
}

function contentsEndpoint(config: ReturnType<typeof getConfig>, path: string) {
  return `https://api.github.com/repos/${config.repository}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(config.branch)}`;
}

async function readRemoteFile(config: ReturnType<typeof getConfig>, path: string) {
  const endpoint = contentsEndpoint(config, path);
  const response = await fetch(endpoint, { headers: githubHeaders(config.token), cache: "no-store" });
  if (response.status === 404) return { path, endpoint, sha: "", content: "" };
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`GitHub 题库读取失败（HTTP ${response.status}）${detail ? `：${detail.slice(0, 180)}` : ""}`);
  }
  const body = await response.json() as { sha?: unknown; content?: unknown };
  return {
    path,
    endpoint,
    sha: typeof body.sha === "string" ? body.sha : "",
    content: typeof body.content === "string" ? body.content : "",
  };
}

async function listArchiveFiles(config: ReturnType<typeof getConfig>) {
  const response = await fetch(contentsEndpoint(config, QUESTION_BANK_ARCHIVE_DIRECTORY), {
    headers: githubHeaders(config.token),
    cache: "no-store",
  });
  if (response.status === 404) return [] as string[];
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`GitHub 分类题库目录读取失败（HTTP ${response.status}）${detail ? `：${detail.slice(0, 180)}` : ""}`);
  }
  const body = await response.json() as unknown;
  if (!Array.isArray(body)) return [] as string[];
  return [...new Set(body
    .filter((item): item is { type?: unknown; path?: unknown } => Boolean(item) && typeof item === "object")
    .filter((item) => item.type === "file" && typeof item.path === "string" && Boolean(questionBankArchiveFileInfo(item.path)))
    .map((item) => item.path as string))];
}

function parseQuestions(content: string) {
  if (!content) return { questions: [] as unknown[], updatedAt: "" };
  try {
    const parsed = JSON.parse(decodeBase64Utf8(content)) as { questions?: unknown[]; updatedAt?: unknown } | unknown[];
    if (Array.isArray(parsed)) return { questions: parsed, updatedAt: "" };
    return {
      questions: Array.isArray(parsed?.questions) ? parsed.questions : [],
      updatedAt: typeof parsed?.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return { questions: [] as unknown[], updatedAt: "" };
  }
}

export async function GET() {
  const config = getConfig();
  if (!config.token) return json({ ok: true, available: false, reason: "github_not_configured", questions: [], questionCount: 0, files: [], updatedAt: "" });

  try {
    const legacy = await readRemoteFile(config, config.archivePath);
    let categorizedPaths: string[] = [];
    try {
      categorizedPaths = await listArchiveFiles(config);
    } catch {
      // 旧总题库仍可独立使用；分类目录读取失败不应阻断历史题库加载。
    }
    const categorized = await Promise.all(categorizedPaths.map((path) => readRemoteFile(config, path)));
    const sources = [legacy, ...categorized].map((file) => ({ file, ...parseQuestions(file.content) }));
    const questions = mergeQuestionBankArchive([], sources.flatMap((source) => source.questions));
    const updatedAt = sources.map((source) => source.updatedAt).filter(Boolean).sort().at(-1) || "";
    const files = sources
      .filter((source) => source.file.content)
      .map((source) => ({
        path: source.file.path,
        slug: source.file.path === config.archivePath ? "legacy" : questionBankArchiveFileInfo(source.file.path)?.slug || "unknown",
        questionCount: source.questions.length,
      }));
    return json({ ok: true, available: true, questions, questionCount: questions.length, files, updatedAt, repository: config.repository, branch: config.branch, path: config.archivePath });
  } catch (error) {
    return json({ ok: false, available: false, questions: [], questionCount: 0, updatedAt: "", reason: error instanceof Error ? error.message : "GitHub 题库读取失败。" }, 502);
  }
}
