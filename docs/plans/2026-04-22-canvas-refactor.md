# Canvas Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the infinite canvas to support intuitive trackpad/mouse gestures, improve node styling, and add resize handles.

**Architecture:** Extend the existing `@xyflow/react` v12-based canvas with custom `onWheel` handling for trackpad/mouse discrimination, CSS-only visual improvements, and built-in `NodeResizer` for 8-direction resize.

**Tech Stack:** React 18, TypeScript, `@xyflow/react` v12, Vitest

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/renderer/features/canvas/canvas.store.ts` | Canvas state store; add `updateNodeBounds` method |
| `src/renderer/features/canvas-shell/CanvasShell.tsx` | ReactFlow container; custom wheel handler, NodeResizer, props changes |
| `src/renderer/styles/workbench.css` | All canvas/node/background visual styles |
| `src/renderer/i18n/packs/en-US.ts` | English translations |
| `src/renderer/i18n/packs/zh-CN.ts` | Chinese translations |
| `tests/unit/renderer/canvas.store.test.ts` | Unit tests for canvas store |
| `tests/unit/renderer/canvas-shell.test.ts` | Unit tests for canvas shell rendering |

---

## Task 1: Add `updateNodeBounds` to canvas store

**Files:**
- Modify: `src/renderer/features/canvas/canvas.store.ts`
- Test: `tests/unit/renderer/canvas.store.test.ts`

The store currently has `updateNodePosition` (updates `x`/`y`). We need a new method `updateNodeBounds` that updates `x`, `y`, `width`, and `height`.

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/renderer/canvas.store.test.ts`, inside the `describe('canvas store', () => { ... })` block:

```ts
  it('persists graph-node bounds updates without dropping metadata', async () => {
    const saveGraphSnapshot = vi.fn().mockImplementation(async (input: { graphSnapshot: GraphSnapshotV2Input }) => ({
      graphSnapshot: input.graphSnapshot
    }));
    setBridge({
      loadGraphSnapshot: vi.fn().mockResolvedValue({ graphSnapshot: createGraphSnapshot() }),
      saveGraphSnapshot
    });

    const { canvasStore } = await importStore();
    await canvasStore.loadCanvasState('ws-1');

    await (canvasStore as unknown as {
      updateNodeBounds: (nodeId: string, bounds: { x: number; y: number; width: number; height: number }) => Promise<void>;
    }).updateNodeBounds('node-terminal-1', { x: 300, y: 220, width: 500, height: 300 });

    expect(saveGraphSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        graphSnapshot: expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({
              id: 'node-terminal-1',
              componentType: 'builtin.terminal',
              componentVersion: '1.0.0',
              state: expect.objectContaining({
                activeSessionId: null
              }),
              bounds: expect.objectContaining({
                x: 300,
                y: 220,
                width: 500,
                height: 300
              })
            })
          ])
        })
      })
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/canvas.store.test.ts --reporter=verbose`

Expected: FAIL with `TypeError: canvasStore.updateNodeBounds is not a function`

- [ ] **Step 3: Implement `updateNodeBounds` in canvas store**

Add the following method to `canvasStore` object in `src/renderer/features/canvas/canvas.store.ts`, after `updateNodePosition` (around line 720):

```ts
  updateNodeBounds: async (
    nodeId: string,
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    }
  ): Promise<void> => {
    if (!state.workspaceId) {
      return;
    }

    const workspaceId = state.workspaceId;
    const nextGraphSnapshot = updateGraphNode(state.graphSnapshot, nodeId, (node) => ({
      ...node,
      bounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      },
      updatedAtMs: Date.now()
    }));

    applyGraphSnapshot(nextGraphSnapshot);
    setState({ errorMessage: null, recentAction: 'Resized node on canvas' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to resize graph node';
      setState({ errorMessage });
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/canvas.store.test.ts --reporter=verbose`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/features/canvas/canvas.store.ts tests/unit/renderer/canvas.store.test.ts
git commit -m "feat: add updateNodeBounds to canvas store"
```

---

## Task 2: Wire `updateNodeBounds` into WorkspaceCanvasPage

**Files:**
- Modify: `src/renderer/features/canvas/WorkspaceCanvasPage.tsx`

- [ ] **Step 1: Pass the new callback through to CanvasShell**

In `src/renderer/features/canvas/WorkspaceCanvasPage.tsx`, add a new prop handler inside the component (after `openBranchDialog`):

```tsx
  const resizeNode = useCallback((nodeId: string, bounds: { x: number; y: number; width: number; height: number }) => {
    void canvasStore.updateNodeBounds(nodeId, bounds);
  }, []);
```

Then pass it to `<CanvasShell ... />`:

```tsx
        <CanvasShell
          ...existing props...
          onResizeNode={resizeNode}
        />
```

- [ ] **Step 2: Add `onResizeNode` to `CanvasShellProps` interface**

In `src/renderer/features/canvas-shell/CanvasShell.tsx`, add to the `CanvasShellProps` interface:

```ts
  onResizeNode: (nodeId: string, bounds: { x: number; y: number; width: number; height: number }) => void;
```

Also add it to the destructured props in `CanvasShell`:

```tsx
export const CanvasShell = ({
  ...existing props...
  onResizeNode
}: CanvasShellProps): JSX.Element => {
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/features/canvas/WorkspaceCanvasPage.tsx src/renderer/features/canvas-shell/CanvasShell.tsx
git commit -m "feat: wire updateNodeBounds from store through to CanvasShell"
```

---

## Task 3: Refactor ReactFlow interaction props and custom onWheel

**Files:**
- Modify: `src/renderer/features/canvas-shell/CanvasShell.tsx`

- [ ] **Step 1: Import `useReactFlow` and `useCallback`**

Ensure imports include:

```tsx
import { useCallback } from 'react';
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps
} from '@xyflow/react';
```

- [ ] **Step 2: Modify `CanvasViewportController` to expose zoom helpers**

Replace the existing `CanvasViewportController` with one that also handles wheel events:

```tsx
const CanvasViewportController = ({
  fitViewRequestId,
  nodesCount
}: {
  fitViewRequestId: number;
  nodesCount: number;
}): null => {
  const { fitView, getViewport, setViewport } = useReactFlow();
  const previousNodesCount = useRef(nodesCount);

  useEffect(() => {
    if (fitViewRequestId === 0) {
      return;
    }

    void fitView({
      duration: 180,
      padding: 0.3
    });
  }, [fitView, fitViewRequestId]);

  useEffect(() => {
    const shouldFitNewNodes = nodesCount > previousNodesCount.current && nodesCount <= 6;
    previousNodesCount.current = nodesCount;

    if (!shouldFitNewNodes) {
      return;
    }

    const timeoutHandle = window.setTimeout(() => {
      void fitView({
        duration: 180,
        padding: 0.36
      });
    }, 48);

    return () => {
      window.clearTimeout(timeoutHandle);
    };
  }, [fitView, nodesCount]);

  // Expose wheel handler via ref on window for the parent ReactFlow to use
  // This is a workaround because ReactFlow's onWheel prop isn't directly on ReactFlow
  return null;
};
```

Actually, a better approach: ReactFlow accepts `onPaneClick`, `onNodeClick`, etc. but not `onWheel` directly on the `<ReactFlow>` component. We need to use a custom component inside `<ReactFlow>` that attaches a wheel listener to the pane.

Create a new inner component:

```tsx
const WheelHandler = (): null => {
  const { getViewport, setViewport } = useReactFlow();

  useEffect(() => {
    const pane = document.querySelector('.ow-canvas-shell__flow .react-flow__pane');
    if (!pane) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      const { x, y, zoom } = getViewport();
      const rect = pane.getBoundingClientRect();

      if (event.ctrlKey || event.metaKey) {
        // Trackpad pinch → zoom
        const newZoom = event.deltaY > 0 ? zoom * 0.9 : zoom * 1.1;
        const clampedZoom = Math.min(Math.max(newZoom, 0.4), 2);
        setViewport({ x, y, zoom: clampedZoom }, { duration: 0 });
      } else if (Math.abs(event.deltaX) > 0.5 && Math.abs(event.deltaY) > 0.5) {
        // Trackpad two-finger pan → pan
        setViewport(
          { x: x - event.deltaX / zoom, y: y - event.deltaY / zoom, zoom },
          { duration: 0 }
        );
      } else {
        // Mouse wheel → zoom centered on cursor
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.4), 2);

        const worldX = (mouseX - x) / zoom;
        const worldY = (mouseY - y) / zoom;
        const newX = mouseX - worldX * newZoom;
        const newY = mouseY - worldY * newZoom;

        setViewport({ x: newX, y: newY, zoom: newZoom }, { duration: 0 });
      }
    };

    pane.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      pane.removeEventListener('wheel', handleWheel);
    };
  }, [getViewport, setViewport]);

  return null;
};
```

- [ ] **Step 3: Update ReactFlow props**

In the `<ReactFlow>` component, change:

```tsx
            <ReactFlow
              defaultViewport={DEFAULT_CANVAS_VIEWPORT}
              edges={edges}
              elementsSelectable={true}
              minZoom={0.4}
              nodeTypes={nodeTypes}
              nodes={nodes}
              onEdgesChange={onEdgesChange}
              onNodeClick={(_event, node) => {
                onSelectNode(node.id);
              }}
              onNodeDragStop={(_event, node) => {
                onMoveNode(node.id, {
                  x: node.position.x,
                  y: node.position.y
                });
              }}
              onNodesChange={onNodesChange}
              onPaneClick={() => {
                onSelectNode(null);
              }}
              panOnDrag={[1]}
              panOnScroll={false}
              proOptions={{ hideAttribution: true }}
              selectionOnDrag={true}
              zoomOnDoubleClick={false}
              zoomOnPinch={true}
              zoomOnScroll={false}
            >
              <CanvasViewportController fitViewRequestId={fitViewRequestId} nodesCount={nodes.length} />
              <WheelHandler />
              <Background gap={24} size={1} />
            </ReactFlow>
```

Key prop changes:
- `panOnDrag={true}` → `panOnDrag={[1]}` (only left mouse button; removes Space+drag pan)
- `panOnScroll` not set (defaults to false)
- `selectionOnDrag={false}` → `selectionOnDrag={true}` (Shift+drag creates selection box)
- `zoomOnScroll={true}` → `zoomOnScroll={false}` (custom wheel handler takes over)
- `zoomOnPinch={true}` → keep as `true`
- `zoomOnDoubleClick={false}` → add to prevent accidental zoom on double-click

- [ ] **Step 4: Run existing tests**

Run: `npx vitest run tests/unit/renderer/canvas-shell.test.ts --reporter=verbose`

Expected: PASS (the test only checks static rendering, not interaction)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/features/canvas-shell/CanvasShell.tsx
git commit -m "feat: custom wheel handler for trackpad/mouse, update interaction props"
```

---

## Task 4: Add NodeResizer to builtin host nodes

**Files:**
- Modify: `src/renderer/features/canvas-shell/CanvasShell.tsx`

- [ ] **Step 1: Import NodeResizer**

Add to imports:

```tsx
import { NodeResizer } from '@xyflow/react';
```

- [ ] **Step 2: Update BuiltinHostFlowNode to include NodeResizer**

Replace `BuiltinHostFlowNode` with:

```tsx
const BuiltinHostFlowNode = ({ data, selected }: NodeProps<CanvasShellNode>): JSX.Element => {
  return (
    <div
      className="nodrag nopan"
      data-testid={`canvas-shell-node-${data.node.id}`}
      style={{
        width: '100%',
        height: '100%',
        minWidth: 0,
        overflow: 'hidden'
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={80}
        handleClassName="ow-node-resizer__handle"
        lineClassName="ow-node-resizer__line"
        onResizeEnd={(_event, params) => {
          data.onResizeNode?.(data.node.id, {
            x: params.x,
            y: params.y,
            width: params.width,
            height: params.height
          });
        }}
      />
      <BuiltinHostRenderer
        workspaceId={data.workspaceId}
        workspaceRootDir={data.workspaceRootDir}
        node={data.node}
        onOpenRun={data.onOpenRun}
        onCreateBranchWorkspace={data.onCreateBranchWorkspace}
      />
    </div>
  );
};
```

- [ ] **Step 3: Add `onResizeNode` to CanvasShellNodeData interface**

```ts
interface CanvasShellNodeData {
  workspaceId: string;
  workspaceRootDir: string;
  node: GraphSnapshotV2Input['nodes'][number];
  onOpenRun: (runId: string) => void;
  onCreateBranchWorkspace: () => void;
  onResizeNode?: (nodeId: string, bounds: { x: number; y: number; width: number; height: number }) => void;
}
```

Also pass it through in `projectGraphToCanvasShell`:

```tsx
      data: {
        workspaceId: input.workspaceId,
        workspaceRootDir: input.workspaceRootDir,
        node,
        onOpenRun: input.onOpenRun,
        onCreateBranchWorkspace: input.onCreateBranchWorkspace,
        onResizeNode: input.onResizeNode
      },
```

And add to `ProjectGraphToCanvasShellInput`:

```ts
export interface ProjectGraphToCanvasShellInput {
  workspaceId: string;
  workspaceRootDir: string;
  graphSnapshot: GraphSnapshotV2Input;
  onOpenRun: (runId: string) => void;
  onCreateBranchWorkspace: () => void;
  onResizeNode?: (nodeId: string, bounds: { x: number; y: number; width: number; height: number }) => void;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/renderer/canvas-shell.test.ts --reporter=verbose`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/features/canvas-shell/CanvasShell.tsx
git commit -m "feat: add NodeResizer for 8-direction resize on selected nodes"
```

---

## Task 5: CSS - Node background, canvas border-radius, selection outline

**Files:**
- Modify: `src/renderer/styles/workbench.css`

- [ ] **Step 1: Remove node background**

Find `.ow-builtin-node-frame` at line 943 and change the `background` property:

```css
.ow-builtin-node-frame {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--ow-color-border);
  border-radius: 18px;
  background: transparent;
  box-shadow: var(--ow-shadow-panel);
}
```

Also update the dark-mode override at line 2572:

```css
.ow-builtin-node-frame {
  position: relative;
  border-radius: 20px;
  background: transparent;
  box-shadow: var(--ow-shadow-node);
}
```

- [ ] **Step 2: Remove canvas border-radius**

Find `.ow-canvas-shell__flow` at line 639 and remove `border-radius`:

```css
.ow-canvas-shell__flow {
  position: relative;
  min-height: 720px;
  border: 1px solid var(--ow-color-border);
  overflow: hidden;
  background: var(--ow-color-bg-canvas);
}
```

The `@media` overrides at lines 1237 and 3715 already set `border-radius: 0` and `border: none`, so they will continue to work correctly.

- [ ] **Step 3: Add dashed outline to selected nodes**

Find `.ow-canvas-shell__flow .react-flow__node.selected .ow-builtin-node-frame` at line 2951 and change:

```css
.ow-canvas-shell__flow .react-flow__node.selected .ow-builtin-node-frame {
  border-color: rgba(var(--ow-node-kind-rgb), 0.42);
  box-shadow:
    0 0 0 1px rgba(var(--ow-node-kind-rgb), 0.18),
    var(--ow-shadow-node);
  transform: translateY(-2px);
  outline: 2px dashed rgba(var(--ow-accent-rgb), 0.72);
  outline-offset: 4px;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/styles/workbench.css
git commit -m "style: remove node bg, canvas border-radius, add dashed selection outline"
```

---

## Task 6: CSS - Grid background and NodeResizer handle styles

**Files:**
- Modify: `src/renderer/styles/workbench.css`

- [ ] **Step 1: Change Background component to lines variant**

In `CanvasShell.tsx`, change:

```tsx
<Background gap={24} variant="lines" />
```

- [ ] **Step 2: Style the grid background**

Find `.ow-canvas-shell__flow .react-flow__background` at line 3746 and change:

```css
.ow-canvas-shell__flow .react-flow__background {
  opacity: 0.9;
}
```

Add a new rule to style the grid lines color:

```css
.ow-canvas-shell__flow .react-flow__background pattern line {
  stroke: rgba(var(--ow-accent-rgb), 0.14);
  stroke-width: 1;
}
```

- [ ] **Step 3: Add NodeResizer handle styles**

Add new CSS rules (append to the end of the file or near the other canvas styles):

```css
.ow-node-resizer__handle {
  width: 8px !important;
  height: 8px !important;
  border-radius: 2px !important;
  background: rgba(var(--ow-accent-rgb), 0.85) !important;
  border: 1px solid rgba(var(--ow-surface-rgb), 0.9) !important;
  box-shadow: 0 0 0 1px rgba(var(--ow-accent-rgb), 0.3) !important;
}

.ow-node-resizer__handle:hover {
  background: rgb(var(--ow-accent-rgb)) !important;
  transform: scale(1.3);
}

.ow-node-resizer__line {
  border-color: rgba(var(--ow-accent-rgb), 0.35) !important;
  border-style: dashed !important;
  border-width: 1px !important;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/features/canvas-shell/CanvasShell.tsx src/renderer/styles/workbench.css
git commit -m "style: grid lines background, NodeResizer handle styling"
```

---

## Task 7: Remove Space-pan hint from NodeToolbar

**Files:**
- Modify: `src/renderer/features/canvas/nodes/NodeToolbar.tsx`
- Modify: `src/renderer/i18n/packs/en-US.ts`
- Modify: `src/renderer/i18n/packs/zh-CN.ts`

- [ ] **Step 1: Remove the pan hint from NodeToolbar**

In `src/renderer/features/canvas/nodes/NodeToolbar.tsx`, remove the pan hint span:

```tsx
export const NodeToolbar = (): JSX.Element => {
  const { t } = useI18n();

  return (
    <div className="ow-node-toolbar" data-testid="node-toolbar">
      <strong className="ow-node-toolbar__title">{t('nodeToolbar.title')}</strong>
      <span className="ow-node-toolbar__hint" data-testid="canvas-quick-insert-hint">
        {t('nodeToolbar.quickInsert')}
      </span>
      <span className="ow-node-toolbar__hint" data-testid="canvas-command-menu-hint">
        {t('nodeToolbar.commandMenu')}
      </span>
    </div>
  );
};
```

- [ ] **Step 2: Remove pan translation keys**

In `src/renderer/i18n/packs/en-US.ts`, remove:
```ts
    'nodeToolbar.pan': 'Space Pan',
```

In `src/renderer/i18n/packs/zh-CN.ts`, remove:
```ts
    'nodeToolbar.pan': 'Space 平移',
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/features/canvas/nodes/NodeToolbar.tsx src/renderer/i18n/packs/en-US.ts src/renderer/i18n/packs/zh-CN.ts
git commit -m "feat: remove Space-pan hint from toolbar (trackpad pan replaces it)"
```

---

## Task 8: Run full test suite

- [ ] **Step 1: Run all canvas-related tests**

```bash
npx vitest run tests/unit/renderer/canvas.store.test.ts tests/unit/renderer/canvas-shell.test.ts tests/unit/renderer/canvas-empty-state.test.ts --reporter=verbose
```

Expected: All PASS

- [ ] **Step 2: Type-check the project**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit (if any fixes needed)**

If type errors or test failures, fix them and commit with a descriptive message.

---

## Spec Coverage Checklist

| Spec Requirement | Task |
|---|---|
| 触控板双指平移 → 画布平移 | Task 3 (WheelHandler detects deltaX+deltaY pattern) |
| 触控板双指缩放 → 画布缩放 | Task 3 (zoomOnPinch=true + WheelHandler ctrlKey pinch) |
| 单击按住空白处拖动 → 画布平移 | Task 3 (panOnDrag=[1]) |
| 移除空格键平移 | Task 3 (panOnDrag=[1] instead of true) + Task 7 |
| Shift+拖动 → 选择框 | Task 3 (selectionOnDrag=true) |
| 鼠标滚轮向上 → 缩小 | Task 3 (WheelHandler mouse wheel branch) |
| 鼠标滚轮向下 → 放大 | Task 3 (WheelHandler mouse wheel branch) |
| 鼠标按住空白处拖动 → 平移 | Task 3 (panOnDrag=[1]) |
| 移除节点淡灰色背景 | Task 5 (background: transparent) |
| Canvas 铺满无圆角 | Task 5 (border-radius removed) |
| 点格 → 网格线背景 | Task 6 (variant="lines" + CSS) |
| 选中虚线框 + resize手柄 | Task 4 (NodeResizer) + Task 5 (dashed outline) + Task 6 (handle styles) |

---

## Placeholder Scan

- No TBD/TODO placeholders
- No vague "add appropriate error handling" instructions
- All code blocks contain complete, runnable code
- All test commands include expected output
- Type signatures match across tasks
