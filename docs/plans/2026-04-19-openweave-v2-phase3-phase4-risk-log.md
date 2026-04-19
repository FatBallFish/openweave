# OpenWeave V2 Phase 3 / Phase 4 Risk Log

## 2026-04-19 Initial review checklist

- Renderer product UI still loads and saves legacy `canvas` state through `canvasLoad` / `canvasSave`; it does not yet use Graph Schema V2 as its primary store.
- Renderer builtin surfaces are still hardcoded in `src/renderer/features/canvas/WorkspaceCanvasPage.tsx` via per-node branches and legacy node components.
- Canvas Shell V2 is still missing; the product renders a stacked node list instead of a real graph canvas with drag/move/zoom behavior.
- Bridge, CLI, workspace-node query, and component action paths already rely on Graph Schema V2 and must remain behaviorally stable during the renderer migration.
- Current Phase 2 terminal behavior is live in renderer/main/worker and must be preserved while the terminal surface moves behind a builtin host seam.

## 2026-04-19 Initial review risks

### 1. Referenced PRD / tech-design files are missing from this worktree

- Risk: the plan references `docs/prd/2026-04-18-openweave-prd-v2-refactor.md` and `docs/tech-design/2026-04-18-openweave-tech-design-v2-refactor.md`, but those paths are not present in `feat/phase2-interactive-terminal`.
- Impact: implementation could drift from intent if review depends on documents that are unavailable on the active branch.
- Mitigation: treat the checked-in Phase 1/2/Phase 3-4 plans plus current code/tests as the authoritative branch-local baseline, and keep this mismatch documented instead of blocking the session.

### 2. Builtin host migration needs a canonical manifest source

- Risk: Graph Schema V2 persists `componentType` / `componentVersion`, but the renderer currently has no builtin manifest registry or seeded builtin manifest catalog to resolve host metadata from.
- Impact: host resolution could regress into another hardcoded product switch if the migration does not establish a manifest-backed seam.
- Mitigation: add one shared builtin manifest source and make renderer host resolution depend on that manifest metadata rather than ad hoc page-level branching.

### 3. Dual canvas/graph persistence can drift during the migration

- Risk: legacy `canvas` persistence still exists in main/renderer while Graph Schema V2 is already used by bridge/CLI/action flows.
- Impact: node edits or movement can diverge across data planes if the renderer keeps writing both paths loosely.
- Mitigation: move the renderer store onto Graph Schema V2 first, keep any compatibility adapter narrow and explicit, and avoid adding new product behavior to the legacy `canvas` path.

## 2026-04-19 Closure notes

### 4. Graph Schema V2 is now the renderer persistence source of truth

- Status: mitigated for this Phase 3 / Phase 4 slice.
- Landed behavior: renderer load/save now uses additive Graph V2 IPC, while legacy `canvas` IPC remains only as a bounded compatibility path for older surfaces/tests.
- Primary files: `src/shared/ipc/contracts.ts`, `src/main/preload.ts`, `src/main/ipc/canvas.ts`, `src/renderer/features/canvas/canvas.store.ts`.
- Verification: `tests/unit/main/preload.test.ts`, `tests/unit/renderer/canvas.store.test.ts`, `tests/integration/main/graph-persistence-v2.test.ts`, and `tests/integration/main/canvas-register-ipc.test.ts`.

### 5. Manifest-driven builtin renderer hosts are now landed

- Status: mitigated for this slice.
- Landed behavior: renderer host resolution now flows through a shared builtin manifest catalog plus `src/renderer/features/components/builtin-host-registry.tsx`, and the six builtin product surfaces route through host components instead of page-level type branches.
- Primary files: `src/shared/components/builtin-manifests.ts`, `src/renderer/features/components/builtin-host-registry.tsx`, `src/renderer/features/components/hosts/*`, `src/renderer/features/canvas/WorkspaceCanvasPage.tsx`.
- Verification: `tests/unit/renderer/builtin-host-registry.test.ts`, `tests/unit/renderer/builtin-hosts.test.ts`, `tests/unit/renderer/terminal-node.test.ts`, `tests/unit/renderer/terminal-session-pane.test.ts`, and `tests/integration/main/bridge-cli-roundtrip.test.ts`.

### 6. Canvas Shell V2 first pass is now live on React Flow

- Status: mitigated for current scope.
- Landed behavior: renderer now mounts a real graph canvas via `@xyflow/react`, renders builtin hosts inside flow nodes, and persists node drag/move back into Graph Schema V2.
- Primary files: `package.json`, `package-lock.json`, `src/renderer/features/canvas-shell/CanvasShell.tsx`, `src/renderer/features/canvas/WorkspaceCanvasPage.tsx`, `src/renderer/main.tsx`, `src/renderer/features/canvas/canvas.store.ts`.
- Verification: `tests/unit/renderer/canvas-shell.test.ts`, `npm run build`, `tests/e2e/terminal-run.spec.ts`, and `tests/e2e/restart-recovery.spec.ts`.

### 7. Residual branch-workspace E2E risk remains outside the focused verification set

- Risk: extra coverage beyond the plan-required E2E set shows `tests/e2e/branch-workspace.spec.ts` timing out after the renderer/canvas-shell migration.
- Impact: the branch-workspace dialog flow likely still has a renderer timing or interaction regression when exercised through the file-tree host path, even though focused terminal/recovery verification is green.
- Mitigation: keep this as a non-blocking follow-up; investigate the exact timeout step in a dedicated session instead of widening this slice after the required verification batch is already green.
- Reproduction status: re-ran `npx playwright test -c playwright.config.ts tests/e2e/branch-workspace.spec.ts --reporter=line` during branch-finish verification and it still timed out standalone.

## 2026-04-19 Focused verification record

- `npm run build`
- `npx vitest run tests/unit/main/preload.test.ts tests/unit/main/runtime-bridge.behavior.test.ts tests/unit/worker/runtime-adapters.test.ts tests/unit/renderer/canvas.store.test.ts tests/unit/renderer/terminal-node.test.ts tests/unit/renderer/terminal-session-pane.test.ts tests/unit/renderer/static-components.test.ts tests/unit/renderer/builtin-host-registry.test.ts tests/unit/renderer/builtin-hosts.test.ts tests/unit/renderer/canvas-shell.test.ts tests/integration/main/graph-persistence-v2.test.ts tests/integration/main/bridge-cli-roundtrip.test.ts tests/integration/main/runs-ipc.test.ts tests/integration/main/runs-register-recovery.test.ts tests/integration/main/runtime-launch.test.ts`
- `npx playwright test -c playwright.config.ts tests/e2e/terminal-run.spec.ts tests/e2e/restart-recovery.spec.ts --reporter=line`
- Additional non-blocking coverage: `tests/e2e/note-node.spec.ts`, `tests/e2e/file-tree.spec.ts`, and `tests/e2e/portal-node.spec.ts` passed; `tests/e2e/branch-workspace.spec.ts` timed out and remains logged as residual risk.
