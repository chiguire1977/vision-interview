import { createQuestionBankMarkdown, mergeQuestionBankArchive } from "@/lib/ai-question-bank";

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
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
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

function getConfig() {
  const token = process.env.VISION_INTERVIEW_GITHUB_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim() || "";
  const repository =
    process.env.VISION_INTERVIEW_GITHUB_REPOSITORY?.trim()
    || process.env.GITHUB_REPOSITORY?.trim()
    || DEFAULT_REPOSITORY;
  const branch = process.env.VISION_INTERVIEW_GITHUB_BRANCH?.trim() || DEFAULT_BRANCH;
  const archivePath = process.env.VISION_INTERVIEW_GITHUB_ARCHIVE_PATH?.trim() || DEFAULT_ARCHIVE_PATH;
  const markdownPath = process.env.VISION_INTERVIEW_GITHUB_MARKDOWN_PATH?.trim() || DEFAULT_MARKDOWN_PATH;
  return { token, repository, branch, archivePath, markdownPath };
}

async function readRemoteFile(config: ReturnType<typeof getConfig>, path: string) {
  const endpoint = `https://api.github.com/repos/${config.repository}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(config.branch)}`;
  const response = await fetch(endpoint, {
    headers: githubHeaders(config.token),
    cache: "no-store",
  });
  if (response.status === 404) {
    return { endpoint, sha: "", content: "" };
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      "GitHub archive read failed (HTTP " + response.status + ")" + (detail ? ": " + detail.slice(0, 240) : ""),
    );
  }

  const body = await response.json() as { sha?: unknown; content?: unknown };
  const sha = typeof body.sha === "string" ? body.sha : "";
  const content = typeof body.content === "string" ? body.content : "";
  return { endpoint, sha, content };
}

async function readRemoteArchive(config: ReturnType<typeof getConfig>) {
  const remote = await readRemoteFile(config, config.archivePath);
  const { endpoint, sha, content } = remote;
  if (!content) return { endpoint, sha, questions: [] as unknown[] };

  try {
    const parsed = JSON.parse(decodeBase64Utf8(content)) as { questions?: unknown[] } | unknown[];
    const questions = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.questions)
        ? parsed.questions
        : [];
    return { endpoint, sha, questions };
  } catch {
    throw new Error("GitHub question bank JSON is invalid.");
  }
}

async function writeRemoteArchive(
  config: ReturnType<typeof getConfig>,
  endpoint: string,
  sha: string,
  questions: unknown[],
  updatedAt: string,
) {
  const archive = {
    version: 1,
    updatedAt,
    questions,
  };
  return writeRemoteFile(
    config,
    endpoint,
    sha,
    encodeBase64Utf8(`${JSON.stringify(archive, null, 2)}\n`),
    "Backup AI generated interview questions",
  );
}

async function writeRemoteMarkdown(
  config: ReturnType<typeof getConfig>,
  endpoint: string,
  sha: string,
  questions: unknown[],
  updatedAt: string,
) {
  return writeRemoteFile(
    config,
    endpoint,
    sha,
    encodeBase64Utf8(createQuestionBankMarkdown(questions, updatedAt)),
    "Backup AI generated interview questions (Markdown)",
  );
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
    headers: {
      ...githubHeaders(config.token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      content,
      branch: config.branch,
      ...(sha ? { sha } : {}),
    }),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { entries?: unknown[]; complete?: unknown };
    const incoming = Array.isArray(body.entries) ? body.entries : [];
    const complete = body.complete === true;
    if (!incoming.length) {
      return Response.json(
        { ok: false, archived: false, reason: "no_entries" },
        { status: 400 },
      );
    }

    const config = getConfig();
    if (!config.token) {
      return Response.json(
        {
          ok: true,
          archived: false,
          reason: "github_not_configured",
          accepted: incoming.length,
          complete,
        },
        { status: 202 },
      );
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const updatedAt = new Date().toISOString();
      const remote = await readRemoteArchive(config);
      const merged = mergeQuestionBankArchive(remote.questions, incoming);
      if (!merged.length) {
        return Response.json(
          { ok: false, archived: false, reason: "no_valid_entries" },
          { status: 400 },
        );
      }

      let response = await writeRemoteArchive(config, remote.endpoint, remote.sha, merged, updatedAt);
      if (response.status === 409 || response.status === 422) continue;
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        return Response.json(
          {
            ok: false,
            archived: false,
            reason: "github_write_failed",
            message: "GitHub archive write failed (HTTP " + response.status + ")" + (detail ? ": " + detail.slice(0, 240) : ""),
          },
          { status: 502 },
        );
      }

      const markdown = await readRemoteFile(config, config.markdownPath);
      response = await writeRemoteMarkdown(config, markdown.endpoint, markdown.sha, merged, updatedAt);
      if (response.status === 409 || response.status === 422) continue;
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        return Response.json(
          {
            ok: false,
            archived: false,
            reason: "github_markdown_write_failed",
            message: "GitHub Markdown archive write failed (HTTP " + response.status + ")" + (detail ? ": " + detail.slice(0, 240) : ""),
          },
          { status: 502 },
        );
      }

      const result = await response.json().catch(() => ({})) as { commit?: { sha?: string } };
      return Response.json(
        {
          ok: true,
          archived: true,
          total: merged.length,
          addedOrUpdated: incoming.length,
          commit: result.commit?.sha ?? null,
          repository: config.repository,
          branch: config.branch,
          path: config.archivePath,
          markdownPath: config.markdownPath,
          complete,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json(
      {
        ok: false,
        archived: false,
        reason: "github_conflict",
        message: "GitHub archive update conflicted twice; please retry.",
      },
      { status: 409 },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        archived: false,
        reason: "sync_exception",
        message: error instanceof Error ? error.message : "Question bank sync failed.",
      },
      { status: 500 },
     );
  }
}
