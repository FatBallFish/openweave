# Run Output Offset Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate shell/TUI first-paint output loss after workspace reopen by giving run output a single monotonic offset contract shared by stream events and persisted snapshots.

**Architecture:** Extend the main-process run model so every output append advances a per-run offset and every stream event carries offset metadata. Update renderer terminal surfaces to reconcile active runs against offsets instead of guessing from raw `tailLog` equality, allowing safe catch-up without reintroducing stream/snapshot races.

**Tech Stack:** Electron IPC, TypeScript, React, xterm.js, Vitest

---

### Task 1: Define Offset-Carrying Run Output Contracts

**Files:**
- Modify: `src/shared/ipc/contracts.ts`
- Modify: `src/shared/ipc/schemas.ts`
- Test: `tests/unit/main/runs-ipc.test.ts`

**Step 1: Write the failing test**

Add/extend tests that assert:
- run stream payloads include monotonic output offsets
- run records returned by runs IPC include enough metadata for renderer catch-up
- subsequent chunks advance offsets without resetting for the same run

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/main/runs-ipc.test.ts`
Expected: FAIL because offset fields are missing from the contract or handler output.

**Step 3: Write minimal implementation**

Update shared IPC types so:
- `RunRecord` includes output position metadata for its persisted tail snapshot
- stream event payload includes chunk start/end offsets
- schemas/types stay aligned across main and renderer usage

Keep field names simple and explicit, e.g. `tailStartOffset`, `tailEndOffset`, `chunkStartOffset`, `chunkEndOffset`.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/main/runs-ipc.test.ts`
Expected: PASS

---

### Task 2: Track Offsets in Main Run Lifecycle

**Files:**
- Modify: `src/main/ipc/runs.ts`
- Modify: `src/main/db/workspace.ts` only if persistence mapping requires new fields
- Test: `tests/integration/main/runs-register-recovery.test.ts`
- Test: `tests/integration/main/runtime-launch.test.ts`
- Test: `tests/unit/main/runs-ipc.test.ts`

**Step 1: Write the failing test**

Add/extend tests that prove:
- stdout/stderr appends increase per-run offsets monotonically
- stream broadcasts expose the correct chunk range
- `listRuns`/`getRun` return tail metadata aligned with the latest appended offset
- recovered terminal runs preserve a valid snapshot range and do not masquerade as live output

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/main/runs-ipc.test.ts tests/integration/main/runtime-launch.test.ts tests/integration/main/runs-register-recovery.test.ts`
Expected: FAIL because run state does not yet track offsets.

**Step 3: Write minimal implementation**

In the in-memory run service:
- maintain a cumulative output offset per run
- when appending output, compute chunk start/end offsets before truncating stored tail
- when tail truncation happens, advance `tailStartOffset` while preserving `tailEndOffset`
- on exit/recovery, keep offsets consistent with the final tail snapshot

Do not change run ordering or recovery semantics beyond the new metadata.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/main/runs-ipc.test.ts tests/integration/main/runtime-launch.test.ts tests/integration/main/runs-register-recovery.test.ts`
Expected: PASS

---

### Task 3: Add Renderer Catch-Up State Machine for Active Runs

**Files:**
- Modify: `src/renderer/features/canvas/nodes/TerminalNode.tsx`
- Modify: `src/renderer/features/runs/TerminalSessionPane.tsx`
- Test: `tests/unit/renderer/terminal-node.test.ts`
- Test: `tests/unit/renderer/terminal-session-pane.test.ts`

**Step 1: Write the failing test**

Add/extend tests for both terminal surfaces covering:
- active run loses its first prompt to late stream subscription, then safely catches up from snapshot once
- stream output already applied is not replayed when poll returns the same bytes
- ANSI/TUI redraw snapshots do not roll back a live surface once stream is ahead
- offset discontinuity or truncation triggers a controlled full redraw instead of corrupt incremental append

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/renderer/terminal-node.test.ts tests/unit/renderer/terminal-session-pane.test.ts`
Expected: FAIL because renderer still compares raw `tailLog` text and lacks offset-aware reconciliation.

**Step 3: Write minimal implementation**

Introduce an explicit render sync model per mounted terminal:
- track `renderedOffset`
- on stream event, append chunk and advance `renderedOffset`
- on polled snapshot for active runs:
  - ignore when snapshot end offset is not ahead
  - append only the missing suffix when snapshot fully covers the current rendered range
  - full redraw only when offsets prove the local surface cannot be incrementally repaired

Do not let active-run polling blindly clear/rewrite the terminal on plain text mismatch.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/renderer/terminal-node.test.ts tests/unit/renderer/terminal-session-pane.test.ts`
Expected: PASS

---

### Task 4: Guard Workspace-Reopen and Stale-Run Flows

**Files:**
- Modify: `src/renderer/features/canvas/WorkspaceCanvasPage.tsx` only if needed to propagate cleaner reopen behavior
- Modify: `src/renderer/features/runs/RunDrawer.tsx` only if needed for offset-aware drawer sync
- Test: `tests/unit/renderer/workspace-canvas-page.test.ts`
- Test: `tests/unit/renderer/run-drawer.test.ts`

**Step 1: Write the failing test**

Add focused tests if current coverage misses:
- reopening a workspace with recovered history plus a fresh active run shows the fresh run once available
- stale drawer runs still close cleanly
- no cross-workspace run state leaks through the new sync metadata

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/renderer/workspace-canvas-page.test.ts tests/unit/renderer/run-drawer.test.ts`
Expected: FAIL only if supporting adjustments are required.

**Step 3: Write minimal implementation**

Make only the narrow supporting changes required by the new output protocol. Do not broaden workspace switching behavior unless a failing test proves it is necessary.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/renderer/workspace-canvas-page.test.ts tests/unit/renderer/run-drawer.test.ts`
Expected: PASS

---

### Task 5: Full Verification

**Files:**
- No additional product files unless verification reveals a defect

**Step 1: Run focused renderer and main tests**

Run: `npm test -- tests/unit/main/runs-ipc.test.ts tests/integration/main/runtime-launch.test.ts tests/integration/main/runs-register-recovery.test.ts tests/unit/renderer/terminal-node.test.ts tests/unit/renderer/terminal-session-pane.test.ts tests/unit/renderer/workspace-canvas-page.test.ts tests/unit/renderer/run-drawer.test.ts`
Expected: PASS

**Step 2: Run any broader terminal-adjacent suite that is cheap enough**

Run: `npm test -- tests/unit/worker/runtime-adapters.test.ts`
Expected: PASS

**Step 3: Review diff for protocol consistency**

Check that shared contract names match their usage in main and renderer and that no fallback path still compares active-run snapshots by raw text alone.

**Step 4: Commit**

```bash
git add docs/plans/2026-04-24-run-output-offset-sync.md src/shared/ipc/contracts.ts src/shared/ipc/schemas.ts src/main/ipc/runs.ts src/main/db/workspace.ts src/renderer/features/canvas/nodes/TerminalNode.tsx src/renderer/features/runs/TerminalSessionPane.tsx src/renderer/features/canvas/WorkspaceCanvasPage.tsx src/renderer/features/runs/RunDrawer.tsx tests/unit/main/runs-ipc.test.ts tests/integration/main/runtime-launch.test.ts tests/integration/main/runs-register-recovery.test.ts tests/unit/renderer/terminal-node.test.ts tests/unit/renderer/terminal-session-pane.test.ts tests/unit/renderer/workspace-canvas-page.test.ts tests/unit/renderer/run-drawer.test.ts tests/unit/worker/runtime-adapters.test.ts
git commit -m "fix: sync terminal output with monotonic offsets"
```
