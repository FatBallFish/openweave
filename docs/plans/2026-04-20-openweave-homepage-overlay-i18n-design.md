# OpenWeave Homepage Overlay Canvas and I18n Design

- Date: 2026-04-20
- Status: Approved for implementation
- Scope: homepage canvas shell, overlay chrome, node visibility, inspector overlay, icon-only actions, language-pack-based i18n

## Problem Summary

The current homepage mixes a shell-level canvas surface with an inner React Flow canvas. This creates a double-canvas perception: an outer surface with text and buttons, and an inner blank infinite canvas. The shell is still grid-based, so the canvas does not truly fill the window and the surrounding controls compete with the stage instead of floating above it.

Node creation already mutates the graph snapshot and increments node count, but new nodes are created at fixed starter coordinates without robust viewport-aware placement or focus behavior. In the current layered layout this makes some added nodes appear missing even though they exist in state.

The right inspector is implemented as a layout column instead of an overlay panel. Most app actions are still text buttons, and renderer copy is hard-coded, so the app cannot switch languages or scale to new locales cleanly.

## Approved Direction

Adopt a canvas-first overlay shell:

- the infinite canvas owns the full window behind all shell chrome
- top bar, left rail, workspace/context panel, and inspector become floating overlays
- duplicate canvas headers and background layers are removed
- node creation remains graph-driven but places and selects new nodes predictably in visible starter slots
- shared icon-button primitives replace text-heavy action buttons for shell chrome
- all renderer text moves behind a language-pack-based i18n registry with built-in `zh-CN` and `en-US`

## Root Causes and Fix Strategy

### 1. Double-canvas perception

Root cause:
- `WorkbenchShell` draws a full stage surface with its own canvas-like styling
- `WorkspaceCanvasPage` adds another page-level header and toolbar wrapper
- `CanvasShell` adds its own header, meta bar, decorative grid, and React Flow background

Fix:
- remove shell/page/header chrome that pretends to be part of the canvas
- keep a single React Flow-driven infinite canvas surface as the working stage
- move supporting controls into floating overlays

### 2. Node count increases but nodes appear missing

Root cause:
- store mutations are correct, but node placement is static and not visibility-aware
- overlapping or off-focus placement makes newly added nodes easy to miss
- current double-layer shell worsens the perception because the user's eye anchors on the outer shell, not the actual graph viewport

Fix:
- centralize default node placement into a collision-avoiding starter-slot helper
- auto-select the created node
- keep placement in a visible cluster near the default viewport origin so added nodes are immediately apparent

### 3. Canvas does not fill the window

Root cause:
- `WorkbenchShell` uses a fixed multi-column layout where the stage only owns one grid column

Fix:
- make the shell a single full-viewport stage
- position floating chrome with `position: absolute` over the canvas
- keep the canvas padded for overlays instead of constrained by layout columns

### 4. Inspector is not a floating expandable panel

Root cause:
- inspector is implemented as a permanent grid column

Fix:
- convert inspector to a right-side floating drawer/panel
- keep the current collapse behavior, but render the collapsed state as a compact floating tab/button

### 5. Buttons should be icon-first with hover descriptions

Root cause:
- current workbench chrome renders literal text buttons everywhere

Fix:
- add a reusable icon-button treatment for shell actions
- expose labels through `aria-label` and tooltip/title text
- keep icon + hotkey metadata where useful

### 6. Text should support installable/uninstallable language packs

Root cause:
- all user-facing strings are embedded directly in renderer components

Fix:
- add a renderer i18n registry that can register/unregister language packs
- ship built-in `zh-CN` and `en-US` packs as installable modules
- expose a provider/hook for `t()` access and language switching
- default to Chinese while preserving English as a bundled option

## Architecture

### Renderer shell

`App` will host a language provider and keep workbench interaction state. `WorkbenchShell` will become an overlay compositor that renders:

- a full-screen canvas stage
- floating top bar
- floating left rail
- floating workspace/context panel
- floating inspector panel
- floating status island
- command palette above all overlays

### Canvas surface

`WorkspaceCanvasPage` will stop rendering shell-like page headers and become a thin state/loading wrapper around `CanvasShell` and `RunDrawer`.

`CanvasShell` will become the single visible canvas surface. It keeps React Flow, minimap, controls, selection HUD, and empty-state onboarding. Its own decorative header row will be removed so the canvas reads as one continuous surface.

### Node placement

`canvas.store.ts` will gain helper logic that computes the next visible starter position from a predefined grid of slots while avoiding overlap with existing graph node rectangles. All add-node actions will reuse this helper.

### I18n packs

Add a small renderer-side i18n subsystem:

- `src/renderer/i18n/types.ts` defines translation keys and pack shape
- `src/renderer/i18n/packs/zh-CN.ts` and `src/renderer/i18n/packs/en-US.ts` provide bundled packs
- `src/renderer/i18n/registry.ts` supports register/unregister/list/get pack operations
- `src/renderer/i18n/provider.tsx` exposes context, current locale, and `t()`

This keeps later expansion possible without rewriting component code.

## Verification Strategy

- unit tests for overlay shell structure and inspector collapsed/expanded rendering
- unit tests for icon-only toolbar output and translated labels
- unit tests for i18n registry/provider behavior
- unit tests for node placement helper to prove new nodes occupy non-overlapping visible slots
- targeted renderer test run after implementation
