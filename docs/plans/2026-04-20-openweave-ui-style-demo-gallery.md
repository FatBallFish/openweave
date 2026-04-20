# OpenWeave UI Style Demo Gallery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone gallery of four full-page static UI demos that let the user visually compare candidate design systems for OpenWeave before standardizing one into a reusable project skill.

**Architecture:** Keep the demos isolated from the product renderer. Create a dedicated static demo directory with one shared stylesheet and one index page linking to four themed HTML files. Use a consistent content model across all pages so the comparison is about design language rather than feature variance.

**Tech Stack:** Plain HTML, CSS, minimal inline SVG, optional lightweight vanilla JS, local file rendering, Playwright screenshots for verification.

---

## Task 1: Create the standalone demo structure

**Files:**
- Create: `poc/ui-style-demos/index.html`
- Create: `poc/ui-style-demos/shared.css`
- Create: `poc/ui-style-demos/README.md`

**Steps:**
1. Create the demo directory under `docs/ui-demos/openweave-style-demos`.
2. Add a shared stylesheet with common layout primitives, shell regions, node card anatomy, side panels, canvas grid, and status tokens.
3. Add an index page that introduces the four styles and links to each full-page demo.
4. Add a short README that explains the purpose, how to open the files, and which concepts stay constant across themes.

## Task 2: Implement the four themed full-page demos

**Files:**
- Create: `poc/ui-style-demos/graphite-ops.html`
- Create: `poc/ui-style-demos/blueprint-canvas.html`
- Create: `poc/ui-style-demos/slate-terminal.html`
- Create: `poc/ui-style-demos/paper-rail.html`

**Steps:**
1. Use the same product frame in all four pages: top bar, left navigation, center canvas, right inspector, and bottom run drawer.
2. Use the same node set in all four pages: note, terminal, portal, file tree, plus one running edge and one warning/error state.
3. Make each theme visually distinct through typography, palette, spacing, chrome density, canvas treatment, and state styling.
4. Keep the pages static but polished enough that they feel like real product screens rather than posters.

## Task 3: Verify rendering and generate preview assets

**Files:**
- Create: `poc/ui-style-demos/previews/*.png`

**Steps:**
1. Open each local HTML file in a headless browser and verify it renders without broken layout.
2. Capture one screenshot per page into `docs/ui-demos/openweave-style-demos/previews/`.
3. Verify the index page links correctly and the screenshots exist on disk.
4. Summarize the demo paths and review instructions for the user.
