# OpenWeave Homepage Overlay and I18n Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the homepage into a canvas-first overlay shell, fix node visibility after creation, convert shell controls to icon-first buttons with hover labels, and add installable renderer language packs for Chinese and English.

**Architecture:** The renderer shell becomes a full-screen canvas compositor with floating chrome layered above a single React Flow canvas. Canvas node creation reuses a visibility-aware placement helper, and renderer copy moves behind a language-pack registry plus provider so future locales can be added or removed as packs.

**Tech Stack:** React 19, TypeScript, Vitest, React Flow (`@xyflow/react`), existing OpenWeave renderer/store architecture.

---

### Task 1: Lock shell and canvas expectations with failing tests

**Files:**
- Modify: `tests/unit/renderer/app-shell.test.ts`
- Modify: `tests/unit/renderer/workbench-shell.test.ts`
- Modify: `tests/unit/renderer/workbench-toolbar.test.ts`
- Modify: `tests/unit/renderer/canvas-shell.test.ts`

**Step 1: Write the failing tests**
- Assert the workbench shell renders a full-screen overlay stage instead of a grid-constrained shell surface.
- Assert the canvas page no longer renders duplicate page/header chrome around the actual canvas.
- Assert the top bar and inspector expose icon/tooltip-oriented controls instead of text-heavy primary actions.

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/unit/renderer/app-shell.test.ts tests/unit/renderer/workbench-shell.test.ts tests/unit/renderer/workbench-toolbar.test.ts tests/unit/renderer/canvas-shell.test.ts`
Expected: FAIL because the current shell still renders duplicate canvas chrome and text buttons.

**Step 3: Write minimal implementation**
- Refactor `WorkbenchShell`, `WorkspaceCanvasPage`, `CanvasShell`, `WorkbenchTopBar`, `WorkbenchInspector`, and related CSS to match the new overlay structure.

**Step 4: Run test to verify it passes**
Run: `npm test -- tests/unit/renderer/app-shell.test.ts tests/unit/renderer/workbench-shell.test.ts tests/unit/renderer/workbench-toolbar.test.ts tests/unit/renderer/canvas-shell.test.ts`
Expected: PASS.

### Task 2: Lock node placement behavior with failing tests

**Files:**
- Modify: `tests/unit/renderer/canvas.store.test.ts`
- Modify: `src/renderer/features/canvas/canvas.store.ts`

**Step 1: Write the failing test**
- Assert newly added nodes are assigned non-overlapping starter positions and the store selects the latest created node.

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/unit/renderer/canvas.store.test.ts`
Expected: FAIL because current creation paths use fixed coordinates and do not guarantee selection/visible slotting.

**Step 3: Write minimal implementation**
- Add shared helper(s) that compute the next available starter bounds from existing node rectangles.
- Update all add-node actions to use the helper and select the new node.

**Step 4: Run test to verify it passes**
Run: `npm test -- tests/unit/renderer/canvas.store.test.ts`
Expected: PASS.

### Task 3: Add renderer language-pack infrastructure with failing tests

**Files:**
- Create: `src/renderer/i18n/types.ts`
- Create: `src/renderer/i18n/registry.ts`
- Create: `src/renderer/i18n/provider.tsx`
- Create: `src/renderer/i18n/packs/zh-CN.ts`
- Create: `src/renderer/i18n/packs/en-US.ts`
- Modify: `src/renderer/main.tsx`
- Create: `tests/unit/renderer/i18n.test.tsx`

**Step 1: Write the failing tests**
- Assert built-in Chinese and English packs can be listed and resolved.
- Assert packs can be registered and unregistered.
- Assert the provider returns translated strings and falls back predictably.

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/unit/renderer/i18n.test.tsx`
Expected: FAIL because no i18n registry/provider exists.

**Step 3: Write minimal implementation**
- Implement the registry and provider.
- Register bundled `zh-CN` and `en-US` packs.
- Wrap the renderer root with the i18n provider.

**Step 4: Run test to verify it passes**
Run: `npm test -- tests/unit/renderer/i18n.test.tsx`
Expected: PASS.

### Task 4: Translate homepage chrome and verify integrated behavior

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/features/workbench/WorkbenchTopBar.tsx`
- Modify: `src/renderer/features/workbench/WorkbenchLeftRail.tsx`
- Modify: `src/renderer/features/workbench/WorkbenchInspector.tsx`
- Modify: `src/renderer/features/workbench/WorkbenchContextPanel.tsx`
- Modify: `src/renderer/features/canvas/nodes/NodeToolbar.tsx`
- Modify: `src/renderer/features/canvas-shell/CanvasEmptyState.tsx`
- Modify: related renderer unit tests

**Step 1: Write the failing tests**
- Assert Chinese is the default rendered locale for homepage shell copy.
- Assert switching to English changes shared labels.
- Assert icon buttons still surface descriptive hover labels.

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/unit/renderer/app-shell.test.ts tests/unit/renderer/inspector-panel.test.ts tests/unit/renderer/static-components.test.ts`
Expected: FAIL because text is still hard-coded and not locale-aware.

**Step 3: Write minimal implementation**
- Replace hard-coded homepage strings with `t()` calls.
- Keep labels accessible with `aria-label` and `title`.

**Step 4: Run test to verify it passes**
Run: `npm test -- tests/unit/renderer/app-shell.test.ts tests/unit/renderer/inspector-panel.test.ts tests/unit/renderer/static-components.test.ts`
Expected: PASS.

### Task 5: Final verification

**Files:**
- No code changes required unless verification fails.

**Step 1: Run focused renderer validation**
Run: `npm test -- tests/unit/renderer/app-shell.test.ts tests/unit/renderer/workbench-shell.test.ts tests/unit/renderer/workbench-toolbar.test.ts tests/unit/renderer/canvas-shell.test.ts tests/unit/renderer/canvas.store.test.ts tests/unit/renderer/inspector-panel.test.ts tests/unit/renderer/static-components.test.ts tests/unit/renderer/i18n.test.tsx`
Expected: PASS.

**Step 2: Run broader safety net**
Run: `npm test -- tests/unit/renderer`
Expected: PASS.

**Step 3: Inspect diff and ensure scope is limited**
Run: `git status --short`
Expected: only planned renderer/docs/test files changed.
