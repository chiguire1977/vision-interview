export const dynamic = "force-dynamic";

import { readBackupFromGitHub, saveBackupToGitHub } from "../../../lib/backup-core.mjs";

const REPOSITORY = {
  owner: "chiguire1977",
  repo: "vision-interview",
  branch: "main",
  path: "data/vision-interview-data.json",
};

const MAX_BODY_BYTES = 4 * 1024 * 1024;

function getBackupToken() {
  return process.env.VISION_INTERVIEW_GITHUB_TOKEN?.trim()
    || process.env.GITHUB_BACKUP_TOKEN?.trim()
    || "";
}

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  try {
    const archive = await readBackupFromGitHub({
      fetchImpl: fetch,
      token: getBackupToken(),
      ...REPOSITORY,
    });
    return json({ ok: true, ...archive });
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
  const token = getBackupToken();
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
      ...REPOSITORY,
    });
    return json({ ok: true, available: true, ...result });
  } catch (error) {
    return json({
      ok: false,
      available: true,
      reason: error instanceof Error ? error.message : "GitHub 备份失败。",
    }, 502);
  }
}
