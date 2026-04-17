# OpenWeave Stage 1 Node Productization Sequence

- Date: 2026-04-18
- Status: Approved for planning and execution
- Related docs:
  - `docs/plans/2026-04-16-openweave-stage1-canvas-shell-redesign-design.md`
  - `docs/plans/2026-04-16-openweave-stage1-canvas-shell-redesign.md`
  - `docs/plans/2026-04-17-openweave-stage1-handoff.md` (from commit `110e9a7`)

## Context

The Stage 1 canvas shell is now structurally in place and has already been stabilized through the follow-up fixes captured in commits `a5172b1` and `110e9a7`. The remaining work is no longer about the shell architecture itself; it is about turning the current Stage 1 node surfaces and interaction edges into credible product surfaces.

The current gaps cluster into four slices:

- Terminal productization
- File Tree productization
- Portal productization
- Canvas polish and performance follow-up

The user confirmed that these should be implemented sequentially, one slice at a time, with subagents doing the concrete implementation work.

## User-Confirmed Boundaries

- Delivery mode: continue from the current Stage 1 baseline instead of redesigning the shell again.
- Execution mode: use subagents for implementation, with the controller session doing planning, review, and integration.
- Order of work: implement the follow-up slices one by one in this sequence:
  1. Terminal
  2. File Tree
  3. Portal
  4. Canvas polish and performance
- Quality bar: each slice must land with explicit automated coverage before moving to the next slice.

## Problem List

### P0 Remaining Product Gaps

1. Terminal is still a run composer rather than a terminal-style work surface.
2. File Tree is still a mostly flat read-only inspector instead of a navigable manager-grade browser.
3. Portal still exposes a minimal automation panel rather than a browser-style pane with session controls.
4. Canvas interaction coverage is not yet deep enough around resize semantics, selection persistence, and heavier interaction loads.

### P1 Delivery Risks

1. All four slices touch the renderer node system, so uncontrolled parallel implementation would create merge risk.
2. Portal and File Tree both cross the renderer-main IPC boundary, so regression coverage has to stay close to the behavior changes.
3. Canvas polish should happen after the three node slices so it can validate the behavior of the final node shapes instead of intermediate placeholders.

## Evaluated Approaches

### Approach A: Sequential vertical slices

Implement each follow-up slice end-to-end, in product priority order, with tests and verification before starting the next slice.

Pros:

- Keeps each milestone reviewable and releasable.
- Works well with one fresh subagent per slice.
- Reduces integration risk because each slice closes before the next begins.

Cons:

- Shared renderer abstractions may evolve incrementally across the first few slices.

### Approach B: Shared abstraction first

Pause feature delivery to extract a generic node framework before building the remaining slices.

Pros:

- Might produce cleaner reuse boundaries on paper.

Cons:

- High risk of premature abstraction.
- Delays user-visible progress.
- Adds design overhead before the real requirements are fully proven.

### Approach C: Test matrix first, implementation later

Write all missing tests for all slices first, then implement all productization work afterwards.

Pros:

- Up-front acceptance boundary is very explicit.

Cons:

- Delays feature delivery.
- Makes it harder to adapt based on what the first slice teaches us.

## Chosen Direction

Adopt Approach A: sequential vertical slices with controller-led review.

This preserves momentum from the Stage 1 shell work, keeps each slice independently shippable, and fits the user-requested subagent workflow.

## Execution Model

### Controller Responsibilities

The main session owns:

- design and planning
- TDD acceptance boundary definition
- subagent dispatch
- spec-compliance review
- code-quality review
- integration verification before completion claims

### Subagent Responsibilities

Each implementation subagent owns only the current slice and must:

- follow TDD for that slice
- stay within the assigned file scope unless required updates are discovered
- avoid reverting unrelated user or prior-agent changes
- report concrete verification evidence back to the controller

### Review Gates

Each slice must pass three gates before the next slice starts:

1. targeted red-green tests for the new behavior
2. spec-compliance review against the approved slice requirements
3. code-quality review plus fresh local verification

## Slice Designs

### Slice 1: Terminal Productization

Goal: evolve the current terminal node from a plain command launcher into a terminal-style run surface while still reusing the existing run subsystem.

Scope:

- terminal-like header chrome with runtime/status affordances
- output/scrollback region that surfaces recent run output clearly
- footer composer that feels like a shell command bar
- better linkage between the node and `RunDrawer`
- stronger unit and E2E coverage for node output and status transitions

Out of scope:

- full PTY emulation
- ANSI-accurate terminal rendering
- tabbed shells

### Slice 2: File Tree Productization

Goal: evolve the current read-only tree dump into a navigable directory browser with stronger repo context.

Scope:

- breadcrumbs and back navigation
- client-side search/filter within the current tree payload
- clearer file/directory chrome
- tighter integration of git summary and branch workspace entry
- stronger IPC, renderer, and E2E coverage

Out of scope:

- create, rename, delete, or open-with-system operations
- write access to workspace files

### Slice 3: Portal Productization

Goal: evolve the current portal node from a basic automation panel into a browser-style pane that exposes session state and common controls more naturally.

Scope:

- richer browser chrome and clearer load state
- better session orchestration per node
- preservation of current automation operations behind a more coherent surface
- coverage for control flows and `file://` safety rules

Out of scope:

- full tab orchestration beyond the scoped Stage 1 behavior
- agent CLI control beyond what the current portal backend supports

### Slice 4: Canvas Polish and Performance

Goal: harden the final Stage 1 experience once the node surfaces above are complete.

Scope:

- stronger automated coverage for top/bottom/side resize semantics
- heavier drag/resize/selection regression coverage
- performance-focused cleanup in adapter/store/render hotspots
- confirmation that the final Terminal/File Tree/Portal node shapes behave well under canvas interactions

Out of scope:

- Stage 2 semantic port modeling
- large architectural rewrites of the canvas shell

## Testing Strategy

Each slice should preserve the existing validation discipline:

- targeted Vitest unit coverage for renderer stores/components
- integration tests when IPC or persistence behavior changes
- Playwright Electron coverage for the user-visible workflow
- broader `npm run build` and `npm run test` verification at appropriate checkpoints

## Success Criteria

This wave is complete when:

1. Terminal, File Tree, and Portal each feel like product surfaces rather than debug forms.
2. Canvas interaction regressions are explicitly covered for the final node shapes.
3. Each slice lands sequentially with fresh verification evidence.
4. The codebase remains in a state where Stage 2 enhancements can build on proven Stage 1 behavior instead of reworking placeholders.
