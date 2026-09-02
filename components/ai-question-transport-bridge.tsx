"use client";

import { useEffect, useState } from "react";
import {
  countCompleteStreamedQuestions,
  createKnowledgeCoverageState,
  filterGeneratedQuestionContent,
  filterHighQualityWebResearchSources,
  isQuestionGenerationPayload,
} from "@/lib/ai-question-quality.mjs";
import {
  combineAbortSignals,
  createQuestionPreparationAbortManager,
} from "@/lib/question-preparation-cancel.mjs";

type StreamProgress = {
  phase: "searching" | "streaming" | "validating";
  candidateCount: number;
  acceptedCount: number;
  knowledgeCount: number;
};

let coverageState = createKnowledgeCoverageState();
let activeGenerationRequests = 0;
let lastGenerationActivity = 0;
let completedCandidateCount = 0;
let acceptedQuestionCount = 0;
const activeCandidateCounts = new Map<symbol, number>();
const preparationAbortManager = createQuestionPreparationAbortManager();
const SESSION_IDLE_RESET_MS = 120000;

function resetCoverageSession() {
  if (activeGenerationRequests > 0) return;
  coverageState = createKnowledgeCoverageState();
  completedCandidateCount = 0;
  acceptedQuestionCount = 0;
  activeCandidateCounts.clear();
  lastGenerationActivity = Date.now();
}

function dispatchProgress(phase: StreamProgress["phase"]) {
  if (typeof window === "undefined") return;
  const activeCandidates = [...activeCandidateCounts.values()].reduce((sum, value) => sum + value, 0);
  window.dispatchEvent(new CustomEvent<StreamProgress>("vision-interview-ai-stream-progress", {
    detail: {
      phase,
      candidateCount: completedCandidateCount + activeCandidates,
      acceptedCount: acceptedQuestionCount,
      knowledgeCount: coverageState.knowledge.size,
    },
  }));
}

function beginGenerationRequest() {
  const now = Date.now();
  if (activeGenerationRequests === 0 && now - lastGenerationActivity > SESSION_IDLE_RESET_MS) resetCoverageSession();
  const requestId = Symbol("ai-question-stream");
  activeGenerationRequests += 1;
  lastGenerationActivity = now;
  activeCandidateCounts.set(requestId, 0);
  dispatchProgress("streaming");
  return requestId;
}

function updateGenerationRequest(requestId: symbol, content: string) {
  const count = countCompleteStreamedQuestions(content);
  if (count <= (activeCandidateCounts.get(requestId) ?? 0)) return;
  activeCandidateCounts.set(requestId, count);
  lastGenerationActivity = Date.now();
  dispatchProgress("streaming");
}

function finishGenerationRequest(requestId: symbol, acceptedCount: number) {
  completedCandidateCount += activeCandidateCounts.get(requestId) ?? 0;
  activeCandidateCounts.delete(requestId);
  acceptedQuestionCount += acceptedCount;
  activeGenerationRequests = Math.max(0, activeGenerationRequests - 1);
  lastGenerationActivity = Date.now();
  dispatchProgress(activeGenerationRequests > 0 ? "streaming" : "validating");
}

function responseWithJson(response: Response, payload: unknown) {
  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(payload), { status: response.status, statusText: response.statusText, headers });
}

function requestSignal(input: RequestInfo | URL, init?: RequestInit) {
  const inheritedSignal = typeof Request !== "undefined" && input instanceof Request ? input.signal : undefined;
  return combineAbortSignals(inheritedSignal, init?.signal, preparationAbortManager.begin());
}

async function consumeSse(response: Response, onContent: (content: string) => void) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let reasoningContent = "";

  const consumeEvent = (eventText: string) => {
    for (const rawLine of eventText.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const payload = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: unknown; reasoning_content?: unknown } }>;
        };
        const delta = payload.choices?.[0]?.delta;
        if (typeof delta?.content === "string" && delta.content) {
          content += delta.content;
          onContent(content);
        }
        if (typeof delta?.reasoning_content === "string" && delta.reasoning_content) reasoningContent += delta.reasoning_content;
      } catch {
        // Ignore provider heartbeats and non-JSON SSE events.
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";
    for (const eventText of events) consumeEvent(eventText);
    if (done) break;
  }
  if (buffer.trim()) consumeEvent(buffer);
  return content.trim() ? content : reasoningContent;
}

export function AiQuestionTransportBridge() {
  const [progress, setProgress] = useState<StreamProgress | null>(null);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent<StreamProgress>).detail;
      if (!detail) return;
      if (hideTimer) clearTimeout(hideTimer);
      setProgress(detail);
      if (detail.phase === "validating") {
        hideTimer = setTimeout(() => {
          setProgress(null);
          if (activeGenerationRequests === 0) preparationAbortManager.reset();
        }, 1800);
      }
    };
    window.addEventListener("vision-interview-ai-stream-progress", onProgress);

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      let pathname = "";
      try { pathname = new URL(rawUrl, window.location.origin).pathname; } catch { pathname = rawUrl; }

      if (pathname === "/api/web-search") {
        if (activeGenerationRequests === 0 && typeof init?.body === "string") {
          try {
            const searchPayload = JSON.parse(init.body) as { excludedTitles?: unknown };
            if (Array.isArray(searchPayload.excludedTitles) && searchPayload.excludedTitles.length === 0) {
              resetCoverageSession();
              preparationAbortManager.reset();
            }
          } catch {
            // Search payload is optional for quality filtering.
          }
        }
        dispatchProgress("searching");
        const response = await originalFetch(input, { ...init, signal: requestSignal(input, init) });
        if (!response.ok) return response;
        try {
          const payload = await response.clone().json() as { sources?: unknown[] } & Record<string, unknown>;
          if (!Array.isArray(payload.sources)) return response;
          return responseWithJson(response, {
            ...payload,
            sources: filterHighQualityWebResearchSources(payload.sources, { maxSources: 8, maxPerDomain: 2 }),
          });
        } catch {
          return response;
        }
      }

      if (pathname !== "/api/ai/chat" || typeof init?.body !== "string") return originalFetch(input, init);
      let payload: Record<string, unknown>;
      try { payload = JSON.parse(init.body) as Record<string, unknown>; } catch { return originalFetch(input, init); }
      if (!isQuestionGenerationPayload(payload)) return originalFetch(input, init);

      const requestId = beginGenerationRequest();
      try {
        const requestHeaders = new Headers(init.headers);
        requestHeaders.set("Content-Type", "application/json");
        const response = await originalFetch(input, {
          ...init,
          headers: requestHeaders,
          signal: requestSignal(input, init),
          body: JSON.stringify({ ...payload, stream: true }),
        });
        const contentType = (response.headers.get("content-type") || "").toLowerCase();

        if (contentType.includes("text/event-stream")) {
          const content = await consumeSse(response, (partial) => updateGenerationRequest(requestId, partial));
          if (!response.ok || !content.trim()) {
            finishGenerationRequest(requestId, 0);
            return Response.json({ ok: false, message: `AI 流式请求失败（HTTP ${response.status}）。` }, { status: response.ok ? 502 : response.status });
          }
          const filtered = filterGeneratedQuestionContent(content, coverageState);
          finishGenerationRequest(requestId, filtered.acceptedCount);
          return Response.json({ ok: true, content: filtered.content }, { headers: { "Cache-Control": "no-store" } });
        }

        try {
          const json = await response.clone().json() as { ok?: boolean; content?: unknown } & Record<string, unknown>;
          if (response.ok && json.ok && typeof json.content === "string") {
            activeCandidateCounts.set(requestId, countCompleteStreamedQuestions(json.content));
            const filtered = filterGeneratedQuestionContent(json.content, coverageState);
            finishGenerationRequest(requestId, filtered.acceptedCount);
            return responseWithJson(response, { ...json, content: filtered.content });
          }
        } catch {
          // Keep the original provider response when it is not JSON.
        }
        finishGenerationRequest(requestId, 0);
        return response;
      } catch (error) {
        finishGenerationRequest(requestId, 0);
        throw error;
      }
    };

    return () => {
      if (hideTimer) clearTimeout(hideTimer);
      preparationAbortManager.abort("题组准备组件已卸载");
      preparationAbortManager.reset();
      window.removeEventListener("vision-interview-ai-stream-progress", onProgress);
      window.fetch = originalFetch;
    };
  }, []);

  const cancelPreparation = () => {
    if (!preparationAbortManager.abort("用户中断题组准备")) return;
    setProgress(null);
    window.setTimeout(() => window.location.reload(), 0);
  };

  if (!progress) return null;
  const title = progress.phase === "searching"
    ? "正在检索题组参考资料"
    : progress.phase === "streaming"
      ? "AI 正在流式生成题目"
      : "正在校验题组质量";

  return (
    <div className="pointer-events-auto fixed right-5 top-20 z-[80] w-[min(360px,calc(100vw-2.5rem))] rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <span className="size-2 animate-pulse rounded-full bg-blue-500" />
      </div>
      {progress.phase === "searching" ? (
        <p className="mt-2 text-xs leading-5 text-slate-600">正在检索并筛选官方文档、论文和高质量技术资料，为本题组生成提供依据。</p>
      ) : (
        <p className="mt-2 text-xs leading-5 text-slate-600">
          已收到 <strong className="text-blue-700">{progress.candidateCount}</strong> 道候选题，覆盖 <strong className="text-blue-700">{progress.knowledgeCount}</strong> 个知识点；已通过覆盖校验 {progress.acceptedCount} 道。
        </p>
      )}
      <p className="mt-1 text-[11px] leading-4 text-slate-400">完整题组准备完成后才会进入答题，不会用半组题提前开始。</p>
      <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={cancelPreparation}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-200"
        >
          中断准备
        </button>
      </div>
    </div>
  );
}
