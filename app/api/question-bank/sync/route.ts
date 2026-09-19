import { createQuestionBankMarkdown, mergeQuestionBankArchive } from "@/lib/ai-question-bank";
import {
  QUESTION_BANK_ARCHIVE_DIRECTORY,
  questionBankArchiveFileInfo,
  questionBankArchivePath,
  questionBankArchiveSlugs,
} from "@/lib/question-bank-archive";
import { normalizeGitHubConnectionSettings } from "@/lib/backup-core.mjs";
import { readGitHubTokenFromRequest } from "../../../../lib/github-credentials.mjs";

const DEFAULT_REPOSITORY = "chiguire1977/vision-interview";
const DEFAULT_BRANCH = "main";
const DEFAULT_ARCHIVE_PATH = "data/ai-question-bank.json";
const DEFAULT_MARKDOWN_PATH = "data/ai-question-bank.md";
const GITHUB_API_VERSION = "2022-11-28";

function encodeBase64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function decodeBase64Utf8(value: string) {
  const binary = atob(value.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

function githubHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": "VisionInterview-question-bank-sync",
  };
}

function getConfig(request?: Request) {
  const token = readGitHubTokenFromRequest(request) || process.env.VISION_INTERVIEW_GITHUB_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim() || "";
  const environment = normalizeGitHubConnectionSettings({
    repository: process.env.VISION_INTERVIEW_GITHUB_REPOSITORY?.trim() || process.env.GITHUB_REPOSITORY?.trim() || DEFAULT_REPOSITORY,
    branch: process.env.VISION_INTERVIEW_GITHUB_BRANCH?.trim() || DEFAULT_BRANCH,
  });
  const search = request ? new URL(request.url).searchParams : null;
  const connection = normalizeGitHubConnectionSettings({
    repository: search?.get("repository") || environment.repository,
    branch: search?.get("branch") || environment.branch,
  }, environment);
  const archivePath = process.env.VISION_INTERVIEW_GITHUB_ARCHIVE_PATH?.trim() || DEFAULT_ARCHIVE_PATH;
  const markdownPath = process.env.VISION_INTERVIEW_GITHUB_MARKDOWN_PATH?.trim() || DEFAULT_MARKDOWN_PATH;
  return { token, repository: connection.repository, branch: connection.branch, archivePath, markdownPath };
}

function contentsEndpoint(config: ReturnType<typeof getConfig>, path: string) {
  return `https://api.github.com/repos/${config.repository}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(config.branch)}`;
}

type RemoteFile = { path: string; endpoint: string; sha: string; content: string };
type ParsedRemoteFile = RemoteFile & { questions: unknown[]; updatedAt: string };

async function readRemoteFile(config: ReturnType<typeof getConfig>, path: string): Promise<RemoteFile> {
  const endpoint = contentsEndpoint(config, path);
  const response = await fetch(endpoint, { headers: githubHeaders(config.token), cache: "no-store" });
  if (response.status === 404) return { path, endpoint, sha: "", content: "" };
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`GitHub archive read failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`);
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
    throw new Error(`GitHub archive directory read failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`);
  }
  const body = await response.json() as unknown;
  if (!Array.isArray(body)) return [] as string[];
  return [...new Set(body
    .filter((item): item is { type?: unknown; path?: unknown } => Boolean(item) && typeof item === "object")
    .filter((item) => item.type === "file" && typeof item.path === "string" && Boolean(questionBankArchiveFileInfo(item.path)))
    .map((item) => item.path as string))];
}

function parseQuestions(file: RemoteFile): ParsedRemoteFile {
  if (!file.content) return { ...file, questions: [], updatedAt: "" };
  try {
    const parsed = JSON.parse(decodeBase64Utf8(file.content)) as { questions?: unknown[]; updatedAt?: unknown } | unknown[];
    if (Array.isArray(parsed)) return { ...file, questions: parsed, updatedAt: "" };
    return {
      ...file,
      questions: Array.isArray(parsed?.questions) ? parsed.questions : [],
      updatedAt: typeof parsed?.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return { ...file, questions: [], updatedAt: "" };
  }
}

async function readRemoteArchives(config: ReturnType<typeof getConfig>) {
  const legacy = parseQuestions(await readRemoteFile(config, config.archivePath));
  let categorizedPaths: string[] = [];
  try {
    categorizedPaths = await listArchiveFiles(config);
  } catch {
    // 旧总题库仍可用于兼容写入；分类目录会在本次同步时按需创建。
  }
  const files = (await Promise.all(categorizedPaths.map((path) => readRemoteFile(config, path)))).map(parseQuestions);
  const categorizedJson = files.filter((file) => questionBankArchiveFileInfo(file.path)?.extension === "json");
  const markdown = new Map(files
    .filter((file) => questionBankArchiveFileInfo(file.path)?.extension === "md")
    .map((file) => [questionBankArchiveFileInfo(file.path)?.slug || "", file] as const));
  const jsonBySlug = new Map(categorizedJson
    .map((file) => [questionBankArchiveFileInfo(file.path)?.slug || "", file] as const));
  const questions = mergeQuestionBankArchive([], [legacy, ...categorizedJson].flatMap((file) => file.questions));
  return { legacy, categorizedJson, markdown, jsonBySlug, questions };
}

function groupedArchives(values: unknown[]) {
  const groups = new Map<string, unknown[]>();
  for (const value of values) {
    for (const slug of questionBankArchiveSlugs(value)) {
      const current = groups.get(slug) ?? [];
      current.push(value);
      groups.set(slug, current);
    }
  }
  return new Map([...groups.entries()].map(([slug, entries]) => [slug, mergeQuestionBankArchive([], entries)] as const));
}

function serializedArchive(questions: unknown[], updatedAt: string) {
  return `${JSON.stringify({ version: 1, updatedAt, questions }, null, 2)}\n`;
}

function normalizedQuestions(value: unknown[]) {
  return JSON.stringify(mergeQuestionBankArchive([], value));
}

async function writeRemoteFile(
  config: ReturnType<typeof getConfig>,
  endpoint: string,
  sha: string,
  content: string,
  message: string,
) {
  return fetch(endpoint, {
    method: "PUT",
    headers: { ...githubHeaders(config.token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content,
      branch: config.branch,
      ...(sha ? { sha } : {}),
    }),
  });
}

async function commitSha(response: Response) {
  const body = await response.json().catch(() => ({})) as { commit?: { sha?: unknown } };
  return typeof body.commit?.sha === "string" ? body.commit.sha : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { entries?: unknown[]; complete?: unknown };
    const incoming = Array.isArray(body.entries) ? body.entries : [];
    const complete = body.complete === true;
    if (!incoming.length) return Response.json({ ok: false, archived: false, reason: "no_entries" }, { status: 400 });

    const config = getConfig(request);
    if (!config.token) {
      return Response.json({ ok: true, archived: false, reason: "github_not_configured", accepted: incoming.length, complete }, { status: 202 });
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const updatedAt = new Date().toISOString();
      const remote = await readRemoteArchives(config);
      const merged = mergeQuestionBankArchive(remote.questions, incoming);
      if (!merged.length) return Response.json({ ok: false, archived: false, reason: "no_valid_entries" }, { status: 400 });

      const grouped = groupedArchives(merged);
      const affectedSlugs = complete
        ? [...grouped.keys()]
        : [...new Set(incoming.flatMap((entry) => questionBankArchiveSlugs(entry)))];
      const changedFiles: string[] = [];
      const markdownWarnings: string[] = [];
      let lastCommit: string | null = null;
      let conflicted = false;

      for (const slug of affectedSlugs) {
        const questions = grouped.get(slug) ?? [];
        if (!questions.length) continue;
        const current = remote.jsonBySlug.get(slug);
        if (current && normalizedQuestions(current.questions) === normalizedQuestions(questions)) continue;

        const jsonPath = questionBankArchivePath(slug, "json");
        const jsonResponse = await writeRemoteFile(
          config,
          contentsEndpoint(config, jsonPath),
          current?.sha || "",
          encodeBase64Utf8(serializedArchive(questions, updatedAt)),
          `Backup AI question bank (${slug})`,
        );
        if (jsonResponse.status === 409 || jsonResponse.status === 422) { conflicted = true; break; }
        if (!jsonResponse.ok) {
          const detail = await jsonResponse.text().catch(() => "");
          return Response.json({ ok: false, archived: false, reason: "github_write_failed", message: `GitHub archive write failed (HTTP ${jsonResponse.status})${detail ? `: ${detail.slice(0, 240)}` : ""}` }, { status: 502 });
        }
        lastCommit = await commitSha(jsonResponse) || lastCommit;
        changedFiles.push(jsonPath);

        const markdownPath = questionBankArchivePath(slug, "md");
        const markdownFile = remote.markdown.get(slug);
        const markdownResponse = await writeRemoteFile(
          config,
          contentsEndpoint(config, markdownPath),
          markdownFile?.sha || "",
          encodeBase64Utf8(createQuestionBankMarkdown(questions, updatedAt)),
          `Backup AI question bank Markdown (${slug})`,
        );
        if (markdownResponse.status === 409 || markdownResponse.status === 422) {
          markdownWarnings.push(`${markdownPath}: GitHub Markdown archive conflicted; JSON remains canonical.`);
          continue;
        }
        if (!markdownResponse.ok) {
          const detail = await markdownResponse.text().catch(() => "");
          markdownWarnings.push(`${markdownPath}: Markdown derivation failed (HTTP ${markdownResponse.status})${detail ? `: ${detail.slice(0, 120)}` : ""}`);
          continue;
        }
        lastCommit = await commitSha(markdownResponse) || lastCommit;
        changedFiles.push(markdownPath);
      }

      if (conflicted) continue;
      return Response.json({
        ok: true,
        archived: true,
        total: merged.length,
        addedOrUpdated: incoming.length,
        commit: lastCommit,
        repository: config.repository,
        branch: config.branch,
        path: config.archivePath,
        markdownPath: config.markdownPath,
        complete,
        changedFiles,
        markdownWarnings,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    return Response.json({ ok: false, archived: false, reason: "github_conflict", message: "GitHub archive update conflicted twice; please retry." }, { status: 409 });
  } catch (error) {
    return Response.json({ ok: false, archived: false, reason: "sync_exception", message: error instanceof Error ? error.message : "Question bank sync failed." }, { status: 500 });
  }
}
