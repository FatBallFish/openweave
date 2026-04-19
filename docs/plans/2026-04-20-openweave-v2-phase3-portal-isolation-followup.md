# OpenWeave V2 Phase 3 Portal Isolation Follow-up Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate the remaining portal runtime containment regression exposed during the Phase 3 / Phase 4 follow-up, and close the highest-value canvas-shell interaction guardrails without widening scope beyond stabilization.

**Architecture:** Keep the current Graph Schema V2 renderer store, manifest-driven builtin hosts, and Canvas Shell V2 intact. Treat this batch as a stabilization slice: make portal runtime ownership explicitly main-process isolated so portal navigation/actions cannot contaminate the renderer window, and keep canvas-shell host interaction behavior deterministic under React Flow. Preserve the existing IPC/session contracts, branch-workspace semantics, and Phase 2 terminal chain.

**Tech Stack:** Electron `BrowserWindow` / `WebContentsView`, main-process portal IPC/session services, React renderer hosts, `@xyflow/react`, Vitest, Playwright Electron.

---

## Why this is the next plan

Phase 3 / Phase 4 are functionally landed on `feat/phase2-interactive-terminal`, and the `branch-workspace` timeout is already fixed. The most credible remaining gap surfaced during that follow-up work:

1. `portal` interactions can still leak into top-level renderer navigation according to Playwright API traces, even though the current user-facing E2E now passes.
2. Canvas Shell V2 host interactivity still depends on bounded layout/viewport assumptions, so future host growth can reintroduce click interception regressions.
3. The current branch has enough regression coverage to stabilize this now without reopening schema/runtime architecture.

This makes the next batch a **stability / isolation slice**, not another feature slice.

## Current accepted baseline in this worktree

Treat the following as already accepted and out of scope to redo:

- renderer load/save uses Graph Schema V2 additive IPC
- shared builtin manifest catalog is landed in `src/shared/components/builtin-manifests.ts`
- builtin host registry is landed in `src/renderer/features/components/builtin-host-registry.tsx`
- `builtin.note` / `builtin.terminal` / `builtin.file-tree` / `builtin.portal` / `builtin.text` / `builtin.attachment` render through builtin hosts
- Canvas Shell V2 first pass is landed on `@xyflow/react`
- node movement persists back to Graph Schema V2
- `branch-workspace` now copies Graph Schema V2 and passes focused E2E again
- focused build / unit / integration / required renderer E2E are green on the current branch

## Primary references to review before editing

- `docs/plans/2026-04-19-openweave-v2-phase3-phase4-builtin-hosts-and-canvas-shell.md`
- `docs/plans/2026-04-19-openweave-v2-phase3-phase4-risk-log.md`
- `docs/plans/2026-04-19-openweave-v2-phase2-risk-log.md`
- `docs/plans/2026-04-18-openweave-phase1-kernel-spec.md`
- `src/main/portal/portal-manager.ts`
- `src/main/ipc/portal.ts`
- `src/renderer/features/canvas-shell/CanvasShell.tsx`
- `tests/unit/main/portal-manager.behavior.test.ts`
- `tests/integration/main/portal-ipc.test.ts`
- `tests/integration/main/portal-register-ipc.test.ts`
- `tests/e2e/portal-node.spec.ts`
- `tests/e2e/branch-workspace.spec.ts`

## Hard constraints for this batch

1. Do not use a git worktree for execution; use direct branch checkout in the current workspace.
2. Do not work on `main`.
3. Do not reopen Graph Schema V2, renderer session, runtime session, or worker/PTTY architecture.
4. Do not widen scope into socket / named pipe / headless `serve` / npm install source / multi-user collaboration / workflow DSL.
5. Keep `node-pty` inside `src/worker/**` only.
6. Do not regress the already-green terminal / recovery / branch-workspace verification.
7. Prefer additive isolation/stability fixes over product-surface redesign.

## Task 1: Re-baseline the remaining portal containment risk

**Files to read:**
- `docs/plans/2026-04-19-openweave-v2-phase3-phase4-risk-log.md`
- `src/main/portal/portal-manager.ts`
- `src/main/main.ts`
- `tests/e2e/portal-node.spec.ts`
- `tests/e2e/branch-workspace.spec.ts`

**Step 1: Capture the branch-local problem statement**

Write short working notes covering only the facts that remain true:

- Playwright traces showed top-level renderer navigation events during portal actions.
- Current `portal-node` / `branch-workspace` E2E coverage proves feature success, but not explicit renderer containment.
- Canvas-shell host interaction remains sensitive to viewport/layout policy changes.

**Step 2: Stop if a structural blocker appears**

If fixing portal containment requires inventing a second renderer shell, a second portal session subsystem, or reopening Phase 1/2 runtime architecture, stop and report instead of improvising a new architecture.

## Task 2: Add failing regression coverage for renderer-window containment

**Goal:** Make the hidden containment bug fail in tests before implementation.

**Files:**
- Modify: `tests/unit/main/portal-manager.behavior.test.ts`
- Modify: `tests/e2e/portal-node.spec.ts`
- Modify if needed: `tests/e2e/branch-workspace.spec.ts`

**Step 1: Write the failing main-process behavior test**

Add coverage that proves portal runtime setup uses dedicated hidden host ownership rather than leaving navigation coupled to the renderer shell. At minimum, assert:

- portal load creates the hidden host/container required for isolation,
- the host is not shown to the user,
- disposal cleans up the owned resources.

**Step 2: Write the failing Electron E2E assertions**

Extend `tests/e2e/portal-node.spec.ts` so that after portal load and after at least one click/input cycle it also asserts:

- `page.url()` still points at the renderer entry (`file:` URL),
- `workspace-canvas-page` and `canvas-workspace-name` are still visible,
- portal actions did not replace the main window contents.

If useful, add one light assertion to `tests/e2e/branch-workspace.spec.ts` that the canvas page remains mounted before terminal run and branch dialog flow continue.

**Step 3: Run tests to verify RED**

Run:
```bash
npx vitest run tests/unit/main/portal-manager.behavior.test.ts

npx playwright test -c playwright.config.ts \
  tests/e2e/portal-node.spec.ts --reporter=line
```

Expected: FAIL because portal containment is not explicitly guaranteed today.

## Task 3: Implement dedicated portal runtime containment

**Goal:** Ensure portal navigation/actions stay inside a main-process-owned hidden host and cannot take over the renderer window.

**Files:**
- Modify: `src/main/portal/portal-manager.ts`
- Modify if needed: `src/main/ipc/portal.ts`
- Modify if needed: `tests/unit/main/portal-manager.behavior.test.ts`
- Modify if needed: `tests/integration/main/portal-ipc.test.ts`
- Modify if needed: `tests/integration/main/portal-register-ipc.test.ts`

**Step 1: Write minimal implementation**

Implement the smallest stable fix that keeps portal ownership isolated. Preferred direction:

- give each active portal entry an explicit hidden host window/container owned by `portal-manager`,
- attach the `WebContentsView` before loading or interacting with portal content,
- keep the host hidden from the user,
- preserve the existing allowlist / recovery / session ID behavior,
- keep cleanup bounded and deterministic.

Do not redesign the renderer or add a second portal IPC protocol.

**Step 2: Run targeted tests to verify GREEN**

Run:
```bash
npx vitest run \
  tests/unit/main/portal-manager.behavior.test.ts \
  tests/integration/main/portal-ipc.test.ts \
  tests/integration/main/portal-register-ipc.test.ts
```

Expected: PASS.

## Task 4: Lock the canvas-shell interaction guardrail around portal/file-tree/terminal hosts

**Goal:** Keep the currently accepted React Flow shell from regressing back into host click interception.

**Files:**
- Modify if needed: `src/renderer/features/canvas-shell/CanvasShell.tsx`
- Modify if needed: `src/renderer/features/canvas/canvas.store.ts`
- Modify if needed: `src/renderer/features/canvas/nodes/FileTreeNode.tsx`
- Modify if needed: `src/renderer/features/canvas/nodes/PortalNode.tsx`
- Modify if needed: `src/renderer/features/canvas/nodes/TerminalNode.tsx`
- Modify if needed: `tests/unit/renderer/canvas.store.test.ts`
- Modify if needed: `tests/unit/renderer/canvas-shell.test.ts`
- Modify if needed: `tests/e2e/branch-workspace.spec.ts`

**Step 1: Add or tighten the smallest failing regression test if current coverage is insufficient**

Only if the new portal containment assertions still leave a click-targeting blind spot, add one bounded regression test for:

- starter layout separation, or
- host wrapper overflow/interaction containment.

Do not write a large new shell test matrix unless a failing path proves it is needed.

**Step 2: Run RED only if you added coverage**

Run just the new/changed regression tests and confirm they fail for the expected reason.

**Step 3: Implement the minimal guardrail**

Keep changes additive and local to shell/host wrappers. Do not redesign node styling.

**Step 4: Verify GREEN**

Run:
```bash
npx vitest run \
  tests/unit/renderer/canvas.store.test.ts \
  tests/unit/renderer/canvas-shell.test.ts
```

Expected: PASS.

## Task 5: Focused verification and doc backfill

**Goal:** End the slice with proof that portal containment and shell interaction remain stable.

**Files:**
- Modify: `docs/plans/2026-04-19-openweave-v2-phase3-phase4-risk-log.md`
- Modify if useful: `docs/plans/2026-04-20-openweave-v2-phase3-portal-isolation-followup.md`
- Modify if useful: `docs/plans/2026-04-19-openweave-v2-phase3-phase4-next-session-prompt.md`

**Step 1: Run focused verification**

Run:
```bash
npx vitest run \
  tests/unit/main/portal-manager.behavior.test.ts \
  tests/integration/main/portal-ipc.test.ts \
  tests/integration/main/portal-register-ipc.test.ts \
  tests/unit/renderer/canvas.store.test.ts \
  tests/unit/renderer/canvas-shell.test.ts \
  tests/unit/renderer/terminal-node.test.ts \
  tests/unit/renderer/builtin-hosts.test.ts \
  tests/integration/main/branch-workspace.test.ts

npm run build

npx playwright test -c playwright.config.ts \
  tests/e2e/portal-node.spec.ts \
  tests/e2e/branch-workspace.spec.ts --reporter=line
```

Expected: PASS.

**Step 2: Update risk log**

Backfill:

- the portal containment root cause,
- the chosen isolation fix,
- any residual shell-layout guardrail that still remains open,
- exact verification commands that were run.

**Step 3: Final review gates**

Perform:

- spec/scope compliance review,
- code quality review.

Do not call the slice complete until both are green or explicitly dispositioned.

## Exit criteria for this batch

This batch is successful if all of the following are true:

1. Portal load/click/input no longer risks navigating the renderer window away from the workspace UI.
2. Portal manager ownership is explicitly isolated and cleaned up deterministically.
3. `portal-node` E2E asserts renderer-window containment, not just action success.
4. `branch-workspace` E2E remains green.
5. Canvas-shell host interaction guardrails stay green under the focused regression set.
6. Focused Vitest, build, and Playwright verification all pass.

## Explicitly deferred after this batch

These remain out of scope unless the user explicitly expands it:

1. Final visual polish / theme system for Canvas Shell V2
2. Large performance work beyond targeted regression fixes
3. Socket / named-pipe / headless `openweave serve`
4. npm package install sources
5. Multi-user collaboration or workflow DSL
6. Cross-platform PTY parity work beyond current Phase 2 notes
