"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  appendRuntimeLog,
  createCloseBackupPayload,
  mergeBackupData,
  readBackupFromStorage,
  writeBackupToStorage,
} from "../lib/backup-core.mjs";

const LAST_SYNC_KEY = "vision-interview-last-sync";
const LAST_SYNC_SNAPSHOT_KEY = "vision-interview-last-sync-snapshot";
const CLOSE_DEFERRED_KEY = "vision-interview-close-backup-deferred";
const DEBOUNCE_MS = 2_000;
const POLL_MS = 1_000;
const STARTUP_TIMEOUT_MS = 8_000;

type Status = "loading" | "saving" | "saved" | "offline" | "error";

function snapshotLocal() {
  return JSON.stringify(readBackupFromStorage(localStorage));
}

function recordLog(level: "INFO" | "WARN" | "ERROR", event: string, message: string, context?: Record<string, unknown>) {
  try {
    appendRuntimeLog(localStorage, { level, event, message, context });
    window.dispatchEvent(new Event("vision-interview-runtime-log-updated"));
  } catch {
    // 浏览器禁用存储时不影响主流程。
  }
}

export function BackupSync({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [detail, setDetail] = useState("正在从 GitHub 加载配置");
  const lastSent = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabled = useRef(true);
  const saving = useRef(false);
  const lastFlushAt = useRef(0);
  const lastError = useRef("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const local = readBackupFromStorage(localStorage);
      const localSnapshot = JSON.stringify(local);
      let lastSyncedSnapshot = "";
      try {
        lastSyncedSnapshot = localStorage.getItem(LAST_SYNC_SNAPSHOT_KEY) || "";
      } catch {
        lastSyncedSnapshot = "";
      }
      const localDirty = lastSyncedSnapshot
        ? lastSyncedSnapshot !== localSnapshot
        : Object.keys(local).length > 0;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), STARTUP_TIMEOUT_MS);
      try {
        const response = await fetch("/api/backup", { cache: "no-store", signal: controller.signal });
        const body = await response.json() as {
          ok?: boolean;
          available?: boolean;
          updatedAt?: string;
          data?: Record<string, unknown>;
          reason?: string;
        };
        if (cancelled) return;

        if (!response.ok || !body.ok || !body.available) {
          lastSent.current = localSnapshot;
          setStatus("offline");
          setDetail(body.reason || "GitHub 配置暂不可用，继续使用本地数据");
          recordLog("WARN", "backup.startup.offline", "启动时未能读取 GitHub 配置", {
            status: response.status,
            reason: body.reason || "unavailable",
          });
          return;
        }

        const merged = mergeBackupData(local, body.data ?? {}, {
          preferLocal: localDirty,
          authoritativeCollections: localDirty,
        });
        writeBackupToStorage(localStorage, merged);
        lastSent.current = localDirty ? JSON.stringify(body.data ?? {}) : JSON.stringify(merged);
        if (!localDirty) {
          try { localStorage.setItem(LAST_SYNC_SNAPSHOT_KEY, JSON.stringify(merged)); } catch { /* 本地存储不可用 */ }
        }
        setStatus("saved");
        setDetail(body.updatedAt
          ? `已加载 GitHub 配置：${new Date(body.updatedAt).toLocaleString("zh-CN")}`
          : "GitHub 暂无存档，已使用本地配置");
        recordLog("INFO", "backup.startup.loaded", "启动配置加载完成", {
          source: Object.keys(body.data ?? {}).length ? "github" : "local",
          updatedAt: body.updatedAt || null,
        });
        try {
          const deferred = localStorage.getItem(CLOSE_DEFERRED_KEY);
          if (deferred) {
            recordLog("WARN", "backup.close.deferred", "上次关闭时部分超大数据已延期，将由本次自动备份补交", {
              detail: JSON.parse(deferred),
            });
            localStorage.removeItem(CLOSE_DEFERRED_KEY);
          }
        } catch { /* 本地存储不可用 */ }
      } catch (error) {
        if (cancelled) return;
        lastSent.current = localSnapshot;
        setStatus("offline");
        setDetail(error instanceof DOMException && error.name === "AbortError"
          ? "GitHub 配置读取超时，继续使用本地数据"
          : "GitHub 配置读取失败，继续使用本地数据");
        recordLog("ERROR", "backup.startup.failed", "启动配置加载失败", {
          error: error instanceof Error ? error.message : "unknown",
        });
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) setInitialized(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialized || !enabled.current) return;

    const push = async (reason: "change" | "manual") => {
      if (!enabled.current || saving.current) return;
      const snapshot = snapshotLocal();
      if (snapshot === lastSent.current) return;
      saving.current = true;
      let changedDuringSave = false;
      setStatus("saving");
      setDetail(reason === "change" ? "正在备份运行数据到 GitHub" : "正在备份关闭前数据");
      try {
        const response = await fetch("/api/backup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: JSON.parse(snapshot),
            merge: true,
            replaceKeys: ["vision-interview-projects", "vision-interview-records"],
          }),
        });
        const body = await response.json() as {
          ok?: boolean;
          available?: boolean;
          updatedAt?: string;
          reason?: string;
          commitSha?: string | null;
        };
        if (!response.ok || !body.ok) {
          const message = body.reason || `HTTP ${response.status}`;
          if (body.available === false) enabled.current = false;
          setStatus(body.available === false ? "offline" : "error");
          setDetail(body.available === false ? "GitHub 自动备份尚未配置" : `备份失败：${message}`);
          if (lastError.current !== message) {
            lastError.current = message;
            recordLog("ERROR", "backup.push.failed", "运行数据备份失败", {
              status: response.status,
              reason: message,
            });
          }
          return;
        }

        lastError.current = "";
        const currentBeforeLog = snapshotLocal();
        changedDuringSave = currentBeforeLog !== snapshot;
        localStorage.setItem(LAST_SYNC_KEY, body.updatedAt || new Date().toISOString());
        recordLog("INFO", "backup.push.saved", "运行数据已备份到 GitHub", {
          reason,
          commit: body.commitSha ? String(body.commitSha).slice(0, 12) : null,
        });
        lastSent.current = changedDuringSave ? snapshot : snapshotLocal();
        localStorage.setItem(LAST_SYNC_SNAPSHOT_KEY, lastSent.current);
        setStatus("saved");
        setDetail(`已备份到 GitHub：${new Date().toLocaleTimeString("zh-CN")}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown";
        setStatus("error");
        setDetail("GitHub 备份请求失败，将在下次变化时重试");
        if (lastError.current !== message) {
          lastError.current = message;
          recordLog("ERROR", "backup.push.failed", "运行数据备份请求失败", { error: message });
        }
      } finally {
        saving.current = false;
        if (changedDuringSave && enabled.current) {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            timer.current = null;
            void push("change");
          }, 0);
        }
      }
    };

    const tick = () => {
      if (!enabled.current || snapshotLocal() === lastSent.current || timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        void push("change");
      }, DEBOUNCE_MS);
    };

    const flush = () => {
      if (!enabled.current) return;
      const now = Date.now();
      if (now - lastFlushAt.current < 1000) return;
      lastFlushAt.current = now;
      recordLog("INFO", "backup.close.flush", "页面关闭或进入后台，提交最后一次备份");
      const snapshot = snapshotLocal();
      if (snapshot === lastSent.current) return;
      const closePayload = createCloseBackupPayload(lastSent.current, snapshot);
      if (closePayload.truncated) {
        try {
          localStorage.setItem(CLOSE_DEFERRED_KEY, JSON.stringify({
            keys: closePayload.deferredKeys ?? [],
            entries: closePayload.deferredEntries ?? {},
          }));
        } catch { /* 本地存储不可用 */ }
      }
      if (!Object.keys(closePayload.data).length) return;
      const payload = JSON.stringify(closePayload);
      const accepted = navigator.sendBeacon?.(
        "/api/backup",
        new Blob([payload], { type: "application/json" }),
      );
      if (!accepted) {
        void fetch("/api/backup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => undefined);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };

    const interval = window.setInterval(tick, POLL_MS);
    window.addEventListener("storage", tick);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", tick);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [initialized]);

  if (!initialized) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f2f5f8] text-sm text-slate-600">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <span className="size-2 animate-pulse rounded-full bg-blue-500" />
          正在从 GitHub 加载配置…
        </div>
      </div>
    );
  }

  const color: Record<Status, string> = {
    loading: "#94a3b8",
    saving: "#f59e0b",
    saved: "#10b981",
    offline: "#94a3b8",
    error: "#ef4444",
  };

  const label: Record<Status, string> = {
    loading: "读取配置…",
    saving: "备份中…",
    saved: "GitHub 已备份",
    offline: "仅本地",
    error: "备份异常",
  };

  return (
    <>
      {children}
      <div
        title={detail}
        style={{
          position: "fixed",
          right: "12px",
          bottom: "12px",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "5px 10px",
          borderRadius: "999px",
          fontSize: "12px",
          lineHeight: 1,
          color: "#e2e8f0",
          background: "rgba(15,23,42,.82)",
          border: "1px solid rgba(148,163,184,.28)",
          backdropFilter: "blur(6px)",
          pointerEvents: "auto",
          userSelect: "none",
        }}
      >
        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: color[status], flexShrink: 0 }} />
        {label[status]}
      </div>
    </>
  );
}
