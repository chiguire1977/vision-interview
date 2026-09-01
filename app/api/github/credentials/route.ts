import { normalizeGitHubConnectionSettings } from "../../../../lib/backup-core.mjs";
import { clearGitHubTokenCookie, setGitHubTokenCookie } from "../../../../lib/github-credentials.mjs";

export const dynamic = "force-dynamic";

const DEFAULT_REPOSITORY = "chiguire1977/vision-interview";
const DEFAULT_BRANCH = "main";
const MAX_TOKEN_LENGTH = 500;

function json(body: Record<string, unknown>, status = 200, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function getConnection(body: { repository?: unknown; branch?: unknown }) {
  const repository = typeof body.repository === "string" ? body.repository : DEFAULT_REPOSITORY;
  const branch = typeof body.branch === "string" ? body.branch : DEFAULT_BRANCH;
  return normalizeGitHubConnectionSettings({ repository, branch });
}

function githubHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "VisionInterview-github-credentials",
  };
}

async function verifyGitHubAccess(token: string, repository: string, branch: string) {
  const headers = githubHeaders(token);
  const repositoryResponse = await fetch(`https://api.github.com/repos/${repository}`, { headers, cache: "no-store" });
  if (!repositoryResponse.ok) {
    throw new Error(`GitHub 凭据验证失败（HTTP ${repositoryResponse.status}）。`);
  }
  const repositoryBody = await repositoryResponse.json().catch(() => ({})) as { permissions?: { push?: unknown; admin?: unknown } };
  if (repositoryBody.permissions?.push !== true && repositoryBody.permissions?.admin !== true) {
    throw new Error("Token 没有目标仓库的写入权限，请授予 Contents: Read and write。");
  }

  const branchResponse = await fetch(`https://api.github.com/repos/${repository}/git/ref/heads/${encodeURIComponent(branch)}`, { headers, cache: "no-store" });
  if (!branchResponse.ok) {
    throw new Error(`GitHub 分支验证失败（HTTP ${branchResponse.status}）。`);
  }
}

export async function POST(request: Request) {
  let body: { token?: unknown; repository?: unknown; branch?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ ok: false, reason: "请求格式无效。" }, 400);
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token || token.length > MAX_TOKEN_LENGTH || /\s/.test(token)) {
    return json({ ok: false, reason: "请输入有效的 GitHub Token。" }, 400);
  }

  const connection = getConnection(body);
  try {
    await verifyGitHubAccess(token, connection.repository, connection.branch);
    return json(
      { ok: true, configured: true, repository: connection.repository, branch: connection.branch },
      200,
      { "Set-Cookie": setGitHubTokenCookie(token) },
    );
  } catch (error) {
    return json({ ok: false, reason: error instanceof Error ? error.message : "GitHub 凭据验证失败。" }, 403);
  }
}

export async function DELETE() {
  return json(
    { ok: true, configured: false },
    200,
    { "Set-Cookie": clearGitHubTokenCookie() },
  );
}
