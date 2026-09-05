# 题组准备状态与 AI 失败诊断 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让开始学习页面显示题组准备进度和 AI 失败原因，并使远程题库同步不阻塞题组进入答题。

**Architecture:** 用 `collectAiQuestionGroup` 的进度回调描述每轮 AI 请求，用 `prepareQuestionGroup` 的进度回调把联网搜索和 AI 阶段同步到页面及运行日志。题组准备成功后立即返回；GitHub 题库同步通过受控的后台 Promise 继续执行。

联网搜索属于题源增强环节而非 AI 出题硬前置。搜索超时或失败时保留安全错误摘要，继续调用第三方 AI，并在题组准备提示和请求上下文中标明检索不可用。

**Tech Stack:** React 19、TypeScript、Vinext、Node test runner、Vite SSR 测试。

**Spec:** `docs/superpowers/specs/2026-08-31-question-group-preparation-status-design.md`

## Global Constraints

- 保持 AI 题组目标数量为 10 道。
- 保持最多 6 轮生成尝试，并且专业知识/综合模拟每轮重新联网搜索。
- 项目答辩不联网，题目只能来自本地 `projectProfile` 和本地项目题库。
- 不在日志、界面或请求中暴露 API Key、Authorization 或完整用户回答。
- 继续同步源码到 GitHub main，并通过 Sites 发布验证。

### Task 1: Add testable attempt progress reporting

**Files:**
- Modify: `lib/ai-question-bank.ts`
- Test: `tests/ai-question-bank.test.mjs`

**Interfaces:**
- Produces `AiQuestionGroupProgress` with `phase`, `attempt`, `maxAttempts`, `collectedCount`, `targetCount`, and optional `error`.
- Extends `collectAiQuestionGroup` with an optional progress callback while preserving existing call signatures.

- [x] **Step 1: Write the failing test** for requesting and reporting attempts that fail before succeeding.
- [x] **Step 2: Run the targeted test** with `node --test tests/ai-question-bank.test.mjs`; confirm the callback is missing.
- [x] **Step 3: Add the progress type and callback events** for `requesting`, `received`, and `failed` phases.
- [x] **Step 4: Run the targeted test** and confirm the attempt sequence and safe error text pass.

### Task 2: Add preparation progress and diagnostic logs

**Files:**
- Modify: `app/page.tsx`
- Test: `tests/ai-question-bank.test.mjs` and existing build tests

**Interfaces:**
- `prepareQuestionGroup` accepts an optional progress callback.
- The page callback updates `groupPreparationMessage` and records `question-bank.ai-request.*` events without changing source filtering.

- [x] **Step 1: Write the failing test** for the progress message contract used by the preparation flow.
- [x] **Step 2: Run the targeted test** and confirm the current static message cannot represent the phase and attempt.
- [x] **Step 3: Pass progress from search start/completion, AI start/completion/failure, and final fallback into the page state.**
- [x] **Step 4: Run the targeted tests and production build** to verify the callback integration compiles.

### Task 3: Make question-bank synchronization non-blocking

**Files:**
- Modify: `app/page.tsx`
- Test: existing question-bank and backup tests, plus the preparation progress test

**Interfaces:**
- AI-generated questions return immediately with a message that GitHub synchronization is running in the background.
- Background synchronization keeps existing pending-queue and runtime backup logs and catches all Promise failures.

- [x] **Step 1: Write the failing test** that asserts the prepared group can resolve before a delayed archive sync completes.
- [x] **Step 2: Run the targeted test** and confirm the current awaited sync blocks resolution.
- [x] **Step 3: Start `syncAiQuestionBankBackup(entries)` without awaiting it**, attach success/failure logging, and return the prepared questions immediately.
- [x] **Step 4: Run the full test suite** and verify no backup or question-bank regression.

### Task 4: Publish and verify

**Files:**
- Modify: none beyond Tasks 1–3

- [ ] **Step 1: Run `git diff --check`, `npm test`, and `git status --short`.**
- [ ] **Step 2: Prepare a Sites checkpoint from the verified build and save the exact commit.**
- [ ] **Step 3: Deploy the saved version privately and poll until terminal success.**
- [ ] **Step 4: Remove only the verified checkpoint archive and report the production URL and verification results.**
