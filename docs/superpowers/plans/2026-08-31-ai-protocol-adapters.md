# AI Protocol Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持三种 AI 上游协议，并让连接测试发送真实聊天请求。

**Architecture:** 通过纯函数适配层统一生成三种协议的请求并解析响应。现有题库生成和回答审阅继续调用同一个后端聊天路由，设置页测试复用该路由；OpenCode Go 的模型协议由模型 ID 自动推断，普通服务商保留手动协议选择。

**Tech Stack:** TypeScript、ES modules、React、Node test runner、Vite/Vinext、Cloudflare Worker。

**Spec:** `docs/superpowers/specs/2026-08-31-ai-protocol-adapters-design.md`

## Global Constraints

- API Key 不进入源代码、GitHub、运行日志或备份数据。
- 继续使用 `/workspace/sites/vision-interview` 和 main 分支。
- 继续同步到 `chiguire1977/vision-interview`，禁止 force push。
- 生产发布使用 Sites checkpoint、save、deploy 和状态验证流程。

---

### Task 1: Protocol adapter library

**Files:**
- Create: `lib/ai-adapters.mjs`
- Modify: `lib/ai-settings.mjs`
- Test: `tests/ai-adapters.test.mjs`
- Test: `tests/ai-settings.test.mjs`

**Interfaces:**
- Produces `buildAiUpstreamRequest(options)`, `extractAiContent(format, payload)`, `resolveAiUpstreamFormat(baseUrl, model, requestedFormat)` and the three-format option list.

- [ ] Write failing tests for all request formats, response parsers, and OpenCode Go mapping.
- [ ] Run `node --test tests/ai-adapters.test.mjs tests/ai-settings.test.mjs` and confirm failure because the adapter library and three options are missing.
- [ ] Implement the smallest pure adapter functions with no credentials in logs.
- [ ] Run the targeted tests and confirm they pass.

### Task 2: Server chat route

**Files:**
- Modify: `app/api/ai/chat/route.ts`
- Test: `tests/ai-chat-route.test.mjs`

**Interfaces:**
- Consumes the adapter library and request fields `provider`, `baseUrl`, `apiKey`, `model`, `messages`, `maxTokens`, `temperature`, and `upstreamFormat`.
- Produces the normalized `{ ok, content }` response for all three protocols.

- [ ] Add failing route tests for Responses and Anthropic Messages requests.
- [ ] Run the targeted route tests and confirm failure.
- [ ] Delegate endpoint, headers, body and parser work to the adapter library.
- [ ] Return 504 for timeout and 502 for upstream/parse failures while preserving safe messages.
- [ ] Run route tests and confirm they pass.

### Task 3: Settings and real chat test

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/api/ai/models/route.ts`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Settings expose `chat-completions`, `responses`, and `anthropic-messages`.
- The test button calls `/api/ai/chat` with a short message and reports the actual protocol result.

- [ ] Add the three choices and OpenCode model protocol labels.
- [ ] Replace the models-only test action with the real chat test, while retaining model refresh as a separate action.
- [ ] Reuse protocol inference in question generation and answer review.
- [ ] Add safe runtime events for test start/success/failure.
- [ ] Run focused UI and route tests.

### Task 4: Full validation and release

**Files:**
- No source files beyond prior tasks.

- [ ] Run `npm test`.
- [ ] Run the production checkpoint build and inspect its result.
- [ ] Save and deploy the checkpoint through Sites.
- [ ] Verify the deployment status and production URL.
