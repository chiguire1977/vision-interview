# VisionInterview Reliability Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the confirmed learning-loop, reliability, data-safety, and interaction improvements.

**Architecture:** Put migrations, review scheduling, error policy, and keyboard policy in pure modules with Node tests; keep `app/page.tsx` as the integration layer. Preserve existing storage and UI flows while normalizing data at their boundaries.

**Tech Stack:** React 19, TypeScript/ESM, Vinext/Vite, Node test runner, GitHub Contents API.

**Spec:** `docs/superpowers/specs/2026-09-19-learning-loop-reliability-design.md`

## Global Constraints

- Direct implementation on `main` is explicitly authorized.
- No new dependencies or unrelated redesign.
- Test-first for every behavior change.
- Preserve cancellation, favorites, whitelist, settings, review-at-end, and access mode.

## Review Focus

- Invalid dates and duplicate question histories select the newest valid review state.
- Unknown categories become “其他” and never create new buckets.
- User cancellation does not retry or trip the circuit breaker.
- Empty append deltas remain valid while empty authoritative replacements are rejected.
- IME and focused form controls do not trigger single-key shortcuts.

### Task 1: Taxonomy and Record Migration

- [ ] Add failing taxonomy and migration tests.
- [ ] Implement strict category normalization and `lib/training-records.mjs`.
- [ ] Run focused tests and commit.

### Task 2: Review Scheduling and Skip Signals

- [ ] Add failing interval, due-queue, latest-attempt, and skip-weight tests.
- [ ] Implement scheduling and stage/skip-based learning focus.
- [ ] Run focused tests and commit.

### Task 3: Review UI and Mastery Analytics

- [ ] Add failing UI/source and personal-center tests.
- [ ] Add today-review entry, skip reason dialog, difficulty reduction, and four-stage analytics.
- [ ] Run focused tests and commit.

### Task 4: AI Errors, Retry, and Circuit Breaker

- [ ] Add failing structured-error, retry, breaker, and route tests.
- [ ] Implement pure reliability helpers, structured proxy responses, retry, and per-session breaker.
- [ ] Run focused tests and commit.

### Task 5: Backup and Question-Bank Safety

- [ ] Add failing collapse-protection and JSON-authority tests.
- [ ] Protect GitHub and sidecar backup writes, create `.bak`, and make Markdown best-effort derived output.
- [ ] Run focused tests and commit.

### Task 6: Shortcuts and Timer Removal

- [ ] Add failing shortcut-policy and rendered-source tests.
- [ ] Wire safe shortcuts and remove timer code/UI.
- [ ] Run focused tests and commit.

### Task 7: Verification and Release

- [ ] Run all 190+ tests and production build.
- [ ] Review the complete diff and fix important findings with regression tests.
- [ ] Push the exact commit to GitHub and Sites source, deploy, and verify terminal status.
