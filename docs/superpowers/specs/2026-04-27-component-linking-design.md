# Design Spec: Component Linking (连线关联)

**Date:** 2026-04-27
**Branch:** feature/component_line
**Status:** approved

## Summary

Add visual connection lines (edges) between canvas components with bidirectional associations, animated interaction highlights triggered by CLI operations, and full keyboard shortcut configuration.

## Scope

### In scope
- Connect button in toolbar, shortcut `C` to enter connect mode
- Figma-style rubber-band connection UX (click first node → dashed line follows cursor → click second node → snap)
- Bidirectional edges persisted in graph snapshot; rendered as dashed lines
- Edge selection (click to select), Delete key to remove
- Active highlight: green flowing animation when CLI send/write targets an edge's nodes
- Shortcut system: refactor from hardcoded to configurable, with Shortcuts Settings UI
- `connectable` property on component manifest; Text and File Tree excluded

### Out of scope
- Directional connections (arrows)
- Multiple edge types or edge labels
- Group-level connections
- Connection weight/cost

## Architecture

```
┌─ Renderer ─────────────────────────────────────┐
│  WorkbenchTopBar (+ connect button)             │
│  SettingsDialog > ShortcutsTab (new)            │
│  CanvasShell (edge rendering, connect mode)     │
│    ├─ ConnectionLineOverlay (rubber band)        │
│    ├─ Edge types: default/selected/active        │
│  useCanvasShortcuts (dynamic bindings)          │
│  settings.store (shortcut bindings)             │
│  canvas.store (addEdge, deleteEdge, etc.)       │
├─ Main ──────────────────────────────────────────┤
│  IPC: graph save/load (edges already supported) │
│  Bridge: highlight forwarding                   │
│  workspace-node-query-service (neighbors)       │
├─ CLI ───────────────────────────────────────────┤
│  node neighbors: treats edges as bidirectional  │
│  node action: triggers highlight via main       │
├─ Shared ────────────────────────────────────────┤
│  manifest.ts: add connectable?: boolean          │
│  schemas.ts: edge schema exists (V2)            │
│  contracts.ts: highlight IPC channel (new)       │
└─────────────────────────────────────────────────┘
```

## Component Details

### 1. Manifest `connectable` property

**File:** `src/shared/components/manifest.ts`
- Add optional `connectable?: boolean` to `ComponentManifestV1.node`
- Default: `true` (all components connectable unless explicitly set to false)
- Set `connectable: false` on `builtin.text` and `builtin.file-tree` manifests

### 2. Connect Mode (Canvas + Rubber Band)

**Flow:**
1. User clicks Connect button or presses `C`
2. `canvas.store` enters `connectMode: true`, cursor changes
3. User clicks a connectable node → node highlights (blue ring), store records `connectSourceNodeId`
4. Mouse moves over canvas → SVG rubber-band dashed line drawn from source node center to cursor
5. User clicks another connectable node (not source) → edge created
6. Edge persisted via `graph:save-v2` IPC, mode exits

**Edge ID convention:** `edge-{uuid}`
**Edge type:** `connectEdge` (custom ReactFlow edge type for dashed style)

### 3. Edge Rendering States

| State | Style | Trigger |
|-------|-------|---------|
| Default | `#8398af` dashed, `stroke-dasharray: 6 4`, `stroke-width: 1.5` | Normal |
| Selected | `--ow-color-accent` dashed, `stroke-width: 2.5` | Click edge |
| Active | `--ow-state-running` dashed + CSS flowing gradient animation | CLI action on connected node |

**Active edge animation:** CSS `@keyframes edgeFlow` — a gradient "pulse" traveling along the edge path, duration ~1.4s loop. At most one edge is active at a time. When a new CLI operation triggers a different edge, the previous active edge returns to default state. If the same edge is triggered again while already active, the animation restarts.

**Selection rules:**
- Clicking an edge → deselect any selected node, select this edge
- Delete key on selected edge → delete edge, persist
- Marquee drag (box select): can include both nodes and edges together
- Clicking canvas background → deselect all

### 4. Shortcut System Refactor

**Data model:**
```typescript
interface ShortcutBinding {
  action: CanvasShortcutAction | 'toggle-connect-mode';
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

interface ShortcutBindings {
  [action: string]: ShortcutBinding;
}
```

**Default bindings** (matching current hardcoded values + new):
| Action | Key | Modifiers |
|--------|-----|-----------|
| open-command-palette | k | meta/ctrl |
| open-quick-add | / | none |
| toggle-inspector | i | meta/ctrl+shift |
| add-terminal | 1 | none |
| add-note | 2 | none |
| add-portal | 3 | none |
| add-file-tree | 4 | none |
| add-text | 5 | none |
| escape | Escape | none |
| delete-selected | Delete/Backspace | none |
| undo | z | meta/ctrl |
| redo | z | meta/ctrl+shift |
| toggle-connect-mode | c | none | *(new)* |

**Storage:** `localStorage` key `openweave:settings:shortcuts`
**Settings UI:** New `ShortcutsTab` component replacing placeholder in `SettingsDialog`, showing each action with editable key + modifier checkboxes.

### 5. Active Highlight via CLI

**Trigger path:**
```
CLI: node action <nodeId> send/write/read
  → main: workspace-node-query-service.runNodeAction()
  → finds edges where nodeId is source or target
  → sends IPC "graph:edge-highlight" with edgeIds[]
  → renderer: sets activeEdgeIds in canvas store
  → edge components re-render with active animation
```

**IPC channel (new):** `graph:edge-highlight`
- Push from main to renderer: `{ edgeIds: string[], sourceNodeId: string }`
- Renderer marks those edges active, clears previous active state for edges NOT in this set
- If `edgeIds` is empty, clears all highlights

### 6. CLI Neighbors (Bidirectional)

**Change in `workspace-node-query-service.ts` `getNodeNeighbors`:**
For each node, edges where node is either `source` OR `target` count as connections. The other side is the neighbor. No distinction between upstream/downstream for bidirectional edges — both sides appear in both lists.

### 7. Toolbar Connect Button

**File:** `src/renderer/features/workbench/WorkbenchTopBar.tsx`
- Add `IconButton` with connect icon after a separator in the Create cluster
- Props: `onToggleConnectMode`, `connectModeActive`
- Active state: blue border + blue icon + background tint

## Files to Modify

### New files
- `src/renderer/features/canvas-shell/ConnectModeOverlay.tsx` — rubber-band line + cursor handling
- `src/renderer/features/workbench/ShortcutsTab.tsx` — shortcut editing UI in settings
- `src/renderer/features/canvas-shell/edge-types/ConnectEdge.tsx` — custom edge renderer with states

### Modified files
- `src/shared/components/manifest.ts` — add `connectable` field
- `src/shared/components/builtin-manifests.ts` — set connectable on text, file-tree
- `src/shared/ipc/contracts.ts` — add highlight IPC channel + contract
- `src/renderer/features/canvas/canvas.store.ts` — connect mode state, edge CRUD, activeEdgeIds
- `src/renderer/features/canvas-shell/CanvasShell.tsx` — connect mode wiring, edge types, marquee selection
- `src/renderer/features/canvas-shell/useCanvasShortcuts.ts` — dynamic binding from store
- `src/renderer/features/workbench/WorkbenchTopBar.tsx` — connect button
- `src/renderer/features/workbench/WorkbenchShell.tsx` — connect mode prop passthrough
- `src/renderer/features/workbench/SettingsDialog.tsx` — add ShortcutsTab
- `src/renderer/features/workbench/settings.store.ts` — shortcut bindings state
- `src/renderer/features/canvas/WorkspaceCanvasPage.tsx` — connect mode props/events
- `src/renderer/i18n/packs/en-US.ts` — new i18n keys
- `src/renderer/i18n/packs/zh-CN.ts` — new i18n keys
- `src/main/ipc/canvas.ts` — edge-highlight IPC handler
- `src/main/bridge/workspace-node-query-service.ts` — bidirectional neighbor lookup
- `src/renderer/styles/workbench.css` — connect mode styles, edge animations
- `src/renderer/styles/tokens.css` — edge color tokens

## Edge Cases

1. **Self-loop:** Prevent connecting a node to itself (already enforced by `graphEdgeSchemaV2` refinement)
2. **Duplicate edge:** If edge A→B already exists, ignore duplicate connect attempt
3. **Delete source/target node:** Deleting a node also deletes all its edges (already done in `deleteNodes`)
4. **Undo/Redo:** Connect and delete-edge actions must be undoable (add entries to `historyStore`)
5. **Non-connectable node click in connect mode:** Ignore — no highlight, no rubber band
6. **Escape in connect mode:** Cancel, exit connect mode, clear source selection
7. **Click connect button again (toggle off):** Exit connect mode
