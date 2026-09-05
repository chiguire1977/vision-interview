import assert from "node:assert/strict";
import test from "node:test";

import { createGitHubBackupLog } from "../lib/backup-log.mjs";

test("creates a start log for a GitHub backup", () => {
  assert.deepEqual(createGitHubBackupLog("started", { operation: "records", count: 3 }), {
    level: "INFO",
    event: "github.backup.started",
    message: "开始备份数据到 GitHub",
    context: { operation: "records", count: 3 },
  });
});

test("creates success and failure logs with safe diagnostic context", () => {
  assert.equal(createGitHubBackupLog("succeeded", { status: 200 }).event, "github.backup.succeeded");
  assert.equal(createGitHubBackupLog("failed", { status: 403, reason: "forbidden" }).level, "ERROR");
  assert.deepEqual(createGitHubBackupLog("failed", {
    reason: "forbidden",
    token: "secret-token",
    apiKey: "secret-key",
    authorization: "Bearer secret-token",
  }).context, { reason: "forbidden" });
});
