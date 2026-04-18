# OpenWeave V2 Phase 2 Interactive Terminal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Land a real interactive terminal chain on top of the completed Phase 1 kernel so Terminal can support true input/output, runtime selection, and stop semantics for `shell` / `codex` / `claude` / `opencode` without widening into builtin rewrite or Canvas Shell V2.

**Architecture:** Reuse the current `runs` service, runtime bridge, runtime worker, skill injection, and renderer Terminal node as the base. Do not introduce a second "session" subsystem. Instead, extend the current run model additively with PTY-backed worker execution, input/stop IPC, and a renderer terminal surface. Keep `node-pty` confined to the worker boundary and keep CLI/component/graph contracts stable unless additive changes are required for interactivity.

**Tech Stack:** Electron main/worker process TypeScript, React renderer, Vitest, Playwright Electron, `node-pty`, `@xterm/xterm`, existing sqlite repositories and runtime bridge.

---

## Why this is the next plan

Current branch facts:

1. Phase 1 kernel is landed on `feat/phase1-kernel-shared`.
2. The next major PRD gap is still FR-012 ~ FR-014:
   - true interactive terminal I/O
   - four runtime kinds in the terminal product surface
   - input-again and interrupt support
3. The renderer still uses legacy hardcoded node UIs, so builtin component rewrite and Canvas Shell V2 are wider slices and should stay deferred until the interactive runtime chain is real.

Working decision:

- Even though the PRD release strategy has one sentence that could be read as "builtin rewrite immediately after Phase 1", the detailed V2 milestone split (`Phase 2: Interactive Terminal`, `Phase 3: builtin components`, `Phase 4: Canvas Shell V2`) plus the actual code gaps on this branch make Interactive Terminal the correct next slice.
- This plan therefore targets **Phase 2 only**.

## Context Baseline

Treat the following as already accepted on this branch:

1. Graph Schema V2 persistence and shared contracts
2. Component Manifest V1 / registry / installer (`directory` / `zip`)
3. Embedded workspace/node query service and `openweave` CLI command surfaces
4. Component action dispatcher and builtin note/text/attachment adapters
5. Skill Pack Manager and Workspace Skill Injection Manager
6. Runtime launch matrix including `opencode`
7. Demo external component closure test
8. Phase 1 verification + doc backfill

Primary references before implementation:

- `docs/prd/2026-04-18-openweave-prd-v2-refactor.md`
- `docs/tech-design/2026-04-18-openweave-tech-design-v2-refactor.md`
- `docs/plans/2026-04-18-openweave-phase1-kernel-spec.md`
- `docs/plans/2026-04-18-openweave-refactor-execution-plan.md`
- `docs/plans/2026-04-16-openweave-windows-runtime-poc-validation.md`
- `docs/plans/2026-04-16-openweave-windows-runtime-poc-report.md`

Current code to inspect before changing anything:

- `src/main/ipc/runs.ts`
- `src/main/runtime/runtime-bridge.ts`
- `src/worker/runtime-worker.ts`
- `src/worker/adapters/*.ts`
- `src/main/preload.ts`
- `src/renderer/features/canvas/nodes/TerminalNode.tsx`
- `src/renderer/features/runs/RunDrawer.tsx`
- `tests/integration/main/runtime-launch.test.ts`
- `tests/integration/main/runs-ipc.test.ts`
- `tests/integration/main/runs-register-recovery.test.ts`
- `tests/e2e/terminal-run.spec.ts`
- `tests/e2e/restart-recovery.spec.ts`

## Session Scope

### In Scope

1. PTY-backed runtime execution inside the worker boundary
2. Additive `run` contract changes for input and stop
3. Renderer terminal runtime selector plus interactive terminal surface
4. Recovery/status behavior for interactive terminal runs
5. Verification for FR-012 ~ FR-014

### Out of Scope

1. Builtin component rewrite onto manifest-driven renderer hosts
2. Canvas Shell V2 / React Flow migration
3. Socket / named-pipe / independent headless `openweave serve`
4. npm install source support
5. Full external component runtime auto-loading in product paths

### Hard Constraints

1. Do not work on `main`.
2. Do not revert unrelated dirty changes if the branch stops being clean later.
3. Keep `node-pty` confined to the worker boundary; renderer/shared must not import it.
4. Preserve current skill-injection flow and current managed-runtime preflight ordering.
5. Prefer additive contract changes over replacing the current `runs` subsystem.
6. Do not widen this slice into builtin component migration or canvas redesign.

## Task 1: Re-baseline the terminal gap before implementation

**Files to read:**
- `docs/prd/2026-04-18-openweave-prd-v2-refactor.md`
- `docs/tech-design/2026-04-18-openweave-tech-design-v2-refactor.md`
- `docs/plans/2026-04-18-openweave-phase1-kernel-spec.md`
- `docs/plans/2026-04-18-openweave-refactor-execution-plan.md`
- `docs/plans/2026-04-16-openweave-windows-runtime-poc-validation.md`
- `docs/plans/2026-04-16-openweave-windows-runtime-poc-report.md`

**Files to inspect:**
- `src/main/ipc/runs.ts`
- `src/main/runtime/runtime-bridge.ts`
- `src/worker/runtime-worker.ts`
- `src/worker/adapters/shell-runtime.ts`
- `src/renderer/features/canvas/nodes/TerminalNode.tsx`
- `src/renderer/features/runs/RunDrawer.tsx`
- `tests/e2e/terminal-run.spec.ts`

**Step 1: Write the current-gap checklist**

Capture, in working notes, the current reality:

- Terminal node is still a legacy canvas node with command-only config
- UI hardcodes `runtime: 'shell'`
- runs are polled and tail-log based, not interactive
- no input/stop surface exists
- runtime worker currently launches child processes, not PTY-backed sessions

**Step 2: Stop if a structural blocker appears**

If the current code makes it impossible to add PTY interaction additively to the `runs` subsystem, stop and report before implementing. Do not silently invent a second session stack.

**Step 3: Create the execution todo list**

Use the tasks below as the only scope for this session.

## Task 2: Add additive interactive run contracts

**Goal:** Extend the current run model so interactive terminal sessions can accept input, stop cleanly, and surface `stopped` as a first-class terminal outcome.

**Files:**
- Modify: `src/shared/ipc/schemas.ts`
- Modify: `src/shared/ipc/contracts.ts`
- Modify: `src/main/preload.ts`
- Modify: `src/main/db/migrations/workspace/001_init.sql` or add a new workspace migration if needed
- Modify: `src/main/db/workspace.ts`
- Test: `tests/unit/main/preload.test.ts`
- Test: `tests/integration/main/runs-ipc.test.ts`
- Test: `tests/integration/main/runs-register-recovery.test.ts`

**Step 1: Write the failing tests**

Cover at minimum:

- `runStatusSchema` accepts `stopped`
- preload exposes additive terminal controls (for example `inputRun` / `stopRun`)
- runs IPC supports input and stop commands
- stopped runs persist as `stopped` instead of `failed`
- recovery still marks truly orphaned runs as failed, not stopped

**Step 2: Run tests to verify RED**

Run:
```bash
npx vitest run \
  tests/unit/main/preload.test.ts \
  tests/integration/main/runs-ipc.test.ts \
  tests/integration/main/runs-register-recovery.test.ts
```

Expected: FAIL because the interactive run contracts do not exist yet.

**Step 3: Write minimal implementation**

Implement additively:

- `runInput` and `runStop` schemas/contracts
- `stopped` run status
- any minimal run-record persistence additions required by the tests
- preload bridge exposure for the new run actions

Do not rename `runs` to a new subsystem in this slice.

**Step 4: Run tests to verify GREEN**

Run:
```bash
npx vitest run \
  tests/unit/main/preload.test.ts \
  tests/integration/main/runs-ipc.test.ts \
  tests/integration/main/runs-register-recovery.test.ts
```

Expected: PASS

## Task 3: Make the runtime worker PTY-backed and controllable

**Goal:** Replace the current non-interactive child-process terminal launch path with a PTY-backed worker flow that still preserves the accepted runtime matrix and worker isolation.

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/worker/adapters/pty-runtime.ts`
- Modify: `src/worker/adapters/shell-runtime.ts`
- Modify: `src/worker/adapters/codex-runtime.ts`
- Modify: `src/worker/adapters/claude-runtime.ts`
- Modify: `src/worker/adapters/opencode-runtime.ts`
- Modify: `src/worker/runtime-worker.ts`
- Modify: `src/main/runtime/runtime-bridge.ts`
- Test: `tests/unit/worker/runtime-adapters.test.ts`
- Test: `tests/integration/main/runtime-launch.test.ts`

**Step 1: Write the failing tests**

Cover:

- PTY launch stays inside the worker boundary
- runtime bridge can forward input to an active worker
- runtime bridge can request stop/interrupt for an active worker
- current runtime kinds still resolve and launch through the same matrix
- `SystemRoot` preservation and env pass-through remain intact for future Windows validation

**Step 2: Run tests to verify RED**

Run:
```bash
npx vitest run \
  tests/unit/worker/runtime-adapters.test.ts \
  tests/integration/main/runtime-launch.test.ts
```

Expected: FAIL because the current worker path is not PTY-backed and does not support input/stop control.

**Step 3: Write minimal implementation**

Implement:

- a PTY launcher wrapper using `node-pty`
- worker message handling for `start`, `input`, and `stop`
- runtime bridge support for forwarding input/stop to the correct worker
- preservation of existing `shell` / `codex` / `claude` / `opencode` runtime routing

Do not add socket transport or a second bridge layer here.

**Step 4: Run tests to verify GREEN**

Run:
```bash
npx vitest run \
  tests/unit/worker/runtime-adapters.test.ts \
  tests/integration/main/runtime-launch.test.ts
```

Expected: PASS

## Task 4: Wire main-process run control on top of the interactive worker path

**Goal:** Make `runs.ts` actually use the new interactive worker controls while preserving the current preflight ordering and managed runtime protections.

**Files:**
- Modify: `src/main/ipc/runs.ts`
- Modify if needed: `src/main/runtime/runtime-bridge.ts`
- Test: `tests/integration/main/runs-ipc.test.ts`
- Test: `tests/integration/main/runs-register-recovery.test.ts`

**Step 1: Write the failing tests**

Extend coverage so it asserts:

- `startRun` still performs managed-runtime preflight before launch
- `inputRun` appends interactive input to the active PTY session
- `stopRun` produces `stopped` rather than `failed`
- managed-runtime conflict protection still works
- disposing workspace runs still cleans managed skill files

**Step 2: Run tests to verify RED**

Run:
```bash
npx vitest run \
  tests/integration/main/runs-ipc.test.ts \
  tests/integration/main/runs-register-recovery.test.ts \
  tests/integration/main/runtime-launch.test.ts
```

Expected: FAIL until the run-control wiring is complete.

**Step 3: Write minimal implementation**

Implement:

- additive run IPC handlers for input/stop
- clean stop-state handling in the in-memory run service
- unchanged managed-runtime preflight order
- unchanged coded unsupported-runtime behavior

Do not redesign the whole run history model in this slice.

**Step 4: Run tests to verify GREEN**

Run:
```bash
npx vitest run \
  tests/integration/main/runs-ipc.test.ts \
  tests/integration/main/runs-register-recovery.test.ts \
  tests/integration/main/runtime-launch.test.ts
```

Expected: PASS

## Task 5: Build the renderer interactive terminal surface

**Goal:** Replace the current command form + tail-log drawer experience with a real terminal interaction surface while staying inside the existing renderer shell.

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/shared/ipc/schemas.ts`
- Modify: `src/renderer/features/canvas/canvas.store.ts`
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

Cover:

- new Terminal nodes default to a runtime field instead of hardcoding shell at click-time
- terminal UI lets the user choose `shell` / `codex` / `claude` / `opencode`
- interactive shell session can receive follow-up input after start
- stop button ends the run as `stopped`
- restart recovery still shows interrupted/crashed sessions correctly

Prefer one minimal interactive E2E path such as:

- launch `cat`
- type a line into the terminal
- observe echoed output
- stop the session

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

Expected: FAIL because the current UI is still non-interactive and shell-only.

**Step 3: Write minimal implementation**

Implement:

- additive terminal node runtime field in the legacy canvas model
- renderer runtime selector
- xterm-based terminal pane (or the thinnest equivalent renderer surface needed to satisfy the tests)
- input forwarding through `runInput`
- stop button through `runStop`
- polling or incremental refresh of terminal output on top of the existing run retrieval path

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

Expected: PASS

## Task 6: Phase 2 verification and doc backfill

**Goal:** End the slice with a clear statement of what Phase 2 now covers and what still remains for builtin rewrite and Canvas Shell V2.

**Files:**
- Modify if needed: `docs/tech-design/2026-04-18-openweave-tech-design-v2-refactor.md`
- Modify if needed: `docs/plans/2026-04-18-openweave-refactor-execution-plan.md`
- Create or update if used during execution: `docs/plans/2026-04-19-openweave-v2-phase2-risk-log.md`

**Step 1: Run the focused Phase 2 verification batch**

Run at minimum:
```bash
npx vitest run \
  tests/unit/main/preload.test.ts \
  tests/unit/worker/runtime-adapters.test.ts \
  tests/unit/renderer/canvas.store.test.ts \
  tests/unit/renderer/terminal-session-pane.test.ts \
  tests/integration/main/runs-ipc.test.ts \
  tests/integration/main/runs-register-recovery.test.ts \
  tests/integration/main/runtime-launch.test.ts
```

Expected: PASS

**Step 2: Run build verification**

Run:
```bash
npm run build
```

Expected: PASS

**Step 3: Run focused Electron E2E verification**

Run:
```bash
npx playwright test -c playwright.config.ts \
  tests/e2e/terminal-run.spec.ts \
  tests/e2e/restart-recovery.spec.ts --reporter=line
```

Expected: PASS

**Step 4: Update docs**

Backfill:

- what Phase 2 interactive terminal now covers
- what remains for Phase 3 builtin components
- what remains for Phase 4 Canvas Shell V2
- any known cross-platform or PTY-specific risks

**Step 5: Final review gates**

Perform:

- spec compliance review
- code quality review

Do not call the slice complete until both are green or explicitly dispositioned.

## Exit Criteria For This Session

This session is successful if all of the following are true:

1. Terminal supports a real interactive PTY-backed path.
2. Terminal UI can choose `shell` / `codex` / `claude` / `opencode`.
3. Active terminal runs can accept additional input after launch.
4. Active terminal runs can be stopped and surface `stopped`.
5. Managed runtime preflight and skill injection still happen before launch.
6. Focused tests, `npm run build`, and terminal E2E pass.

## Explicitly Deferred After This Plan

These stay for later sessions unless the user expands scope:

1. Builtin component migration onto manifest-driven renderer hosts
2. Canvas Shell V2 / React Flow migration
3. Independent socket / named-pipe / headless `openweave serve`
4. npm package install source support
5. Full external worker runtime auto-loading in product paths
