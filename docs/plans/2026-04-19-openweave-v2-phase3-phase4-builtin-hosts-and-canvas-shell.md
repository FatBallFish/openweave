# OpenWeave V2 Phase 3 / Phase 4 Builtin Hosts and Canvas Shell Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move OpenWeave from the completed Phase 2 interactive-terminal baseline to the next renderer milestone by migrating the product UI off the legacy canvas node list and onto Graph Schema V2, manifest-driven builtin component hosts, and a first real Canvas Shell V2 powered by a graph canvas library.

**Architecture:** Treat Graph Schema V2 as the renderer source of truth and stop extending the legacy `canvasLoad` / `canvasSave` path. Build a renderer-side builtin host registry that resolves graph `componentType` entries to dedicated host components, then mount those hosts inside a Canvas Shell V2 surface that preserves current Phase 2 behaviors for terminal sessions, file tree, portal, and node actions. Keep runtime launch, CLI, bridge, and skill-injection semantics additive-stable; this slice is a renderer/data-plane migration, not another runtime rewrite.

**Tech Stack:** Electron main/renderer TypeScript, React, Graph Schema V2 IPC, component manifests/registry, `@xyflow/react` (or the thinnest equivalent React Flow package already accepted by the repo), existing runs/file-tree/portal IPC, Vitest, Playwright Electron.

---

## Why this is the next plan

Phase 2 is now complete enough that the remaining major PRD gaps are no longer in the runtime chain. The largest unresolved product gaps are now:

1. FR-015 ~ FR-020: builtin components must be rendered through a unified component-host path rather than hardcoded renderer branches.
2. FR-021 ~ FR-022: the product shell still needs a real infinite-canvas UX rather than the current stacked node list.
3. The renderer still reads/writes legacy `canvas` node state even though Graph Schema V2 already exists and is the accepted data model for bridge/CLI/component actions.

This plan therefore treats **Phase 3 builtin hosts** and **Phase 4 Canvas Shell V2 foundation** as one renderer migration slice. The goal is not final visual polish; the goal is to make the renderer speak the same graph/component language as the rest of the product.

## Current accepted baseline in this worktree

Treat the following as already complete / accepted in `feat/phase2-interactive-terminal`:

- Graph Schema V2 persistence and shared contracts
- Component Manifest V1 / registry / installer
- `openweave` CLI and local workspace/node query bridge
- Component action dispatcher plus builtin action adapters
- Skill Pack Manager and Workspace Skill Injection Manager
- Runtime matrix for `shell` / `codex` / `claude` / `opencode`
- Phase 2 interactive terminal input/stop flow
- Confirmed-exit `stopped` semantics
- Terminal runtime selection persistence in the legacy terminal node path
- Focused Phase 2 unit/integration/build/E2E verification

These are not to be reworked unless a direct blocker is proven.

## Primary references to review before editing

- `docs/prd/2026-04-18-openweave-prd-v2-refactor.md`
- `docs/tech-design/2026-04-18-openweave-tech-design-v2-refactor.md`
- `docs/plans/2026-04-18-openweave-phase1-kernel-spec.md`
- `docs/plans/2026-04-18-openweave-refactor-execution-plan.md`
- `docs/plans/2026-04-19-openweave-v2-phase2-interactive-terminal.md`
- `docs/plans/2026-04-19-openweave-v2-phase2-batch2-main-control-and-renderer.md`
- `docs/plans/2026-04-19-openweave-v2-phase2-risk-log.md`

## Hard constraints for this batch

1. Do not work on `main`.
2. Do not create a second renderer/session subsystem.
3. Do not widen scope into socket/named-pipe transport, headless `serve`, or npm install sources.
4. Keep `node-pty` confined to `src/worker/**`; renderer/shared must not import it.
5. Preserve current Phase 2 terminal semantics, managed-runtime preflight ordering, and crash-recovery behavior.
6. Make Graph Schema V2 the renderer source of truth; do not deepen product dependence on the legacy `canvas` IPC path.
7. Builtin component rendering must move toward a manifest-driven host seam, not another set of hardcoded product branches.
8. Prefer additive migration and compatibility adapters over large one-shot rewrites when tests can prove the seam.

## Task 1: Re-baseline renderer/data-plane gaps before migration

**Files to read:**
- `docs/plans/2026-04-19-openweave-v2-phase2-interactive-terminal.md`
- `docs/plans/2026-04-19-openweave-v2-phase2-batch2-main-control-and-renderer.md`
- `docs/plans/2026-04-19-openweave-v2-phase2-risk-log.md`

**Files to inspect:**
- `src/renderer/features/canvas/WorkspaceCanvasPage.tsx`
- `src/renderer/features/canvas/canvas.store.ts`
- `src/main/ipc/canvas.ts`
- `src/main/db/workspace.ts`
- `src/main/bridge/workspace-node-query-service.ts`
- `src/shared/ipc/schemas.ts`
- `src/shared/ipc/contracts.ts`
- `tests/integration/main/graph-persistence-v2.test.ts`
- `tests/e2e/terminal-run.spec.ts`
- `tests/e2e/restart-recovery.spec.ts`

**Step 1: Write the current-gap checklist**

Capture the concrete facts that still remain true:

- renderer product UI still reads legacy `canvas` state instead of Graph Schema V2,
- builtin renderer paths are still hardcoded component-by-component,
- Canvas Shell V2 / graph-canvas interaction layer is still missing,
- bridge/CLI/action paths already depend on Graph Schema V2 and must stay stable.

**Step 2: Stop if a structural blocker appears**

If code/docs show that builtin host migration cannot be layered over Graph Schema V2 without reopening the Phase 1/2 data contracts, stop and report instead of inventing a parallel schema.

**Step 3: Create the execution todo list**

Use the tasks below as the only scope for this session.

## Task 2: Add Graph Schema V2 renderer store and IPC bridge

**Goal:** Replace renderer dependence on legacy `canvasLoad` / `canvasSave` with a graph-store path that loads/saves `GraphSnapshotV2Input` directly.

**Files:**
- Modify: `src/shared/ipc/contracts.ts`
- Modify if needed: `src/main/preload.ts`
- Modify if needed: `src/main/ipc/canvas.ts` or add a dedicated graph IPC registration path
- Modify: `src/renderer/features/canvas/canvas.store.ts`
- Modify if needed: `src/renderer/features/canvas/WorkspaceCanvasPage.tsx`
- Test: `tests/unit/renderer/canvas.store.test.ts`
- Test: `tests/integration/main/graph-persistence-v2.test.ts`
- Test if needed: `tests/integration/main/canvas-register-ipc.test.ts`

**Step 1: Write the failing tests**

Cover at minimum:

- renderer store loads Graph Schema V2 snapshots instead of legacy `canvas` node arrays,
- save operations preserve graph node metadata (`componentType`, `componentVersion`, `bounds`, `config`, `state`, `capabilities`),
- Graph V2 remains stable for existing bridge/CLI consumers,
- any temporary legacy adapter behavior is explicit and bounded.

**Step 2: Run tests to verify RED**

Run:
```bash
npx vitest run \
  tests/unit/renderer/canvas.store.test.ts \
  tests/integration/main/graph-persistence-v2.test.ts
```

Expected: FAIL because renderer store still assumes legacy `canvas` nodes.

**Step 3: Write minimal implementation**

Implement additively:

- one renderer graph store keyed by `GraphSnapshotV2Input`,
- preload/contracts exposure for Graph V2 load/save if renderer cannot already use it directly,
- a narrow adapter only where legacy tests or product code need temporary compatibility,
- no new long-lived legacy state path.

**Step 4: Run tests to verify GREEN**

Run the same commands.

Expected: PASS.

## Task 3: Build renderer builtin host registry on top of manifests and graph nodes

**Goal:** Replace hardcoded renderer node branching with a manifest-driven builtin host seam that resolves graph `componentType` values to dedicated host components.

**Files:**
- Create: `src/renderer/features/components/builtin-host-registry.ts`
- Create: `src/renderer/features/components/hosts/*`
- Modify: `src/renderer/features/canvas/WorkspaceCanvasPage.tsx`
- Modify if needed: `src/renderer/features/canvas/nodes/*`
- Modify if needed: `src/shared/components/manifest.ts` or related manifest helpers only if tests prove a renderer-facing field is required
- Test: `tests/unit/renderer/static-components.test.ts`
- Create if needed: `tests/unit/renderer/builtin-host-registry.test.ts`

**Step 1: Write the failing tests**

Cover at minimum:

- graph `componentType` entries resolve to renderer hosts for `builtin.note`, `builtin.terminal`, `builtin.file-tree`, `builtin.portal`, `builtin.text`, and `builtin.attachment`,
- unsupported component types fail closed with a bounded fallback surface,
- renderer host resolution does not require special-casing outside the registry/host seam.

**Step 2: Run tests to verify RED**

Run:
```bash
npx vitest run \
  tests/unit/renderer/static-components.test.ts \
  tests/unit/renderer/builtin-host-registry.test.ts
```

Expected: FAIL because the renderer still hardcodes legacy node branches.

**Step 3: Write minimal implementation**

Implement:

- a builtin host registry keyed by manifest/graph component type,
- one host component per builtin class or a thin host family when DRY is obvious,
- an explicit fallback host for unsupported/disabled components,
- no giant switch statement in `WorkspaceCanvasPage.tsx` after the migration is complete.

**Step 4: Run tests to verify GREEN**

Run the same commands.

Expected: PASS.

## Task 4: Migrate builtin component product surfaces onto graph-backed hosts

**Goal:** Make the six builtin product surfaces render from Graph Schema V2 state while preserving the Phase 2 runtime chain and existing read/write/action behaviors.

**Files:**
- Modify: `src/renderer/features/components/hosts/NoteHost.tsx`
- Modify: `src/renderer/features/components/hosts/TerminalHost.tsx`
- Modify: `src/renderer/features/components/hosts/FileTreeHost.tsx`
- Modify: `src/renderer/features/components/hosts/PortalHost.tsx`
- Create/modify: `src/renderer/features/components/hosts/TextHost.tsx`
- Create/modify: `src/renderer/features/components/hosts/AttachmentHost.tsx`
- Modify if needed: `src/renderer/features/runs/RunDrawer.tsx`
- Modify if needed: `src/renderer/features/runs/TerminalSessionPane.tsx`
- Test: `tests/unit/renderer/terminal-node.test.ts`
- Test: `tests/unit/renderer/terminal-session-pane.test.ts`
- Create/modify: `tests/unit/renderer/builtin-hosts.test.ts`
- Test if needed: `tests/integration/main/bridge-cli-roundtrip.test.ts`

**Step 1: Write the failing tests**

Cover at minimum:

- note host binds graph-backed markdown state correctly,
- terminal host preserves Phase 2 runtime selection/input/stop semantics,
- file-tree and portal hosts keep their current IPC-driven live behaviors,
- text and attachment hosts render bounded first-pass builtin surfaces using graph node data,
- renderer host updates do not break existing bridge/CLI/action roundtrips.

**Step 2: Run tests to verify RED**

Run:
```bash
npx vitest run \
  tests/unit/renderer/terminal-node.test.ts \
  tests/unit/renderer/terminal-session-pane.test.ts \
  tests/unit/renderer/builtin-hosts.test.ts \
  tests/integration/main/bridge-cli-roundtrip.test.ts
```

Expected: FAIL because the renderer still uses legacy node implementations and text/attachment hosts are not yet first-class product surfaces.

**Step 3: Write minimal implementation**

Implement:

- graph-to-host data mapping for all six builtin component types,
- terminal host reuse of the accepted Phase 2 run controls,
- the thinnest product-safe host UIs for text and attachment consistent with current graph/bridge data,
- no reopening of runtime worker or action-dispatcher architecture unless a failing test proves it necessary.

**Step 4: Run tests to verify GREEN**

Run the same commands.

Expected: PASS.

## Task 5: Land Canvas Shell V2 on a real graph-canvas library

**Goal:** Replace the current stacked node list with an infinite canvas shell that supports node rendering, drag/move, zoom/pan, edge rendering, and run drawer coexistence.

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/renderer/features/canvas-shell/*`
- Modify: `src/renderer/features/canvas/WorkspaceCanvasPage.tsx`
- Modify if needed: `src/renderer/main.tsx`
- Test: `tests/unit/renderer/static-components.test.ts`
- Create if needed: `tests/unit/renderer/canvas-shell.test.ts`
- Test: `tests/e2e/terminal-run.spec.ts`
- Test: `tests/e2e/restart-recovery.spec.ts`
- Create/modify if useful: `tests/e2e/branch-workspace.spec.ts`

**Step 1: Write the failing tests**

Cover at minimum:

- renderer mounts a graph-canvas shell instead of a simple vertical list,
- graph nodes render through the builtin host registry,
- node move/update persists through Graph Schema V2 save/load,
- terminal session drawer still works when the terminal node lives inside the canvas shell,
- crash recovery still reopens the workspace and shows failed/recovered terminal sessions correctly.

Prefer one minimal E2E path such as:

- create workspace,
- add or load a builtin terminal graph node,
- launch an interactive shell session,
- send follow-up input,
- stop the session,
- reopen/recover and confirm terminal state remains coherent.

**Step 2: Run tests to verify RED**

Run:
```bash
npx vitest run \
  tests/unit/renderer/static-components.test.ts \
  tests/unit/renderer/canvas-shell.test.ts

npm run build

npx playwright test -c playwright.config.ts \
  tests/e2e/terminal-run.spec.ts \
  tests/e2e/restart-recovery.spec.ts --reporter=line
```

Expected: FAIL because Canvas Shell V2 is not mounted yet.

**Step 3: Write minimal implementation**

Implement:

- one graph-canvas shell container,
- node/edge projection from Graph Schema V2,
- renderer persistence for node movement and graph save,
- host mounting for builtin nodes inside the shell,
- no visual overreach beyond what tests require to prove the shell is real.

**Step 4: Run tests to verify GREEN**

Run the same commands.

Expected: PASS.

## Task 6: Phase 3 / Phase 4 focused verification and doc backfill

**Goal:** End this slice with a renderer/data-plane verification record that clearly states what Phase 3 and Phase 4 now cover and what still remains for later polish/stability work.

**Files:**
- Modify if needed: `docs/tech-design/2026-04-18-openweave-tech-design-v2-refactor.md`
- Modify if needed: `docs/plans/2026-04-18-openweave-refactor-execution-plan.md`
- Modify: `docs/plans/2026-04-19-openweave-v2-phase2-risk-log.md`
- Create/modify if useful: `docs/plans/2026-04-19-openweave-v2-phase3-phase4-risk-log.md`
- Create/modify if useful: `docs/plans/2026-04-19-openweave-v2-phase3-phase4-next-session-prompt.md`

**Step 1: Run the focused verification batch**

Run:
```bash
npx vitest run \
  tests/unit/main/preload.test.ts \
  tests/unit/main/runtime-bridge.behavior.test.ts \
  tests/unit/worker/runtime-adapters.test.ts \
  tests/unit/renderer/canvas.store.test.ts \
  tests/unit/renderer/terminal-node.test.ts \
  tests/unit/renderer/terminal-session-pane.test.ts \
  tests/unit/renderer/static-components.test.ts \
  tests/unit/renderer/builtin-host-registry.test.ts \
  tests/unit/renderer/builtin-hosts.test.ts \
  tests/unit/renderer/canvas-shell.test.ts \
  tests/integration/main/graph-persistence-v2.test.ts \
  tests/integration/main/bridge-cli-roundtrip.test.ts \
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

- what Phase 3 builtin host migration now covers,
- what Phase 4 Canvas Shell V2 now covers,
- what still remains deferred for later visual polish/performance/stability work,
- any residual React Flow / graph-shell / PTY environment risks that remain open.

**Step 5: Final review gates**

Perform:

- spec compliance review,
- code quality review.

Do not call the slice complete until both are green or explicitly dispositioned.

## Exit criteria for this batch

This batch is successful if all of the following are true:

1. Renderer product state loads/saves through Graph Schema V2 rather than the legacy `canvas` node model.
2. Builtin renderer paths resolve through a manifest-driven host seam rather than ad-hoc top-level branches.
3. `builtin.note`, `builtin.terminal`, `builtin.file-tree`, `builtin.portal`, `builtin.text`, and `builtin.attachment` all have renderer host coverage.
4. Terminal host preserves the Phase 2 interactive session behavior, including follow-up input and `stopped` handling.
5. Canvas Shell V2 is a real graph canvas with node rendering plus move/persist behavior, not a vertical list.
6. Focused Vitest, build, and Playwright renderer/runtime verification all pass.

## Explicitly deferred after this batch

These remain out of scope unless the user explicitly expands it:

1. Final visual polish/theme system for Canvas Shell V2
2. Large-scale performance optimization beyond targeted regression fixes
3. Socket / named-pipe / headless `openweave serve`
4. npm package install source support
5. Multi-user collaboration or workflow DSL
