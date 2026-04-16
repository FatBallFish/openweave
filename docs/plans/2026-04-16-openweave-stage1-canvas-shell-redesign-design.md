# OpenWeave Stage 1 Canvas and Shell Redesign

- Date: 2026-04-16
- Status: Approved for planning
- Related docs:
  - `docs/prd/2026-04-15-openweave-prd-v1.md`
  - `docs/tech-design/2026-04-15-openweave-tech-design-v1.md`
  - `docs/screenshot/主页面.png`
  - `docs/screenshot/新工作区页面.png`
  - `docs/screenshot/新建工作区.png`

## Context

The current MVP proves the backend slices exist, but the renderer experience does not yet match the product direction defined in the PRD or the Maestri-inspired reference material. The main gap is structural rather than cosmetic: the app renders a vertically stacked node list instead of a true canvas-first workspace.

This redesign covers the first stage only:

- Align information architecture and interaction model with the Maestri-style workspace flow.
- Keep OpenWeave's own visual language instead of cloning Maestri pixel-for-pixel.
- Allow a breaking canvas-data upgrade to avoid carrying forward the wrong interaction model.
- Focus on the canvas shell and "credible product" versions of the four node types.
- Defer deeper node-specific power features to a later stage.

## User-Confirmed Boundaries

- Delivery mode: Stage 1 only, focused on canvas and shell reconstruction first.
- Product direction: structure and interaction aligned with Maestri, visuals remain OpenWeave-specific.
- Node ambition for Stage 1: "usable product version" of each node, not full advanced behavior.
- Data strategy: destructive upgrade is allowed; old canvas state does not need to remain compatible.

## Problem List

### P0 Product-Level Gaps

1. The current canvas is not an infinite canvas. It is a stacked list and does not satisfy PRD canvas requirements.
2. Nodes are rendered as form cards instead of movable, sizeable, connectable workspace objects.
3. Workspace management and the main canvas are collapsed into a single page instead of a shell with navigation, tools, and a central stage.
4. Note, Terminal, File Tree, and Portal are all rendered in debug-oriented placeholder form.
5. The renderer lacks a coherent visual system for node hierarchy, selection, tool state, and canvas affordances.

### P1 Deferred Capability Gaps

1. Portal auto-spawn behavior for new tabs, close-to-remove flow, and agent CLI control are out of scope for Stage 1.
2. File Tree write operations such as create, rename, delete, and open-with-system are out of scope for Stage 1.
3. Full PTY-style interactive terminal emulation remains out of scope for Stage 1.

## Evaluated Approaches

### Approach A: Canvas and shell first

Rebuild the renderer around a real canvas interaction model first, then upgrade all four nodes to visually credible, practically usable Stage 1 versions.

Pros:

- Fixes the deepest architectural mismatch first.
- Produces the largest user-visible product improvement quickly.
- Preserves backend work while replacing the wrong UI shell.

Cons:

- Some advanced node behaviors still wait for Stage 2.

### Approach B: Node capability first

Keep the existing shell and improve node internals first.

Pros:

- Can incrementally enhance single components.

Cons:

- Reinforces the wrong interaction model.
- Causes likely rework when the shell is later replaced.

### Approach C: Full reconstruction in one phase

Redesign the shell, the canvas, and all advanced node capabilities in a single delivery.

Pros:

- Closest to the eventual target state.

Cons:

- Excessive scope and verification risk for one pass.
- Harder to reason about regressions and acceptance.

## Chosen Direction

Adopt Approach A.

Stage 1 should deliver a real canvas product skeleton:

- left navigation shell
- top tool rail
- infinite canvas with drag, pan, zoom, connect, delete
- box-draw node creation flow
- visually coherent node system
- Stage 1 note, terminal, file tree, and portal nodes

This gets OpenWeave out of placeholder territory and into a true canvas-first workspace experience while containing risk.

## Stage 1 Information Architecture

### Left Navigation

The left rail becomes the workspace shell instead of rendering workspace controls inline above the canvas.

Sections:

- app branding and current workspace identity
- collapse / expand control
- workspace summary and settings entry
- view navigation: Canvas, Runs, and future placeholders such as Notes Outline or Portal Sessions
- switch workspace / return to workspace list entry

### Top Canvas Toolbar

The toolbar becomes the command surface for canvas behavior.

Groups:

- node tools: Note, Terminal, File Tree, Portal
- canvas tools: select, connect, pan, delete
- view tools: zoom indicator, fit view, center content
- ambient status: active tool, workspace name, save state

### Central Canvas Stage

The center of the screen becomes a real infinite canvas with a visible spatial background and room for node composition.

Capabilities:

- pan
- zoom
- node drag
- node resize
- edge creation
- node and edge selection
- delete actions
- empty-state onboarding when no nodes exist

### Right Panel Strategy

Stage 1 intentionally avoids a permanent inspector panel.

Node editing should be primarily in-node, with lightweight dialogs only when creation requires extra parameters. This keeps the canvas feeling like a workspace, not a settings form.

## Core Interaction Model

### Node Creation Flow

The Stage 1 creation interaction must follow the user-requested box-draw behavior:

1. User selects a node type from the top toolbar.
2. Cursor enters draw mode.
3. User drags a rectangle on the canvas.
4. If the node type requires additional parameters, show a creation dialog.
5. Create the node inside the drawn bounds and select it.

Creation dialog needs by type:

- Note: no required dialog
- Terminal: optional runtime / initial command dialog
- File Tree: required root path dialog, defaulting to workspace root
- Portal: optional URL dialog, defaulting to `https://example.com`

### Selection and Manipulation

- click selects
- drag moves
- shift or marquee supports multi-select
- visible selection affordances appear on active nodes
- delete removes selected nodes and their connected edges

### Connections

Nodes expose connection handles on their sides. Stage 1 connections are structural only: they represent relationships and flow context, not full execution semantics.

### Workspace Boundary

Workspace management belongs to the shell, not inside the canvas surface. The left navigation owns workspace-level actions while the center stage owns context composition.

### Branch Workspace Entry

Branch creation should move away from explicit list-page buttons. Stage 1 exposes it from:

- workspace menu in the shell
- File Tree node menu

## Visual Direction

The renderer should structurally echo Maestri while looking like OpenWeave.

Design intent:

- warm, slightly paper-like neutral shell instead of blank white
- subtle grid or dotted canvas texture
- node cards that feel like movable workstation panes
- low-saturation neutral base with type-specific accent colors
- consistent linear iconography
- strong visual distinction between idle, hover, selected, running, and error states

Suggested accents:

- Note: amber / parchment
- Terminal: carbon / teal
- File Tree: moss / sage
- Portal: slate blue / copper highlight

## Stage 1 Node Designs

### Note Node

Goal: evolve from a textarea into a working markdown document card.

Stage 1 scope:

- node header with title, type icon, overflow menu, delete
- two content modes: Edit and Preview
- markdown editing and rendered preview
- support for headings, lists, code blocks, quotes, bold, and links
- scrollable content region inside the node bounds

Out of scope:

- WYSIWYG editing
- attachments
- multi-document tabs

### Terminal Node

Goal: evolve from a command input into a terminal-like run pane.

Stage 1 scope:

- header with title, runtime label, and status light
- output/history region
- bottom command input composer
- list and summary of recent runs
- run creation from the inline command bar
- continued reuse of the existing run subsystem

Out of scope:

- full PTY emulation
- ANSI-accurate terminal rendering
- multi-tab terminals

### File Tree Node

Goal: evolve from a flat list into a lightweight directory browser.

Stage 1 scope:

- node header with path, refresh, search, and menu
- breadcrumb and back navigation
- expandable tree structure
- search/filter within the current tree
- git summary block
- branch entry moved into node menu

Out of scope:

- create, rename, delete
- drag and drop
- open with system app

### Portal Node

Goal: evolve from a debug form into a miniature browser workspace pane.

Stage 1 scope:

- browser-style header with title, status, navigation controls, and overflow menu
- address bar and load/refresh actions
- live web content area
- URL synchronization on in-page navigation
- back / forward availability state
- advanced actions like screenshot and structure read kept behind the menu, not as always-visible debug controls

Out of scope:

- new-tab auto-spawn into linked portal nodes
- close-to-remove canvas behavior
- full agent CLI browser action surface

## Technical Design

### Canvas Engine

Stage 1 replaces the current list-driven canvas renderer with a true `@xyflow/react` canvas model. This is already the architecture recommended in the technical design and is the most reliable route for pan/zoom/drag/connect/select behavior.

### Persisted Canvas Model

The persisted model should move from `x/y`-centric node forms to a real canvas snapshot:

- `nodes[]`
- `edges[]`
- each node stores position, size, title, type, and business data

Recommended node shape:

```ts
type CanvasNodeRecord = {
  id: string;
  type: 'note' | 'terminal' | 'file-tree' | 'portal';
  position: { x: number; y: number };
  size: { width: number; height: number };
  title: string;
  data: Record<string, unknown>;
  created_at_ms: number;
  updated_at_ms: number;
};
```

Recommended edge shape:

```ts
type CanvasEdgeRecord = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  created_at_ms: number;
};
```

### State Segmentation

Split renderer state into:

- workspace shell state
- canvas UI state
- persisted canvas snapshot state
- local per-node UI state

The persisted snapshot should include only business-relevant state. Temporary UI affordances such as open menus or hover states must remain local.

### Backend / IPC Reuse and Extension

Keep:

- workspace lifecycle
- runs lifecycle
- portal security boundaries
- file-tree loading primitives

Extend:

- canvas snapshot schema to support position, size, title, and handles
- portal responses to include browser-state fields needed for the node chrome
- file tree IPC to better support tree navigation and filtering semantics

### Breaking Upgrade Strategy

Stage 1 is allowed to break old canvas persistence. Workspace identity may remain, but the saved canvas schema can be reset or upgraded destructively because the current renderer model is not worth preserving.

## Testing Strategy

### Unit

- tool mode switching
- marquee creation state
- node deletion and edge cleanup
- note edit/preview state
- terminal history rendering
- file tree search/navigation state
- portal address bar and navigation state

### Integration

- canvas snapshot save/load for new schema
- edge persistence and restoration
- shell state and workspace handoff

### E2E

- create workspace and land in the new shell
- select a tool and drag-create each node type
- drag nodes, reconnect nodes, and verify persistence after restart
- delete nodes and verify connected edges are removed
- verify note preview, terminal history pane, file tree navigation, and portal browser chrome basics

## Explicit Stage 1 Non-Goals

- full terminal PTY experience
- file write operations
- portal new-tab spawning and auto-removal graph behavior
- semantic connection types
- permanent right-side inspector

## Acceptance Criteria

Stage 1 is complete when:

1. The renderer is recognizably a canvas-first product instead of a stacked form page.
2. Users can pan, zoom, draw-create, move, resize, connect, and delete nodes.
3. The shell has a left navigation layout and a top tool rail.
4. All four node types look and behave like product panes rather than debug widgets.
5. Canvas position, size, node data, and edges persist through restart using the new schema.
6. Existing backend capabilities continue to power Stage 1 behavior without regressing workspace, run, file, or portal safety boundaries.
