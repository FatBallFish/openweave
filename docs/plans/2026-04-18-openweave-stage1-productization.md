# OpenWeave Stage 1 Productization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Productize the remaining Stage 1 follow-up slices in sequence: Terminal, File Tree, Portal, then Canvas polish and performance.

**Architecture:** Keep the Stage 1 canvas shell and current backend slices intact, then upgrade each remaining slice vertically from tests through renderer/UI and any required IPC adjustments. Execute one slice at a time so the node framework evolves incrementally without mixing unrelated behavior changes.

**Tech Stack:** Electron, React, TypeScript, Vite, Vitest, Playwright Electron, existing OpenWeave IPC bridges and workspace persistence.

---

### Task 1: Productize the Terminal node

**Files:**
- Modify: `src/renderer/features/canvas/nodes/TerminalNode.tsx`
- Modify: `src/renderer/features/runs/RunDrawer.tsx`
- Test: `tests/unit/renderer/terminal-node.test.ts`
- Test: `tests/e2e/terminal-run.spec.ts`

**Step 1: Write the failing test**

Create `tests/unit/renderer/terminal-node.test.ts` to assert the terminal node now renders product chrome instead of raw coordinate fields:

```ts
expect(markup).toContain('terminal-node-output');
expect(markup).toContain('terminal-node-composer');
expect(markup).toContain('Last run');
expect(markup).not.toContain('terminal-node-x-');
```

Extend `tests/e2e/terminal-run.spec.ts` so it checks the visible output region and terminal-style composer affordance after a run completes.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/renderer/terminal-node.test.ts tests/e2e/terminal-run.spec.ts`
Expected: FAIL because `TerminalNode` still renders a command textbox plus `x/y` editors.

**Step 3: Write minimal implementation**

- Replace the direct `x/y` controls with terminal-style node chrome.
- Keep the existing run-start IPC path, but move command entry into a footer composer.
- Render recent run output and status in a dedicated output panel.
- Keep `RunDrawer` aligned with the upgraded node so node-to-drawer navigation still works naturally.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/renderer/terminal-node.test.ts && npx playwright test -c playwright.config.ts tests/e2e/terminal-run.spec.ts --reporter=line`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/features/canvas/nodes/TerminalNode.tsx src/renderer/features/runs/RunDrawer.tsx tests/unit/renderer/terminal-node.test.ts tests/e2e/terminal-run.spec.ts
git commit -m "feat: productize terminal node surface"
```

### Task 2: Productize the File Tree node

**Files:**
- Modify: `src/renderer/features/canvas/nodes/FileTreeNode.tsx`
- Modify: `src/renderer/features/git/GitPanel.tsx`
- Modify: `src/shared/ipc/contracts.ts`
- Modify: `src/main/ipc/files.ts`
- Test: `tests/unit/renderer/file-tree-node.test.ts`
- Test: `tests/integration/main/file-tree-ipc.test.ts`
- Test: `tests/e2e/file-tree.spec.ts`

**Step 1: Write the failing test**

Create `tests/unit/renderer/file-tree-node.test.ts` with expectations for breadcrumbs, back navigation, search, and the absence of raw `x/y` editors:

```ts
expect(markup).toContain('file-tree-breadcrumbs');
expect(markup).toContain('file-tree-search-input');
expect(markup).not.toContain('file-tree-node-x-');
```

Extend `tests/integration/main/file-tree-ipc.test.ts` and `tests/e2e/file-tree.spec.ts` so they cover navigable directory rendering, git summary persistence, and branch-workspace entry from the upgraded node surface.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/renderer/file-tree-node.test.ts tests/integration/main/file-tree-ipc.test.ts && npx playwright test -c playwright.config.ts tests/e2e/file-tree.spec.ts --reporter=line`
Expected: FAIL because the node still renders a flat list and simple refresh action.

**Step 3: Write minimal implementation**

- Add current-path navigation state and breadcrumb rendering.
- Add client-side search/filter over the loaded tree payload.
- Upgrade the visual chrome so directory/file rows, repo summary, and branch actions feel coherent.
- Keep the surface read-only.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/renderer/file-tree-node.test.ts tests/integration/main/file-tree-ipc.test.ts && npx playwright test -c playwright.config.ts tests/e2e/file-tree.spec.ts --reporter=line`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/features/canvas/nodes/FileTreeNode.tsx src/renderer/features/git/GitPanel.tsx src/shared/ipc/contracts.ts src/main/ipc/files.ts tests/unit/renderer/file-tree-node.test.ts tests/integration/main/file-tree-ipc.test.ts tests/e2e/file-tree.spec.ts
git commit -m "feat: productize file tree node surface"
```

### Task 3: Productize the Portal node

**Files:**
- Modify: `src/renderer/features/canvas/nodes/PortalNode.tsx`
- Modify: `src/renderer/features/portal/PortalToolbar.tsx`
- Modify: `src/shared/ipc/contracts.ts`
- Modify: `src/main/ipc/portal.ts`
- Modify: `src/main/portal/portal-manager.ts`
- Test: `tests/unit/renderer/portal-node.test.ts`
- Test: `tests/integration/main/portal-ipc.test.ts`
- Test: `tests/e2e/portal-node.spec.ts`

**Step 1: Write the failing test**

Create `tests/unit/renderer/portal-node.test.ts` to assert richer browser-style chrome and no raw coordinate editors:

```ts
expect(markup).toContain('portal-browser-chrome');
expect(markup).toContain('portal-session-state');
expect(markup).not.toContain('portal-node-x-');
```

Extend `tests/integration/main/portal-ipc.test.ts` and `tests/e2e/portal-node.spec.ts` to cover the upgraded session/control flow while preserving the current `file://` guardrails.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/renderer/portal-node.test.ts tests/integration/main/portal-ipc.test.ts && npx playwright test -c playwright.config.ts tests/e2e/portal-node.spec.ts --reporter=line`
Expected: FAIL because the portal node still exposes a thin automation form.

**Step 3: Write minimal implementation**

- Reshape the node UI into browser-style chrome with clearer loading and session affordances.
- Preserve existing portal operations behind the upgraded UI.
- Adjust IPC or manager state only where needed to support clearer node session behavior.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/renderer/portal-node.test.ts tests/integration/main/portal-ipc.test.ts && npx playwright test -c playwright.config.ts tests/e2e/portal-node.spec.ts --reporter=line`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/features/canvas/nodes/PortalNode.tsx src/renderer/features/portal/PortalToolbar.tsx src/shared/ipc/contracts.ts src/main/ipc/portal.ts src/main/portal/portal-manager.ts tests/unit/renderer/portal-node.test.ts tests/integration/main/portal-ipc.test.ts tests/e2e/portal-node.spec.ts
git commit -m "feat: productize portal node surface"
```

### Task 4: Polish canvas interactions and performance for the final Stage 1 surfaces

**Files:**
- Modify: `src/renderer/features/canvas/WorkspaceCanvasPage.tsx`
- Modify: `src/renderer/features/canvas/canvas.store.ts`
- Modify: `src/renderer/features/canvas/react-flow-adapters.ts`
- Test: `tests/unit/renderer/canvas.store.test.ts`
- Test: `tests/unit/renderer/react-flow-adapters.test.ts`
- Test: `tests/e2e/canvas-shell.spec.ts`
- Test: `tests/e2e/canvas-connections.spec.ts`

**Step 1: Write the failing test**

Extend the unit and E2E suites so they assert final resize semantics and heavier interaction regression coverage:

```ts
expect(result.width).toBe(320);
expect(result.position.x).toBe(160);
expect(result.position.y).toBe(120);
```

Add E2E coverage for top/bottom resize behavior, repeated drag-resize cycles, and selection/delete flows after the node productization slices have landed.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/renderer/canvas.store.test.ts tests/unit/renderer/react-flow-adapters.test.ts && npx playwright test -c playwright.config.ts tests/e2e/canvas-shell.spec.ts tests/e2e/canvas-connections.spec.ts --reporter=line`
Expected: FAIL because the current regression set does not yet pin down these final interactions.

**Step 3: Write minimal implementation**

- Fix any resize/selection semantics exposed by the new tests.
- Tighten adapter/store behavior where repeated updates or final node shapes cause drift.
- Keep the implementation focused on Stage 1 interaction hardening, not architectural rewrite.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/renderer/canvas.store.test.ts tests/unit/renderer/react-flow-adapters.test.ts && npx playwright test -c playwright.config.ts tests/e2e/canvas-shell.spec.ts tests/e2e/canvas-connections.spec.ts --reporter=line`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/features/canvas/WorkspaceCanvasPage.tsx src/renderer/features/canvas/canvas.store.ts src/renderer/features/canvas/react-flow-adapters.ts tests/unit/renderer/canvas.store.test.ts tests/unit/renderer/react-flow-adapters.test.ts tests/e2e/canvas-shell.spec.ts tests/e2e/canvas-connections.spec.ts
git commit -m "fix: polish canvas interactions for stage1 surfaces"
```
