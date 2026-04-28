# Component Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bidirectional component connection lines on the canvas with animated CLI-triggered highlights, Figma-style rubber-band connection UX, and configurable keyboard shortcuts.

**Architecture:** Extend the existing graph edge system (already persisted, rendered by ReactFlow) with a connect mode in canvas.store, a custom edge renderer for 3 visual states, and a new `edge:highlight` IPC channel. Refactor shortcuts from hardcoded to store-driven with a Settings UI.

**Tech Stack:** TypeScript, React, @xyflow/react, Electron IPC, Zod schemas, localStorage for settings

---

### Task 1: Add `connectable` property to ComponentManifest

**Files:**
- Modify: `src/shared/components/manifest.ts`
- Modify: `src/shared/components/builtin-manifests.ts`

- [ ] **Step 1: Add `connectable` to manifest schema**

In `src/shared/components/manifest.ts`, add `connectable` to the `node` object schema inside `componentManifestSchemaV1`:

```typescript
// Find the .node schema inside componentManifestSchemaV1 (around line 85-89)
// Change from:
node: z.object({
  defaultTitle: z.string().trim().min(1),
  defaultSize: componentSizeSchema,
  minSize: componentSizeSchema.optional()
}),

// To:
node: z.object({
  defaultTitle: z.string().trim().min(1),
  defaultSize: componentSizeSchema,
  minSize: componentSizeSchema.optional(),
  connectable: z.boolean().optional().default(true)
}),
```

Also update the `superRefine` at line 117 to not reject `connectable` — no change needed, it only validates `minSize`.

- [ ] **Step 2: Set `connectable: false` on text and file-tree manifests**

In `src/shared/components/builtin-manifests.ts`, add `connectable: false` to the `node` object for `builtin.file-tree` (line 101-103) and `builtin.text` (line 154-156):

For `builtin.file-tree`:
```typescript
node: {
  defaultTitle: 'File tree',
  defaultSize: { width: 360, height: 280 },
  connectable: false
},
```

For `builtin.text`:
```typescript
node: {
  defaultTitle: 'Text',
  defaultSize: { width: 320, height: 220 },
  connectable: false
},
```

- [ ] **Step 3: Build check**

```bash
cd /Users/fatballfish/Documents/Projects/ClientProjects/openweave && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No new type errors from the manifest changes.

- [ ] **Step 4: Commit**

```bash
git add src/shared/components/manifest.ts src/shared/components/builtin-manifests.ts
git commit -m "$(cat <<'EOF'
feat: add connectable property to component manifest

Defaults to true; set to false for text and file-tree builtins.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Extend settings.store with shortcut bindings

**Files:**
- Modify: `src/renderer/features/workbench/settings.store.ts`

- [ ] **Step 1: Define shortcut data types and defaults**

In `src/renderer/features/workbench/settings.store.ts`, add the shortcut types and default bindings at the top of the file (before `loadState`):

```typescript
// --- Shortcut bindings (add after DEFAULT_MAX_UNDO_STEPS) ---

const SHORTCUTS_STORAGE_KEY = 'openweave:settings:shortcuts';

export interface ShortcutBinding {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export type ShortcutActionId =
  | 'open-command-palette'
  | 'open-quick-add'
  | 'toggle-inspector'
  | 'add-terminal'
  | 'add-note'
  | 'add-portal'
  | 'add-file-tree'
  | 'add-text'
  | 'escape'
  | 'delete-selected'
  | 'undo'
  | 'redo'
  | 'toggle-connect-mode';

export interface ShortcutActionMeta {
  actionId: ShortcutActionId;
  labelKey: string;
}

export const SHORTCUT_ACTIONS: ShortcutActionMeta[] = [
  { actionId: 'open-command-palette', labelKey: 'shortcuts.commandPalette' },
  { actionId: 'open-quick-add', labelKey: 'shortcuts.quickAdd' },
  { actionId: 'toggle-inspector', labelKey: 'shortcuts.toggleInspector' },
  { actionId: 'add-terminal', labelKey: 'shortcuts.addTerminal' },
  { actionId: 'add-note', labelKey: 'shortcuts.addNote' },
  { actionId: 'add-portal', labelKey: 'shortcuts.addPortal' },
  { actionId: 'add-file-tree', labelKey: 'shortcuts.addFileTree' },
  { actionId: 'add-text', labelKey: 'shortcuts.addText' },
  { actionId: 'escape', labelKey: 'shortcuts.escape' },
  { actionId: 'delete-selected', labelKey: 'shortcuts.deleteSelected' },
  { actionId: 'undo', labelKey: 'shortcuts.undo' },
  { actionId: 'redo', labelKey: 'shortcuts.redo' },
  { actionId: 'toggle-connect-mode', labelKey: 'shortcuts.toggleConnectMode' }
];

const DEFAULT_SHORTCUT_BINDINGS: Record<ShortcutActionId, ShortcutBinding> = {
  'open-command-palette': { key: 'k', ctrlKey: true, metaKey: true, shiftKey: false, altKey: false },
  'open-quick-add': { key: '/', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
  'toggle-inspector': { key: 'i', ctrlKey: false, metaKey: true, shiftKey: true, altKey: false },
  'add-terminal': { key: '1', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
  'add-note': { key: '2', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
  'add-portal': { key: '3', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
  'add-file-tree': { key: '4', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
  'add-text': { key: '5', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
  'escape': { key: 'Escape', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
  'delete-selected': { key: 'Delete', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
  'undo': { key: 'z', ctrlKey: true, metaKey: true, shiftKey: false, altKey: false },
  'redo': { key: 'z', ctrlKey: false, metaKey: true, shiftKey: true, altKey: false },
  'toggle-connect-mode': { key: 'c', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }
};
```

- [ ] **Step 2: Add shortcutBindings to SettingsState and load/save**

Modify `SettingsState`:
```typescript
interface SettingsState {
  maxUndoSteps: number;
  theme: ThemeSetting;
  shortcutBindings: Record<ShortcutActionId, ShortcutBinding>;
}
```

In `loadState`, add shortcut loading:
```typescript
// After the theme loading block in loadState():
let shortcutBindings: Record<ShortcutActionId, ShortcutBinding> = { ...DEFAULT_SHORTCUT_BINDINGS };
try {
  const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
  if (stored !== null) {
    const parsed = JSON.parse(stored) as Partial<Record<ShortcutActionId, ShortcutBinding>>;
    shortcutBindings = { ...DEFAULT_SHORTCUT_BINDINGS, ...parsed };
  }
} catch {
  // ignore localStorage errors
}
```

In `setState`, add shortcut persistence:
```typescript
// After the theme persistence block in setState():
if (previous.shortcutBindings !== state.shortcutBindings) {
  try {
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(state.shortcutBindings));
  } catch {
    // ignore
  }
}
```

- [ ] **Step 3: Add shortcut update method to settingsStore**

```typescript
// Add to settingsStore object:
updateShortcutBinding: (actionId: ShortcutActionId, binding: ShortcutBinding): void => {
  setState({
    shortcutBindings: {
      ...state.shortcutBindings,
      [actionId]: binding
    }
  });
},

resetShortcutBindings: (): void => {
  setState({ shortcutBindings: { ...DEFAULT_SHORTCUT_BINDINGS } });
}
```

- [ ] **Step 4: Build check**

```bash
cd /Users/fatballfish/Documents/Projects/ClientProjects/openweave && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/features/workbench/settings.store.ts
git commit -m "$(cat <<'EOF'
feat: add shortcut bindings to settings store with defaults

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: ShortcutsTab component for SettingsDialog

**Files:**
- Create: `src/renderer/features/workbench/ShortcutsTab.tsx`
- Modify: `src/renderer/features/workbench/SettingsDialog.tsx`

- [ ] **Step 1: Create ShortcutsTab component**

Create `src/renderer/features/workbench/ShortcutsTab.tsx`:

```typescript
import { settingsStore, useSettingsStore, SHORTCUT_ACTIONS, type ShortcutActionId, type ShortcutBinding } from './settings.store';
import { useI18n } from '../../i18n/provider';

const modifierLabels: { key: keyof ShortcutBinding; label: string }[] = [
  { key: 'ctrlKey', label: 'Ctrl' },
  { key: 'metaKey', label: 'Cmd' },
  { key: 'shiftKey', label: 'Shift' },
  { key: 'altKey', label: 'Alt' }
];

export const ShortcutsTab = (): JSX.Element => {
  const { t } = useI18n();
  const bindings = useSettingsStore((s) => s.shortcutBindings);

  const updateBinding = (actionId: ShortcutActionId, patch: Partial<ShortcutBinding>) => {
    const current = bindings[actionId];
    settingsStore.updateShortcutBinding(actionId, { ...current, ...patch });
  };

  const handleKeyDown = (actionId: ShortcutActionId) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const key = e.key;
    if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return;
    if (key === 'Tab') return;
    const binding: ShortcutBinding = {
      key: key.length === 1 ? key.toLowerCase() : key,
      ctrlKey: e.ctrlKey || e.metaKey,
      metaKey: false,
      shiftKey: e.shiftKey,
      altKey: e.altKey
    };
    settingsStore.updateShortcutBinding(actionId, binding);
  };

  return (
    <div className="ow-shortcuts-tab">
      <div className="ow-settings-dialog__group">
        <h3>Keyboard Shortcuts</h3>
        <p className="ow-settings-dialog__hint">Click a key field and press the desired key combination. Click modifiers to toggle.</p>
      </div>

      {SHORTCUT_ACTIONS.map((action) => {
        const binding = bindings[action.actionId];
        return (
          <div key={action.actionId} className="ow-shortcuts-tab__row">
            <span className="ow-shortcuts-tab__label">{t(action.labelKey)}</span>
            <div className="ow-shortcuts-tab__controls">
              {modifierLabels.map((mod) => (
                <button
                  key={mod.key}
                  aria-pressed={binding[mod.key as keyof ShortcutBinding] as boolean}
                  className={`ow-shortcuts-tab__modifier${binding[mod.key as keyof ShortcutBinding] ? ' is-active' : ''}`}
                  onClick={() => updateBinding(action.actionId, { [mod.key]: !binding[mod.key as keyof ShortcutBinding] })}
                  type="button"
                >
                  {mod.label}
                </button>
              ))}
              <input
                className="ow-shortcuts-tab__key-input"
                defaultValue={binding.key}
                onKeyDown={handleKeyDown(action.actionId)}
                readOnly
              />
            </div>
          </div>
        );
      })}

      <div className="ow-settings-dialog__group" style={{ marginTop: 20 }}>
        <button
          className="ow-toolbar-button"
          type="button"
          onClick={() => settingsStore.resetShortcutBindings()}
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Wire ShortcutsTab into SettingsDialog**

In `src/renderer/features/workbench/SettingsDialog.tsx`, add import:
```typescript
import { ShortcutsTab } from './ShortcutsTab';
```

Replace the placeholder shortcuts tab (line 160):
```typescript
// Change from:
{activeTab === 'shortcuts' && <div className="ow-settings-dialog__placeholder" />}

// To:
{activeTab === 'shortcuts' && <ShortcutsTab />}
```

- [ ] **Step 3: Build check**

```bash
cd /Users/fatballfish/Documents/Projects/ClientProjects/openweave && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/features/workbench/ShortcutsTab.tsx src/renderer/features/workbench/SettingsDialog.tsx
git commit -m "$(cat <<'EOF'
feat: add ShortcutsTab with configurable key bindings UI

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Refactor useCanvasShortcuts to use dynamic bindings

**Files:**
- Modify: `src/renderer/features/canvas-shell/useCanvasShortcuts.ts`

- [ ] **Step 1: Rewrite useCanvasShortcuts to read from settingsStore**

Replace the file content at `src/renderer/features/canvas-shell/useCanvasShortcuts.ts`. The key change is replacing the hardcoded `getCanvasShortcutAction` with a dynamic matcher that reads from `settingsStore.getState().shortcutBindings`:

```typescript
import { useEffect } from 'react';
import { settingsStore, type ShortcutActionId } from '../workbench/settings.store';

export type CanvasShortcutAction =
  | 'open-command-palette'
  | 'open-quick-add'
  | 'toggle-inspector'
  | 'add-terminal'
  | 'add-note'
  | 'add-portal'
  | 'add-file-tree'
  | 'add-text'
  | 'escape'
  | 'delete-selected'
  | 'undo'
  | 'redo'
  | 'toggle-connect-mode';

interface CanvasShortcutLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}

interface UseCanvasShortcutsOptions {
  enabled?: boolean;
  onOpenCommandPalette: () => void;
  onOpenQuickAdd: () => void;
  onToggleInspector: () => void;
  onAddTerminal: () => void;
  onAddNote: () => void;
  onAddPortal: () => void;
  onAddFileTree: () => void;
  onAddText: () => void;
  onEscape: () => void;
  onDeleteSelected: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleConnectMode?: () => void;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!target || typeof target !== 'object') {
    return false;
  }
  const candidate = target as { tagName?: string; isContentEditable?: boolean };
  const tagName = candidate.tagName?.toUpperCase();
  return (
    candidate.isContentEditable === true ||
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    tagName === 'BUTTON'
  );
};

const matchesBinding = (event: CanvasShortcutLike, binding: ReturnType<typeof settingsStore.getState>['shortcutBindings'][string]): boolean => {
  const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const bindingKey = binding.key.length === 1 ? binding.key.toLowerCase() : binding.key;
  if (eventKey !== bindingKey) return false;
  // On Mac, metaKey = Cmd; on Windows/Linux, ctrlKey = Ctrl
  // Treat ctrlKey or metaKey as matching binding.ctrlKey || binding.metaKey
  const hasBindingMod = binding.ctrlKey || binding.metaKey;
  const hasEventMod = event.ctrlKey || event.metaKey;
  if (hasBindingMod !== hasEventMod) return false;
  if (event.shiftKey !== binding.shiftKey) return false;
  if (event.altKey !== binding.altKey) return false;
  return true;
};

export const getCanvasShortcutAction = (
  event: CanvasShortcutLike
): CanvasShortcutAction | null => {
  if (isEditableTarget(event.target)) {
    return null;
  }

  const bindings = settingsStore.getState().shortcutBindings;
  // Delete also matches Backspace
  if (matchesBinding(event, bindings['delete-selected']) || (event.key === 'Backspace' && bindings['delete-selected'].key === 'Delete')) {
    return 'delete-selected';
  }
  // Undo: check ctrl+z and meta+z
  if (matchesBinding(event, bindings['undo']) || (event.key.toLowerCase() === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey)) {
    return 'undo';
  }

  for (const [actionId, binding] of Object.entries(bindings) as [ShortcutActionId, typeof bindings[string]][]) {
    if (actionId === 'delete-selected' || actionId === 'undo') continue; // handled above
    if (matchesBinding(event, binding)) {
      return actionId;
    }
  }

  return null;
};

export const useCanvasShortcuts = ({
  enabled = true,
  onOpenCommandPalette,
  onOpenQuickAdd,
  onToggleInspector,
  onAddTerminal,
  onAddNote,
  onAddPortal,
  onAddFileTree,
  onAddText,
  onEscape,
  onDeleteSelected,
  onUndo,
  onRedo,
  onToggleConnectMode
}: UseCanvasShortcutsOptions): void => {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      const action = getCanvasShortcutAction(event);
      if (!action) {
        return;
      }

      event.preventDefault();

      switch (action) {
        case 'open-command-palette':
          onOpenCommandPalette();
          return;
        case 'open-quick-add':
          onOpenQuickAdd();
          return;
        case 'toggle-inspector':
          onToggleInspector();
          return;
        case 'add-terminal':
          onAddTerminal();
          return;
        case 'add-note':
          onAddNote();
          return;
        case 'add-portal':
          onAddPortal();
          return;
        case 'add-file-tree':
          onAddFileTree();
          return;
        case 'add-text':
          onAddText();
          return;
        case 'escape':
          onEscape();
          return;
        case 'delete-selected':
          onDeleteSelected();
          return;
        case 'undo':
          onUndo();
          return;
        case 'redo':
          onRedo();
          return;
        case 'toggle-connect-mode':
          onToggleConnectMode?.();
          return;
        default:
          return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    enabled,
    onAddFileTree,
    onAddNote,
    onAddPortal,
    onAddTerminal,
    onAddText,
    onEscape,
    onOpenCommandPalette,
    onOpenQuickAdd,
    onToggleInspector,
    onDeleteSelected,
    onUndo,
    onRedo,
    onToggleConnectMode
  ]);
};
```

- [ ] **Step 2: Build check**

```bash
cd /Users/fatballfish/Documents/Projects/ClientProjects/openweave && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/features/canvas-shell/useCanvasShortcuts.ts
git commit -m "$(cat <<'EOF'
feat: refactor shortcuts to use dynamic bindings from settings store

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Add connect mode state and edge CRUD to canvas.store

**Files:**
- Modify: `src/renderer/features/canvas/canvas.store.ts`
- Modify: `src/renderer/features/canvas/history.store.ts`

- [ ] **Step 1: Add connect mode state fields**

In `src/renderer/features/canvas/canvas.store.ts`, add to `CanvasState` interface (after `selectedNodeId`):
```typescript
connectModeActive: boolean;
connectSourceNodeId: string | null;
activeEdgeIds: string[];
selectedEdgeId: string | null;
```

In `initialState`:
```typescript
connectModeActive: false,
connectSourceNodeId: null,
activeEdgeIds: [],
selectedEdgeId: null,
```

- [ ] **Step 2: Add connect mode methods**

Add to the `canvasStore` object:

```typescript
toggleConnectMode: (): void => {
  setState({
    connectModeActive: !state.connectModeActive,
    connectSourceNodeId: null,
    selectedEdgeId: null,
    selectedNodeId: null
  });
},
exitConnectMode: (): void => {
  setState({
    connectModeActive: false,
    connectSourceNodeId: null
  });
},
setConnectSourceNode: (nodeId: string | null): void => {
  setState({ connectSourceNodeId: nodeId });
},
```

- [ ] **Step 3: Add edge creation method**

```typescript
addEdge: async (source: string, target: string): Promise<void> => {
  if (!state.workspaceId || state.loading) return;
  if (source === target) return;

  const workspaceId = state.workspaceId;
  // Check for duplicate
  const alreadyExists = state.graphSnapshot.edges.some(
    (e) => (e.source === source && e.target === target) || (e.source === target && e.target === source)
  );
  if (alreadyExists) return;

  const now = Date.now();
  const edgeId = `edge-${crypto.randomUUID()}`;
  const newEdge = {
    id: edgeId,
    source,
    target,
    sourceHandle: null as string | null,
    targetHandle: null as string | null,
    label: null as string | null,
    meta: {} as Record<string, unknown>,
    createdAtMs: now,
    updatedAtMs: now
  };

  const nextGraphSnapshot = {
    ...state.graphSnapshot,
    edges: [...state.graphSnapshot.edges, newEdge]
  };

  historyStore.push({ kind: 'addEdge', edge: newEdge });
  applyGraphSnapshot(nextGraphSnapshot);
  setState({ recentAction: 'Connected components', connectModeActive: false, connectSourceNodeId: null });
  try {
    await persistGraphSnapshot(workspaceId, nextGraphSnapshot);
  } catch (error) {
    if (state.workspaceId !== workspaceId) return;
    const errorMessage = error instanceof Error ? error.message : 'Failed to save edge';
    setState({ errorMessage });
  }
},
```

- [ ] **Step 4: Add edge deletion method**

```typescript
deleteSelectedEdge: async (): Promise<void> => {
  if (!state.workspaceId || !state.selectedEdgeId) return;
  const workspaceId = state.workspaceId;
  const edgeId = state.selectedEdgeId;

  const nextGraphSnapshot = {
    ...state.graphSnapshot,
    edges: state.graphSnapshot.edges.filter((e) => e.id !== edgeId)
  };

  const deletedEdge = state.graphSnapshot.edges.find((e) => e.id === edgeId);
  if (deletedEdge) {
    historyStore.push({ kind: 'removeEdge', edge: deletedEdge });
  }

  applyGraphSnapshot(nextGraphSnapshot, null);
  setState({ selectedEdgeId: null, recentAction: 'Deleted connection' });
  try {
    await persistGraphSnapshot(workspaceId, nextGraphSnapshot);
  } catch (error) {
    if (state.workspaceId !== workspaceId) return;
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete edge';
    setState({ errorMessage });
  }
},

selectEdge: (edgeId: string | null): void => {
  setState({
    selectedEdgeId: edgeId,
    selectedNodeId: edgeId ? null : state.selectedNodeId
  });
},

setActiveEdgeIds: (edgeIds: string[]): void => {
  setState({ activeEdgeIds: edgeIds });
},
```

- [ ] **Step 5: Update deleteSelectedNode to also handle selected edge**

In `canvasStore.deleteSelectedNode`, add edge check at the beginning:
```typescript
deleteSelectedNode: async (): Promise<void> => {
  if (state.selectedEdgeId) {
    await canvasStore.deleteSelectedEdge();
    return;
  }
  if (!state.selectedNodeId) return;
  // ... rest of existing code
},
```

- [ ] **Step 6: Update deleteNodes to handle edges in history**

No changes needed — `deleteNodes` already filters edges. But we need to add edge history entries. In the `deleteNodes` method, before the push loop for nodes, add:

```typescript
// Collect edges to remove (edges connected to deleted nodes)
const deletedEdgeIds = new Set(nodeIds);
const connectedEdges = state.graphSnapshot.edges.filter(
  (edge) => deletedEdgeIds.has(edge.source) || deletedEdgeIds.has(edge.target)
);
// Push these edge removals to history
for (const edge of connectedEdges) {
  historyStore.push({ kind: 'removeEdge', edge });
}
```

- [ ] **Step 7: Add edge history types and undo/redo support**

In `src/renderer/features/canvas/history.store.ts`, add edge entries to the `HistoryEntry` type:
```typescript
// Add after the renameNode entry:
| { kind: 'addEdge'; edge: GraphEdgeRecord }
| { kind: 'removeEdge'; edge: GraphEdgeRecord }
```

Also add the `GraphEdgeRecord` import (or extract from `GraphEdgeV2Input`). Actually, the edge is already typed as part of `GraphSnapshotV2Input['edges'][number]`. Let's define it:
```typescript
import type { GraphEdgeV2Input } from '../../../shared/ipc/schemas';
// ...
type GraphEdgeRecord = GraphEdgeV2Input;
```

In `canvas.store.ts` `undo` method, add cases:
```typescript
case 'addEdge': {
  nextGraphSnapshot = {
    ...nextGraphSnapshot,
    edges: nextGraphSnapshot.edges.filter((e) => e.id !== entry.edge.id)
  };
  break;
}
case 'removeEdge': {
  nextGraphSnapshot = {
    ...nextGraphSnapshot,
    edges: [...nextGraphSnapshot.edges, entry.edge]
  };
  break;
}
```

In `redo` method, add the reverse cases:
```typescript
case 'addEdge': {
  nextGraphSnapshot = {
    ...nextGraphSnapshot,
    edges: [...nextGraphSnapshot.edges, entry.edge]
  };
  break;
}
case 'removeEdge': {
  nextGraphSnapshot = {
    ...nextGraphSnapshot,
    edges: nextGraphSnapshot.edges.filter((e) => e.id !== entry.edge.id)
  };
  break;
}
```

- [ ] **Step 8: Build check**

```bash
cd /Users/fatballfish/Documents/Projects/ClientProjects/openweave && npx tsc --noEmit --pretty 2>&1 | head -40
```

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/features/canvas/canvas.store.ts src/renderer/features/canvas/history.store.ts
git commit -m "$(cat <<'EOF'
feat: add connect mode state, edge CRUD, and undo/redo to canvas store

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Custom ConnectEdge component with 3 visual states

**Files:**
- Create: `src/renderer/features/canvas-shell/edge-types/ConnectEdge.tsx`
- Create: `src/renderer/features/canvas-shell/edge-types/connect-edge.css`

- [ ] **Step 1: Create ConnectEdge custom edge component**

Create `src/renderer/features/canvas-shell/edge-types/ConnectEdge.tsx`:

```typescript
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

interface ConnectEdgeData {
  isActive?: boolean;
}

type ConnectEdgeProps = EdgeProps & {
  data?: ConnectEdgeData;
};

export const ConnectEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data
}: ConnectEdgeProps): JSX.Element => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12
  });

  const isActive = data?.isActive ?? false;

  const strokeColor = isActive
    ? 'var(--ow-state-running)'
    : selected
      ? 'var(--ow-color-accent)'
      : '#8398af';

  const strokeWidth = selected ? 2.5 : 1.5;
  const dashArray = '6 4';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: dashArray,
          transition: 'stroke 200ms ease, stroke-width 200ms ease'
        }}
      />
      {/* Wider invisible hit area for easier click selection */}
      <BaseEdge
        id={`${id}-hit`}
        path={edgePath}
        style={{
          stroke: 'transparent',
          strokeWidth: 14,
          fill: 'none'
        }}
      />
      {isActive && (
        <EdgeLabelRenderer>
          <div
            className="ow-connect-edge__glow"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none'
            }}
          >
            <svg width="0" height="0" style={{ position: 'absolute' }}>
              <defs>
                <filter id={`edge-glow-${id}`}>
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
            </svg>
          </div>
        </EdgeLabelRenderer>
      )}
      <path
        d={edgePath}
        fill="none"
        stroke={isActive ? 'var(--ow-state-running)' : 'transparent'}
        strokeWidth={isActive ? 3 : 0}
        strokeDasharray={isActive ? '8 6' : '0'}
        strokeLinecap="round"
        style={{
          animation: isActive ? 'edgeFlow 1.4s linear infinite' : 'none',
          filter: isActive ? `url(#edge-glow-${id})` : 'none',
          pointerEvents: 'none'
        }}
      />
    </>
  );
};
```

- [ ] **Step 2: Create edge CSS with flow animation**

Create `src/renderer/features/canvas-shell/edge-types/connect-edge.css`:

```css
@keyframes edgeFlow {
  from { stroke-dashoffset: 28; }
  to { stroke-dashoffset: 0; }
}

.ow-connect-edge__glow {
  pointer-events: none;
}
```

- [ ] **Step 3: Build check**

```bash
cd /Users/fatballfish/Documents/Projects/ClientProjects/openweave && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/features/canvas-shell/edge-types/ConnectEdge.tsx src/renderer/features/canvas-shell/edge-types/connect-edge.css
git commit -m "$(cat <<'EOF'
feat: add ConnectEdge custom edge with default/selected/active states

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: ConnectModeOverlay for rubber-band interaction

**Files:**
- Create: `src/renderer/features/canvas-shell/ConnectModeOverlay.tsx`

- [ ] **Step 1: Create ConnectModeOverlay**

Create `src/renderer/features/canvas-shell/ConnectModeOverlay.tsx`:

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { getBuiltinComponentManifest } from '../../../shared/components/builtin-manifests';

interface ConnectModeOverlayProps {
  sourceNodeId: string | null;
  workspaceId: string;
  graphNodes: Array<{ id: string; componentType: string; bounds: { x: number; y: number; width: number; height: number } }>;
  onSelectSource: (nodeId: string) => void;
  onCompleteConnection: (sourceId: string, targetId: string) => void;
}

export const ConnectModeOverlay = ({
  sourceNodeId,
  workspaceId,
  graphNodes,
  onSelectSource,
  onCompleteConnection
}: ConnectModeOverlayProps): JSX.Element => {
  const { getViewport, screenToFlowPosition } = useReactFlow();
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const sourceBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const getNodeCenter = (bounds: { x: number; y: number; width: number; height: number }) => ({
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  });

  useEffect(() => {
    if (sourceNodeId) {
      const node = graphNodes.find((n) => n.id === sourceNodeId);
      if (node) {
        sourceBoundsRef.current = node.bounds;
      }
    } else {
      sourceBoundsRef.current = null;
      setMousePos(null);
    }
  }, [sourceNodeId, graphNodes]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!sourceNodeId) return;
      const container = document.querySelector('.ow-canvas-shell__flow');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const { x: vpX, y: vpY, zoom } = getViewport();
      const worldX = (e.clientX - rect.left - vpX) / zoom;
      const worldY = (e.clientY - rect.top - vpY) / zoom;
      setMousePos({ x: worldX, y: worldY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [sourceNodeId, getViewport]);

  const isNodeConnectable = useCallback((componentType: string): boolean => {
    const manifest = getBuiltinComponentManifest(componentType);
    if (!manifest) return false;
    return manifest.node.connectable !== false;
  }, []);

  if (!sourceNodeId || !mousePos || !sourceBoundsRef.current) return null;

  const sourceCenter = getNodeCenter(sourceBoundsRef.current);

  return (
    <svg
      className="ow-connect-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000
      }}
    >
      <line
        x1={sourceCenter.x}
        y1={sourceCenter.y}
        x2={mousePos.x}
        y2={mousePos.y}
        stroke="var(--ow-color-accent)"
        strokeWidth={2}
        strokeDasharray="6 4"
        strokeLinecap="round"
        opacity={0.7}
      />
      <circle
        cx={mousePos.x}
        cy={mousePos.y}
        r={5}
        fill="var(--ow-color-accent)"
        opacity={0.5}
      />
    </svg>
  );
};
```

- [ ] **Step 2: Build check**

```bash
cd /Users/fatballfish/Documents/Projects/ClientProjects/openweave && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/features/canvas-shell/ConnectModeOverlay.tsx
git commit -m "$(cat <<'EOF'
feat: add ConnectModeOverlay with rubber-band line following cursor

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Integrate connect mode into CanvasShell

**Files:**
- Modify: `src/renderer/features/canvas-shell/CanvasShell.tsx`

- [ ] **Step 1: Update CanvasShell to wire connect mode**

In `src/renderer/features/canvas-shell/CanvasShell.tsx`, add imports:
```typescript
import { ConnectModeOverlay } from './ConnectModeOverlay';
import { ConnectEdge } from './edge-types/ConnectEdge';
import './edge-types/connect-edge.css';
import { useCanvasStore } from '../canvas/canvas.store';
```

Add new props to `CanvasShellProps`:
```typescript
connectModeActive?: boolean;
connectSourceNodeId?: string | null;
onSelectConnectSource?: (nodeId: string) => void;
onCompleteConnection?: (sourceId: string, targetId: string) => void;
onSelectEdge?: (edgeId: string | null) => void;
onDeleteSelectedEdge?: () => void;
activeEdgeIds?: string[];
selectedEdgeId?: string | null;
```

Update the `nodeTypes` registration:
```typescript
const nodeTypes = {
  builtinHost: BuiltinHostFlowNode
};

const edgeTypes = {
  connectEdge: ConnectEdge
};
```

Update the `projectGraphToCanvasShell` function to use the custom edge type and pass active/selected data:
```typescript
// In the edges map, change type from 'smoothstep' to 'connectEdge':
edges: input.graphSnapshot.edges.map((edge) => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
  sourceHandle: edge.sourceHandle ?? undefined,
  targetHandle: edge.targetHandle ?? undefined,
  type: 'connectEdge',
  data: {
    ...edge.meta,
    isActive: input.activeEdgeIds?.includes(edge.id) ?? false
  },
  selected: input.selectedEdgeId === edge.id,
  selectable: true,
  deletable: true
}))
```

Update `ProjectGraphToCanvasShellInput` to include:
```typescript
activeEdgeIds?: string[];
selectedEdgeId?: string | null;
```

In the `ReactFlow` component, add:
```typescript
edgeTypes={edgeTypes}
// Change selectionOnDrag and elementsSelectable to allow edge selection:
elementsSelectable={true}
selectionOnDrag={false}
// Add edge click handler:
onEdgeClick={(_event, edge) => {
  onSelectEdge?.(edge.id);
  onSelectNode(null);
}}
// Handle delete on edges:
onEdgesDelete={(edges) => {
  if (edges.length > 0) {
    onSelectEdge?.(edges[0].id);
    onDeleteSelectedEdge?.();
  }
}}
```

Add the `ConnectModeOverlay` inside `ReactFlow` (after the Background):
```typescript
{connectModeActive ? (
  <ConnectModeOverlay
    sourceNodeId={connectSourceNodeId ?? null}
    workspaceId={workspaceId}
    graphNodes={graphSnapshot.nodes}
    onSelectSource={onSelectConnectSource ?? (() => {})}
    onCompleteConnection={onCompleteConnection ?? (() => {})}
  />
) : null}
```

Update `onNodeClick` to handle connect mode:
```typescript
onNodeClick={(_event, node) => {
  if (connectModeActive) {
    const targetNode = graphSnapshot.nodes.find((n) => n.id === node.id);
    if (targetNode) {
      const manifest = getBuiltinComponentManifest(targetNode.componentType);
      const connectable = manifest?.node.connectable !== false;
      if (!connectable) return;
      if (!connectSourceNodeId) {
        onSelectConnectSource?.(node.id);
      } else if (node.id !== connectSourceNodeId) {
        onCompleteConnection?.(connectSourceNodeId, node.id);
      }
    }
    return;
  }
  onSelectNode(node.id);
}}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/fatballfish/Documents/Projects/ClientProjects/openweave && npx tsc --noEmit --pretty 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/features/canvas-shell/CanvasShell.tsx
git commit -m "$(cat <<'EOF'
feat: integrate connect mode, custom edges, and rubber-band overlay into CanvasShell

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Add connect button to WorkbenchTopBar

**Files:**
- Modify: `src/renderer/features/workbench/WorkbenchTopBar.tsx`

- [ ] **Step 1: Add connect button props and button**

In `src/renderer/features/workbench/WorkbenchTopBar.tsx`, add new props to `WorkbenchTopBarProps`:
```typescript
connectModeActive?: boolean;
onToggleConnectMode?: () => void;
```

Add the connect button after the last create button (after addText button, before the separator), using a separator div and then the connect IconButton:


```tsx
<div
  style={{ width: 1, height: 28, background: "var(--ow-color-border)", margin: "0 6px", flexShrink: 0 }}
/>

<IconButton
  disabled={disabled}
  icon={
    <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15">
      <circle cx="6" cy="6" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="18" cy="18" r="1.6" fill="currentColor" stroke="none" />
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 3" />
    </svg>
  }
  label={t("topbar.addConnect")}
  onClick={onToggleConnectMode}
  primary={true}
  active={connectModeActive}
  testId="workbench-topbar-action-connect"
/>
```


- [ ] **Step 2: Build check**

```bash
cd /Users/fatballfish/Documents/Projects/ClientProjects/openweave && npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/features/workbench/WorkbenchTopBar.tsx
git commit -m "$(cat <<'EOF'
feat: add connect mode toggle button to WorkbenchTopBar

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Wire everything in App.tsx, WorkbenchShell, and WorkspaceCanvasPage

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/features/workbench/WorkbenchShell.tsx`
- Modify: `src/renderer/features/canvas/WorkspaceCanvasPage.tsx`

- [ ] **Step 1: Add connect mode state hooks in App.tsx**

```typescript
// Add to useCanvasStore selectors:
const connectModeActive = useCanvasStore((s) => s.connectModeActive);
const connectSourceNodeId = useCanvasStore((s) => s.connectSourceNodeId);
const activeEdgeIds = useCanvasStore((s) => s.activeEdgeIds);
const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId);
```

Add `onToggleConnectMode` callback:
```typescript
const toggleConnectMode = useCallback(() => {
  canvasStore.toggleConnectMode();
}, []);
```

Add `onToggleConnectMode` to `useCanvasShortcuts`:
```typescript
onToggleConnectMode: toggleConnectMode,
```

Pass new props to `WorkspaceCanvasPage`:
```typescript
connectModeActive={connectModeActive}
connectSourceNodeId={connectSourceNodeId}
activeEdgeIds={activeEdgeIds}
selectedEdgeId={selectedEdgeId}
onToggleConnectMode={toggleConnectMode}
onSelectConnectSource={(nodeId) => canvasStore.setConnectSourceNode(nodeId)}
onCompleteConnection={(sourceId, targetId) => { void canvasStore.addEdge(sourceId, targetId); }}
onSelectEdge={(edgeId) => canvasStore.selectEdge(edgeId)}
onDeleteSelectedEdge={() => { void canvasStore.deleteSelectedEdge(); }}
```

Pass new props to `WorkbenchShell`:
```typescript
connectModeActive={connectModeActive}
onToggleConnectMode={toggleConnectMode}
```

Also update the `delete-selected` handler in shortcuts:
```typescript
onDeleteSelected: () => {
  if (selectedEdgeId) {
    void canvasStore.deleteSelectedEdge();
  } else {
    void canvasStore.deleteSelectedNode();
  }
},
```

- [ ] **Step 2: Update WorkbenchShell props and passthrough**

In `src/renderer/features/workbench/WorkbenchShell.tsx`, add to the interface:
```typescript
connectModeActive?: boolean;
onToggleConnectMode?: () => void;
```

In the props destructuring, add them. Pass to `WorkbenchTopBar`:
```typescript
<WorkbenchTopBar
  // ... existing props
  connectModeActive={connectModeActive}
  onToggleConnectMode={onToggleConnectMode}
/>
```

- [ ] **Step 3: Update WorkspaceCanvasPage props and passthrough**

In `src/renderer/features/canvas/WorkspaceCanvasPage.tsx`, add to interface:
```typescript
connectModeActive?: boolean;
connectSourceNodeId?: string | null;
activeEdgeIds?: string[];
selectedEdgeId?: string | null;
onToggleConnectMode?: () => void;
onSelectConnectSource?: (nodeId: string) => void;
onCompleteConnection?: (sourceId: string, targetId: string) => void;
onSelectEdge?: (edgeId: string | null) => void;
onDeleteSelectedEdge?: () => void;
```

Destructure them and pass to `CanvasShell`.

- [ ] **Step 4: Build check**

```bash
cd /Users/fatballfish/Documents/Projects/ClientProjects/openweave && npx tsc --noEmit --pretty 2>&1 | head -40
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/App.tsx src/renderer/features/workbench/WorkbenchShell.tsx src/renderer/features/canvas/WorkspaceCanvasPage.tsx
git commit -m "$(cat <<'EOF'
feat: wire connect mode through App, WorkbenchShell, and WorkspaceCanvasPage

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Bidirectional neighbor lookup in workspace-node-query-service

**Files:**
- Modify: `src/main/bridge/workspace-node-query-service.ts`

- [ ] **Step 1: Update getNodeNeighbors for bidirectionality**

In `src/main/bridge/workspace-node-query-service.ts`, inside the `getNodeNeighbors` method (around line 194), change the edge matching logic to treat all edges as bidirectional. Currently it distinguishes upstream (target matches) and downstream (source matches). Instead, find all edges where node is either source or target, and report the other side as a neighbor in both lists:

```typescript
// Replace the existing edge iteration (lines 194-219) with:
for (const edge of graph.edges) {
  if (edge.source === input.nodeId) {
    const targetNode = nodeMap.get(edge.target);
    if (!targetNode) continue;
    downstream.push({
      edgeId: edge.id,
      nodeId: targetNode.id,
      componentType: targetNode.componentType,
      title: targetNode.title
    });
  }
  if (edge.target === input.nodeId) {
    const sourceNode = nodeMap.get(edge.source);
    if (!sourceNode) continue;
    upstream.push({
      edgeId: edge.id,
      nodeId: sourceNode.id,
      componentType: sourceNode.componentType,
      title: sourceNode.title
    });
  }
}
```

Note: The logic is actually already correct for bidirectionality — edges with source=nodeId appear in downstream, edges with target=nodeId appear in upstream. But since our connections are bidirectional (stored with an arbitrary source/target), we want each edge to produce BOTH an upstream AND downstream neighbor entry for each connected node.

The fix: for each edge connected to the node (in either direction), report the other node as BOTH an upstream AND downstream neighbor:

```typescript
for (const edge of graph.edges) {
  let neighborNodeId: string | null = null;
  let neighborTitle = '';
  let neighborComponentType = '';

  if (edge.source === input.nodeId) {
    const targetNode = nodeMap.get(edge.target);
    if (targetNode) {
      neighborNodeId = targetNode.id;
      neighborTitle = targetNode.title;
      neighborComponentType = targetNode.componentType;
    }
  } else if (edge.target === input.nodeId) {
    const sourceNode = nodeMap.get(edge.source);
    if (sourceNode) {
      neighborNodeId = sourceNode.id;
      neighborTitle = sourceNode.title;
      neighborComponentType = sourceNode.componentType;
    }
  }

  if (!neighborNodeId) continue;

  const neighborEntry = {
    edgeId: edge.id,
    nodeId: neighborNodeId,
    componentType: neighborComponentType,
    title: neighborTitle
  };

  upstream.push(neighborEntry);
  downstream.push(neighborEntry);
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/fatballfish/Documents/Projects/ClientProjects/openweave && npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/main/bridge/workspace-node-query-service.ts
git commit -m "$(cat <<'EOF'
feat: make node neighbor lookup bidirectional for connected edges

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Edge highlight IPC channel

**Files:**
- Modify: `src/shared/ipc/contracts.ts`
- Modify: `src/main/ipc/canvas.ts`

- [ ] **Step 1: Add highlight IPC channel and type**

In `src/shared/ipc/contracts.ts`, add to `IPC_CHANNELS`:
```typescript
graphEdgeHighlight: 'graph:edge-highlight',
```

- [ ] **Step 2: Add highlight handler in main process**

In `src/main/ipc/canvas.ts`, add to `CanvasIpcHandlers`:
```typescript
edgeHighlight: (_event: IpcMainInvokeEvent, input: { workspaceId: string; sourceNodeId: string; edgeIds: string[] }) => Promise<{ edgeIds: string[] }>;
```

In `createCanvasIpcHandlers`:
```typescript
edgeHighlight: async (_event, input) => {
  const edges = deps.getWorkspaceRepository(input.workspaceId).loadGraphSnapshot().edges;
  const matched = edges.filter(
    (e) => e.source === input.sourceNodeId || e.target === input.sourceNodeId
  );
  return { edgeIds: matched.map((e) => e.id) };
}
```

In `registerCanvasIpcHandlers`, register the handler:
```typescript
ipcMain.removeHandler(IPC_CHANNELS.graphEdgeHighlight);
ipcMain.handle(IPC_CHANNELS.graphEdgeHighlight, handlers.edgeHighlight);
```

- [ ] **Step 3: Build check**

```bash
cd /Users/fatballfish/Documents/Projects/ClientProjects/openweave && npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/ipc/contracts.ts src/main/ipc/canvas.ts
git commit -m "$(cat <<'EOF'
feat: add edge-highlight IPC channel for CLI-triggered edge animation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: i18n keys for connect mode and shortcuts

**Files:**
- Modify: `src/renderer/i18n/packs/en-US.ts`
- Modify: `src/renderer/i18n/packs/zh-CN.ts`

- [ ] **Step 1: Add English i18n keys**

In `src/renderer/i18n/packs/en-US.ts`, add to `messages`:

```typescript
'topbar.addConnect': 'Connect components',
'shortcuts.commandPalette': 'Command palette',
'shortcuts.quickAdd': 'Quick add',
'shortcuts.toggleInspector': 'Toggle inspector',
'shortcuts.addTerminal': 'Add terminal',
'shortcuts.addNote': 'Add note',
'shortcuts.addPortal': 'Add portal',
'shortcuts.addFileTree': 'Add file tree',
'shortcuts.addText': 'Add text',
'shortcuts.escape': 'Escape / Cancel',
'shortcuts.deleteSelected': 'Delete selected',
'shortcuts.undo': 'Undo',
'shortcuts.redo': 'Redo',
'shortcuts.toggleConnectMode': 'Toggle connect mode',
'shortcuts.reset': 'Reset to defaults',
'shortcuts.pressKey': 'Press key...',
```

- [ ] **Step 2: Add Chinese i18n keys**

In `src/renderer/i18n/packs/zh-CN.ts`, add to `messages`:

```typescript
'topbar.addConnect': '连线',
'shortcuts.commandPalette': '命令面板',
'shortcuts.quickAdd': '快速添加',
'shortcuts.toggleInspector': '切换检查器',
'shortcuts.addTerminal': '添加终端',
'shortcuts.addNote': '添加笔记',
'shortcuts.addPortal': '添加门户',
'shortcuts.addFileTree': '添加文件树',
'shortcuts.addText': '添加文本',
'shortcuts.escape': '取消 / 退出',
'shortcuts.deleteSelected': '删除选中',
'shortcuts.undo': '撤销',
'shortcuts.redo': '还原',
'shortcuts.toggleConnectMode': '连线模式',
'shortcuts.reset': '恢复默认',
'shortcuts.pressKey': '按下新快捷键...',
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/i18n/packs/en-US.ts src/renderer/i18n/packs/zh-CN.ts
git commit -m "$(cat <<'EOF'
feat: add i18n keys for connect mode and shortcut settings

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: CSS styles for connect mode and shortcuts

**Files:**
- Modify: `src/renderer/styles/workbench.css`

- [ ] **Step 1: Add connect mode and shortcuts CSS**

At the end of `src/renderer/styles/workbench.css`, append:

```css
/* ---- Connect Mode ---- */

.ow-connect-overlay {
  pointer-events: none;
}

.ow-canvas-shell__flow .react-flow__edge.selected .react-flow__edge-path {
  stroke: var(--ow-color-accent) !important;
  stroke-width: 2.5 !important;
}

/* ---- Connect Edge Animation ---- */

@keyframes edgeFlow {
  from { stroke-dashoffset: 28; }
  to { stroke-dashoffset: 0; }
}

/* ---- Shortcuts Tab ---- */

.ow-shortcuts-tab__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid var(--ow-color-border);
}

.ow-shortcuts-tab__label {
  font-size: 13px;
  color: var(--ow-color-text-default);
  font-weight: 500;
  flex-shrink: 0;
  min-width: 140px;
}

.ow-shortcuts-tab__controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ow-shortcuts-tab__modifier {
  padding: 3px 9px;
  border-radius: 6px;
  border: 1px solid var(--ow-color-border);
  background: var(--ow-color-bg-panel);
  color: var(--ow-color-text-muted);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--ow-transition-fast);
  font-family: inherit;
}

.ow-shortcuts-tab__modifier.is-active {
  background: var(--ow-color-accent-soft);
  border-color: var(--ow-color-accent);
  color: var(--ow-color-accent);
}

.ow-shortcuts-tab__key-input {
  width: 80px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--ow-color-border);
  background: var(--ow-color-bg-panel-sunken);
  color: var(--ow-color-text-default);
  font-family: var(--ow-font-mono);
  font-size: 13px;
  text-align: center;
  cursor: pointer;
}

.ow-shortcuts-tab__key-input:focus {
  outline: none;
  border-color: var(--ow-color-accent);
  box-shadow: 0 0 0 3px rgba(var(--ow-accent-rgb), 0.12);
}

.ow-settings-dialog__hint {
  font-size: 12px;
  color: var(--ow-color-text-muted);
  margin: 0 0 8px;
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/fatballfish/Documents/Projects/ClientProjects/openweave && npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/styles/workbench.css
git commit -m "$(cat <<'EOF'
feat: add CSS for connect mode overlay, edge animations, and shortcuts tab

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Integration test and dev run

**Files:** (none modified, just verification)

- [ ] **Step 1: Full build check**

```bash
cd /Users/fatballfish/Documents/Projects/ClientProjects/openweave && npx tsc --noEmit --pretty 2>&1
```

Expected: No type errors. Fix any that appear.

- [ ] **Step 2: Start dev server and verify**

```bash
cd /Users/fatballfish/Documents/Projects/ClientProjects/openweave && npm run dev
```

Manual verification checklist:
- [ ] Connect button visible in toolbar
- [ ] Press C to enter connect mode, button shows active state
- [ ] Click a terminal node → blue ring highlight
- [ ] Move mouse → rubber-band dashed line follows cursor
- [ ] Click another connectable node → edge created between them
- [ ] Created edge renders as gray dashed line
- [ ] Click the edge → selected state (blue, thicker)
- [ ] Press Delete → edge is deleted
- [ ] Open Settings → Shortcuts tab → see all shortcuts
- [ ] Edit shortcut for connect mode, verify it works
- [ ] Open CLI: `node neighbors <nodeId>` → shows connected nodes

- [ ] **Step 3: Commit any fixes**

If any issues found during testing, fix and commit.
