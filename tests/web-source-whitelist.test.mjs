import assert from "node:assert/strict";
import test from "node:test";

import {
  buildResearchQueries,
  normalizeQuestionRetrievalOptions,
  normalizeWebSourceWhitelist,
  readWebSourceWhitelist,
  reorderWebSourceWhitelist,
  retrieveWebSources,
  sortSourcesByWhitelist,
  sourceMatchesWhitelist,
} from "../lib/question-retrieval.mjs";

test("builds prioritized site queries in whitelist order before fallback queries", () => {
  const queries = buildResearchQueries("HALCON 阈值分割", [
    { id: "opencv", url: "https://docs.opencv.org/", enabled: true },
    { id: "mvtec", url: "https://www.mvtec.com/doc/halcon/", enabled: true },
  ]);

  assert.deepEqual(queries.slice(0, 2), [
    "HALCON 阈值分割 site:docs.opencv.org",
    "HALCON 阈值分割 site:www.mvtec.com",
  ]);
  assert.deepEqual(queries.slice(2), [
    "HALCON 阈值分割",
    "HALCON 阈值分割 site:github.com (面试题 OR interview questions OR interview) (stars OR trending OR discussions OR issues)",
    "HALCON 阈值分割 官方文档 论文 工程实践 排障",
  ]);
});

test("matches source URLs by whitelist origin and path boundary", () => {
  assert.equal(sourceMatchesWhitelist("https://docs.opencv.org/4.x/tutorial.html#part", "https://docs.opencv.org/"), true);
  assert.equal(sourceMatchesWhitelist("https://docs.opencv.org/4.x/tutorial.html", "https://docs.opencv.org/4.x/"), true);
  assert.equal(sourceMatchesWhitelist("https://docs.opencv.org/4.x-other/tutorial.html", "https://docs.opencv.org/4.x/"), false);
  assert.equal(sourceMatchesWhitelist("https://evil.example.com/docs", "https://docs.opencv.org/"), false);
});

test("sorts sources by enabled whitelist order while keeping non-whitelist fallback sources", () => {
  const sources = [
    { title: "GitHub", url: "https://github.com/example/interview", snippet: "github" },
    { title: "MVTEC", url: "https://www.mvtec.com/doc/halcon/reference.html", snippet: "halcon" },
    { title: "OpenCV", url: "https://docs.opencv.org/4.x/tutorial.html", snippet: "opencv" },
    { title: "Other", url: "https://example.com/article", snippet: "other" },
  ];
  const sorted = sortSourcesByWhitelist(sources, [
    { id: "opencv", url: "https://docs.opencv.org/", enabled: true },
    { id: "mvtec", url: "https://www.mvtec.com/doc/halcon/", enabled: true },
  ]);
  assert.deepEqual(sorted.map((source) => source.title), ["OpenCV", "MVTEC", "GitHub", "Other"]);
});

test("reorders whitelist cards and normalizes invalid entries", () => {
  const list = [
    { id: "a", url: "https://a.example.com", enabled: true },
    { id: "bad", url: "javascript:alert(1)", enabled: true },
    { id: "b", url: "https://b.example.com", enabled: false },
  ];
  assert.deepEqual(reorderWebSourceWhitelist(list, 1, 0), [
    { id: "b", url: "https://b.example.com/", enabled: false },
    { id: "a", url: "https://a.example.com/", enabled: true },
  ]);
});

test("retrieval options preserve normalized whitelist order", () => {
  const result = normalizeQuestionRetrievalOptions({
    whitelist: [
      { id: "first", url: "https://first.example.com", enabled: true },
      { id: "bad", url: "ftp://bad.example.com", enabled: true },
      { id: "second", url: "https://second.example.com", enabled: false },
    ],
  });
  assert.deepEqual(result.whitelist, [
    { id: "first", url: "https://first.example.com/", enabled: true },
    { id: "second", url: "https://second.example.com/", enabled: false },
  ]);
});

test("preserves verified metadata and treats unavailable entries as inactive for retrieval", () => {
  const whitelist = [
    {
      id: "opencv",
      url: "https://docs.opencv.org",
      enabled: true,
      displayName: "OpenCV Documentation",
      available: true,
      lastCheckedAt: "2026-09-04T12:00:00.000Z",
    },
    {
      id: "broken",
      url: "https://broken.example.com",
      enabled: true,
      displayName: "Broken source",
      available: false,
      checkError: "连接超时",
    },
  ];

  assert.deepEqual(normalizeWebSourceWhitelist(whitelist), [
    {
      id: "opencv",
      url: "https://docs.opencv.org/",
      enabled: true,
      displayName: "OpenCV Documentation",
      available: true,
      lastCheckedAt: "2026-09-04T12:00:00.000Z",
    },
    {
      id: "broken",
      url: "https://broken.example.com/",
      enabled: true,
      displayName: "Broken source",
      available: false,
      checkError: "连接超时",
    },
  ]);
  assert.deepEqual(buildResearchQueries("HALCON", whitelist), [
    "HALCON site:docs.opencv.org",
    "HALCON",
    "HALCON site:github.com (面试题 OR interview questions OR interview) (stars OR trending OR discussions OR issues)",
    "HALCON 官方文档 论文 工程实践 排障",
  ]);
});

test("reads a persisted whitelist without allowing malformed values through", () => {
  const storage = {
    getItem() {
      return JSON.stringify([
        { id: "valid", url: "https://docs.example.com/", enabled: true },
        { id: "invalid", url: "javascript:alert(1)", enabled: true },
      ]);
    },
  };
  assert.deepEqual(readWebSourceWhitelist(storage), [
    { id: "valid", url: "https://docs.example.com/", enabled: true },
  ]);
});

test("retrieves whitelist queries in configured order and ranks their results first", async () => {
  const requests = [];
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    requests.push(body.query);
    return new Response(JSON.stringify({ ok: true, sources: body.query.includes("site:second.example.com")
      ? [{ title: "Second", url: "https://second.example.com/guide", snippet: "second" }]
      : body.query.includes("site:first.example.com")
        ? [{ title: "First", url: "https://first.example.com/docs", snippet: "first" }]
        : [{ title: "Fallback", url: "https://example.com/fallback", snippet: "fallback" }] }), { status: 200 });
  };
  const result = await retrieveWebSources({
    query: "机器视觉",
    fetchImpl,
    options: {
      parallelRequests: 3,
      whitelist: [
        { id: "first", url: "https://first.example.com", enabled: true },
        { id: "second", url: "https://second.example.com", enabled: true },
      ],
    },
  });
  assert.deepEqual(requests.slice(0, 2), [
    "机器视觉 site:first.example.com",
    "机器视觉 site:second.example.com",
  ]);
  assert.deepEqual(result.sources.map((source) => source.title), ["First", "Second", "Fallback"]);
});
