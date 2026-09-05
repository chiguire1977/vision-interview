import assert from "node:assert/strict";
import test from "node:test";

import {
  buildResearchQueries,
  normalizeQuestionRetrievalOptions,
  normalizeQuestionRetrievalResult,
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
