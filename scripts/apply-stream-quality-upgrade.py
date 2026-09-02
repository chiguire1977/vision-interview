from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str, label: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match in {path}, found {count}")
    write(path, content.replace(old, new, 1))


def append_once(path: str, marker: str, addition: str) -> None:
    content = read(path)
    if marker in content:
        raise RuntimeError(f"test marker already exists in {path}: {marker}")
    write(path, content.rstrip() + "\n\n" + addition.strip() + "\n")


def run(command: list[str], *, expect_success: bool, red_marker: str | None = None) -> None:
    result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
    sys.stdout.write(result.stdout)
    sys.stderr.write(result.stderr)
    combined = result.stdout + "\n" + result.stderr
    if expect_success and result.returncode != 0:
        raise RuntimeError(f"command failed: {' '.join(command)}")
    if not expect_success:
        if result.returncode == 0:
            raise RuntimeError("TDD RED verification failed: tests unexpectedly passed before implementation")
        if red_marker and red_marker not in combined:
            raise RuntimeError(f"TDD RED failed for an unrelated reason; missing marker: {red_marker}")


BANK_TESTS = r'''
test("ranks authoritative research sources and removes invalid, duplicate, low-quality, and overrepresented domains", () => {
  const result = bank.filterHighQualityWebResearchSources([
    { title: "OpenCV threshold docs", url: "https://docs.opencv.org/4.x/d7/d4d/tutorial_py_thresholding.html?utm_source=test", snippet: "official" },
    { title: "OpenCV threshold duplicate", url: "https://docs.opencv.org/4.x/d7/d4d/tutorial_py_thresholding.html?utm_medium=chat", snippet: "duplicate" },
    { title: "OpenCV feature docs", url: "https://docs.opencv.org/4.x/da/df5/tutorial_py_sift_intro.html", snippet: "official" },
    { title: "OpenCV third page", url: "https://docs.opencv.org/4.x/d1/de0/tutorial_py_feature_homography.html", snippet: "official" },
    { title: "Original paper", url: "https://arxiv.org/abs/1506.02640", snippet: "paper" },
    { title: "GitHub docs", url: "https://docs.github.com/en/rest", snippet: "github docs" },
    { title: "Low quality aggregate", url: "https://wenku.baidu.com/view/123", snippet: "aggregate" },
    { title: "Local URL", url: "http://localhost/internal", snippet: "invalid" },
    { title: "Bad protocol", url: "ftp://example.com/file", snippet: "invalid" },
  ], { maxSources: 8, maxPerDomain: 2 });

  assert.equal(result[0].url, "https://docs.opencv.org/4.x/d7/d4d/tutorial_py_thresholding.html");
  assert.equal(result[1].url, "https://docs.opencv.org/4.x/da/df5/tutorial_py_sift_intro.html");
  assert.ok(result.some((item) => item.url === "https://arxiv.org/abs/1506.02640"));
  assert.ok(result.some((item) => item.url === "https://docs.github.com/en/rest"));
  assert.equal(result.filter((item) => new URL(item.url).hostname === "docs.opencv.org").length, 2);
  assert.ok(result.every((item) => !item.url.includes("utm_")));
  assert.ok(result.every((item) => !item.url.includes("wenku.baidu.com") && !item.url.includes("localhost")));
});

test("counts only complete question objects in partial streamed JSON", () => {
  const partial = '{"questions":[{"title":"A","hint":"brace } inside string"},{"title":"B","reference":{"url":"https://example.com"}},{"title":"C"';
  assert.equal(bank.countCompleteStreamedQuestions(partial), 2);
  assert.equal(bank.countCompleteStreamedQuestions('{"questions":['), 0);
});

test("selects knowledge-diverse questions instead of title-only variants", () => {
  const selected = bank.selectKnowledgeDiverseQuestions([
    generated("NCC 原理一", { type: "算法原理", knowledgePoints: ["NCC", "归一化"] }),
    generated("NCC 原理二", { type: "算法原理", knowledgePoints: ["NCC", "归一化"] }),
    generated("现场光照漂移", { type: "现场故障", knowledgePoints: ["光照漂移", "曝光"] }),
    generated("阈值参数影响", { type: "参数影响", knowledgePoints: ["阈值", "噪声"] }),
  ], 3);

  assert.deepEqual(selected.map((item) => item.title), ["NCC 原理一", "现场光照漂移", "阈值参数影响"]);
  const matrix = bank.buildKnowledgeCoverageMatrix(selected);
  assert.equal(matrix.length, 3);
  assert.ok(new Set(matrix.flatMap((row) => row.coverageKeys)).size >= 6);
});

test("consumes OpenAI-compatible SSE responses while reporting partial content", async () => {
  const encoder = new TextEncoder();
  const sse = (content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sse('{"questions":[')));
      controller.enqueue(encoder.encode(sse('{"title":"A"}')));
      controller.enqueue(encoder.encode(sse(']}')));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  }), { headers: { "content-type": "text/event-stream" } });
  const partials = [];
  const result = await bank.consumeAiChatResponse(response, (content) => partials.push(content));
  assert.equal(result.ok, true);
  assert.equal(result.content, '{"questions":[{"title":"A"}]}');
  assert.ok(partials.length >= 2);
});

test("formats streamed question progress before the full group is ready", () => {
  assert.equal(bank.formatAiQuestionGroupProgress({
    phase: "streaming-received",
    attempt: 1,
    maxAttempts: 6,
    targetCount: 10,
    collectedCount: 3,
    streamedCount: 3,
    workerIndex: 1,
    parallelRequests: 2,
  }), "第 1/6 轮（并行 1/2）：已流式收到 3/10 道候选题，正在继续生成与校验…");
});
'''

ROUTE_TEST = r'''
test("AI chat route proxies provider streaming responses when requested", async () => {
  const route = await vite.ssrLoadModule("/app/api/ai/chat/route.ts");
  const previousKey = process.env.DEEPSEEK_API_KEY;
  const previousFetch = globalThis.fetch;
  let upstreamBody;
  process.env.DEEPSEEK_API_KEY = "test-key";
  const encoder = new TextEncoder();
  const sse = (content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
  globalThis.fetch = async (_url, init = {}) => {
    upstreamBody = JSON.parse(init.body);
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sse('{"questions":[')));
        controller.enqueue(encoder.encode(sse(']}')));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    }), { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  try {
    const response = await route.POST(new Request("http://localhost/api/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "deepseek",
        model: "test-model",
        messages: [{ role: "user", content: "stream a question group" }],
        stream: true,
      }),
    }));
    assert.equal(response.status, 200);
    assert.equal(upstreamBody.stream, true);
    assert.match(response.headers.get("content-type") || "", /^text\/event-stream/);
    assert.match(await response.text(), /data:/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousKey;
  }
});
'''

append_once("tests/ai-question-bank.test.mjs", 'ranks authoritative research sources and removes invalid', BANK_TESTS)
append_once("tests/ai-chat-route.test.mjs", 'AI chat route proxies provider streaming responses', ROUTE_TEST)

run([
    "node", "--test", "--test-concurrency=1",
    "tests/ai-question-bank.test.mjs", "tests/ai-chat-route.test.mjs",
], expect_success=False, red_marker="filterHighQualityWebResearchSources")
print("TDD_RED_VERIFIED")

replace_once(
    "lib/ai-question-bank.ts",
    'export type AiQuestionGroupProgressPhase = "requesting" | "searching" | "search-completed" | "search-failed" | "ai-requesting" | "received" | "failed";',
    'export type AiQuestionGroupProgressPhase = "requesting" | "searching" | "search-completed" | "search-failed" | "ai-requesting" | "streaming-received" | "received" | "failed";',
    "add streaming progress phase",
)
replace_once(
    "lib/ai-question-bank.ts",
    '  searchSourceCount?: number;\n  error?: string;',
    '  searchSourceCount?: number;\n  streamedCount?: number;\n  sharedAcrossWorkers?: boolean;\n  error?: string;',
    "extend progress metadata",
)

UTILITY_BLOCK = r'''

type WebResearchSourceLike = { title: string; url: string; snippet: string };

const LOW_QUALITY_RESEARCH_HOSTS = [
  /(^|\.)wenku\.baidu\.com$/i,
  /(^|\.)zhidao\.baidu\.com$/i,
  /(^|\.)docin\.com$/i,
  /(^|\.)book118\.com$/i,
  /(^|\.)360doc\.com$/i,
  /(^|\.)scribd\.com$/i,
  /(^|\.)bit\.ly$/i,
  /(^|\.)t\.co$/i,
];

const TRACKING_QUERY_KEYS = new Set(["spm", "from", "source", "ref", "ref_", "campaign", "share"]);

function isPrivateResearchHostname(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host === "::1" || host.endsWith(".local")) return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  const match = host.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function normalizeResearchUrl(raw: unknown) {
  const text = cleanString(raw);
  if (!text) return undefined;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    if (url.username || url.password || isPrivateResearchHostname(url.hostname)) return undefined;
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (LOW_QUALITY_RESEARCH_HOSTS.some((pattern) => pattern.test(hostname))) return undefined;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      const lowered = key.toLowerCase();
      if (lowered.startsWith("utm_") || TRACKING_QUERY_KEYS.has(lowered)) url.searchParams.delete(key);
    }
    return { url: url.toString(), hostname };
  } catch {
    return undefined;
  }
}

function researchAuthorityScore(hostname: string) {
  if (/^(docs\.)?(opencv\.org|mvtec\.com|halcon\.com)$/i.test(hostname)) return 110;
  if (/^(support|docs)\.cognex\.com$/i.test(hostname)) return 108;
  if (/^(learn|docs)\.microsoft\.com$/i.test(hostname)) return 106;
  if (/^(docs\.)?python\.org$/i.test(hostname)) return 104;
  if (/^(arxiv\.org|doi\.org|ieeexplore\.ieee\.org|openaccess\.thecvf\.com|dl\.acm\.org)$/i.test(hostname)) return 100;
  if (/^(docs\.github\.com|github\.com)$/i.test(hostname)) return 96;
  if (/^(docs|developer|developers|reference)\./i.test(hostname)) return 90;
  if (/\.(edu|gov)$/i.test(hostname)) return 86;
  return 50;
}

export function filterHighQualityWebResearchSources(
  values: unknown[],
  options: { maxSources?: number; maxPerDomain?: number } = {},
): WebResearchSourceLike[] {
  const maxSources = Math.max(1, Math.floor(options.maxSources ?? 8));
  const maxPerDomain = Math.max(1, Math.floor(options.maxPerDomain ?? 2));
  const normalized = values.flatMap((value, index) => {
    if (!value || typeof value !== "object") return [];
    const record = value as Record<string, unknown>;
    const title = cleanString(record.title);
    const snippet = cleanText(record.snippet);
    const normalizedUrl = normalizeResearchUrl(record.url);
    if (!title || !snippet || !normalizedUrl) return [];
    return [{
      title,
      url: normalizedUrl.url,
      snippet,
      hostname: normalizedUrl.hostname,
      score: researchAuthorityScore(normalizedUrl.hostname),
      index,
    }];
  }).sort((left, right) => right.score - left.score || left.index - right.index);

  const result: WebResearchSourceLike[] = [];
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const domainCounts = new Map<string, number>();
  for (const source of normalized) {
    if (result.length >= maxSources) break;
    const titleKey = normalizedComparison(source.title);
    if (seenUrls.has(source.url) || seenTitles.has(titleKey)) continue;
    const domainCount = domainCounts.get(source.hostname) ?? 0;
    if (domainCount >= maxPerDomain) continue;
    seenUrls.add(source.url);
    seenTitles.add(titleKey);
    domainCounts.set(source.hostname, domainCount + 1);
    result.push({ title: source.title, url: source.url, snippet: source.snippet });
  }
  return result;
}

export function countCompleteStreamedQuestions(content: unknown) {
  if (typeof content !== "string" || !content) return 0;
  const keyIndex = content.search(/"questions"\s*:\s*\[/i);
  if (keyIndex < 0) return 0;
  const arrayStart = content.indexOf("[", keyIndex);
  if (arrayStart < 0) return 0;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let count = 0;
  for (let index = arrayStart + 1; index < content.length; index += 1) {
    const char = content[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0) count += 1;
    } else if (char === "]" && depth === 0) break;
  }
  return count;
}

export async function consumeAiChatResponse(
  response: Response,
  onPartialContent?: (content: string) => void,
): Promise<{ ok?: boolean; content?: string; message?: string }> {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("text/event-stream")) {
    try {
      return await response.json() as { ok?: boolean; content?: string; message?: string };
    } catch {
      return { ok: false, message: `AI 响应格式无效（HTTP ${response.status}）。` };
    }
  }
  if (!response.ok || !response.body) {
    return { ok: false, message: `AI 流式请求失败（HTTP ${response.status}）。` };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const consumeEvent = (eventText: string) => {
    for (const rawLine of eventText.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const payload = JSON.parse(data) as { choices?: Array<{ delta?: { content?: unknown } }> };
        const delta = payload.choices?.[0]?.delta?.content;
        if (typeof delta !== "string" || !delta) continue;
        content += delta;
        try { onPartialContent?.(content); } catch { /* progress callback cannot break streaming */ }
      } catch {
        // Ignore provider heartbeat or non-JSON SSE events.
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
  return content.trim()
    ? { ok: true, content }
    : { ok: false, message: "AI 流式响应没有返回有效内容。" };
}

function questionCoverageKeys(question: AiGeneratedQuestion) {
  const raw = question.knowledgePoints?.length
    ? question.knowledgePoints
    : [...question.tags, ...question.keywords].slice(0, 6);
  return [...new Set(raw.map((item) => normalizedComparison(item)).filter(Boolean))];
}

export function buildKnowledgeCoverageMatrix(values: unknown[]) {
  return normalizeAiGeneratedQuestions(values).map((question, index) => ({
    index: index + 1,
    title: question.title,
    type: question.type,
    category: question.category,
    sourceType: question.sourceType ?? "",
    knowledgePoints: question.knowledgePoints?.length ? question.knowledgePoints : [...question.tags, ...question.keywords].slice(0, 6),
    coverageKeys: questionCoverageKeys(question),
  }));
}

export function selectKnowledgeDiverseQuestions(values: unknown[], targetCount: number) {
  const target = Math.max(0, Math.floor(targetCount));
  const candidates = normalizeAiGeneratedQuestions(values);
  const selected: AiGeneratedQuestion[] = [];
  const seenKnowledge = new Set<string>();
  const seenTypes = new Set<string>();
  const seenCategories = new Set<string>();

  while (selected.length < target && candidates.length) {
    let bestIndex = -1;
    let bestScore = -1;
    for (let index = 0; index < candidates.length; index += 1) {
      const question = candidates[index];
      const knowledgeKeys = questionCoverageKeys(question);
      const unseenKnowledge = knowledgeKeys.filter((key) => !seenKnowledge.has(key)).length;
      const typeKey = normalizedComparison(question.type);
      const categoryKey = normalizedComparison(question.category);
      const newType = Boolean(typeKey && !seenTypes.has(typeKey));
      const newCategory = Boolean(categoryKey && !seenCategories.has(categoryKey));
      if (selected.length > 0 && unseenKnowledge === 0 && !newType && !newCategory) continue;
      const score = unseenKnowledge * 20 + (newType ? 6 : 0) + (newCategory ? 2 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    if (bestIndex < 0) break;
    const [question] = candidates.splice(bestIndex, 1);
    selected.push(question);
    questionCoverageKeys(question).forEach((key) => seenKnowledge.add(key));
    const typeKey = normalizedComparison(question.type);
    const categoryKey = normalizedComparison(question.category);
    if (typeKey) seenTypes.add(typeKey);
    if (categoryKey) seenCategories.add(categoryKey);
  }
  return selected;
}
'''

replace_once(
    "lib/ai-question-bank.ts",
    'export function normalizeQuestionTitleKey(value: unknown) {\n  return cleanString(value).toLocaleLowerCase();\n}\n',
    'export function normalizeQuestionTitleKey(value: unknown) {\n  return cleanString(value).toLocaleLowerCase();\n}\n' + UTILITY_BLOCK,
    "insert research, streaming, and coverage helpers",
)
replace_once(
    "lib/ai-question-bank.ts",
    'function normalizeReference(value: unknown) {\n  if (!value || typeof value !== "object") return undefined;\n  const record = value as Record<string, unknown>;\n  const title = cleanString(record.title);\n  const url = cleanString(record.url);\n  return title && url ? { title, url } : undefined;\n}',
    'function normalizeReference(value: unknown) {\n  if (!value || typeof value !== "object") return undefined;\n  const record = value as Record<string, unknown>;\n  const title = cleanString(record.title);\n  const normalizedUrl = normalizeResearchUrl(record.url);\n  return title && normalizedUrl ? { title, url: normalizedUrl.url } : undefined;\n}',
    "validate reference URLs",
)
replace_once(
    "lib/ai-question-bank.ts",
    '  if (progress.phase === "ai-requesting") return `${round}${worker}：正在请求 AI 生成题目${progress.requestedCount ? `（${progress.requestedCount} 道）` : ""}…`;\n  if (progress.phase === "received") {',
    '  if (progress.phase === "ai-requesting") return `${round}${worker}：正在请求 AI 生成题目${progress.requestedCount ? `（${progress.requestedCount} 道）` : ""}…`;\n  if (progress.phase === "streaming-received") return `${round}${worker}：已流式收到 ${progress.collectedCount}/${progress.targetCount} 道候选题，正在继续生成与校验…`;\n  if (progress.phase === "received") {',
    "format streaming progress",
)
replace_once(
    "lib/ai-question-bank.ts",
    '    collected = normalizeAiGeneratedQuestions([...collected, ...received]).slice(0, target);',
    '    collected = selectKnowledgeDiverseQuestions([...collected, ...received], target);',
    "apply knowledge diversity during collection",
)
replace_once(
    "lib/ai-question-bank.ts",
    '  const ai = normalizeAiGeneratedQuestions(aiValues).slice(0, target);',
    '  const ai = selectKnowledgeDiverseQuestions(aiValues, target);',
    "apply knowledge diversity before fallback",
)

replace_once(
    "app/api/ai/chat/route.ts",
    '    const body = await request.json() as { provider?: string; baseUrl?: string; apiKey?: string; model?: string; messages?: ChatMessage[]; maxTokens?: number; temperature?: number };',
    '    const body = await request.json() as { provider?: string; baseUrl?: string; apiKey?: string; model?: string; messages?: ChatMessage[]; maxTokens?: number; temperature?: number; stream?: boolean };',
    "accept stream option",
)
replace_once(
    "app/api/ai/chat/route.ts",
    '    if (!apiKey) return Response.json({ ok: false, message: "请先配置当前 AI 服务商的 API Key。" }, { status: 400 });\n\n    const endpoint =',
    '    if (!apiKey) return Response.json({ ok: false, message: "请先配置当前 AI 服务商的 API Key。" }, { status: 400 });\n    const wantsStream = body.stream === true;\n\n    const endpoint =',
    "compute streaming flag",
)
replace_once(
    "app/api/ai/chat/route.ts",
    '      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },',
    '      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: wantsStream ? "text/event-stream" : "application/json" },',
    "request SSE from provider",
)
replace_once(
    "app/api/ai/chat/route.ts",
    '        stream: false,',
    '        stream: wantsStream,',
    "forward stream option",
)
replace_once(
    "app/api/ai/chat/route.ts",
    '    if (response.status >= 300 && response.status < 400) return Response.json({ ok: false, message: "AI 地址发生重定向，请填写最终 HTTPS 地址。" }, { status: 502 });\n    const payload = await response.json() as {',
    '    if (response.status >= 300 && response.status < 400) return Response.json({ ok: false, message: "AI 地址发生重定向，请填写最终 HTTPS 地址。" }, { status: 502 });\n    const upstreamContentType = (response.headers.get("content-type") || "").toLowerCase();\n    if (wantsStream && response.ok && response.body && upstreamContentType.includes("text/event-stream")) {\n      return new Response(response.body, {\n        status: 200,\n        headers: {\n          "Content-Type": "text/event-stream; charset=utf-8",\n          "Cache-Control": "no-store, no-transform",\n          "X-Accel-Buffering": "no",\n        },\n      });\n    }\n    const payload = await response.json() as {',
    "proxy SSE response",
)

replace_once(
    "app/page.tsx",
    '  AI_QUESTION_MAX_ATTEMPTS,\n  collectAiQuestionGroup,',
    '  AI_QUESTION_MAX_ATTEMPTS,\n  buildKnowledgeCoverageMatrix,\n  collectAiQuestionGroup,\n  consumeAiChatResponse,\n  countCompleteStreamedQuestions,',
    "import streaming and coverage helpers",
)
replace_once(
    "app/page.tsx",
    '  filterAiGeneratedQuestions,\n  fillQuestionGroup,',
    '  filterAiGeneratedQuestions,\n  filterHighQualityWebResearchSources,\n  fillQuestionGroup,',
    "import source quality helper",
)
replace_once(
    "app/page.tsx",
    '    const sharedResearchByAttempt = new Map<number, Promise<{ value?: WebResearchSource[]; error?: string }>>();',
    '    const sharedResearchByAttempt = new Map<number, Promise<{ value?: WebResearchSource[]; error?: string }>>();\n    const streamProgressByWorker = new Map<string, number>();',
    "track streamed worker progress",
)
replace_once(
    "app/page.tsx",
    '            const webSources = Array.isArray(searchResult.sources)\n              ? searchResult.sources.filter(isWebResearchSource).slice(0, 8)\n              : [];',
    '            const webSources = Array.isArray(searchResult.sources)\n              ? filterHighQualityWebResearchSources(searchResult.sources.filter(isWebResearchSource), { maxSources: 8, maxPerDomain: 2 })\n              : [];',
    "filter and rank research sources",
)
replace_once(
    "app/page.tsx",
    '          model,\n          maxTokens: Math.min(4800, Math.max(1600, count * 1400)),',
    '          model,\n          stream: true,\n          maxTokens: Math.min(4800, Math.max(1600, count * 1400)),',
    "enable streaming generation",
)
replace_once(
    "app/page.tsx",
    '                  "题目之间不得重复，也不能只是换一种说法",',
    '                  "题目之间不得重复，也不能只是换一种说法",\n                  "当前题组必须形成知识点覆盖矩阵：每道题至少贡献一个新的主要知识点、工程场景或考察角度；不得只修改标题而复用同一组 knowledgePoints",',
    "require coverage matrix in prompt",
)
replace_once(
    "app/page.tsx",
    '          const result = await response.json() as { ok?: boolean; content?: string; message?: string };\n          if (!response.ok || !result.ok || !result.content) {',
    '''          const result = await consumeAiChatResponse(response, (partialContent) => {
            const progressKey = `${attempt}:${workerIndex}`;
            const streamedByWorker = countCompleteStreamedQuestions(partialContent);
            const previous = streamProgressByWorker.get(progressKey) ?? 0;
            if (streamedByWorker <= previous) return;
            streamProgressByWorker.set(progressKey, streamedByWorker);
            const streamedThisAttempt = [...streamProgressByWorker.entries()]
              .filter(([key]) => key.startsWith(`${attempt}:`))
              .reduce((sum, [, value]) => sum + value, 0);
            const collectedCount = Math.min(targetCount, excludedTitles.length + streamedThisAttempt);
            onProgress({
              phase: "streaming-received",
              attempt,
              maxAttempts: AI_QUESTION_MAX_ATTEMPTS,
              targetCount,
              collectedCount,
              streamedCount: collectedCount,
              workerIndex,
              parallelRequests,
              requestedCount: count,
              searchSourceCount: webSources.length,
            });
          });
          if (!response.ok || !result.ok || !result.content) {''',
    "consume streaming response and report partial questions",
)
replace_once(
    "app/page.tsx",
    '    const completed = fillQuestionGroup(generated, fallbackPool, targetCount);',
    '''    const coverageMatrix = buildKnowledgeCoverageMatrix(generated);
    recordRuntimeEvent("INFO", "question-bank.coverage.matrix", "本题组知识点覆盖矩阵已完成校验", {
      targetCount,
      questionCount: generated.length,
      uniqueKnowledgePointCount: new Set(coverageMatrix.flatMap((row) => row.coverageKeys)).size,
      matrix: coverageMatrix,
    });
    const completed = fillQuestionGroup(generated, fallbackPool, targetCount);''',
    "record coverage matrix",
)
replace_once(
    "app/page.tsx",
    '      if (progress.phase === "ai-requesting") {',
    '''      if (progress.phase === "streaming-received") {
        recordRuntimeEvent("INFO", "question-bank.ai-stream.progress", message, {
          attempt: progress.attempt,
          maxAttempts: progress.maxAttempts,
          collectedCount: progress.collectedCount,
          targetCount: progress.targetCount,
          workerIndex: progress.workerIndex,
          parallelRequests: progress.parallelRequests,
        });
      } else if (progress.phase === "ai-requesting") {''',
    "log streaming progress",
)
replace_once(
    "app/page.tsx",
    '    request.then((result) => {\n      if (!active) return;\n      setPreparedGroupQuestions(result.questions);',
    '''    request.then((result) => {
      if (!active) return;
      if (result.questions.length < questionGroupSettings.questionGroupSize) {
        throw new Error(`题组尚未完整：${result.questions.length}/${questionGroupSettings.questionGroupSize}`);
      }
      setPreparedGroupQuestions(result.questions);''',
    "gate answer UI on a complete group",
)
replace_once(
    "app/page.tsx",
    '      setPreparedGroupQuestions(buildQuestionFallbackPool(groupQuestionSeed, project, { trainingMode, category, difficulty, techStack, detectionDirection, learningFocus }).slice(0, questionGroupSettings.questionGroupSize));\n      setGroupPreparationSource("本地规则");',
    '''      const localFallback = buildQuestionFallbackPool(groupQuestionSeed, project, { trainingMode, category, difficulty, techStack, detectionDirection, learningFocus }).slice(0, questionGroupSettings.questionGroupSize);
      if (localFallback.length < questionGroupSettings.questionGroupSize) {
        setPreparedGroupQuestions(null);
        setGroupPreparationMessage(`未能准备完整题组（${localFallback.length}/${questionGroupSettings.questionGroupSize}），请重新开始训练。`);
        setPreparingGroup(false);
        setTrainingStarted(false);
        recordRuntimeEvent("ERROR", "question-group.prepare.incomplete", "题组数量不足，未进入答题", {
          preparedCount: localFallback.length,
          targetCount: questionGroupSettings.questionGroupSize,
        });
        return;
      }
      setPreparedGroupQuestions(localFallback);
      setGroupPreparationSource("本地规则");''',
    "prevent partial fallback group from entering answer UI",
)

run([
    "node", "--test", "--test-concurrency=1",
    "tests/ai-question-bank.test.mjs", "tests/ai-chat-route.test.mjs",
], expect_success=True)
print("TDD_GREEN_VERIFIED")
