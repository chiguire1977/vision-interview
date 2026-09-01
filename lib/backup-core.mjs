export const RUNTIME_LOG_STORAGE_KEY = "vision-interview-runtime-logs";
export const RUNTIME_SESSION_STORAGE_KEY = "vision-interview-runtime-session";
export const GITHUB_SYNC_SETTINGS_STORAGE_KEY = "vision-interview-github-sync-settings";
export const GITHUB_CONNECTION_SETTINGS_STORAGE_KEY = "vision-interview-github-connection-settings";
export const MAX_RUNTIME_LOGS = 1000;

export const DEFAULT_GITHUB_CONNECTION_SETTINGS = Object.freeze({
  repository: "chiguire1977/vision-interview",
  branch: "main",
});

export const DEFAULT_GITHUB_SYNC_SETTINGS = Object.freeze({
  autoBackup: true,
  syncAiSettings: true,
  syncFavorites: true,
  syncProjects: true,
  syncRuntimeLogs: true,
  syncQuestionBank: true,
});

export const BACKUP_KEYS = [
  "vision-interview-records",
  "vision-interview-favorite-questions",
  "vision-interview-projects",
  "vision-interview-ai-preferences",
  "vision-interview-ai-provider-settings",
  "vision-interview-project-view",
  RUNTIME_LOG_STORAGE_KEY,
  GITHUB_SYNC_SETTINGS_STORAGE_KEY,
  GITHUB_CONNECTION_SETTINGS_STORAGE_KEY,
];

const LOG_LEVELS = new Set(["INFO", "WARN", "ERROR"]);
const LOG_KINDS = new Set(["system", "user"]);
const USER_EVENT_PREFIXES = ["answer.", "training.", "project.", "speech.started"];
const SENSITIVE_KEY = /(?:api.?key|token|secret|password|authorization|credential)/i;
const COLLECTION_KEYS = new Set([
  "vision-interview-records",
  "vision-interview-favorite-questions",
  "vision-interview-projects",
  RUNTIME_LOG_STORAGE_KEY,
]);
const CLOSE_PAYLOAD_LIMIT = 60 * 1024;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeString(value) {
  let result = String(value);
  if (result.includes("://")) {
    result = result.replace(/([a-z][a-z0-9+.-]*:\/\/)([^\s/:@]+):([^\s/@]+)@/gi, "$1[REDACTED]@");
  }
  if (/(?:api[_-]?key|access[_-]?token|client[_-]?secret|token|secret|password|authorization|credential)/i.test(result)) {
    result = result
      .replace(/([?&](?:api[_-]?key|access[_-]?token|client[_-]?secret|token|secret|password|authorization|credential)=)[^&#\s]*/gi, "$1[REDACTED]")
      .replace(/\b(Bearer\s+)[A-Za-z0-9._~+\/-]{8,}/gi, "$1[REDACTED]")
      .replace(/\b(Basic\s+)[A-Za-z0-9+/=]{8,}/gi, "$1[REDACTED]")
      .replace(/\b((?:api[_-]?key|access[_-]?token|client[_-]?secret|token|secret|password|authorization|credential)\s*[:=]\s*)["']?[^\s,;"'}&]{4,}["']?/gi, "$1[REDACTED]");
  }
  if (/(?:github_pat_|gh[pousr]_|sk-)/.test(result)) {
    result = result.replace(/\b(?:github_pat_|gh[pousr]_|sk-)[A-Za-z0-9_-]{8,}/g, "[REDACTED]");
  }
  return result;
}

function sanitizeValue(value) {
  if (typeof value === "string") return sanitizeString(value);
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeValue(item))
      .filter((item) => item !== undefined);
  }
  if (!isPlainObject(value)) return undefined;

  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) continue;
    const sanitized = sanitizeValue(item);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  return result;
}

export function runtimeLogKindForEvent(event) {
  return USER_EVENT_PREFIXES.some((prefix) => String(event || "").startsWith(prefix)) ? "user" : "system";
}

function clip(value, length) {
  return sanitizeString(String(value ?? "")).trim().slice(0, length);
}

function normalizeRuntimeLog(value) {
  if (!isPlainObject(value)) return null;
  const id = clip(value.id, 120);
  const timestamp = clip(value.timestamp, 64);
  const event = clip(value.event, 120);
  const message = clip(value.message, 1200);
  if (!id || !timestamp || !event || !message) return null;

  const level = LOG_LEVELS.has(value.level) ? value.level : "INFO";
  const kind = LOG_KINDS.has(value.kind) ? value.kind : runtimeLogKindForEvent(event);
  const sessionId = clip(value.sessionId, 120);
  const context = sanitizeValue(value.context);
  return {
    id,
    timestamp,
    level,
    kind,
    ...(sessionId ? { sessionId } : {}),
    event,
    message,
    ...(isPlainObject(context) && Object.keys(context).length ? { context } : {}),
  };
}

export function startRuntimeSession(storage, startedAt = new Date().toISOString(), id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`) {
  const session = { id: clip(id, 120), startedAt: clip(startedAt, 64) };
  storage.setItem(RUNTIME_SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function normalizeRuntimeLogs(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeRuntimeLog(item))
    .filter(Boolean)
    .slice(0, MAX_RUNTIME_LOGS);
}

export function sanitizeBackupData(value) {
  if (!isPlainObject(value)) return {};
  const result = {};
  for (const key of BACKUP_KEYS) {
    if (!(key in value)) continue;
    if (key === RUNTIME_LOG_STORAGE_KEY) {
      result[key] = normalizeRuntimeLogs(value[key]);
      continue;
    }
    if (key === GITHUB_CONNECTION_SETTINGS_STORAGE_KEY) {
      result[key] = normalizeGitHubConnectionSettings(value[key]);
      continue;
    }
    const sanitized = sanitizeValue(value[key]);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  return result;
}

function normalizedRepository(value) {
  let candidate = String(value ?? "").trim();
  if (!candidate) return "";
  try {
    if (/^https?:\/\//i.test(candidate)) candidate = new URL(candidate).pathname;
  } catch {
    return "";
  }
  candidate = candidate.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "");
  return /^[A-Za-z0-9_.-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/.test(candidate) ? candidate : "";
}

function normalizedBranch(value) {
  const candidate = String(value ?? "").trim().replace(/^\/+|\/+$/g, "");
  return /^[A-Za-z0-9._/-]{1,200}$/.test(candidate) && !candidate.includes("..") ? candidate : "";
}

export function normalizeGitHubConnectionSettings(value, fallback = DEFAULT_GITHUB_CONNECTION_SETTINGS) {
  const source = isPlainObject(value) ? value : {};
  const safeFallback = {
    repository: normalizedRepository(fallback?.repository) || DEFAULT_GITHUB_CONNECTION_SETTINGS.repository,
    branch: normalizedBranch(fallback?.branch) || DEFAULT_GITHUB_CONNECTION_SETTINGS.branch,
  };
  return {
    repository: normalizedRepository(source.repository) || safeFallback.repository,
    branch: normalizedBranch(source.branch) || safeFallback.branch,
  };
}

export function readGitHubConnectionSettings(storage) {
  try {
    return normalizeGitHubConnectionSettings(JSON.parse(storage.getItem(GITHUB_CONNECTION_SETTINGS_STORAGE_KEY) || "{}"));
  } catch {
    return { ...DEFAULT_GITHUB_CONNECTION_SETTINGS };
  }
}

export function githubApiUrl(path, connection = DEFAULT_GITHUB_CONNECTION_SETTINGS) {
  const normalized = normalizeGitHubConnectionSettings(connection);
  const separator = String(path).includes("?") ? "&" : "?";
  return `${path}${separator}repository=${encodeURIComponent(normalized.repository)}&branch=${encodeURIComponent(normalized.branch)}`;
}

export function normalizeGitHubSyncSettings(value) {
  const source = isPlainObject(value) ? value : {};
  return Object.fromEntries(Object.keys(DEFAULT_GITHUB_SYNC_SETTINGS).map((key) => [
    key,
    typeof source[key] === "boolean" ? source[key] : DEFAULT_GITHUB_SYNC_SETTINGS[key],
  ]));
}

export function readGitHubSyncSettings(storage) {
  try {
    return normalizeGitHubSyncSettings(JSON.parse(storage.getItem(GITHUB_SYNC_SETTINGS_STORAGE_KEY) || "{}"));
  } catch {
    return { ...DEFAULT_GITHUB_SYNC_SETTINGS };
  }
}

export function createAutoBackupSnapshot(value) {
  const snapshot = sanitizeBackupData(value);
  delete snapshot["vision-interview-records"];
  return snapshot;
}

export function createScopedAutoBackupSnapshot(value, settings = DEFAULT_GITHUB_SYNC_SETTINGS) {
  const snapshot = createAutoBackupSnapshot(value);
  const normalized = normalizeGitHubSyncSettings(settings);
  if (!normalized.syncAiSettings) {
    delete snapshot["vision-interview-ai-preferences"];
    delete snapshot["vision-interview-ai-provider-settings"];
  }
  if (!normalized.syncFavorites) delete snapshot["vision-interview-favorite-questions"];
  if (!normalized.syncProjects) {
    delete snapshot["vision-interview-projects"];
    delete snapshot["vision-interview-project-view"];
  }
  if (!normalized.syncRuntimeLogs) delete snapshot[RUNTIME_LOG_STORAGE_KEY];
  return snapshot;
}

export function createRecordsUploadPayload(records) {
  const data = sanitizeBackupData({ "vision-interview-records": records });
  return {
    data,
    merge: true,
    replaceKeys: ["vision-interview-records"],
  };
}

export function appendRuntimeLog(storage, entry, timestamp = new Date().toISOString(), id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`) {
  let previous = [];
  try {
    previous = normalizeRuntimeLogs(JSON.parse(storage.getItem(RUNTIME_LOG_STORAGE_KEY) || "[]"));
  } catch {
    previous = [];
  }

  const created = normalizeRuntimeLog({
    id,
    timestamp,
    level: entry?.level,
    kind: entry?.kind,
    sessionId: entry?.sessionId,
    event: entry?.event,
    message: entry?.message,
    context: entry?.context,
  });
  if (!created) throw new Error("运行日志缺少 event 或 message。");

  storage.setItem(
    RUNTIME_LOG_STORAGE_KEY,
    JSON.stringify([created, ...previous].slice(0, MAX_RUNTIME_LOGS)),
  );
  return created;
}

export function filterRuntimeLogs(value, level = "ALL", kind = "ALL") {
  const logs = normalizeRuntimeLogs(value);
  return logs.filter((log) => (level === "ALL" || log.level === level) && (kind === "ALL" || log.kind === kind));
}

export function filterRuntimeLogsBySession(value, sessionId) {
  const normalizedSessionId = clip(sessionId, 120);
  if (!normalizedSessionId) return [];
  return normalizeRuntimeLogs(value).filter((log) => log.sessionId === normalizedSessionId);
}

export function clearRuntimeLogs(storage) {
  storage.setItem(RUNTIME_LOG_STORAGE_KEY, "[]");
}

function collectionIdentity(key, value, index) {
  if (!isPlainObject(value)) return `${key}:${index}:${JSON.stringify(value)}`;
  if (typeof value.id === "string" && value.id) return value.id;
  if (key === "vision-interview-projects") return String(value.name || index);
  if (key === "vision-interview-records") {
    return [value.question, value.timestamp || value.date, value.action, value.project].map((item) => String(item || "")).join("|") || String(index);
  }
  if (key === "vision-interview-favorite-questions") {
    return [value.source, value.title || value.question].map((item) => String(item || "").trim().toLocaleLowerCase().replace(/\s+/g, "")).join("|") || String(index);
  }
  return `${key}:${index}:${JSON.stringify(value)}`;
}

function mergeCollection(key, preferredValue, secondaryValue, preferredHasKey) {
  const preferred = Array.isArray(preferredValue) ? preferredValue : [];
  const secondary = Array.isArray(secondaryValue) ? secondaryValue : [];
  if (preferredHasKey && preferred.length === 0) return [];

  const merged = new Map();
  secondary.forEach((item, index) => merged.set(collectionIdentity(key, item, index), item));
  preferred.forEach((item, index) => merged.set(collectionIdentity(key, item, index), item));
  const order = [];
  const seen = new Set();
  [...preferred, ...secondary].forEach((item, index) => {
    const identity = collectionIdentity(key, item, index);
    if (seen.has(identity)) return;
    seen.add(identity);
    order.push(identity);
  });
  const result = order.map((identity) => merged.get(identity));
  if (key === RUNTIME_LOG_STORAGE_KEY) {
    return normalizeRuntimeLogs(result)
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, MAX_RUNTIME_LOGS);
  }
  return result;
}

function mergeObjects(secondary, preferred) {
  if (!isPlainObject(secondary)) return preferred;
  if (!isPlainObject(preferred)) return preferred;
  const result = { ...secondary };
  for (const [key, value] of Object.entries(preferred)) {
    result[key] = isPlainObject(value) && isPlainObject(result[key])
      ? mergeObjects(result[key], value)
      : value;
  }
  return result;
}

export function mergeBackupData(localData, githubData, options = {}) {
  const local = sanitizeBackupData(localData);
  const github = sanitizeBackupData(githubData);
  const preferred = options.preferLocal ? local : github;
  const secondary = options.preferLocal ? github : local;
  const replaceKeys = new Set(Array.isArray(options.replaceKeys) ? options.replaceKeys : []);
  const result = {};

  for (const key of BACKUP_KEYS) {
    const preferredHasKey = Object.prototype.hasOwnProperty.call(preferred, key);
    const secondaryHasKey = Object.prototype.hasOwnProperty.call(secondary, key);
    if (!preferredHasKey && !secondaryHasKey) continue;
    if (COLLECTION_KEYS.has(key)) {
      result[key] = options.authoritativeCollections && preferredHasKey
        ? (key === RUNTIME_LOG_STORAGE_KEY ? normalizeRuntimeLogs(preferred[key]) : preferred[key])
        : mergeCollection(key, preferred[key], secondary[key], preferredHasKey);
    } else if (preferredHasKey && replaceKeys.has(key)) {
      result[key] = preferred[key];
    } else if (preferredHasKey) {
      result[key] = isPlainObject(preferred[key])
        ? mergeObjects(secondary[key], preferred[key])
        : preferred[key];
    } else {
      result[key] = secondary[key];
    }
  }
  return sanitizeBackupData(result);
}

export function readBackupFromStorage(storage) {
  const result = {};
  for (const key of BACKUP_KEYS) {
    let raw;
    try {
      raw = storage.getItem(key);
    } catch {
      continue;
    }
    if (raw === null) continue;
    try {
      result[key] = JSON.parse(raw);
    } catch {
      result[key] = raw;
    }
  }
  return sanitizeBackupData(result);
}

function parseSnapshot(value) {
  if (isPlainObject(value)) return sanitizeBackupData(value);
  try {
    return sanitizeBackupData(JSON.parse(String(value || "{}")));
  } catch {
    return {};
  }
}

function entryMap(key, values) {
  const map = new Map();
  if (!Array.isArray(values)) return map;
  values.forEach((item, index) => map.set(collectionIdentity(key, item, index), JSON.stringify(item)));
  return map;
}

function compactCloseValue(value, state) {
  if (typeof value === "string") {
    if (value.length <= 2048) return value;
    state.truncated = true;
    return `${value.slice(0, 2045)}…`;
  }
  if (Array.isArray(value)) return value.map((item) => compactCloseValue(item, state));
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, compactCloseValue(item, state)]));
}

export function createCloseBackupPayload(previousSnapshot, currentSnapshot, maxBytes = CLOSE_PAYLOAD_LIMIT) {
  const previous = parseSnapshot(previousSnapshot);
  const current = parseSnapshot(currentSnapshot);
  const data = {};
  const replaceKeys = [];
  const state = { truncated: false };
  const deferredKeys = [];

  for (const key of BACKUP_KEYS) {
    if (JSON.stringify(previous[key]) === JSON.stringify(current[key])) continue;
    if (!Object.prototype.hasOwnProperty.call(current, key)) continue;
    const keyState = { truncated: false };
    if (key === "vision-interview-records" || key === RUNTIME_LOG_STORAGE_KEY) {
      const values = Array.isArray(current[key]) ? current[key] : [];
      if (!values.length) {
        data[key] = [];
        replaceKeys.push(key);
        continue;
      }
      const before = entryMap(key, previous[key]);
      const currentIds = new Set(values.map((value, index) => collectionIdentity(key, value, index)));
      const removed = key === "vision-interview-records" && Array.isArray(previous[key])
        && previous[key].some((item, index) => !currentIds.has(collectionIdentity(key, item, index)));
      if (removed) {
        const compacted = compactCloseValue(values, keyState);
        if (keyState.truncated) {
          deferredKeys.push(key);
          state.truncated = true;
          continue;
        }
        data[key] = compacted;
        replaceKeys.push(key);
      } else {
        const compacted = compactCloseValue(
          values.filter((item, index) => before.get(collectionIdentity(key, item, index)) !== JSON.stringify(item)),
          keyState,
        );
        if (keyState.truncated) {
          deferredKeys.push(key);
          state.truncated = true;
          continue;
        }
        data[key] = compacted;
      }
      continue;
    }
    const compacted = compactCloseValue(current[key], keyState);
    if (keyState.truncated) {
      deferredKeys.push(key);
      state.truncated = true;
      continue;
    }
    data[key] = compacted;
    if (key === "vision-interview-projects" || key === "vision-interview-ai-provider-settings") replaceKeys.push(key);
  }

  const deferredEntries = {};
  const payload = { data, merge: true, replaceKeys, truncated: state.truncated, deferredKeys, deferredEntries };
  const size = () => new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  for (const key of [RUNTIME_LOG_STORAGE_KEY, "vision-interview-records", "vision-interview-projects"]) {
    if (Array.isArray(data[key]) && replaceKeys.includes(key) && size() > maxBytes) {
      delete data[key];
      replaceKeys.splice(replaceKeys.indexOf(key), 1);
      deferredKeys.push(key);
      payload.truncated = true;
      continue;
    }
    const originalLength = Array.isArray(data[key]) ? data[key].length : 0;
    while (Array.isArray(data[key]) && data[key].length > 0 && size() > maxBytes) {
      data[key].pop();
      payload.truncated = true;
    }
    if (Array.isArray(data[key]) && data[key].length < originalLength) {
      deferredEntries[key] = originalLength - data[key].length;
    }
  }
  if (size() > maxBytes) {
    for (const key of BACKUP_KEYS) {
      if (key === RUNTIME_LOG_STORAGE_KEY || key === "vision-interview-records") continue;
      if (size() <= maxBytes) break;
      delete data[key];
      const replaceIndex = replaceKeys.indexOf(key);
      if (replaceIndex >= 0) replaceKeys.splice(replaceIndex, 1);
      deferredKeys.push(key);
      payload.truncated = true;
    }
  }
  if (!deferredKeys.length) delete payload.deferredKeys;
  if (!Object.keys(deferredEntries).length) delete payload.deferredEntries;
  return payload;
}

export function writeBackupToStorage(storage, data) {
  const sanitized = sanitizeBackupData(data);
  for (const [key, value] of Object.entries(sanitized)) {
    storage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  return sanitized;
}

function contentsUrl({ owner, repo, path, branch }) {
  const encodedPath = String(path)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
}

function githubHeaders(token, includeJson = false) {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "vision-interview-site",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
  };
}

function decodeBase64Utf8(content) {
  const binary = atob(String(content).replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(content) {
  const bytes = new TextEncoder().encode(content);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function readGitHubFile({ fetchImpl, token, owner, repo, branch, path }) {
  const response = await fetchImpl(contentsUrl({ owner, repo, branch, path }), {
    method: "GET",
    headers: githubHeaders(token),
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub 读取失败（HTTP ${response.status}）：${detail.slice(0, 240)}`);
  }
  return response.json();
}

export async function readBackupFromGitHub(options) {
  const file = await readGitHubFile(options);
  if (!file) {
    return { available: true, sha: null, version: 2, updatedAt: "", data: {} };
  }

  const archive = parseArchiveFile(file);
  return {
    available: true,
    sha: typeof file.sha === "string" ? file.sha : null,
    version: typeof archive?.version === "number" ? archive.version : 2,
    updatedAt: typeof archive?.updatedAt === "string" ? archive.updatedAt : "",
    data: sanitizeBackupData(archive?.data),
  };
}

function parseArchiveFile(file) {
  if (!file || file.encoding !== "base64" || typeof file.content !== "string") return {};
  try {
    return JSON.parse(decodeBase64Utf8(file.content));
  } catch {
    return {};
  }
}

export async function saveBackupToGitHub(options) {
  const { fetchImpl, token, owner, repo, branch, path, now = new Date().toISOString() } = options;
  if (!token) throw new Error("未配置 GitHub 备份凭据。");

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const current = await readGitHubFile({ fetchImpl, token, owner, repo, branch, path });
    const remoteArchive = parseArchiveFile(current);
    let data = options.merge
      ? mergeBackupData(options.data, remoteArchive?.data, {
        preferLocal: true,
        replaceKeys: options.replaceKeys,
      })
      : sanitizeBackupData(options.data);
    for (const key of Array.isArray(options.replaceKeys) ? options.replaceKeys : []) {
      if (!BACKUP_KEYS.includes(key) || !Object.prototype.hasOwnProperty.call(options.data || {}, key)) continue;
      const exact = sanitizeBackupData({ [key]: options.data[key] });
      if (Object.prototype.hasOwnProperty.call(exact, key)) data[key] = exact[key];
    }
    data = sanitizeBackupData(data);
    const archive = { version: 2, updatedAt: now, data };
    const content = encodeBase64Utf8(`${JSON.stringify(archive, null, 2)}\n`);
    const body = {
      message: `chore(data): backup runtime state ${now}`,
      content,
      branch,
      ...(current?.sha ? { sha: current.sha } : {}),
    };
    const response = await fetchImpl(contentsUrl({ owner, repo, branch, path }), {
      method: "PUT",
      headers: githubHeaders(token, true),
      body: JSON.stringify(body),
    });
    if (response.ok) {
      const payload = await response.json();
      return {
        attempts: attempt,
        commitSha: payload?.commit?.sha ?? null,
        updatedAt: now,
        saved: Object.keys(data),
      };
    }
    if (attempt === 1 && (response.status === 409 || response.status === 422)) continue;
    const detail = await response.text();
    throw new Error(`GitHub 备份失败（HTTP ${response.status}）：${detail.slice(0, 240)}`);
  }
  throw new Error("GitHub 备份冲突。");
}
