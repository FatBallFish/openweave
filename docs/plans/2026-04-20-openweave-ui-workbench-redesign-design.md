# OpenWeave UI Workbench Redesign Design

- Date: 2026-04-20
- Status: Approved for implementation planning
- Theme baseline: `Blueprint Canvas` (bright master)
- Dark-mode scope in this doc: token mapping + state mapping only
- Related docs:
  - `docs/tech-design/2026-04-18-openweave-tech-design-v2-refactor.md`
  - `docs/plans/2026-04-19-openweave-v2-phase3-phase4-builtin-hosts-and-canvas-shell.md`
  - `src/renderer/App.tsx`
  - `src/renderer/features/workspaces/WorkspaceListPage.tsx`
  - `src/renderer/features/canvas/WorkspaceCanvasPage.tsx`
  - `src/renderer/features/canvas-shell/CanvasShell.tsx`
  - `src/renderer/features/components/builtin-host-registry.tsx`

## 1. Background

OpenWeave has already finished the V2 kernel direction in principle: Graph Schema V2, builtin-host seam, runtime/bridge/CLI path, PTY-backed terminal baseline, and a first infinite-canvas shell are all present in code. But the renderer still reads like a technical demo rather than a product:

- the app entry is still a centered document page rather than a workbench shell
- workspace management, canvas orchestration, and runtime feedback are visually fragmented
- builtin components are functional but not yet expressed as one product family
- interaction density is too low for high-frequency AI workflow composition
- the current UI does not match the "AI engineer personal workbench" positioning

This redesign does not change the V2 technical direction. It productizes it. The goal is to turn the current renderer into a real operational workspace while preserving the already accepted component/runtime architecture.

## 2. Product Positioning

### 2.1 Primary persona

OpenWeave is positioned first as an **AI engineer personal workbench**:

- a place to compose terminals, notes, portals, file context, and outputs around one engineering problem
- a place where orchestration actions are frequent and central
- a place that must feel fast, tool-like, and operational rather than like a dashboard or admin console

This is intentionally different from a team operations center. Collaboration affordances can exist later, but they must not dominate the shell.

### 2.2 Competitive stance toward Maestri

Interaction strategy can boldly benchmark Maestri, especially in these dimensions:

- spatial workflow composition on an infinite canvas
- fast creation of terminals and context nodes
- direct manipulation instead of form-heavy page transitions
- always-visible orchestration context and runtime state

But brand expression must clearly diverge:

- OpenWeave should feel more engineering-structured and less sketchbook-like
- visual tone should emphasize system planning, execution clarity, and controlled density
- the shell should read like a precise AI engineering cockpit, not like a creative whiteboard toy

### 2.3 Reverse-analysis conclusions from Maestri

Based on app-bundle strings and public product material, the most useful signals are:

- workspace is the top-level mental model
- canvas is the dominant surface
- terminals, portals, notes, and connections coexist spatially
- interaction favors quick add, focus, and local manipulation over deep modal flows
- runtime/state awareness stays near the workspace instead of being buried in secondary settings

OpenWeave should keep these strengths, but shift the visual language from "creative spatial notes" to "AI engineering operation".

## 3. Design Goals and Non-goals

### 3.1 Goals

1. Replace the current document-like home page with a true workbench shell.
2. Make the infinite canvas the dominant surface without losing workspace and run context.
3. Rebuild all builtin component surfaces as one coherent host family.
4. Align interaction with the V2 Component Interface direction rather than one-off widget logic.
5. Reduce onboarding friction for workflow composition through hierarchy, shortcuts, and stronger state feedback.
6. Establish a bright-mode master design that is implementation-ready and tokenized.

### 3.2 Non-goals

1. This pass does not redesign the underlying runtime, CLI, bridge, or PTY architecture.
2. This pass does not add remote collaboration, a marketplace, or automation scheduler semantics.
3. This pass does not require full dark-mode UI mockups yet.
4. This pass does not attempt to reproduce Maestri pixel-for-pixel.

## 4. Confirmed Product Decisions

The following decisions were explicitly confirmed and are treated as locked for implementation:

- deliver the bright master first; dark mode only needs token/state parity for now
- interaction can boldly benchmark Maestri; brand must clearly separate
- product focus is "AI engineer personal workbench"
- the shell uses a left workspace/resource/run/event structure
- the top toolbar is hybrid, but orchestration actions come first and global management comes second
- the center is an infinite canvas workbench
- the right side is a persistent but collapsible Inspector
- the lower-right area carries a floating status / event / task cluster
- first deliver the real in-progress work state, then add a lightweight empty state
- builtin components in scope are exactly 5: `Terminal`, `Portal`, `File Tree`, `Note`, `Text`
- `Note` means editable markdown; `Text` means read-only plain text display

## 5. Information Architecture

## 5.1 Primary shell hierarchy

The shell hierarchy must follow this attention order:

1. active work on the infinite canvas
2. selected node and run state
3. inspector and contextual panels
4. workspace/global navigation chrome

The product should never feel like a left-nav dashboard with a canvas embedded inside it. The canvas remains the center of gravity.

### 5.2 App shell regions

#### Left rail (`76px`)

A compact persistent rail used for mode switching and high-frequency location changes.

Contents:

- brand mark / current workspace badge
- canvas home
- resources / components entry
- runs / events entry
- workspace switcher
- settings / preferences / help affordances

Behavior:

- calm chrome, icon-first, label-on-hover or in expanded contextual panel
- selection state must be obvious but restrained
- collapse is allowed only for the adjacent contextual panel, not for the core rail itself

#### Left contextual panel (`280px`)

A contextual support panel whose content changes by left-rail selection.

Modes:

- `Workspace`: workspace summary, recent canvases, quick-open
- `Resources`: builtin component catalog, saved snippets, files, templates
- `Runs`: recent runs, active tasks, interventions, alerts
- `Events`: warnings, failures, confirmations, audit-like stream

Behavior:

- default homepage mode should show a mixed workspace/resources view tuned for composition
- panel content should be dense, readable, and scannable
- panel is secondary to the canvas and should use quieter emphasis than nodes

#### Top toolbar (`64px`)

The top toolbar is the primary action strip.

Order principle:

1. create / orchestrate actions first
2. canvas/view tools second
3. workspace/global utilities third

Recommended sections:

- create: add terminal, add note, add portal, add file tree, add text
- compose: connect, group, annotate, fit selection, duplicate
- search/command: global command palette trigger, quick filter, jump-to-node
- workspace utility: current branch, save state, share/export placeholder, settings

Interaction tone:

- looks closer to an engineering command strip than a SaaS navbar
- compact buttons with clear hotkey hints
- create actions should be visible without opening a menu

#### Center canvas workbench

The workbench is a real infinite canvas with drafting-paper energy.

Capabilities required by design:

- pan, zoom, fit, center
- node drag and future resize affordance
- relationship lines with semantic labels when useful
- direct selection and multi-select
- visible runtime states on nodes and edges
- local empty state when the graph is sparse

Visual character:

- engineering-paper background, subtle grid/dot mix
- canvas should feel spatial and intentional, not decorative
- nodes should have enough visual weight to anchor composition against the background

#### Right Inspector (`360px` expanded / `40px` collapsed)

The Inspector is persistent because workflow composition is high-frequency.

Sections:

- selected object summary
- configurable properties
- connection/relationship info
- runtime state / last action / quick commands
- node-specific parameters based on Component Interface contract

Behavior:

- can collapse to a slim vertical affordance
- should feel like a parameter sheet, not a blog sidebar
- default content when nothing is selected should guide composition, not show empty forms

#### Lower-right state island

A floating cluster pinned at the lower right.

Contents:

- run status
- event feed badge
- queued tasks / notifications
- optional quick-open for active session drawer

Behavior:

- always present, compact by default
- expands on hover/click into richer detail
- should feel like operational telemetry, not chat bubbles

## 6. Homepage High-Fidelity Master

## 6.1 Default state: real work in progress

The primary homepage should not be an empty onboarding scene. It should show credible in-progress orchestration:

- a terminal node running an AI CLI session
- a note node with active markdown plan/checklist
- a file tree node rooted at the current workspace
- a portal node showing an external reference or tool page
- a text node with a generated result or extracted output
- 2-4 visible relationship lines that explain reasoning flow

This composition should communicate in under five seconds that OpenWeave is for:

- gathering context
- executing steps
- observing outputs
- iterating spatially

### 6.2 Recommended visual composition

Suggested initial composition:

- center-left: `File Tree` anchored as context source
- upper-center: `Note` as plan/control document
- center-right: `Terminal` as primary execution engine
- lower-right: `Portal` as external context or verification surface
- lower-center: `Text` as extracted output / result / summary

This arrangement reinforces the work loop: context -> plan -> execute -> verify -> record.

### 6.3 Tone and finish

The page should feel:

- precise, bright, and operational
- calm enough for long sessions
- dense enough for expert work without becoming visually loud

It must avoid:

- generic dashboard cards
- purple startup gradients
- oversized glows or glassmorphism
- sticky-note scrapbook aesthetics

## 7. Lightweight Empty State

After the real-work master, add a lighter empty state.

Principles:

- keep the shell intact so the product still feels real
- onboarding lives inside the canvas, not instead of the canvas
- bias the user toward immediate composition

Recommended empty-state content:

- centered quick-start card cluster on the canvas
- one-line explanation: "Start with a terminal, then add context around it."
- 5 create actions with hotkeys
- two recommended starter recipes:
  - Debug a repo
  - Explore a website and capture findings
- soft demo edge sketch in the background to imply spatial workflow

## 8. Builtin Component Redesign

All builtin components must share one outer host anatomy so they visibly belong to the same product system.

## 8.1 Shared host anatomy

Every node host uses the same structure:

1. **Header**
   - type icon
   - title
   - quick state chip
   - small inline actions
   - overflow menu
2. **Body**
   - primary component content
3. **Footer status strip**
   - metadata, timestamps, connection hints, validation/runtime info

Shared states that must be explicit for every host:

- default
- hover
- selected/focused
- running/active
- warning
- failed
- disabled when relevant

## 8.2 Terminal

Role:

- the primary agent/session execution node
- highest interaction density among builtin components

Design requirements:

- strong header with runtime selector, session identity, running state
- terminal output surface visually nested but not visually detached from the host
- inline command input / launch controls readable at a glance
- session controls such as stop, rerun, open run, copy last command
- footer strip showing cwd, runtime, last run, and error state

Product behavior goal:

- Terminal should feel like the center of an AI engineer's flow, not like a generic terminal embed.

## 8.3 Note

Role:

- editable markdown work document for planning, checkpoints, scratch structure, and execution notes

Design requirements:

- markdown/editor split does not need full dual-pane by default; keep a focused writing surface
- typography should support headings, task lists, code, and callouts cleanly
- quick formatting affordances should stay lightweight
- footer strip can show word count, last edit, linked nodes, or checklist progress

Product behavior goal:

- Note should feel like the operational notebook attached to a live workflow.

## 8.4 Text

Role:

- read-only output/result node
- best for extracted plain text, summaries, command results, logs, or copied artifacts

Design requirements:

- visually distinct from `Note` so users never confuse editability
- monospaced or mixed presentation depending on content type, but always read-only
- should support truncation, expand, copy, and provenance metadata
- footer strip can show source node and generation timestamp

Product behavior goal:

- Text should feel like a stable evidence/output surface.

## 8.5 File Tree

Role:

- engineering context source for repo structure and file access

Design requirements:

- denser tree rows than the current demo rendering
- clear root identity and git/workspace context
- file preview affordances stay lightweight inside the card; deep browsing can route elsewhere later
- quick actions such as branch workspace, copy path, reveal relevant file, refresh
- footer strip shows root path state, git summary, watcher freshness, or lock state

Product behavior goal:

- File Tree should feel like a practical repo-context module, not a toy directory viewer.

## 8.6 Portal

Role:

- external context and interaction node for browsing, capture, structure read, and page action flows

Design requirements:

- strong URL/header treatment with trust and loading cues
- action bar for load, capture, read structure, click, and input remains compact and usable
- embedded preview should look like a managed viewport rather than a random iframe box
- footer strip can show domain, last interaction, and open page status

Product behavior goal:

- Portal should feel like a controlled field instrument for external context.

## 9. Workflow Interaction Redesign

## 9.1 Three interaction layers

### Layer A: shell-level orientation

Used for workspace switching, recent activity, global command, and jumping to resources.

### Layer B: canvas-level composition

Used for add/connect/group/select/move/zoom and for understanding graph state.

### Layer C: node-level deep work

Used for editing markdown, operating a terminal, browsing files, interacting with a portal, or reading results.

The redesign should keep these layers distinct so the UI does not collapse into one overloaded page.

## 9.2 Fast create model

Users should be able to create nodes through multiple equivalent paths:

- top-toolbar direct action
- double-click blank canvas
- slash trigger on canvas: `/`
- command palette: `Cmd/Ctrl+K`
- contextual quick insert near a selected node or connection target

Creation should bias toward low-friction defaults. If a component can be created with a safe default, create it first and configure second.

## 9.3 Selection and focus model

The canvas should support:

- single select
- multi-select
- marquee select
- focus mode for one active node
- keyboard-driven next/previous selection

Selected state must be obvious without overwhelming the canvas. Border, header tint, and local action affordances are preferred over glow-heavy treatments.

## 9.4 Semantic relationships

Connections should not read as meaningless wires.

First-pass semantic connection types:

- context
- output
- dependency
- observation
- reference

If labels improve readability, display them as small chips near the edge midpoint. The goal is to make the graph explain itself.

## 9.5 Groups and sections

Add a group/section concept for larger workflows.

Design behavior:

- a group can visually contain several nodes
- group headers should read like task sections or workflow phases
- groups are calmer than nodes and should not become giant cards themselves

This is important for real engineering use because workflows quickly exceed a handful of nodes.

## 9.6 Runtime feedback on canvas

Runtime state should appear directly where work happens.

Examples:

- running badge in node header
- edge pulse or subtle progress cue when data is actively flowing
- failure badge on a node with quick jump to details
- latest output snippet shown in footer strip or inspector
- state island counts updating without pulling focus away from the canvas

## 9.7 Inspector as control surface

The Inspector is not just metadata.

It should support:

- editing selected node properties
- seeing recent actions and relevant context
- controlling node-specific parameters exposed by the Component Interface
- viewing connection semantics and linked nodes
- applying workflow-level actions to a multi-selection

## 9.8 Keyboard system

High-frequency shortcuts are part of the product, not an enhancement.

Priority shortcuts:

- `Cmd/Ctrl+K`: command palette
- `1-5`: quick insert favorite nodes
- `/`: quick add from canvas context
- `Space`: hand/pan mode
- `Enter`: focus selected node
- `Esc`: exit focus / clear ephemeral UI
- `Backspace/Delete`: remove selection
- `Cmd/Ctrl+G`: group selection
- `Cmd/Ctrl+Shift+I`: toggle Inspector

## 10. Visual System

## 10.1 Typography

Bright master typography:

- UI font: `Manrope`
- Mono font: `JetBrains Mono`

Guidelines:

- headers are compact and confident, not oversized marketing headings
- meta text stays readable under dense conditions
- code-like or runtime data uses mono sparingly and intentionally

## 10.2 Bright tokens (`Blueprint Canvas`)

### Core surfaces

- app background: `#edf4fb`
- canvas background: `#e8f0f8`
- panel background: `rgba(255,255,255,0.62)`
- strong panel: `rgba(255,255,255,0.90)`
- text strong: `#10253d`
- text default: `#26445f`
- text soft: `#5f7790`
- border: `rgba(33,74,120,0.18)`
- border strong: `rgba(33,74,120,0.32)`
- accent: `#0d6efd`
- accent strong: `#0056c9`
- success: `#0d7f6f`
- warning: `#b57912`
- danger: `#bf4d4d`

### Shape and spacing

- corner radius: small to medium, technical not bubbly
- shell spacing: 12 / 16 / 20 / 24 rhythm
- node internals: compact but breathable
- borders carry more visual structure than shadows

### Motion

Allowed motion is restrained and purposeful:

- staggered shell reveal on first paint
- state pulse for running nodes
- subtle inspector slide/collapse
- modest edge or status transitions

No decorative floating or oversold micro-animation.

## 10.3 State expression rules

### Default

- neutral surface
- quiet metadata
- stable border

### Hover

- slightly stronger border
- local actions become clearer

### Selected / focused

- accent border + subtle header or surface wash
- no full-card neon glow

### Running / active

- success dot or chip
- limited animation only where it improves scan speed

### Warning

- localized amber indicator
- never flood the entire card

### Failed

- high-contrast red indicator and summary cue
- preserve readability of content inside the card

### Disabled

- desaturated content and muted affordances
- still clearly identifiable as a component, not removed state

## 11. Dark Token and State Mapping

This phase does not require full dark screens, but all bright-system decisions must map cleanly into `Slate Terminal`.

### 11.1 Dark base tokens

- app background: `#0d1217`
- panel background: `rgba(21,29,35,0.82)`
- strong panel: `rgba(25,34,41,0.96)`
- canvas background: `#0b1014`
- node background: `rgba(24,33,39,0.88)`
- text strong: `#ebf2f7`
- text default: `#c5d2dd`
- text soft: `#91a4b3`
- border: `rgba(91,114,131,0.22)`
- border strong: `rgba(91,114,131,0.38)`
- accent: `#58a6ff`
- accent strong: `#9dcbff`
- success: `#3fb950`
- warning: `#d29922`
- danger: `#f85149`

### 11.2 Mapping rules

- bright shell structure remains unchanged in dark mode
- dark mode should feel like a runtime-native IDE shell, not cyberpunk neon
- selected state can be slightly stronger than bright mode, but still controlled
- running/warning/failed semantics must remain identical between themes
- terminal and run surfaces can carry more tonal contrast than note/text surfaces

## 12. Delivery Scope

## 12.1 Deliverables

1. homepage workbench shell high-fidelity implementation
2. lightweight empty-state implementation
3. 5 builtin component high-fidelity redesigns
4. key orchestration interaction surfaces and shortcuts
5. shared token/state system with dark-mode parity mapping

## 12.2 Recommended implementation order

### Phase 1: Workbench shell

- app shell layout
- left rail
- contextual left panel
- top toolbar
- right inspector
- lower-right state island
- homepage real-work composition

### Phase 2: Unified builtin host system

- shared host chrome
- shared state system
- host header/body/footer anatomy
- common action placement

### Phase 3: Component-by-component redesign

- Terminal
- Note
- Text
- File Tree
- Portal

### Phase 4: Workflow interaction system

- fast create model
- command palette
- selection/multi-select
- grouping
- semantic edges
- runtime-on-canvas feedback
- keyboard system

### Phase 5: Theme parity and polish

- dark token/state mapping hook-up
- shell polish
- motion refinement
- dense-state QA and accessibility pass

## 13. Acceptance Checklist

The redesign is considered complete only when all of the following are true:

- the app no longer lands on a centered demo document page
- the infinite canvas is visually and functionally the product center
- left rail, top toolbar, right inspector, and lower-right status island all exist and feel coherent
- all 5 builtin components share a unified host structure
- `Note` is clearly editable markdown and `Text` is clearly read-only output
- the workflow can be understood through state, hierarchy, and visible relationships without opening multiple dialogs
- create/connect/focus interactions are faster than the current demo flow
- bright theme is fully implemented and dark token/state parity exists in code
- the result feels like OpenWeave's own AI engineering workbench rather than a Maestri clone
