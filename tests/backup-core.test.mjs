import assert from "node:assert/strict";
import test from "node:test";

import {
  appendRuntimeLog,
  clearRuntimeLogs,
  createCloseBackupPayload,
  createAutoBackupSnapshot,
  createRecordsUploadPayload,
  filterRuntimeLogs,
  filterRuntimeLogsBySession,
  mergeBackupData,
  readBackupFromGitHub,
  readBackupFromStorage,
  sanitizeBackupData,
  startRuntimeSession,
  saveBackupToGitHub,
  writeBackupToStorage,
} from "../lib/backup-core.mjs";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("createAutoBackupSnapshot keeps favorite questions without credentials", () => {
  const snapshot = createAutoBackupSnapshot({
    "vision-interview-records": [{ id: "record-1" }],
    "vision-interview-favorite-questions": [{ title: "Otsu", source: "专业", apiKey: "discard" }],
    "vision-interview-project-view": "grid",
    "vision-interview-runtime-logs": [{
      id: "log-1",
      timestamp: "2026-08-31T00:00:00.000Z",
      level: "INFO",
      kind: "system",
      event: "app.start",
      message: "启动",
    }],
  });

  assert.deepEqual(snapshot, {
    "vision-interview-favorite-questions": [{ title: "Otsu", source: "专业" }],
    "vision-interview-project-view": "grid",
    "vision-interview-runtime-logs": [{
      id: "log-1",
      timestamp: "2026-08-31T00:00:00.000Z",
      level: "INFO",
      kind: "system",
      event: "app.start",
      message: "启动",
    }],
  });
});

test("createRecordsUploadPayload uploads the complete sanitized record collection", () => {
  const payload = createRecordsUploadPayload([
    { id: "record-1", question: "Q1", answer: "A1", apiKey: "discard" },
  ]);

  assert.deepEqual(payload, {
    data: { "vision-interview-records": [{ id: "record-1", question: "Q1", answer: "A1" }] },
    merge: true,
    replaceKeys: ["vision-interview-records"],
  });
});

test("sanitizeBackupData keeps approved data and removes nested credentials", () => {
  const result = sanitizeBackupData({
    "vision-interview-records": [{ question: "Otsu", answer: "类间方差最大" }],
    "vision-interview-ai-provider-settings": {
      custom: {
        baseUrl: "https://ai.example.com/v1",
        apiKey: "must-not-leave-browser",
        nested: { authorization: "Bearer secret", model: "vision-model" },
      },
    },
    "vision-interview-runtime-logs": [
      {
        id: "log-1",
        timestamp: "2026-08-31T01:00:00.000Z",
        level: "ERROR",
        kind: "system",
        event: "ai.request.failed",
        message: "请求失败",
        context: { provider: "custom", token: "hidden", status: 502 },
      },
    ],
    unrelated: "discard-me",
  });

  assert.deepEqual(result, {
    "vision-interview-records": [{ question: "Otsu", answer: "类间方差最大" }],
    "vision-interview-ai-provider-settings": {
      custom: {
        baseUrl: "https://ai.example.com/v1",
        nested: { model: "vision-model" },
      },
    },
    "vision-interview-runtime-logs": [
      {
        id: "log-1",
        timestamp: "2026-08-31T01:00:00.000Z",
        level: "ERROR",
        kind: "system",
        event: "ai.request.failed",
        message: "请求失败",
        context: { provider: "custom", status: 502 },
      },
    ],
  });
});

test("sanitizeBackupData redacts credentials embedded inside approved strings", () => {
  const result = sanitizeBackupData({
    "vision-interview-ai-provider-settings": {
      custom: {
        baseUrl: "https://user:pass@ai.example.com/v1?api_key=secret-value&model=vision",
        note: "Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz123456 client_secret=hidden-client-secret Authorization: Basic dXNlcjpwYXNz",
      },
    },
    "vision-interview-runtime-logs": [{
      id: "log-secret",
      timestamp: "2026-08-31T01:00:00.000Z",
      level: "ERROR",
      event: "provider.failed",
      message: "token=github_pat_1234567890abcdefghijklmnopqrstuvwxyz",
    }],
  });

  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /secret-value|user:pass|ghp_|github_pat_|hidden-client-secret|dXNlcjpwYXNz/);
  assert.match(serialized, /\[REDACTED\]/);
});

test("appendRuntimeLog keeps the newest 1000 sanitized entries", () => {
  const previous = Array.from({ length: 1000 }, (_, index) => ({
    id: `old-${index}`,
    timestamp: `2026-08-30T00:00:${String(index % 60).padStart(2, "0")}.000Z`,
    level: "INFO",
    event: "training.tick",
    message: `旧日志 ${index}`,
  }));
  const storage = createStorage({
    "vision-interview-runtime-logs": JSON.stringify(previous),
  });

  const created = appendRuntimeLog(
    storage,
    {
      level: "WARN",
      kind: "system",
      sessionId: "session-current",
      event: "backup.retry",
      message: "GitHub 冲突，准备重试",
      context: { attempt: 2, password: "never-store" },
    },
    "2026-08-31T01:02:03.000Z",
    "new-log",
  );

  const saved = JSON.parse(storage.getItem("vision-interview-runtime-logs"));
  assert.equal(saved.length, 1000);
  assert.deepEqual(saved[0], created);
  assert.equal(saved.at(-1).id, "old-998");
  assert.deepEqual(created.context, { attempt: 2 });
  assert.equal(created.kind, "system");
  assert.equal(created.sessionId, "session-current");
});

test("startRuntimeSession creates a new startup session without deleting archived logs", () => {
  const storage = createStorage({
    "vision-interview-runtime-logs": JSON.stringify([
      { id: "old", sessionId: "session-old", timestamp: "2026-08-30T01:00:00.000Z", level: "INFO", event: "app.start", message: "上次启动" },
    ]),
  });

  const session = startRuntimeSession(storage, "2026-08-31T01:00:00.000Z", "session-current");

  assert.deepEqual(session, { id: "session-current", startedAt: "2026-08-31T01:00:00.000Z" });
  assert.deepEqual(JSON.parse(storage.getItem("vision-interview-runtime-logs")), [
    { id: "old", sessionId: "session-old", timestamp: "2026-08-30T01:00:00.000Z", level: "INFO", event: "app.start", message: "上次启动" },
  ]);
});

test("filterRuntimeLogsBySession hides logs from previous startup sessions", () => {
  const logs = [
    { id: "current", sessionId: "session-current", timestamp: "2026-08-31T01:00:00.000Z", level: "INFO", event: "app.start", message: "本次启动" },
    { id: "old", sessionId: "session-old", timestamp: "2026-08-30T01:00:00.000Z", level: "INFO", event: "app.start", message: "上次启动" },
    { id: "legacy", timestamp: "2026-08-29T01:00:00.000Z", level: "INFO", event: "app.start", message: "旧格式" },
  ];

  assert.deepEqual(filterRuntimeLogsBySession(logs, "session-current").map((log) => log.id), ["current"]);
});

test("normalizeRuntimeLogs classifies legacy events and preserves explicit log kinds", async () => {
  const { normalizeRuntimeLogs } = await import("../lib/backup-core.mjs");
  const logs = normalizeRuntimeLogs([
    { id: "system", timestamp: "2026-08-31T01:00:00.000Z", level: "INFO", event: "question-group.prepare.completed", message: "题组完成" },
    { id: "user", timestamp: "2026-08-31T01:01:00.000Z", level: "INFO", event: "answer.submit.completed", message: "回答完成" },
    { id: "explicit", timestamp: "2026-08-31T01:02:00.000Z", level: "INFO", kind: "system", event: "project.catalog.saved", message: "项目已保存" },
  ]);

  assert.deepEqual(logs.map((log) => log.kind), ["system", "user", "system"]);
});

test("filterRuntimeLogs can filter the selected log category after severity", async () => {
  const { filterRuntimeLogs } = await import("../lib/backup-core.mjs");
  const logs = [
    { id: "system", timestamp: "2026-08-31T01:00:00.000Z", level: "INFO", kind: "system", event: "backup.saved", message: "已备份" },
    { id: "user", timestamp: "2026-08-31T01:01:00.000Z", level: "INFO", kind: "user", event: "answer.submit.completed", message: "回答完成" },
  ];

  assert.deepEqual(filterRuntimeLogs(logs, "ALL", "system").map((log) => log.id), ["system"]);
  assert.deepEqual(filterRuntimeLogs(logs, "INFO", "user").map((log) => log.id), ["user"]);
});

test("filterRuntimeLogs returns only the selected severity", () => {
  const logs = [
    { id: "1", timestamp: "2026-08-31T01:00:00.000Z", level: "INFO", kind: "system", event: "app.start", message: "启动" },
    { id: "2", timestamp: "2026-08-31T01:01:00.000Z", level: "ERROR", kind: "system", event: "backup.failed", message: "失败" },
  ];

  assert.deepEqual(filterRuntimeLogs(logs, "ERROR"), [logs[1]]);
  assert.deepEqual(filterRuntimeLogs(logs, "ALL"), logs);
});

test("clearRuntimeLogs removes the persisted runtime history", () => {
  const storage = createStorage({
    "vision-interview-runtime-logs": JSON.stringify([
      { id: "1", timestamp: "2026-08-31T01:00:00.000Z", level: "INFO", event: "app.start", message: "启动" },
    ]),
  });

  clearRuntimeLogs(storage);

  assert.deepEqual(JSON.parse(storage.getItem("vision-interview-runtime-logs")), []);
});

test("mergeBackupData loads GitHub values while retaining local-only approved values", () => {
  const result = mergeBackupData(
    {
      "vision-interview-projects": [{ id: "local", name: "本地项目" }],
      "vision-interview-project-view": "grid",
    },
    {
      "vision-interview-projects": [{ id: "github", name: "GitHub 项目" }],
      "vision-interview-ai-preferences": { provider: "deepseek", model: "deepseek-v4-flash" },
    },
  );

  assert.deepEqual(result, {
    "vision-interview-projects": [
      { id: "github", name: "GitHub 项目" },
      { id: "local", name: "本地项目" },
    ],
    "vision-interview-project-view": "grid",
    "vision-interview-ai-preferences": { provider: "deepseek", model: "deepseek-v4-flash" },
  });
});

test("mergeBackupData preserves newer dirty local values and unions records and logs", () => {
  const result = mergeBackupData(
    {
      "vision-interview-project-view": "list",
      "vision-interview-records": [
        { id: "local-record", question: "Local" },
        { id: "shared", question: "New local answer" },
      ],
      "vision-interview-runtime-logs": [
        { id: "local-log", timestamp: "2026-08-31T02:00:00.000Z", level: "INFO", event: "local", message: "local" },
      ],
    },
    {
      "vision-interview-project-view": "grid",
      "vision-interview-records": [
        { id: "remote-record", question: "Remote" },
        { id: "shared", question: "Stale remote answer" },
      ],
      "vision-interview-runtime-logs": [
        { id: "remote-log", timestamp: "2026-08-30T02:00:00.000Z", level: "WARN", event: "remote", message: "remote" },
      ],
    },
    { preferLocal: true },
  );

  assert.equal(result["vision-interview-project-view"], "list");
  assert.deepEqual(result["vision-interview-records"].map((item) => item.id), ["local-record", "shared", "remote-record"]);
  assert.equal(result["vision-interview-records"].find((item) => item.id === "shared").question, "New local answer");
  assert.deepEqual(result["vision-interview-runtime-logs"].map((item) => item.id), ["local-log", "remote-log"]);
});

test("mergeBackupData can treat dirty local collections as authoritative so deletions stay deleted", () => {
  const result = mergeBackupData(
    { "vision-interview-projects": [{ id: "keep", name: "Keep" }] },
    { "vision-interview-projects": [{ id: "keep", name: "Old" }, { id: "deleted", name: "Deleted" }] },
    { preferLocal: true, authoritativeCollections: true },
  );
  assert.deepEqual(result["vision-interview-projects"], [{ id: "keep", name: "Keep" }]);
});

test("createCloseBackupPayload sends a compact delta under the beacon budget", () => {
  const oldLogs = Array.from({ length: 1000 }, (_, index) => ({
    id: `old-${index}`,
    timestamp: "2026-08-30T00:00:00.000Z",
    level: "INFO",
    event: "old",
    message: "x".repeat(500),
  }));
  const current = {
    "vision-interview-project-view": "list",
    "vision-interview-runtime-logs": [{
      id: "new-log",
      timestamp: "2026-08-31T00:00:00.000Z",
      level: "INFO",
      event: "close",
      message: "final change",
    }, ...oldLogs],
  };
  const previous = {
    "vision-interview-project-view": "grid",
    "vision-interview-runtime-logs": oldLogs,
  };

  const payload = createCloseBackupPayload(JSON.stringify(previous), JSON.stringify(current));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));

  assert.ok(encoded.byteLength <= 60 * 1024);
  assert.equal(payload.merge, true);
  assert.equal(payload.data["vision-interview-project-view"], "list");
  assert.deepEqual(payload.data["vision-interview-runtime-logs"].map((item) => item.id), ["new-log"]);
});

test("createCloseBackupPayload drops or truncates a single oversized entry instead of exceeding the beacon budget", () => {
  const payload = createCloseBackupPayload("{}", JSON.stringify({
    "vision-interview-records": [{ id: "huge", question: "Q", answer: "x".repeat(100_000) }],
    "vision-interview-ai-preferences": { provider: "custom", note: "y".repeat(100_000) },
  }));
  const bytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  assert.ok(bytes <= 60 * 1024);
  assert.equal(payload.truncated, true);
});

test("createCloseBackupPayload never replaces a GitHub collection with a partial close-time snapshot", () => {
  const previous = Array.from({ length: 101 }, (_, index) => ({ id: `record-${index}`, question: `Q${index}`, answer: "old" }));
  const current = previous.slice(0, 100).map((record) => ({ ...record, answer: "x".repeat(3000) }));
  const payload = createCloseBackupPayload(
    JSON.stringify({ "vision-interview-records": previous }),
    JSON.stringify({ "vision-interview-records": current }),
  );

  assert.ok(new TextEncoder().encode(JSON.stringify(payload)).byteLength <= 60 * 1024);
  assert.equal(payload.data["vision-interview-records"], undefined);
  assert.ok(payload.deferredKeys.includes("vision-interview-records"));
  assert.ok(!payload.replaceKeys.includes("vision-interview-records"));
});

test("createCloseBackupPayload defers an authoritative collection instead of replacing it with field-truncated data", () => {
  const payload = createCloseBackupPayload(
    JSON.stringify({ "vision-interview-projects": [{ id: "project", name: "Old" }] }),
    JSON.stringify({ "vision-interview-projects": [{ id: "project", name: "x".repeat(5000) }] }),
  );

  assert.equal(payload.data["vision-interview-projects"], undefined);
  assert.ok(payload.deferredKeys.includes("vision-interview-projects"));
  assert.ok(!payload.replaceKeys.includes("vision-interview-projects"));
});

test("storage helpers restore GitHub configuration without touching unrelated browser data", () => {
  const storage = createStorage({
    unrelated: "keep-me",
    "vision-interview-project-view": "grid",
  });

  writeBackupToStorage(storage, {
    "vision-interview-project-view": "list",
    "vision-interview-ai-preferences": { provider: "deepseek", apiKey: "discard" },
    unrelated: "replace-me",
  });

  assert.equal(storage.getItem("unrelated"), "keep-me");
  assert.equal(storage.getItem("vision-interview-project-view"), "list");
  assert.deepEqual(readBackupFromStorage(storage), {
    "vision-interview-ai-preferences": { provider: "deepseek" },
    "vision-interview-project-view": "list",
  });
});

test("readBackupFromStorage tolerates blocked browser storage", () => {
  const storage = {
    getItem() { throw new Error("blocked"); },
  };
  assert.deepEqual(readBackupFromStorage(storage), {});
});

test("readBackupFromGitHub decodes and sanitizes the repository archive", async () => {
  const archive = {
    version: 2,
    updatedAt: "2026-08-31T01:03:00.000Z",
    data: {
      "vision-interview-project-view": "grid",
      "vision-interview-ai-provider-settings": {
        custom: { model: "vision-model", apiKey: "do-not-restore" },
      },
    },
  };
  let requestInit;
  const fetchImpl = async (_url, init) => {
    requestInit = init;
    return new Response(JSON.stringify({
      sha: "archive-sha",
      encoding: "base64",
      content: Buffer.from(JSON.stringify(archive), "utf8").toString("base64"),
    }), { status: 200 });
  };

  const result = await readBackupFromGitHub({
    fetchImpl,
    owner: "chiguire1977",
    repo: "vision-interview",
    branch: "main",
    path: "data/vision-interview-data.json",
  });

  assert.deepEqual(result, {
    available: true,
    sha: "archive-sha",
    version: 2,
    updatedAt: "2026-08-31T01:03:00.000Z",
    data: {
      "vision-interview-project-view": "grid",
      "vision-interview-ai-provider-settings": {
        custom: { model: "vision-model" },
      },
    },
  });
  assert.equal(requestInit.headers["User-Agent"], "vision-interview-site");
});

test("readBackupFromGitHub treats a missing archive as an empty available backup", async () => {
  const result = await readBackupFromGitHub({
    fetchImpl: async () => new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }),
    owner: "chiguire1977",
    repo: "vision-interview",
    branch: "main",
    path: "data/vision-interview-data.json",
  });

  assert.deepEqual(result, {
    available: true,
    sha: null,
    version: 2,
    updatedAt: "",
    data: {},
  });
});

test("saveBackupToGitHub refetches the file sha and retries once after a conflict", async () => {
  const requests = [];
  const responses = [
    new Response(JSON.stringify({ sha: "sha-old" }), { status: 200 }),
    new Response(JSON.stringify({ message: "conflict" }), { status: 409 }),
    new Response(JSON.stringify({ sha: "sha-latest" }), { status: 200 }),
    new Response(JSON.stringify({ commit: { sha: "commit-new" } }), { status: 200 }),
  ];
  const fetchImpl = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    return responses.shift();
  };

  const result = await saveBackupToGitHub({
    fetchImpl,
    token: "server-secret",
    owner: "chiguire1977",
    repo: "vision-interview",
    branch: "main",
    path: "data/vision-interview-data.json",
    data: { "vision-interview-project-view": "list" },
    now: "2026-08-31T01:05:00.000Z",
  });

  assert.equal(result.commitSha, "commit-new");
  assert.equal(result.attempts, 2);
  assert.equal(requests.length, 4);
  assert.equal(requests[0].init.method, "GET");
  assert.equal(requests[0].init.headers["User-Agent"], "vision-interview-site");
  assert.equal(requests[1].init.method, "PUT");
  assert.equal(requests[1].init.headers["User-Agent"], "vision-interview-site");
  assert.equal(JSON.parse(requests[1].init.body).sha, "sha-old");
  assert.equal(requests[2].init.method, "GET");
  assert.equal(JSON.parse(requests[3].init.body).sha, "sha-latest");
  assert.match(JSON.parse(requests[3].init.body).message, /^chore\(data\): backup runtime state /);
});

test("saveBackupToGitHub re-merges a close delta after a conflict", async () => {
  const encodeArchive = (archive) => Buffer.from(JSON.stringify(archive), "utf8").toString("base64");
  const responses = [
    new Response(JSON.stringify({
      sha: "sha-old",
      encoding: "base64",
      content: encodeArchive({ version: 2, data: { "vision-interview-records": [{ id: "remote-1", question: "Remote 1" }] } }),
    }), { status: 200 }),
    new Response(JSON.stringify({ message: "conflict" }), { status: 409 }),
    new Response(JSON.stringify({
      sha: "sha-latest",
      encoding: "base64",
      content: encodeArchive({ version: 2, data: { "vision-interview-records": [{ id: "remote-2", question: "Remote 2" }] } }),
    }), { status: 200 }),
    new Response(JSON.stringify({ commit: { sha: "commit-merged" } }), { status: 200 }),
  ];
  const requests = [];
  const fetchImpl = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    return responses.shift();
  };

  await saveBackupToGitHub({
    fetchImpl,
    token: "server-secret",
    owner: "chiguire1977",
    repo: "vision-interview",
    branch: "main",
    path: "data/vision-interview-data.json",
    data: { "vision-interview-records": [{ id: "local", question: "Local" }] },
    merge: true,
    now: "2026-08-31T01:05:00.000Z",
  });

  const uploaded = JSON.parse(requests[3].init.body);
  const archive = JSON.parse(Buffer.from(uploaded.content, "base64").toString("utf8"));
  assert.deepEqual(archive.data["vision-interview-records"].map((item) => item.id), ["local", "remote-2"]);
});
