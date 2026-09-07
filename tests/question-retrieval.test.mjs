import assert from "node:assert/strict";
import test from "node:test";

import {
  buildResearchQueries,
  DEFAULT_WEB_SOURCE_WHITELIST,
  normalizeQuestionRetrievalOptions,
  normalizeQuestionRetrievalResult,
  readWebSourceWhitelist,
  retrieveWebSources,
} from "../lib/question-retrieval.mjs";

test("builds one base query plus GitHub and engineering research queries", () => {
  assert.deepEqual(buildResearchQueries(" HALCON 阈值分割 "), [
    "HALCON 阈值分割",
    "HALCON 阈值分割 site:github.com (面试题 OR interview questions OR interview) (stars OR trending OR discussions OR issues)",
    "HALCON 阈值分割 官方文档 论文 工程实践 排障",
  ]);
});

test("normalizes retrieval options and result contract", () => {
  assert.deepEqual(normalizeQuestionRetrievalOptions({ parallelRequests: 99, requestTimeoutMs: 0 }), {
    parallelRequests: 4,
    requestTimeoutMs: 8000,
    cacheTtlMs: 600000,
    minimumSources: 4,
    softTimeoutMs: 4500,
    whitelist: [],
  });
  assert.deepEqual(normalizeQuestionRetrievalResult({ source: "invalid", questions: "bad", aiCount: "2" }, [{ title: "fallback" }]), {
    questions: [{ title: "fallback" }],
    source: "本地规则",
    message: "联网题目获取失败，已使用本地题库。",
    aiCount: 0,
  });
});

test("retrieves and merges unique web sources without affecting caller state", async () => {
  const requests = [];
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    requests.push(body.query);
    return new Response(JSON.stringify({ ok: true, sources: [
      { title: `${body.query} source`, url: "https://github.com/example/interview", snippet: "github" },
      { title: "duplicate", url: "https://docs.example.com/a", snippet: "docs" },
    ] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const result = await retrieveWebSources({ query: "HALCON 阈值", fetchImpl });
  assert.equal(requests.length, 3);
  assert.deepEqual(result.sources.map((source) => source.url), [
    "https://github.com/example/interview",
    "https://docs.example.com/a",
  ]);
  assert.equal(result.cached, false);
});

test("uses the fixed whitelist defaults and includes CSDN", () => {
  const whitelist = readWebSourceWhitelist({ getItem: () => "[]" });
  assert.deepEqual(whitelist, DEFAULT_WEB_SOURCE_WHITELIST);
  assert.ok(whitelist.some((entry) => entry.url === "https://blog.csdn.net/" && entry.enabled));
});

test("returns as soon as enough sources arrive and aborts slower searches", async () => {
  const started = [];
  const fetchImpl = async (_url, init) => {
    started.push(init.signal);
    if (started.length === 1) {
      return new Response(JSON.stringify({ ok: true, sources: [
        { title: "One", url: "https://one.example.com/", snippet: "one" },
        { title: "Two", url: "https://two.example.com/", snippet: "two" },
        { title: "Three", url: "https://three.example.com/", snippet: "three" },
        { title: "Four", url: "https://four.example.com/", snippet: "four" },
      ] }), { status: 200 });
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(new Response(JSON.stringify({ ok: true, sources: [] }), { status: 200 })), 200);
      init.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(init.signal.reason || new Error("aborted"));
      }, { once: true });
    });
  };
  const startedAt = Date.now();
  const result = await retrieveWebSources({
    query: "HALCON 阈值",
    fetchImpl,
    options: { parallelRequests: 3, minimumSources: 4, softTimeoutMs: 80 },
  });

  assert.ok(Date.now() - startedAt < 150);
  assert.equal(result.sources.length, 4);
  assert.equal(result.earlyReturned, true);
  assert.equal(started.length, 3);
});
