export const dynamic = "force-dynamic";

import { normalizeGitHubConnectionSettings, readBackupFromGitHub, saveBackupToGitHub } from "../../../lib/backup-core.mjs";
import { readGitHubTokenFromRequest } from "../../../lib/github-credentials.mjs";

const DEFAULT_REPOSITORY = "chiguire1977/vision-interview";
const DEFAULT_BRANCH = "main";
const REPOSITORY = {
  path: "data/vision-interview-data.json",
};

const MAX_BODY_BYTES = 4 * 1024 * 1024;

function getBackupToken(request?: Request) {
  return readGitHubTokenFromRequest(request)
    || process.env.VISION_INTERVIEW_GITHUB_TOKEN?.trim()
    || process.env.GITHUB_BACKUP_TOKEN?.trim()
    || "";
}

function getRepository(request?: Request) {
  const environment = normalizeGitHubConnectionSettings({
    repository: process.env.VISION_INTERVIEW_GITHUB_REPOSITORY?.trim() || DEFAULT_REPOSITORY,
    branch: process.env.VISION_INTERVIEW_GITHUB_BRANCH?.trim() || DEFAULT_BRANCH,
  });
  const search = request ? new URL(request.url).searchParams : null;
  const connection = normalizeGitHubConnectionSettings({
    repository: search?.get("repository") || environment.repository,
    branch: search?.get("branch") || environment.branch,
  }, environment);
  const [owner, repo] = connection.repository.split("/");
  return { owner, repo, branch: connection.branch, repository: connection.repository, path: REPOSITORY.path };
}

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request?: Request) {
  const repository = getRepository(request);
  try {
    const archive = await readBackupFromGitHub({
      fetchImpl: fetch,
      token: getBackupToken(request),
      owner: repository.owner,
      repo: repository.repo,
      branch: repository.branch,
      path: repository.path,
    });
    return json({ ok: true, ...archive, repository: repository.repository, branch: repository.branch });
  } catch (error) {
    return json({
      ok: false,
      available: false,
      reason: error instanceof Error ? error.message : "GitHub 配置读取失败。",
      updatedAt: "",
      data: {},
    }, 502);
  }
}

export async function POST(request: Request) {
  const repository = getRepository(request);
  const token = getBackupToken(request);
  if (!token) {
    return json({ ok: false, available: false, reason: "未配置 GitHub 备份凭据。" }, 503);
  }

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return json({ ok: false, available: true, reason: "备份数据超过 4MB 上限。" }, 413);
    }
    const body = JSON.parse(raw) as { data?: unknown; merge?: unknown; replaceKeys?: unknown };
    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
      return json({ ok: false, available: true, reason: "data 必须是对象。" }, 400);
    }

    const result = await saveBackupToGitHub({
      fetchImpl: fetch,
      token,
      data: body.data,
      merge: body.merge !== false,
      replaceKeys: Array.isArray(body.replaceKeys)
        ? body.replaceKeys.filter((key): key is string => typeof key === "string")
        : [],
      owner: repository.owner,
      repo: repository.repo,
      branch: repository.branch,
      path: repository.path,
    });
    return json({ ok: true, available: true, ...result, repository: repository.repository, branch: repository.branch });
  } catch (error) {
    return json({
      ok: false,
      available: true,
      reason: error instanceof Error ? error.message : "GitHub 备份失败。",
    }, 502);
  }
}
