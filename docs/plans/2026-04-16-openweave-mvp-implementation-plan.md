# OpenWeave MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first OpenWeave MVP from an empty repository to a macOS Alpha-ready desktop app, with confirmed pre-implementation decisions, a passed Portal PoC, and a clear post-PTY path for future Windows/Linux packaging.

**Architecture:** Execute in two stages. Stage 0 closes blocking decisions and validates the hardest technical risk with a standalone Portal PoC. After that, implement the production app in layered slices: shell and persistence first, then canvas and nodes, then runtime, Git, Portal, recovery, Branch Workspace, and release hardening.

**Tech Stack:** Electron, React, TypeScript, Vite, `@xyflow/react`, `xterm.js`, Zustand, React Query, better-sqlite3, node-pty, zod, Playwright Electron, Vitest, system `git` CLI.

---

## Working Rules

- Execute tasks in order unless a task is explicitly marked parallel-safe.
- Gate 0 in `docs/plans/2026-04-16-openweave-decision-checklist.md` is already closed; if DC-02, DC-06, DC-10, or DC-11 changes later, re-baseline Tasks 2, 4, 10, and 12 before coding.
- Do not start Task 8 until the standalone Portal PoC has passed its acceptance criteria.
- Windows Runtime PoC findings apply to future preview work: keep the runtime boundary as `main -> utilityProcess -> worker -> node-pty`, and never let renderer import `node-pty`.
- Task 12 is for macOS Alpha packaging only; Windows/Linux preview packaging stays on a separate post-MVP validation track until a native preview smoke gate passes.
- Commands below assume `npm`; if the repo standard changes later, translate commands 1:1.
- Keep commits small and aligned to the task commit messages below.

## Delivery Gates

- **Gate 0:** Already closed on 2026-04-16 for DC-01, DC-02, DC-04, DC-06, DC-10, and DC-11.
- **Gate POC:** Portal PoC verifies live `WebContentsView` overlay, bounds sync, screenshot fallback, and single-active-Portal behavior.
- **Gate Alpha:** M1-M5 complete, Playwright Electron smoke suite green, manual QA checklist passed.

### Task 1: Capture approved decisions and owner map as ADRs

**Files:**
- Read: `docs/plans/2026-04-16-openweave-decision-checklist.md`
- Create: `docs/decisions/2026-04-16-mvp-shell-and-release-decisions.md`
- Create: `docs/decisions/2026-04-16-portal-security-and-branch-boundaries.md`
- Create: `docs/decisions/2026-04-16-owner-map-and-delivery-model.md`
- Test: `tests/planning/decision-gates.spec.md`

**Step 1: Write the decision capture checklist**

```md
- [ ] DC-01 owner map copied into ADR
- [ ] DC-02 Electron locked for MVP
- [ ] DC-04 schema timestamps locked to *_at_ms
- [ ] DC-06 Portal allowlist copied into ADR
- [ ] DC-10 Playwright Electron baseline copied into ADR
- [ ] DC-11 Branch Workspace boundary copied into ADR
```

**Step 2: Run gate verification and confirm Gate 0 is closed**

Run: `rg -n "Status：Pending|状态：Pending|\| Pending \|" docs/plans/2026-04-16-openweave-decision-checklist.md`
Expected: no Gate 0 items appear as pending.

**Step 3: Write the approved architecture and ownership records**

```md
# MVP shell and release decisions
- MVP shell: Electron
- Alpha platform: macOS only
- QA baseline: Playwright Electron required
- Installer: DMG first

# Owner map and delivery model
- Shell / Canvas / Runtime / Persistence / Portal / QA owner: 王凌超
- Packaging scripts: generated with AI Agent support
- Packaging execution: automated by GitHub Actions

# Portal security and branch boundaries
- Allowed URLs: http, https, localhost, 127.0.0.1
- Rejected URLs: file://
- Branch Workspace copies Portal URL only
```

**Step 4: Re-run verification on the captured ADRs**

Run: `rg -n "Electron|Playwright Electron|required|file://|王凌超|GitHub Actions" docs/decisions/2026-04-16-*.md`
Expected: all approved decisions and ownership records are present.

**Step 5: Commit**

```bash
git add docs/decisions/2026-04-16-mvp-shell-and-release-decisions.md docs/decisions/2026-04-16-portal-security-and-branch-boundaries.md docs/decisions/2026-04-16-owner-map-and-delivery-model.md tests/planning/decision-gates.spec.md
git commit -m "docs: record approved MVP decisions"
```

### Task 2: Build a standalone Portal PoC shell

**Files:**
- Create: `poc/portal-shell/package.json`
- Create: `poc/portal-shell/tsconfig.json`
- Create: `poc/portal-shell/src/main.ts`
- Create: `poc/portal-shell/src/preload.ts`
- Create: `poc/portal-shell/src/renderer/index.html`
- Create: `poc/portal-shell/src/renderer/portal-harness.tsx`
- Create: `poc/portal-shell/src/renderer/styles.css`
- Test: `poc/portal-shell/tests/portal-harness.spec.ts`

**Step 1: Write the failing test**

```ts
import { test, expect } from '@playwright/test';

test('shows two portal frames and one active overlay target', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173');
  await expect(page.getByTestId('portal-a')).toBeVisible();
  await expect(page.getByTestId('portal-b')).toBeVisible();
  await expect(page.getByTestId('active-portal-id')).toHaveText('portal-a');
});
```

**Step 2: Run the test to verify it fails**

Run: `cd poc/portal-shell && npm test -- portal-harness.spec.ts`
Expected: FAIL because the PoC shell and test harness do not exist yet.

**Step 3: Write the minimal implementation**

```ts
const portals = [
  { id: 'portal-a', url: 'https://example.com' },
  { id: 'portal-b', url: 'http://127.0.0.1:3000' },
];

render(<PortalHarness initialPortals={portals} initialActivePortalId="portal-a" />);
```

**Step 4: Run the test to verify it passes**

Run: `cd poc/portal-shell && npm test -- portal-harness.spec.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add poc/portal-shell
git commit -m "test: scaffold standalone portal poc harness"
```

### Task 3: Prove Portal bounds sync, single-active mode, and screenshot fallback

**Files:**
- Modify: `poc/portal-shell/src/main.ts`
- Modify: `poc/portal-shell/src/renderer/portal-harness.tsx`
- Modify: `poc/portal-shell/src/renderer/styles.css`
- Create: `poc/portal-shell/src/main/portal-manager.ts`
- Create: `poc/portal-shell/src/shared/portal-contract.ts`
- Test: `poc/portal-shell/tests/portal-overlay.e2e.spec.ts`

**Step 1: Write the failing test**

```ts
test('switches the live WebContentsView and falls back to screenshot while zoomed out', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173');
  await page.getByRole('button', { name: 'Activate portal-b' }).click();
  await expect(page.getByTestId('active-portal-id')).toHaveText('portal-b');
  await page.getByRole('slider', { name: 'Canvas zoom' }).fill('0.4');
  await expect(page.getByTestId('portal-a-fallback')).toBeVisible();
});
```

**Step 2: Run the test to verify it fails**

Run: `cd poc/portal-shell && npm run test:e2e -- portal-overlay.e2e.spec.ts`
Expected: FAIL because no main-process overlay sync or fallback logic exists.

**Step 3: Write the minimal implementation**

```ts
if (zoom < 0.45 || !isVisible(bounds)) {
  portalManager.showScreenshot(nodeId);
} else {
  portalManager.attachLiveView(nodeId, bounds, syncId);
}
```

**Step 4: Run the test to verify it passes**

Run: `cd poc/portal-shell && npm run test:e2e -- portal-overlay.e2e.spec.ts`
Expected: PASS with one active live portal and inactive portals shown as screenshots.

**Step 5: Commit**

```bash
git add poc/portal-shell
git commit -m "feat: validate portal overlay synchronization"
```

### Task 4: Scaffold the production Electron app shell and shared contracts

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/main/main.ts`
- Create: `src/main/preload.ts`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/shared/ipc/contracts.ts`
- Create: `src/shared/ipc/schemas.ts`
- Create: `tests/unit/shared/ipc-schemas.test.ts`
- Test: `tests/e2e/app-launch.spec.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { workspaceCreateSchema } from '../../../src/shared/ipc/schemas';

describe('workspaceCreateSchema', () => {
  it('rejects an empty directory path', () => {
    expect(() => workspaceCreateSchema.parse({ name: 'demo', rootDir: '' })).toThrow();
  });
});
```

**Step 2: Run the tests to verify they fail**

Run: `npm run test -- tests/unit/shared/ipc-schemas.test.ts`
Expected: FAIL because the shared schema module is not created yet.

**Step 3: Write the minimal implementation**

```ts
export const workspaceCreateSchema = z.object({
  name: z.string().min(1),
  rootDir: z.string().min(1),
});
```

**Step 4: Run the tests to verify they pass**

Run: `npm run test -- tests/unit/shared/ipc-schemas.test.ts && npm run test:e2e -- app-launch.spec.ts`
Expected: PASS and the Electron shell opens the entry page.

**Step 5: Commit**

```bash
git add package.json tsconfig.json tsconfig.node.json vite.config.ts vitest.config.ts playwright.config.ts src/main src/renderer src/shared tests/unit/shared/ipc-schemas.test.ts tests/e2e/app-launch.spec.ts
git commit -m "chore: scaffold electron app shell"
```

### Task 5: Implement registry DB, Workspace list, and create/open/delete flow

**Files:**
- Create: `src/main/db/registry.ts`
- Create: `src/main/db/migrations/registry/001_init.sql`
- Create: `src/main/ipc/workspaces.ts`
- Create: `src/renderer/features/workspaces/WorkspaceListPage.tsx`
- Create: `src/renderer/features/workspaces/CreateWorkspaceDialog.tsx`
- Create: `src/renderer/features/workspaces/workspaces.store.ts`
- Create: `tests/integration/main/workspaces-ipc.test.ts`
- Test: `tests/e2e/workspace-list.spec.ts`

**Step 1: Write the failing test**

```ts
it('creates a workspace row and returns it in the list', async () => {
  const result = await createWorkspace({ name: 'Demo', rootDir: '/tmp/demo' });
  expect(result.workspace.name).toBe('Demo');
  expect(listWorkspaces()[0].rootDir).toBe('/tmp/demo');
});
```

**Step 2: Run the tests to verify they fail**

Run: `npm run test -- tests/integration/main/workspaces-ipc.test.ts`
Expected: FAIL because the registry DB and IPC handlers do not exist yet.

**Step 3: Write the minimal implementation**

```ts
export function createWorkspace(input: WorkspaceCreateInput) {
  registryDb.prepare(insertWorkspaceSql).run({
    id: crypto.randomUUID(),
    name: input.name,
    root_dir: input.rootDir,
    created_at_ms: Date.now(),
    updated_at_ms: Date.now(),
  });
}
```

**Step 4: Run the tests to verify they pass**

Run: `npm run test -- tests/integration/main/workspaces-ipc.test.ts && npm run test:e2e -- workspace-list.spec.ts`
Expected: PASS with create/open/delete flows visible from the entry page.

**Step 5: Commit**

```bash
git add src/main/db src/main/ipc/workspaces.ts src/renderer/features/workspaces tests/integration/main/workspaces-ipc.test.ts tests/e2e/workspace-list.spec.ts
git commit -m "feat: add workspace registry and entry flow"
```

### Task 6: Implement canvas shell, node model, and Note node editing

**Files:**
- Create: `src/main/db/workspace.ts`
- Create: `src/main/db/migrations/workspace/001_init.sql`
- Create: `src/main/ipc/canvas.ts`
- Create: `src/renderer/features/canvas/WorkspaceCanvasPage.tsx`
- Create: `src/renderer/features/canvas/canvas.store.ts`
- Create: `src/renderer/features/canvas/nodes/NoteNode.tsx`
- Create: `src/renderer/features/canvas/nodes/NodeToolbar.tsx`
- Create: `tests/integration/main/canvas-ipc.test.ts`
- Test: `tests/e2e/note-node.spec.ts`

**Step 1: Write the failing test**

```ts
it('persists node position and markdown content', async () => {
  await saveCanvasState({
    nodes: [{ id: 'note-1', type: 'note', x: 120, y: 80, contentMd: '# Hello' }],
    edges: [],
  });
  const restored = await loadCanvasState();
  expect(restored.nodes[0]).toMatchObject({ x: 120, y: 80, contentMd: '# Hello' });
});
```

**Step 2: Run the tests to verify they fail**

Run: `npm run test -- tests/integration/main/canvas-ipc.test.ts`
Expected: FAIL because the workspace DB and canvas persistence layer do not exist yet.

**Step 3: Write the minimal implementation**

```ts
export function serializeNoteNode(node: NoteNodeDraft) {
  return {
    id: node.id,
    node_type: 'note',
    x: node.x,
    y: node.y,
    payload_json: JSON.stringify({ contentMd: node.contentMd }),
  };
}
```

**Step 4: Run the tests to verify they pass**

Run: `npm run test -- tests/integration/main/canvas-ipc.test.ts && npm run test:e2e -- note-node.spec.ts`
Expected: PASS and Note nodes survive app restart.

**Step 5: Commit**

```bash
git add src/main/db/workspace.ts src/main/db/migrations/workspace/001_init.sql src/main/ipc/canvas.ts src/renderer/features/canvas tests/integration/main/canvas-ipc.test.ts tests/e2e/note-node.spec.ts
git commit -m "feat: add canvas persistence and note nodes"
```

### Task 7: Implement Runtime Worker, Terminal node, and Run detail flow

**Files:**
- Create: `src/worker/runtime-worker.ts`
- Create: `src/worker/adapters/shell-runtime.ts`
- Create: `src/worker/adapters/codex-runtime.ts`
- Create: `src/worker/adapters/claude-runtime.ts`
- Create: `src/main/ipc/runs.ts`
- Create: `src/main/runtime/runtime-bridge.ts`
- Create: `src/renderer/features/runs/RunDrawer.tsx`
- Create: `src/renderer/features/canvas/nodes/TerminalNode.tsx`
- Create: `tests/integration/main/runs-ipc.test.ts`
- Test: `tests/e2e/terminal-run.spec.ts`

**Implementation constraint:**
- Preserve the runtime split as `main -> utilityProcess/runtime bridge -> worker adapters`.
- Keep `node-pty` confined to the worker boundary; renderer and shared UI layers must not import it.
- Keep runtime launch environment pass-through explicit so a later Windows preview track can preserve `SystemRoot` and other required variables.

**Step 1: Write the failing test**

```ts
it('transitions a run from queued to completed and stores the summary', async () => {
  const run = await startRun({ workspaceId: 'ws-1', nodeId: 'term-1', runtime: 'shell', command: 'echo hello' });
  await waitForRun(run.id, 'completed');
  const stored = await getRun(run.id);
  expect(stored.status).toBe('completed');
  expect(stored.summary).toContain('hello');
});
```

**Step 2: Run the tests to verify they fail**

Run: `npm run test -- tests/integration/main/runs-ipc.test.ts`
Expected: FAIL because the worker bridge and run state machine are not implemented.

**Step 3: Write the minimal implementation**

```ts
runtimeBridge.start({
  runtime: 'shell',
  env: process.env,
});
runtimeBridge.on('stdout', (event) => appendRunEvent(event.runId, 'stdout', event.chunk));
runtimeBridge.on('exit', (event) => markRunCompleted(event.runId, buildSummary(event.tail)));
```

**Step 4: Run the tests to verify they pass**

Run: `npm run test -- tests/integration/main/runs-ipc.test.ts && npm run test:e2e -- terminal-run.spec.ts`
Expected: PASS with queued/running/completed states visible in the UI.

**Step 5: Commit**

```bash
git add src/worker src/main/ipc/runs.ts src/main/runtime src/renderer/features/runs src/renderer/features/canvas/nodes/TerminalNode.tsx tests/integration/main/runs-ipc.test.ts tests/e2e/terminal-run.spec.ts
git commit -m "feat: add runtime worker and terminal runs"
```

### Task 8: Implement File Tree, Git status, and read-only safety boundaries

**Files:**
- Create: `src/worker/git/git-service.ts`
- Create: `src/worker/fs/file-tree-service.ts`
- Create: `src/main/ipc/files.ts`
- Create: `src/renderer/features/canvas/nodes/FileTreeNode.tsx`
- Create: `src/renderer/features/git/GitPanel.tsx`
- Create: `tests/integration/main/file-tree-ipc.test.ts`
- Test: `tests/e2e/file-tree.spec.ts`

**Step 1: Write the failing test**

```ts
it('ignores large generated directories and reports git status for changed files', async () => {
  const tree = await loadFileTree({ rootDir: fixtureRepo });
  expect(tree.entries.some((entry) => entry.path.includes('node_modules'))).toBe(false);
  expect(tree.entries.find((entry) => entry.path.endsWith('src/app.ts'))?.gitStatus).toBe('M');
});
```

**Step 2: Run the tests to verify they fail**

Run: `npm run test -- tests/integration/main/file-tree-ipc.test.ts`
Expected: FAIL because file tree loading and git status wiring do not exist yet.

**Step 3: Write the minimal implementation**

```ts
const DEFAULT_IGNORED_GLOBS = ['.git', 'node_modules', 'dist', 'build', '.next', 'out', 'coverage'];
const statuses = await gitStatus(rootDir);
return mergeTreeWithGitStatus(scanTree(rootDir, DEFAULT_IGNORED_GLOBS), statuses);
```

**Step 4: Run the tests to verify they pass**

Run: `npm run test -- tests/integration/main/file-tree-ipc.test.ts && npm run test:e2e -- file-tree.spec.ts`
Expected: PASS and non-Git directories still load without enabling Git write actions.

**Step 5: Commit**

```bash
git add src/worker/git src/worker/fs src/main/ipc/files.ts src/renderer/features/canvas/nodes/FileTreeNode.tsx src/renderer/features/git/GitPanel.tsx tests/integration/main/file-tree-ipc.test.ts tests/e2e/file-tree.spec.ts
git commit -m "feat: add file tree and git status surfaces"
```

### Task 9: Implement persistence recovery, audit logging, and crash-safe run restoration

**Files:**
- Create: `src/main/audit/audit-log.ts`
- Create: `src/main/recovery/recovery-service.ts`
- Modify: `src/main/db/workspace.ts`
- Modify: `src/main/ipc/runs.ts`
- Modify: `src/main/ipc/workspaces.ts`
- Create: `tests/integration/main/recovery-service.test.ts`
- Test: `tests/e2e/restart-recovery.spec.ts`

**Step 1: Write the failing test**

```ts
it('marks running runs as failed after an unclean shutdown and preserves the tail log', async () => {
  await seedRunningRun({ id: 'run-1', status: 'running' });
  const recovered = await recoverWorkspace('ws-1');
  expect(recovered.runs[0].status).toBe('failed');
  expect(recovered.runs[0].tailLog).toContain('last 4kb');
});
```

**Step 2: Run the tests to verify they fail**

Run: `npm run test -- tests/integration/main/recovery-service.test.ts`
Expected: FAIL because recovery rules and audit persistence do not exist yet.

**Step 3: Write the minimal implementation**

```ts
if (run.status === 'running') {
  updateRunStatus(run.id, 'failed', 'Recovered after unclean shutdown');
  persistAudit('run.recovered', run.id, 'success');
}
```

**Step 4: Run the tests to verify they pass**

Run: `npm run test -- tests/integration/main/recovery-service.test.ts && npm run test:e2e -- restart-recovery.spec.ts`
Expected: PASS and restored workspaces show the latest canvas, runs, and audits.

**Step 5: Commit**

```bash
git add src/main/audit src/main/recovery src/main/db/workspace.ts src/main/ipc/runs.ts src/main/ipc/workspaces.ts tests/integration/main/recovery-service.test.ts tests/e2e/restart-recovery.spec.ts
git commit -m "feat: add recovery and audit logging"
```

### Task 10: Integrate Portal MVP into the production app

**Files:**
- Create: `src/main/portal/portal-manager.ts`
- Create: `src/main/portal/portal-session-service.ts`
- Create: `src/main/ipc/portal.ts`
- Create: `src/renderer/features/canvas/nodes/PortalNode.tsx`
- Create: `src/renderer/features/portal/PortalToolbar.tsx`
- Create: `src/shared/portal/types.ts`
- Create: `tests/integration/main/portal-ipc.test.ts`
- Test: `tests/e2e/portal-node.spec.ts`

**Step 1: Write the failing test**

```ts
it('loads a portal url, captures a screenshot, and returns a simplified structure tree', async () => {
  const portal = await loadPortal({ workspaceId: 'ws-1', nodeId: 'portal-1', url: 'http://127.0.0.1:3000' });
  const screenshot = await capturePortalScreenshot(portal.id);
  const structure = await readPortalStructure(portal.id);
  expect(screenshot.path).toContain('artifacts/portal/portal-1');
  expect(structure.elements.length).toBeGreaterThan(0);
});

it('rejects disallowed portal urls such as file://', async () => {
  await expect(loadPortal({ workspaceId: 'ws-1', nodeId: 'portal-2', url: 'file:///tmp/demo.html' })).rejects.toThrow(
    'URL scheme not allowed',
  );
});
```

**Step 2: Run the tests to verify they fail**

Run: `npm run test -- tests/integration/main/portal-ipc.test.ts`
Expected: FAIL because the production Portal manager is not wired yet.

**Step 3: Write the minimal implementation**

```ts
assertPortalUrlAllowed(input.url);
await portalManager.loadUrl(nodeId, input.url);
const screenshot = await portalManager.capture(nodeId);
const structure = await portalManager.readStructure(nodeId);
return { screenshot, structure };
```

**Step 4: Run the tests to verify they pass**

Run: `npm run test -- tests/integration/main/portal-ipc.test.ts && npm run test:e2e -- portal-node.spec.ts`
Expected: PASS for load, click, input, screenshot, and structure read flows.

**Step 5: Commit**

```bash
git add src/main/portal src/main/ipc/portal.ts src/renderer/features/canvas/nodes/PortalNode.tsx src/renderer/features/portal src/shared/portal tests/integration/main/portal-ipc.test.ts tests/e2e/portal-node.spec.ts
git commit -m "feat: add portal node mvp integration"
```

### Task 11: Implement Branch Workspace isolation and basic Git write actions

**Files:**
- Create: `src/worker/git/worktree-service.ts`
- Modify: `src/worker/git/git-service.ts`
- Modify: `src/main/ipc/workspaces.ts`
- Create: `src/main/ipc/branch-workspaces.ts`
- Create: `src/renderer/features/workspaces/BranchWorkspaceDialog.tsx`
- Modify: `src/renderer/features/git/GitPanel.tsx`
- Create: `tests/integration/main/branch-workspace.test.ts`
- Test: `tests/e2e/branch-workspace.spec.ts`

**Step 1: Write the failing test**

```ts
it('creates a branch workspace with copied layout but isolated runtime and portal state', async () => {
  const branch = await createBranchWorkspace({
    sourceWorkspaceId: 'ws-main',
    branchName: 'feature/demo',
    copyCanvas: true,
  });
  expect(branch.rootDir).toContain('feature/demo');
  expect(await listRuns(branch.id)).toHaveLength(0);
  expect(await listPortalSessions(branch.id)).toHaveLength(0);
});
```

**Step 2: Run the tests to verify they fail**

Run: `npm run test -- tests/integration/main/branch-workspace.test.ts`
Expected: FAIL because worktree cloning and isolation rules are not implemented.

**Step 3: Write the minimal implementation**

```ts
await gitWorktreeService.create({ sourceDir, branchName, targetDir });
await cloneCanvasLayout(sourceWorkspaceId, branchWorkspaceId, { includeRuns: false, includePortalSessions: false });
```

**Step 4: Run the tests to verify they pass**

Run: `npm run test -- tests/integration/main/branch-workspace.test.ts && npm run test:e2e -- branch-workspace.spec.ts`
Expected: PASS and Portal URL copies without login state or screenshots.

**Step 5: Commit**

```bash
git add src/worker/git/worktree-service.ts src/worker/git/git-service.ts src/main/ipc/workspaces.ts src/main/ipc/branch-workspaces.ts src/renderer/features/workspaces/BranchWorkspaceDialog.tsx src/renderer/features/git/GitPanel.tsx tests/integration/main/branch-workspace.test.ts tests/e2e/branch-workspace.spec.ts
git commit -m "feat: add branch workspace isolation"
```

### Task 12: Prepare Alpha packaging, verification, and release checklist

**Files:**
- Create: `.github/workflows/package-alpha.yml`
- Create: `electron-builder.yml`
- Create: `scripts/verify-alpha.sh`
- Create: `docs/release/2026-04-16-openweave-alpha-checklist.md`
- Create: `tests/e2e/smoke-alpha.spec.ts`
- Modify: `README.md`

**Packaging boundary:**
- This task only covers macOS Alpha packaging and verification.
- Do not add Windows/Linux packaging automation in this branch.
- Future Windows preview packaging requires a separate native Windows CI gate for `utilityProcess + node-pty + PowerShell` smoke before installer work starts.

**Step 1: Write the failing smoke test**

```ts
test('launches the packaged app and opens an existing workspace', async () => {
  const app = await launchPackagedApp();
  await expect(app.firstWindow().getByText('Workspaces')).toBeVisible();
});
```

**Step 2: Run the test to verify it fails**

Run: `npm run test:e2e -- smoke-alpha.spec.ts`
Expected: FAIL because packaging config and release assets do not exist yet.

**Step 3: Write the minimal implementation**

```sh
npm run build
npm run package:mac
npm run test:e2e -- smoke-alpha.spec.ts
```

```yaml
name: package-alpha
on:
  workflow_dispatch:
  push:
    branches: [main]
jobs:
  mac-build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build && npm run package:mac
```

**Step 4: Run the verification to confirm it passes**

Run: `bash scripts/verify-alpha.sh`
Expected: PASS with build, package, smoke checks green, and CI packaging workflow ready for manual/internal artifact generation.

**Step 5: Commit**

```bash
git add .github/workflows/package-alpha.yml electron-builder.yml scripts/verify-alpha.sh docs/release/2026-04-16-openweave-alpha-checklist.md tests/e2e/smoke-alpha.spec.ts README.md
git commit -m "chore: prepare alpha packaging and automation"
```

## Milestone Mapping

- **M1:** Task 4 + Task 5 complete
- **M2:** Task 6 + Task 7 complete
- **M3:** Task 8 complete
- **M4:** Task 10 complete after Tasks 2-3 pass
- **M5:** Task 9 + Task 11 + Task 12 complete

## No-Regret Parallel Work

These items can run in parallel once Gate 0 is closed and before Portal production integration starts:
- Task 4 and the documentation portion of Task 12
- Task 6 and fixture/test-data setup for Tasks 7-9
- Renderer styling polish after Task 6, as long as it does not change IPC contracts

## Acceptance Checklist

- Workspace create/open/delete works against `registry.db`.
- Canvas restores nodes, edges, and note content after restart.
- At least two Terminal nodes can run concurrently with visible state transitions.
- File Tree loads large repos with ignored directories filtered by default.
- Portal loads allowed URLs, rejects `file://`, supports core interactions, and falls back cleanly when inactive or zoomed out.
- Branch Workspace clones layout without copying runs, audits, screenshots, or login state.
- Alpha build launches on macOS, passes Electron smoke tests, and has a GitHub Actions packaging workflow for internal/manual distribution artifacts.
