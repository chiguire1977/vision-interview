#!/usr/bin/env node
/**
 * 学习数据存档服务（旁路 sidecar）
 *
 * 为什么需要它：
 *   应用的 API 路由运行在 Cloudflare Workers 运行时（workerd）里，
 *   该沙箱只允许读文件、禁止写入（POST 会得到 "operation not permitted"）。
 *   所以把落盘工作交给这个独立的 Node 进程，由 Vite 反向代理转发。
 *
 * 接口：
 *   GET  /api/backup  -> { ok, available, version, updatedAt, data }
 *   POST /api/backup  -> 整份覆盖写入，返回 { ok, updatedAt, saved, counts }
 *
 * 数据文件：data/vision-interview-data.json（随 git 一起备份）
 */

import { createServer } from "node:http";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = resolve(ROOT, "data");
const DATA_FILE = resolve(DATA_DIR, "vision-interview-data.json");
const PORT = Number(process.env.BACKUP_PORT || 8787);

/** 白名单：只有这些 key 会被存档 */
const BACKUP_KEYS = [
  "vision-interview-records",
  "vision-interview-projects",
  "vision-interview-ai-preferences",
  "vision-interview-ai-provider-settings",
  "vision-interview-project-view",
];

const MAX_BODY = 8 * 1024 * 1024; // 8MB 上限，防止异常巨量写入

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readArchive() {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ok: true,
      available: true,
      version: parsed.version ?? 1,
      updatedAt: parsed.updatedAt ?? "",
      data: parsed.data ?? {},
    };
  } catch (err) {
    if (err?.code === "ENOENT") {
      return { ok: true, available: true, version: 1, updatedAt: "", data: {} };
    }
    return {
      ok: false,
      available: true,
      version: 1,
      updatedAt: "",
      data: {},
      reason: String(err),
    };
  }
}

async function writeArchive(incoming) {
  const filtered = {};
  for (const key of BACKUP_KEYS) {
    if (key in incoming) filtered[key] = incoming[key];
  }

  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    data: filtered,
  };

  await mkdir(DATA_DIR, { recursive: true });
  // 临时文件 + 原子改名，避免写到一半被读取
  const tmp = `${DATA_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(payload, null, 2), "utf8");
  await rename(tmp, DATA_FILE);

  const counts = Object.fromEntries(
    Object.entries(filtered).map(([k, v]) => [
      k,
      Array.isArray(v) ? v.length : typeof v,
    ]),
  );

  return {
    ok: true,
    available: true,
    updatedAt: payload.updatedAt,
    saved: Object.keys(filtered),
    counts,
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") return send(res, 204, {});

  if (url.pathname !== "/api/backup" && url.pathname !== "/") {
    return send(res, 404, { ok: false, reason: "not found" });
  }

  if (req.method === "GET") {
    return send(res, 200, await readArchive());
  }

  if (req.method === "POST") {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", async () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const incoming = body?.data;
        if (typeof incoming !== "object" || incoming === null) {
          return send(res, 400, { ok: false, reason: "data must be an object" });
        }
        const result = await writeArchive(incoming);
        const n = result.counts["vision-interview-records"] ?? 0;
        console.log(
          `[backup] saved ${result.saved.length} keys, ${n} records @ ${result.updatedAt}`,
        );
        send(res, 200, result);
      } catch (err) {
        console.error("[backup] write failed:", err);
        send(res, 500, { ok: false, reason: String(err) });
      }
    });
    return;
  }

  send(res, 405, { ok: false, reason: "method not allowed" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[backup] archive service on http://127.0.0.1:${PORT}`);
  console.log(`[backup] data file: ${DATA_FILE}`);
});
