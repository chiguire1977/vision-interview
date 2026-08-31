# Backup And Question Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make backup status accurately represent local-only mode, upload learning records on demand, and finish remote question caching before an AI question group is returned.

**Architecture:** Keep the existing GitHub backup and question-bank API contracts. The browser backup worker snapshots approved state without learning records; startup still merges all remote data, while the Learning Records page posts the full local record collection with `replaceKeys`. The AI preparation path awaits the existing question-bank sync and reports whether the archive is remote or pending locally.

**Tech Stack:** Next.js/Vinext, React, TypeScript, browser localStorage, Node test runner, GitHub Contents API.

**Spec:** `docs/superpowers/specs/2026-08-31-backup-and-question-cache.md`

## Global Constraints

- Preserve existing GitHub `main` history; never force-push.
- Never persist GitHub or AI credentials in browser data or runtime logs.
- Keep startup restoration of records, projects, preferences, and logs.
- Auto backup must exclude `vision-interview-records`.
- Manual record upload must use the full current record collection and deduplicate by record ID through the existing backup merge path.
- AI question caching must retain a local pending queue when remote GitHub caching is unavailable.

---

### Task 1: Backup snapshot boundaries

**Files:**
- Modify: `lib/backup-core.mjs`
- Modify: `components/backup-sync.tsx`
- Test: `tests/backup-core.test.mjs`

**Interfaces:**
- Produces `createAutoBackupSnapshot(value)` that returns sanitized approved data without `vision-interview-records`.
- Existing startup merge and close payload behavior remain available.

- [ ] **Step 1: Write the failing test**

```js
test("createAutoBackupSnapshot excludes learning records but keeps configuration and logs", () => {
  const snapshot = createAutoBackupSnapshot({
    "vision-interview-records": [{ id: "record-1" }],
    "vision-interview-project-view": "grid",
    "vision-interview-runtime-logs": [{ id: "log-1", timestamp: "2026-08-31T00:00:00.000Z", level: "INFO", event: "app.start", message: "启动" }],
  });
  assert.deepEqual(snapshot, {
    "vision-interview-project-view": "grid",
    "vision-interview-runtime-logs": [{ id: "log-1", timestamp: "2026-08-31T00:00:00.000Z", level: "INFO", event: "app.start", message: "启动" }],
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/backup-core.test.mjs`

Expected: FAIL because `createAutoBackupSnapshot` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add the exported helper in `lib/backup-core.mjs`, then use it from `components/backup-sync.tsx` for startup dirty comparisons, normal pushes, and close-time snapshots. Keep startup `readBackupFromStorage` and `mergeBackupData` calls unchanged for restoring records.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/backup-core.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/backup-core.mjs components/backup-sync.tsx tests/backup-core.test.mjs
git commit -m "fix: keep learning records out of automatic backup"
```

### Task 2: Manual learning-record upload

**Files:**
- Modify: `app/page.tsx`
- Modify: `lib/backup-core.mjs`
- Test: `tests/backup-core.test.mjs`

**Interfaces:**
- Produces `createRecordsUploadPayload(records)` returning `{ data: { "vision-interview-records": records }, merge: true, replaceKeys: ["vision-interview-records"] }`.
- `TrainingReport` accepts `onUploadRecords: () => Promise<{ ok: boolean; message: string }>`.

- [ ] **Step 1: Write the failing test**

```js
test("createRecordsUploadPayload uploads the complete sanitized record collection", () => {
  const payload = createRecordsUploadPayload([
    { id: "record-1", question: "Q1", answer: "A1", apiKey: "discard" },
  ]);
  assert.deepEqual(payload, {
    data: { "vision-interview-records": [{ id: "record-1", question: "Q1", answer: "A1" }] },
    merge: true,
    replaceKeys: ["vision-interview-records"],
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/backup-core.test.mjs`

Expected: FAIL because `createRecordsUploadPayload` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add the pure payload helper. In `app/page.tsx`, add a records upload handler that posts the payload to `/api/backup`, logs `records.upload.started`, `records.upload.saved`, or `records.upload.failed`, and renders a button in `TrainingReport` with pending count based on a local uploaded snapshot marker.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/backup-core.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/backup-core.mjs app/page.tsx tests/backup-core.test.mjs
git commit -m "feat: add manual learning record upload"
```

### Task 3: AI cache completion and status copy

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/backup-sync.tsx`
- Test: `tests/backup-core.test.mjs`

**Interfaces:**
- `syncAiQuestionBankBackup` returns `{ archived: boolean; pendingCount: number }`.
- `prepareQuestionGroup` awaits the cache result before returning AI-generated questions.

- [ ] **Step 1: Write the failing test**

```js
test("automatic snapshot does not mark records as uploaded", () => {
  const snapshot = createAutoBackupSnapshot({ "vision-interview-records": [{ id: "record-1" }] });
  assert.deepEqual(snapshot, {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/backup-core.test.mjs`

Expected: FAIL until the automatic snapshot boundary exists.

- [ ] **Step 3: Write minimal implementation**

Make `syncAiQuestionBankBackup` return the archive outcome, await it in `prepareQuestionGroup`, and update the AI preparation message with “已缓存到远程题库” or “已保存到本地待同步队列”. Treat `{ available: false }` backup responses as local-only informational state and use the label “仅本地保存”.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test && npm run build`

Expected: all tests pass and the production build completes.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx components/backup-sync.tsx tests/backup-core.test.mjs
git commit -m "fix: clarify local backup mode and await question cache"
```

### Task 4: Full verification and publication

**Files:**
- Verify: `app/page.tsx`, `components/backup-sync.tsx`, `lib/backup-core.mjs`, `tests/backup-core.test.mjs`

- [ ] **Step 1: Run the complete test and build gate**

Run: `npm test && npm run build`

Expected: all tests pass, build succeeds, and no credentials appear in generated data or logs.

- [ ] **Step 2: Inspect the final diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors and only intended source, test, spec, and plan files changed.

- [ ] **Step 3: Sync the validated source to GitHub**

Fetch the current GitHub `main` tip immediately before creating the commit, create a commit whose parent is that tip, and update `main` with force disabled. Preserve all existing history.

- [ ] **Step 4: Prepare and publish the Site checkpoint**

Run the Sites checkpoint workflow for the edited checkout, save the exact prepared archive as a new Site version, deploy that exact version, and verify the deployment status directly until it returns a production URL.

- [ ] **Step 5: Report the remaining runtime prerequisite**

Tell the user that the deployed manual upload and remote AI cache become effective after adding the GitHub write token as a Sites secret; until then the UI intentionally stays in “仅本地保存” mode and preserves local pending data.
