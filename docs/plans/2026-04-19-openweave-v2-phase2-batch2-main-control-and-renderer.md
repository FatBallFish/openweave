# OpenWeave V2 Phase 2 Batch 2 Main-Process Control and Renderer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish the remaining Phase 2 interactive-terminal work on top of the current Task 2/3 WIP by fixing exit-confirmed stop semantics in the `runs` subsystem, landing the renderer interactive terminal surface, and closing the focused Phase 2 verification/doc gaps.

**Architecture:** Continue the additive evolution of the existing `runs` service, runtime bridge, runtime worker, and legacy renderer shell. Do not introduce a second session subsystem. Keep `node-pty` inside the worker boundary, move the final `stopped` transition to the confirmed runtime-exit path, and build the renderer terminal UX on top of the existing canvas node and run-drawer structure.

**Tech Stack:** Electron main/worker TypeScript, React renderer, Vitest, Playwright Electron, `node-pty`, `@xterm/xterm` (and fit addon if needed), existing sqlite repositories, runtime bridge, and workspace skill injection pipeline.

---

## Why this plan exists

The current worktree already completed the first execution batch from `docs/plans/2026-04-19-openweave-v2-phase2-interactive-terminal.md`:

1. Task 1 re-baseline/review is complete.
2. Task 2 additive `runInput` / `runStop` contracts and `stopped` status are landed.
3. Task 3 PTY-backed worker/runtime bridge path is landed.

The remaining Phase 2 gaps are now concentrated in:

- main-process stop/final-status semantics,
- renderer runtime selection + interactive terminal UI,
- final focused verification and doc backfill.

This plan intentionally starts from the current dirty worktree state and must not re-do Phase 1 or recreate the PTY groundwork.

## Current accepted baseline in this worktree

Treat these as already in progress / accepted WIP in `/Users/fatballfish/Documents/Projects/ClientProjects/openweave/.worktrees/feat/phase2-interactive-terminal`:

- `runInput` / `runStop` IPC contracts exist.
- `runStatusSchema` already accepts `stopped`.
- preload exposes additive run controls.
- worker runtime path is PTY-backed through `node-pty`.
- runtime bridge forwards `input` / `stop` to active workers.
- focused main/worker tests for the above currently pass.

Expected dirty files before this batch starts:

- `package.json`
- `package-lock.json`
- `src/main/ipc/runs.ts`
- `src/main/preload.ts`
- `src/main/runtime/runtime-bridge.ts`
- `src/shared/ipc/contracts.ts`
- `src/shared/ipc/schemas.ts`
- `src/worker/adapters/shell-runtime.ts`
- `src/worker/runtime-worker.ts`
- `src/worker/adapters/pty-runtime.ts`
- `tests/integration/main/runs-ipc.test.ts`
- `tests/integration/main/runs-register-recovery.test.ts`
- `tests/integration/main/runtime-launch.test.ts`
- `tests/unit/main/preload.test.ts`
- `tests/unit/worker/runtime-adapters.test.ts`
- `docs/plans/2026-04-19-openweave-v2-phase2-risk-log.md`

These are expected. Do not treat them as unrelated changes. Do not revert them.

## Primary references to review before editing

- `docs/prd/2026-04-18-openweave-prd-v2-refactor.md`
- `docs/tech-design/2026-04-18-openweave-tech-design-v2-refactor.md`
- `docs/plans/2026-04-18-openweave-phase1-kernel-spec.md`
- `docs/plans/2026-04-18-openweave-refactor-execution-plan.md`
- `docs/plans/2026-04-19-openweave-v2-phase2-interactive-terminal.md`
- `docs/plans/2026-04-19-openweave-v2-phase2-risk-log.md`

## Hard constraints for this batch

1. Do not work on `main`.
2. Do not create a new worktree if the current Phase 2 worktree already exists.
3. Do not revert unrelated dirty changes.
4. Keep `node-pty` confined to `src/worker/**`; renderer/shared must not import it.
5. Preserve current managed-runtime preflight ordering and skill-injection semantics.
6. Do not widen scope into builtin component migration, Canvas Shell V2, socket/named-pipe transport, or headless `serve`.
7. Prefer additive changes inside the existing `runs` subsystem.

## Task 1: Re-baseline the current Phase 2 worktree before changing behavior

**Files to read:**
- `docs/plans/2026-04-19-openweave-v2-phase2-interactive-terminal.md`
- `docs/plans/2026-04-19-openweave-v2-phase2-risk-log.md`

**Files to inspect:**
- `src/main/ipc/runs.ts`
- `src/main/runtime/runtime-bridge.ts`
- `src/worker/runtime-worker.ts`
- `src/renderer/features/canvas/canvas.store.ts`
- `src/renderer/features/canvas/nodes/TerminalNode.tsx`
- `src/renderer/features/runs/RunDrawer.tsx`
- `tests/integration/main/runs-ipc.test.ts`
- `tests/integration/main/runtime-launch.test.ts`
- `tests/e2e/terminal-run.spec.ts`
- `tests/e2e/restart-recovery.spec.ts`

**Step 1: Confirm the dirty baseline matches expectations**

Run:
```bash
git status --short
```

Expected: the Phase 2 WIP files listed above are dirty/untracked; no attempt should be made to clean them.

**Step 2: Run the focused baseline verification batch**

Run:
```bash
npx vitest run \
  tests/unit/main/preload.test.ts \
  tests/unit/main/runtime-bridge.behavior.test.ts \
  tests/unit/worker/runtime-adapters.test.ts \
  tests/integration/main/runs-ipc.test.ts \
  tests/integration/main/runs-register-recovery.test.ts \
  tests/integration/main/runtime-launch.test.ts
```

Expected: PASS on the current Task 2/3 WIP.

**Step 3: Write the remaining-gap checklist in working notes**

Capture the concrete facts that still remain true:

- `stopRun` persists `stopped` before the real worker exit is confirmed.
- managed-runtime exclusivity can be bypassed during the stop grace window.
- stop/exit race can drop shutdown tail output or mislabel a near-finished run.
- renderer terminal node still hardcodes runtime at click-time or lacks persisted runtime selection.
- renderer still lacks a real interactive terminal session pane and still treats only `completed` / `failed` as terminal in the drawer.

**Step 4: Stop if the baseline is inconsistent**

If the current worktree state does not match the expected WIP or the focused baseline tests fail before new edits, stop and report instead of patching around unknown drift.

## Task 2: Finalize stop semantics on confirmed runtime exit

**Goal:** Keep the existing additive IPC surface, but move the final `stopped` outcome to the confirmed runtime-exit path so managed-runtime protection, tail capture, and final status are consistent.

**Files:**
- Modify: `src/main/ipc/runs.ts`
- Modify if needed: `src/main/runtime/runtime-bridge.ts`
- Test: `tests/integration/main/runs-ipc.test.ts`
- Test: `tests/integration/main/runs-register-recovery.test.ts`
- Test: `tests/integration/main/runtime-launch.test.ts`

**Step 1: Write the failing tests**

Cover at minimum:

- stopping a managed runtime does **not** immediately allow a different managed runtime to start until the exit/finalization path completes,
- a stop request preserves late tail output until the worker exit arrives,
- a stop-intended run becomes `stopped` only after confirmed exit,
- recovery still marks truly orphaned `queued` / `running` runs as `failed`,
- unsupported-runtime behavior and preflight ordering remain unchanged.

**Step 2: Run tests to verify RED**

Run:
```bash
npx vitest run \
  tests/integration/main/runs-ipc.test.ts \
  tests/integration/main/runs-register-recovery.test.ts \
  tests/integration/main/runtime-launch.test.ts
```

Expected: FAIL because current stop handling finalizes `stopped` too early.

**Step 3: Write minimal implementation**

Implement additively:

- track stop intent separately from final terminal status inside `src/main/ipc/runs.ts`,
- keep the run non-terminal for conflict checks until the runtime exit event is processed,
- continue accepting stream events until final completion,
- derive final status on exit using stop intent plus the real exit outcome,
- keep the accepted preflight ordering and current coded error behavior stable.

Do not add a new persisted run-state taxonomy unless the tests prove it is necessary.

**Step 4: Run tests to verify GREEN**

Run:
```bash
npx vitest run \
  tests/integration/main/runs-ipc.test.ts \
  tests/integration/main/runs-register-recovery.test.ts \
  tests/integration/main/runtime-launch.test.ts
```

Expected: PASS.

## Task 3: Add runtime selection to terminal-node persistence and store

**Goal:** Extend the legacy terminal-node model additively so renderer/UI can select `shell` / `codex` / `claude` / `opencode` without breaking current canvas persistence.

**Files:**
- Modify: `src/shared/ipc/schemas.ts`
- Modify if needed: `src/main/db/workspace.ts`
- Modify if needed: `src/main/db/migrations/workspace/001_init.sql` or add a new migration only if truly required
- Modify: `src/renderer/features/canvas/canvas.store.ts`
- Modify: `src/renderer/features/canvas/nodes/TerminalNode.tsx`
- Test: `tests/unit/renderer/canvas.store.test.ts`
- Test if needed: `tests/integration/main/graph-persistence-v2.test.ts`

**Step 1: Write the failing tests**

Cover:

- new terminal nodes default to `runtime: 'shell'`,
- terminal-node updates can persist runtime changes,
- canvas load/save keeps terminal runtime stable,
- terminal node no longer hardcodes `runtime: 'shell'` inside the run-click path.

**Step 2: Run tests to verify RED**

Run:
```bash
npx vitest run \
  tests/unit/renderer/canvas.store.test.ts
```

If graph/canvas persistence coverage is extended, also run the exact added test file.

Expected: FAIL because terminal nodes currently only persist `command`.

**Step 3: Write minimal implementation**

Implement additively:

- add `runtime` to `terminalNodeSchema`,
- keep default runtime as `'shell'`,
- update canvas store creation/update helpers,
- update terminal node UI to read/write runtime from node state,
- avoid widening into manifest-driven builtin migration.

Prefer backward-safe load behavior for existing in-worktree test fixtures if needed.

**Step 4: Run tests to verify GREEN**

Run:
```bash
npx vitest run \
  tests/unit/renderer/canvas.store.test.ts
```

And any exact added persistence test command.

Expected: PASS.

## Task 4: Build the renderer interactive terminal session surface

**Goal:** Replace the current command-form + tail-log-only experience with a real interactive terminal session pane inside the existing renderer shell.

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/renderer/features/canvas/nodes/TerminalNode.tsx`
- Modify: `src/renderer/features/runs/RunDrawer.tsx`
- Create: `src/renderer/features/runs/TerminalSessionPane.tsx`
- Modify if needed: `src/renderer/features/canvas/WorkspaceCanvasPage.tsx`
- Modify if needed: `src/renderer/main.tsx`
- Test: `tests/unit/renderer/canvas.store.test.ts`
- Create: `tests/unit/renderer/terminal-session-pane.test.ts`
- Test: `tests/e2e/terminal-run.spec.ts`
- Test: `tests/e2e/restart-recovery.spec.ts`

**Step 1: Write the failing tests**

Cover at minimum:

- terminal UI lets the user choose `shell` / `codex` / `claude` / `opencode`,
- interactive terminal session can receive follow-up input after launch,
- stop button ends the session with `stopped`,
- `RunDrawer`/session UI treats `stopped` as terminal rather than active,
- restart recovery still shows interrupted/crashed sessions correctly.

Prefer one minimal E2E path such as:

- launch `cat`,
- type a line into the terminal,
- observe echoed output,
- stop the session,
- observe `stopped` UI.

**Step 2: Run tests to verify RED**

Run:
```bash
npx vitest run \
  tests/unit/renderer/canvas.store.test.ts \
  tests/unit/renderer/terminal-session-pane.test.ts

npm run build

npx playwright test -c playwright.config.ts \
  tests/e2e/terminal-run.spec.ts \
  tests/e2e/restart-recovery.spec.ts --reporter=line
```

Expected: FAIL because the current renderer is still non-interactive and still treats only `completed` / `failed` as terminal.

**Step 3: Write minimal implementation**

Implement:

- runtime selector in the terminal node,
- xterm-based session pane (or the thinnest equivalent interactive terminal surface needed to satisfy the tests),
- input forwarding through `runInput`,
- stop through `runStop`,
- session polling/refresh on top of the existing `getRun` path,
- `RunDrawer` terminal-state handling that includes `stopped`.

Do not start builtin component host migration in this slice.

**Step 4: Run tests to verify GREEN**

Run:
```bash
npx vitest run \
  tests/unit/renderer/canvas.store.test.ts \
  tests/unit/renderer/terminal-session-pane.test.ts

npm run build

npx playwright test -c playwright.config.ts \
  tests/e2e/terminal-run.spec.ts \
  tests/e2e/restart-recovery.spec.ts --reporter=line
```

Expected: PASS.

## Task 5: Phase 2 focused verification and doc backfill

**Goal:** End this batch with updated Phase 2 docs and a verification record that reflects the real current closure state.

**Files:**
- Modify if needed: `docs/tech-design/2026-04-18-openweave-tech-design-v2-refactor.md`
- Modify if needed: `docs/plans/2026-04-18-openweave-refactor-execution-plan.md`
- Modify: `docs/plans/2026-04-19-openweave-v2-phase2-risk-log.md`
- Modify if useful: `docs/plans/2026-04-19-openweave-v2-phase2-next-session-prompt.md`

**Step 1: Run the focused verification batch**

Run:
```bash
npx vitest run \
  tests/unit/main/preload.test.ts \
  tests/unit/main/runtime-bridge.behavior.test.ts \
  tests/unit/worker/runtime-adapters.test.ts \
  tests/unit/renderer/canvas.store.test.ts \
  tests/unit/renderer/terminal-session-pane.test.ts \
  tests/integration/main/runs-ipc.test.ts \
  tests/integration/main/runs-register-recovery.test.ts \
  tests/integration/main/runtime-launch.test.ts
```

Expected: PASS.

**Step 2: Run build verification**

Run:
```bash
npm run build
```

Expected: PASS.

**Step 3: Run focused Electron E2E verification**

Run:
```bash
npx playwright test -c playwright.config.ts \
  tests/e2e/terminal-run.spec.ts \
  tests/e2e/restart-recovery.spec.ts --reporter=line
```

Expected: PASS.

**Step 4: Update docs**

Backfill:

- what is now complete in Phase 2 after this batch,
- what remains deferred for builtin components / Canvas Shell V2,
- any cross-platform or PTY-specific risks that remain open,
- whether a further follow-up session is still needed.

**Step 5: Final review gates**

Perform:

- spec compliance review,
- code quality review.

Do not call the slice complete until both are green or explicitly dispositioned.

## Exit criteria for this batch

This batch is successful if all of the following are true:

1. `stopRun` no longer finalizes `stopped` before real worker exit is confirmed.
2. managed-runtime exclusivity remains intact during stop grace/exit finalization.
3. terminal-node runtime selection is persisted in the legacy canvas model.
4. renderer can choose `shell` / `codex` / `claude` / `opencode`.
5. renderer supports follow-up input and stop for an active terminal session.
6. renderer treats `stopped` as a terminal outcome.
7. focused Vitest, build, and Playwright terminal E2E all pass.

## Explicitly deferred after this batch

These remain out of scope unless the user explicitly expands it:

1. Builtin component migration onto manifest-driven renderer hosts
2. Canvas Shell V2 / React Flow migration
3. Socket / named-pipe / headless `openweave serve`
4. npm package install source support
5. Full external worker runtime auto-loading in product runtime paths
