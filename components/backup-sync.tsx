"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 学习数据自动存档
 *
 * 页面原本把设置和学习记录存在 localStorage，清缓存/换设备就会丢。
 * 这个组件把它镜像到服务端 data/vision-interview-data.json：
 *
 *   启动时  —— 服务端存档比本地新（或本地为空）则拉回本地
 *   运行中  —— 监听数据变化，防抖 1.5s 后回写服务端
 *   离开前  —— 用 sendBeacon 尽力保存最后一次改动
 *
 * 服务端不可用时（例如部署在 Cloudflare Workers）自动退回纯 localStorage，
 * 不影响原有功能。
 */

const KEYS = [
  "vision-interview-records",
  "vision-interview-projects",
  "vision-interview-ai-preferences",
  "vision-interview-ai-provider-settings",
  "vision-interview-project-view",
] as const;

const LAST_SYNC_KEY = "vision-interview-last-sync";
const DEBOUNCE_MS = 1500;
const POLL_MS = 3000;

type Status = "idle" | "loading" | "saving" | "saved" | "offline" | "error";

function readLocal(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of KEYS) {
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    try {
      out[key] = JSON.parse(raw);
    } catch {
      out[key] = raw; // project-view 之类的纯字符串
    }
  }
  return out;
}

function writeLocal(data: Record<string, unknown>) {
  for (const key of KEYS) {
    if (!(key in data)) continue;
    const value = data[key];
    localStorage.setItem(
      key,
      typeof value === "string" ? value : JSON.stringify(value),
    );
  }
}

function countRecords(data: Record<string, unknown>): number {
  const r = data["vision-interview-records"];
  return Array.isArray(r) ? r.length : 0;
}

export function BackupSync() {
  const [status, setStatus] = useState<Status>("loading");
  const [detail, setDetail] = useState<string>("");
  const lastSent = useRef<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabled = useRef(true);

  // ── 启动：拉取服务端存档 ────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/backup", { cache: "no-store" });
        const body = await res.json();
        if (cancelled) return;

        if (!body?.available) {
          enabled.current = false;
          setStatus("offline");
          setDetail("服务端存档不可用，仅使用本地存储");
          return;
        }

        const remote = (body.data ?? {}) as Record<string, unknown>;
        const local = readLocal();
        const remoteCount = countRecords(remote);
        const localCount = countRecords(local);

        // 本地为空、或服务端记录更多 -> 用服务端覆盖本地
        const shouldRestore =
          Object.keys(local).length === 0 || remoteCount > localCount;

        if (shouldRestore && Object.keys(remote).length > 0) {
          writeLocal(remote);
          lastSent.current = JSON.stringify(remote);
          setStatus("saved");
          setDetail(`已恢复 ${remoteCount} 条学习记录，刷新后生效`);
          // 注意：这里绝对不能调用 window.location.reload()。
          // 页面在渲染期间会持续写 localStorage，恢复→reload→再恢复
          // 会形成无限重载循环，表现为「正在准备本题组」永远转圈。
          // 数据已写入 localStorage，用户下次刷新自然生效。
          return;
        }

        lastSent.current = JSON.stringify(local);
        setStatus("saved");
        setDetail(
          body.updatedAt
            ? `存档于 ${new Date(body.updatedAt).toLocaleString("zh-CN")}`
            : "已就绪",
        );
      } catch {
        if (cancelled) return;
        enabled.current = false;
        setStatus("offline");
        setDetail("服务端存档不可用，仅使用本地存储");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── 运行中：轮询本地变化并防抖回写 ──────────────────────
  useEffect(() => {
    if (!enabled.current) return;

    const push = async (snapshot: string) => {
      setStatus("saving");
      try {
        const res = await fetch("/api/backup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: JSON.parse(snapshot) }),
        });
        const body = await res.json();
        if (body?.ok) {
          lastSent.current = snapshot;
          localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
          setStatus("saved");
          setDetail(`已保存 ${new Date().toLocaleTimeString("zh-CN")}`);
        } else {
          setStatus("error");
          setDetail("保存失败");
        }
      } catch {
        setStatus("error");
        setDetail("保存失败");
      }
    };

    const tick = () => {
      const snapshot = JSON.stringify(readLocal());
      if (snapshot === lastSent.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => push(snapshot), DEBOUNCE_MS);
    };

    const interval = setInterval(tick, POLL_MS);
    window.addEventListener("storage", tick);

    // 离开页面前尽力保存
    const flush = () => {
      const snapshot = JSON.stringify(readLocal());
      if (snapshot === lastSent.current) return;
      navigator.sendBeacon?.(
        "/api/backup",
        new Blob([JSON.stringify({ data: JSON.parse(snapshot) })], {
          type: "application/json",
        }),
      );
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", tick);
      window.removeEventListener("pagehide", flush);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const color: Record<Status, string> = {
    idle: "#94a3b8",
    loading: "#94a3b8",
    saving: "#f59e0b",
    saved: "#10b981",
    offline: "#94a3b8",
    error: "#ef4444",
  };

  const label: Record<Status, string> = {
    idle: "存档",
    loading: "读取存档…",
    saving: "保存中…",
    saved: "已存档",
    offline: "仅本地",
    error: "存档异常",
  };

  return (
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
      <span
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: color[status],
          flexShrink: 0,
        }}
      />
      {label[status]}
    </div>
  );
}
