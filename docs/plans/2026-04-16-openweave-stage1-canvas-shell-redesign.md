# OpenWeave Stage 1 Canvas and Shell Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the renderer into a canvas-first workspace shell with a real infinite canvas, Maestri-aligned interaction structure, and Stage 1 product versions of the Note, Terminal, File Tree, and Portal nodes.

**Architecture:** Replace the current list-driven canvas UI with a React Flow-based shell composed of a left workspace rail, a top tool rail, and a central canvas stage. Keep the existing workspace/run/file/portal backend slices where possible, but upgrade the shared canvas schema, renderer state model, and workspace repository persistence to support node position, size, edges, browser chrome state, and destructive reset of legacy canvas data.

**Tech Stack:** Electron, React, TypeScript, Vite, `@xyflow/react`, `react-markdown`, `remark-gfm`, `lucide-react`, Vitest, Playwright Electron, Node SQLite.

---

### Task 1: Add the renderer foundations for the new shell

**Files:**
- Modify: `package.json`
- Modify: `src/renderer/main.tsx`
- Create: `src/renderer/styles/app-shell.css`
- Test: `tests/unit/renderer/static-components.test.ts`

**Step 1: Write the failing test**

Extend `tests/unit/renderer/static-components.test.ts` so it expects the new shell-level tokens instead of the old button row:

```ts
expect(shellHtml).toContain('workspace-shell');
expect(shellHtml).toContain('canvas-topbar');
expect(shellHtml).toContain('canvas-tool-note');
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/renderer/static-components.test.ts`
Expected: FAIL because the shell classes and toolbar structure do not exist yet.

**Step 3: Write minimal implementation**

- Add renderer dependencies:
  - `@xyflow/react`
  - `react-markdown`
  - `remark-gfm`
  - `lucide-react`
- Import a shared renderer stylesheet from `src/renderer/main.tsx`.
- Create `src/renderer/styles/app-shell.css` with app-level variables for shell surfaces, node accents, toolbar chrome, and canvas background texture.

```ts
import './styles/app-shell.css';
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/renderer/static-components.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add package.json src/renderer/main.tsx src/renderer/styles/app-shell.css tests/unit/renderer/static-components.test.ts
git commit -m "chore: add canvas shell frontend foundations"
```

### Task 2: Upgrade shared canvas schemas and contracts to a real canvas snapshot

**Files:**
- Modify: `src/shared/ipc/schemas.ts`
- Modify: `src/shared/ipc/contracts.ts`
- Modify: `tests/unit/shared/ipc-schemas.test.ts`
- Modify: `tests/unit/main/preload.test.ts`

**Step 1: Write the failing test**

Add schema assertions for node position, size, and richer edge data:

```ts
expect(() =>
  canvasStateSchema.parse({
    nodes: [
      {
        id: 'note-1',
        type: 'note',
        position: { x: 120, y: 80 },
        size: { width: 360, height: 220 },
        title: 'Discovery',
        data: { markdown: '# Hello', viewMode: 'edit' },
        created_at_ms: 1,
        updated_at_ms: 1
      }
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'note-1',
        target: 'terminal-1',
        sourceHandle: 'right',
        targetHandle: 'left',
        created_at_ms: 1
      }
    ]
  })
).not.toThrow();
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/shared/ipc-schemas.test.ts tests/unit/main/preload.test.ts`
Expected: FAIL because the old `x/y` and `sourceNodeId/targetNodeId` shape is still enforced.

**Step 3: Write minimal implementation**

- Replace per-node top-level `x` / `y` fields with:
  - `position`
  - `size`
  - `title`
  - `data`
  - `created_at_ms`
  - `updated_at_ms`
- Expand canvas edges to:
  - `source`
  - `target`
  - `sourceHandle`
  - `targetHandle`
  - `label`
  - `created_at_ms`
- Extend contract types for richer File Tree and Portal UI state only where Stage 1 needs it.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/shared/ipc-schemas.test.ts tests/unit/main/preload.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/shared/ipc/schemas.ts src/shared/ipc/contracts.ts tests/unit/shared/ipc-schemas.test.ts tests/unit/main/preload.test.ts
git commit -m "refactor: upgrade canvas snapshot schemas"
```

### Task 3: Persist the new canvas model and reset legacy canvas tables destructively

**Files:**
- Modify: `src/main/db/workspace.ts`
- Modify: `src/main/ipc/canvas.ts`
- Modify: `tests/integration/main/canvas-ipc.test.ts`
- Modify: `tests/unit/renderer/canvas.store.test.ts`

**Step 1: Write the failing test**

Update integration coverage so it asserts the new snapshot shape and legacy-edge sanitization:

```ts
await handlers.save({} as IpcMainInvokeEvent, {
  workspaceId,
  state: {
    nodes: [
      {
        id: 'note-1',
        type: 'note',
        position: { x: 120, y: 80 },
        size: { width: 360, height: 220 },
        title: 'Discovery',
        data: { markdown: '# Hello', viewMode: 'preview' },
        created_at_ms: 1,
        updated_at_ms: 1
      }
    ],
    edges: []
  }
});
```

Also add a case that seeds an old-style row and expects the repository to drop and recreate only the canvas tables.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/main/canvas-ipc.test.ts tests/unit/renderer/canvas.store.test.ts`
Expected: FAIL because the repository still serializes `x/y` payloads and old edge fields.

**Step 3: Write minimal implementation**

- Refactor `src/main/db/workspace.ts` serialization to store:
  - `position_x`
  - `position_y`
  - `width`
  - `height`
  - `title`
  - `payload_json`
- Add a canvas-table compatibility check when opening `workspace.db`.
- If legacy canvas columns are detected, drop and recreate `canvas_nodes` / `canvas_edges` while leaving runs and audits intact.
- Update `src/main/ipc/canvas.ts` sanitization for new edge keys and file-tree path data in `node.data`.
- Rewrite `src/renderer/features/canvas/canvas.store.ts` to read and write the new snapshot shape only.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/integration/main/canvas-ipc.test.ts tests/unit/renderer/canvas.store.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/db/workspace.ts src/main/ipc/canvas.ts src/renderer/features/canvas/canvas.store.ts tests/integration/main/canvas-ipc.test.ts tests/unit/renderer/canvas.store.test.ts
git commit -m "refactor: persist stage1 canvas snapshot model"
```

### Task 4: Build the workspace shell with left rail and top canvas toolbar

**Files:**
- Modify: `src/renderer/App.tsx`
- Create: `src/renderer/features/shell/WorkspaceShell.tsx`
- Create: `src/renderer/features/shell/WorkspaceSidebar.tsx`
- Create: `src/renderer/features/canvas/CanvasTopbar.tsx`
- Modify: `src/renderer/features/workspaces/WorkspaceListPage.tsx`
- Test: `tests/unit/renderer/static-components.test.ts`
- Test: `tests/e2e/workspace-list.spec.ts`

**Step 1: Write the failing test**

Add assertions for:

- collapsed/expanded shell container
- sidebar workspace title
- canvas topbar tool buttons
- workspace list staying separate from the active shell

```ts
await expect(page.getByTestId('workspace-shell')).toBeVisible();
await expect(page.getByTestId('workspace-sidebar')).toBeVisible();
await expect(page.getByTestId('canvas-topbar')).toBeVisible();
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/renderer/static-components.test.ts && npm run test:e2e -- workspace-list.spec.ts`
Expected: FAIL because the app still renders the list and canvas in one stacked page.

**Step 3: Write minimal implementation**

- Introduce `WorkspaceShell` as the top-level layout when a workspace is active.
- Move workspace-level metadata and navigation into `WorkspaceSidebar`.
- Keep `WorkspaceListPage` as the empty/no-active-workspace route.
- Build `CanvasTopbar` with tool groups and visible active-tool state.

```tsx
return activeWorkspace ? (
  <WorkspaceShell workspace={activeWorkspace}>
    <WorkspaceCanvasPage ... />
  </WorkspaceShell>
) : (
  <WorkspaceListPage />
);
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/renderer/static-components.test.ts && npm run test:e2e -- workspace-list.spec.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/App.tsx src/renderer/features/shell/WorkspaceShell.tsx src/renderer/features/shell/WorkspaceSidebar.tsx src/renderer/features/canvas/CanvasTopbar.tsx src/renderer/features/workspaces/WorkspaceListPage.tsx tests/unit/renderer/static-components.test.ts tests/e2e/workspace-list.spec.ts
git commit -m "feat: add stage1 workspace shell layout"
```

### Task 5: Replace the list canvas with a React Flow canvas surface

**Files:**
- Modify: `src/renderer/features/canvas/WorkspaceCanvasPage.tsx`
- Create: `src/renderer/features/canvas/CanvasSurface.tsx`
- Create: `src/renderer/features/canvas/canvas-ui.store.ts`
- Create: `src/renderer/features/canvas/react-flow-adapters.ts`
- Modify: `tests/unit/renderer/canvas.store.test.ts`
- Create: `tests/unit/renderer/canvas-ui.store.test.ts`
- Create: `tests/e2e/canvas-shell.spec.ts`

**Step 1: Write the failing test**

Add canvas UI tests for tool modes and selection, and an E2E shell test for pan/zoom/drag:

```ts
expect(canvasUiStore.getState().toolMode).toBe('select');
canvasUiStore.setToolMode('create-note');
expect(canvasUiStore.getState().toolMode).toBe('create-note');
```

```ts
await expect(page.getByTestId('reactflow-canvas')).toBeVisible();
await page.getByTestId('canvas-tool-pan').click();
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/renderer/canvas-ui.store.test.ts tests/unit/renderer/canvas.store.test.ts && npm run test:e2e -- canvas-shell.spec.ts`
Expected: FAIL because no React Flow canvas or tool-mode store exists.

**Step 3: Write minimal implementation**

- Replace the mapped node list with a `ReactFlow` surface.
- Introduce `canvas-ui.store.ts` for:
  - `toolMode`
  - selected node ids
  - selected edge ids
  - viewport state
- Adapt persisted nodes and edges into React Flow elements.
- Support select, pan, drag, resize, connect, and delete actions.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/renderer/canvas-ui.store.test.ts tests/unit/renderer/canvas.store.test.ts && npm run test:e2e -- canvas-shell.spec.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/features/canvas/WorkspaceCanvasPage.tsx src/renderer/features/canvas/CanvasSurface.tsx src/renderer/features/canvas/canvas-ui.store.ts src/renderer/features/canvas/react-flow-adapters.ts tests/unit/renderer/canvas.store.test.ts tests/unit/renderer/canvas-ui.store.test.ts tests/e2e/canvas-shell.spec.ts
git commit -m "feat: replace canvas list with react flow surface"
```

### Task 6: Implement drag-to-create node placement and creation dialogs

**Files:**
- Modify: `src/renderer/features/canvas/CanvasSurface.tsx`
- Create: `src/renderer/features/canvas/creation/useCanvasCreation.ts`
- Create: `src/renderer/features/canvas/creation/CreationOverlay.tsx`
- Create: `src/renderer/features/canvas/creation/CreateNodeDialog.tsx`
- Modify: `src/renderer/features/canvas/canvas.store.ts`
- Create: `tests/unit/renderer/use-canvas-creation.test.ts`
- Modify: `tests/e2e/canvas-shell.spec.ts`

**Step 1: Write the failing test**

Add unit coverage for drawn bounds and an E2E test for box-creating a note:

```ts
const bounds = deriveNodeBounds({ x: 40, y: 60 }, { x: 280, y: 220 });
expect(bounds).toEqual({ x: 40, y: 60, width: 240, height: 160 });
```

```ts
await page.getByTestId('canvas-tool-note').click();
await dragMarquee(page, { x: 300, y: 220 }, { x: 640, y: 460 });
await expect(page.getByTestId('note-node-title')).toBeVisible();
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/renderer/use-canvas-creation.test.ts && npm run test:e2e -- canvas-shell.spec.ts`
Expected: FAIL because the canvas still creates nodes from button clicks.

**Step 3: Write minimal implementation**

- Add a drag overlay that activates when a create tool is selected.
- Compute node position and size from the marquee rectangle.
- Show a small creation dialog only for File Tree and Portal when defaults are insufficient.
- Route creation through `canvas.store`.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/renderer/use-canvas-creation.test.ts && npm run test:e2e -- canvas-shell.spec.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/features/canvas/CanvasSurface.tsx src/renderer/features/canvas/creation/useCanvasCreation.ts src/renderer/features/canvas/creation/CreationOverlay.tsx src/renderer/features/canvas/creation/CreateNodeDialog.tsx src/renderer/features/canvas/canvas.store.ts tests/unit/renderer/use-canvas-creation.test.ts tests/e2e/canvas-shell.spec.ts
git commit -m "feat: add drag-to-create canvas nodes"
```

### Task 7: Rebuild the Note node as a markdown document pane

**Files:**
- Create: `src/renderer/features/canvas/nodes/shared/CanvasNodeFrame.tsx`
- Modify: `src/renderer/features/canvas/nodes/NoteNode.tsx`
- Create: `src/renderer/features/canvas/nodes/NoteNode.css.ts` or merge into `src/renderer/styles/app-shell.css`
- Create: `tests/unit/renderer/note-node.test.ts`
- Modify: `tests/e2e/note-node.spec.ts`

**Step 1: Write the failing test**

Add unit and E2E coverage for markdown preview:

```ts
expect(markup).toContain('<h1>Heading</h1>');
expect(markup).toContain('Preview');
```

```ts
await page.getByTestId('note-node-tab-preview').click();
await expect(page.getByTestId('note-node-preview')).toContainText('Heading');
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/renderer/note-node.test.ts && npm run test:e2e -- note-node.spec.ts`
Expected: FAIL because the note node still renders a raw textarea and `x/y` fields.

**Step 3: Write minimal implementation**

- Introduce `CanvasNodeFrame` for shared node chrome: icon, title, delete menu, handles, state ring.
- Replace the note node body with:
  - edit tab
  - preview tab
  - `react-markdown` + `remark-gfm`
- Remove direct `x/y` inputs from the node.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/renderer/note-node.test.ts && npm run test:e2e -- note-node.spec.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/features/canvas/nodes/shared/CanvasNodeFrame.tsx src/renderer/features/canvas/nodes/NoteNode.tsx src/renderer/styles/app-shell.css tests/unit/renderer/note-node.test.ts tests/e2e/note-node.spec.ts
git commit -m "feat: rebuild note node as markdown pane"
```

### Task 8: Rebuild the Terminal node as a terminal-style run pane

**Files:**
- Modify: `src/renderer/features/canvas/nodes/TerminalNode.tsx`
- Modify: `src/renderer/features/runs/RunDrawer.tsx`
- Create: `tests/unit/renderer/terminal-node.test.ts`
- Modify: `tests/e2e/terminal-run.spec.ts`

**Step 1: Write the failing test**

Add assertions for header chrome, output region, and command composer:

```ts
expect(markup).toContain('terminal-node-output');
expect(markup).toContain('terminal-node-composer');
expect(markup).toContain('Last run');
```

```ts
await expect(page.getByTestId('terminal-node-output')).toContainText('hello');
await expect(page.getByTestId('terminal-node-composer-input')).toBeVisible();
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/renderer/terminal-node.test.ts && npm run test:e2e -- terminal-run.spec.ts`
Expected: FAIL because the node still renders a plain command field and run button.

**Step 3: Write minimal implementation**

- Render a terminal-styled output panel with scrollback from recent runs.
- Keep the existing run-start behavior, but move the input into a terminal footer composer.
- Add runtime badge, status light, and compact recent-history list.
- Keep `RunDrawer` compatible with the new node affordances.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/renderer/terminal-node.test.ts && npm run test:e2e -- terminal-run.spec.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/features/canvas/nodes/TerminalNode.tsx src/renderer/features/runs/RunDrawer.tsx tests/unit/renderer/terminal-node.test.ts tests/e2e/terminal-run.spec.ts
git commit -m "feat: rebuild terminal node as run pane"
```

### Task 9: Rebuild the File Tree node as a navigable directory browser

**Files:**
- Modify: `src/renderer/features/canvas/nodes/FileTreeNode.tsx`
- Modify: `src/renderer/features/git/GitPanel.tsx`
- Modify: `src/shared/ipc/contracts.ts`
- Modify: `src/main/ipc/files.ts`
- Create: `tests/unit/renderer/file-tree-node.test.ts`
- Modify: `tests/integration/main/file-tree-ipc.test.ts`
- Modify: `tests/e2e/file-tree.spec.ts`

**Step 1: Write the failing test**

Add coverage for breadcrumb navigation and client-side search:

```ts
expect(markup).toContain('file-tree-breadcrumbs');
expect(markup).toContain('file-tree-search-input');
```

```ts
await page.getByTestId('file-tree-search-input').fill('src');
await expect(page.getByTestId('file-tree-entry-src')).toBeVisible();
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/renderer/file-tree-node.test.ts tests/integration/main/file-tree-ipc.test.ts && npm run test:e2e -- file-tree.spec.ts`
Expected: FAIL because the node still renders a flat list without breadcrumbs or search.

**Step 3: Write minimal implementation**

- Add current-path navigation state in the node.
- Render breadcrumbs, back action, search field, and expandable entry rows.
- Keep read-only behavior.
- Move branch creation into the File Tree node menu instead of a dedicated inline button row.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/renderer/file-tree-node.test.ts tests/integration/main/file-tree-ipc.test.ts && npm run test:e2e -- file-tree.spec.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/features/canvas/nodes/FileTreeNode.tsx src/renderer/features/git/GitPanel.tsx src/shared/ipc/contracts.ts src/main/ipc/files.ts tests/unit/renderer/file-tree-node.test.ts tests/integration/main/file-tree-ipc.test.ts tests/e2e/file-tree.spec.ts
git commit -m "feat: rebuild file tree node browser"
```

### Task 10: Rebuild the Portal node as a browser-style pane

**Files:**
- Modify: `src/renderer/features/canvas/nodes/PortalNode.tsx`
- Modify: `src/renderer/features/portal/PortalToolbar.tsx`
- Modify: `src/shared/ipc/contracts.ts`
- Modify: `src/main/ipc/portal.ts`
- Modify: `src/main/portal/portal-manager.ts`
- Create: `tests/unit/renderer/portal-node.test.ts`
- Modify: `tests/integration/main/portal-ipc.test.ts`
- Modify: `tests/e2e/portal-node.spec.ts`

**Step 1: Write the failing test**

Add coverage for browser chrome:

```ts
expect(markup).toContain('portal-address-bar');
expect(markup).toContain('portal-nav-back');
expect(markup).toContain('portal-nav-forward');
```

```ts
await expect(page.getByTestId('portal-address-bar')).toHaveValue(fixture.origin);
await expect(page.getByTestId('portal-page-title')).toContainText('Portal Fixture');
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/renderer/portal-node.test.ts tests/integration/main/portal-ipc.test.ts && npm run test:e2e -- portal-node.spec.ts`
Expected: FAIL because the portal still exposes a debug-action form instead of browser chrome.

**Step 3: Write minimal implementation**

- Replace always-visible debug inputs with browser-style controls.
- Expose page title, current URL, loading state, and back/forward availability through portal IPC.
- Move screenshot and structure actions into an overflow menu.
- Keep real page rendering in the content area.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/renderer/portal-node.test.ts tests/integration/main/portal-ipc.test.ts && npm run test:e2e -- portal-node.spec.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/features/canvas/nodes/PortalNode.tsx src/renderer/features/portal/PortalToolbar.tsx src/shared/ipc/contracts.ts src/main/ipc/portal.ts src/main/portal/portal-manager.ts tests/unit/renderer/portal-node.test.ts tests/integration/main/portal-ipc.test.ts tests/e2e/portal-node.spec.ts
git commit -m "feat: rebuild portal node as browser pane"
```

### Task 11: Wire delete, edge persistence, and branch actions into the final shell

**Files:**
- Modify: `src/renderer/features/canvas/CanvasSurface.tsx`
- Modify: `src/renderer/features/canvas/canvas.store.ts`
- Modify: `src/renderer/features/workspaces/workspaces.store.ts`
- Modify: `src/renderer/features/workspaces/BranchWorkspaceDialog.tsx`
- Modify: `tests/e2e/branch-workspace.spec.ts`
- Create: `tests/e2e/canvas-connections.spec.ts`

**Step 1: Write the failing test**

Add a new E2E spec for connection persistence and deletion cleanup:

```ts
await createConnectedNoteAndTerminal(page);
await expect(page.getByTestId('canvas-edge-count')).toContainText('1');
await pressDelete(page);
await expect(page.getByTestId('canvas-edge-count')).toContainText('0');
```

Also update branch-workspace coverage so the branch entry path uses the new shell/menu location.

**Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- canvas-connections.spec.ts branch-workspace.spec.ts`
Expected: FAIL because delete and branch entry still follow the old UI model.

**Step 3: Write minimal implementation**

- Make delete remove selected nodes and connected edges from both React Flow state and persisted snapshot.
- Expose edge count or stable edge selectors for E2E.
- Route branch workspace creation from the new shell and File Tree node menu.

**Step 4: Run test to verify it passes**

Run: `npm run test:e2e -- canvas-connections.spec.ts branch-workspace.spec.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/features/canvas/CanvasSurface.tsx src/renderer/features/canvas/canvas.store.ts src/renderer/features/workspaces/workspaces.store.ts src/renderer/features/workspaces/BranchWorkspaceDialog.tsx tests/e2e/branch-workspace.spec.ts tests/e2e/canvas-connections.spec.ts
git commit -m "feat: finish stage1 canvas interactions"
```

### Task 12: Run full verification and refresh documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/release/2026-04-16-openweave-alpha-checklist.md`
- Optional: `docs/plans/2026-04-16-openweave-stage1-canvas-shell-redesign-design.md` only if implementation changed the approved design

**Step 1: Update docs**

- Describe the new shell layout, draw-to-create interaction, and Stage 1 node capabilities.
- Note the intentional destructive canvas schema reset.
- Update the alpha checklist language so QA can verify the new shell instead of the old list UI.

**Step 2: Run verification**

Run:

```bash
npm test -- \
  tests/unit/shared/ipc-schemas.test.ts \
  tests/unit/main/preload.test.ts \
  tests/unit/renderer/static-components.test.ts \
  tests/unit/renderer/canvas.store.test.ts \
  tests/unit/renderer/canvas-ui.store.test.ts \
  tests/unit/renderer/use-canvas-creation.test.ts \
  tests/unit/renderer/note-node.test.ts \
  tests/unit/renderer/terminal-node.test.ts \
  tests/unit/renderer/file-tree-node.test.ts \
  tests/unit/renderer/portal-node.test.ts \
  tests/integration/main/canvas-ipc.test.ts \
  tests/integration/main/file-tree-ipc.test.ts \
  tests/integration/main/portal-ipc.test.ts
```

Run:

```bash
npm run build
```

Run:

```bash
npm run test:e2e -- \
  workspace-list.spec.ts \
  canvas-shell.spec.ts \
  canvas-connections.spec.ts \
  note-node.spec.ts \
  terminal-run.spec.ts \
  file-tree.spec.ts \
  portal-node.spec.ts \
  branch-workspace.spec.ts
```

Expected: all commands PASS.

**Step 3: Commit**

```bash
git add README.md docs/release/2026-04-16-openweave-alpha-checklist.md
git commit -m "docs: update stage1 canvas shell verification"
```
