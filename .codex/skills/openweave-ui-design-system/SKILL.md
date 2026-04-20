---
name: openweave-ui-design-system
description: OpenWeave product UI design system for workflow orchestration and infinite-canvas interfaces. Use when designing, restyling, reviewing, or extending any OpenWeave renderer UI, especially the workspace shell, canvas shell, node cards, inspector panels, run drawers, dialogs, and navigation. This skill standardizes Blueprint Canvas as the bright theme and Slate Terminal as the dark theme, and should be used before creating mocks, static demos, React components, or UI review feedback for OpenWeave.
---

# OpenWeave UI Design System

Use this skill to keep OpenWeave visually consistent while the product grows.

## Core Rules

- Use `Blueprint Canvas` for bright mode.
- Use `Slate Terminal` for dark mode.
- Design for engineering operation, not artistic rendering.
- Keep the infinite canvas as the primary surface; surrounding chrome must support it, not compete with it.
- Make run state, selection state, warning state, and failure state readable in under one second.

## Workflow

1. Identify the surface being changed: workspace shell, canvas shell, node host, inspector, drawer, or dialog.
2. Decide whether the task targets bright mode, dark mode, or both.
3. Read the relevant references before designing:
   - `references/blueprint-canvas.md` for bright mode
   - `references/slate-terminal.md` for dark mode
   - `references/component-rules.md` for shared anatomy and review checks
4. Preserve the existing product structure unless the user explicitly asks for a broader layout rethink.
5. Produce UI work with explicit tokens, spacing, state behavior, and component hierarchy rather than vague styling language.

## Shared Product Priorities

- Optimize for dense operational work: many nodes, many states, many side panels.
- Keep product chrome calm so graph relationships remain readable.
- Prefer borders, spacing, and restrained emphasis over decorative effects.
- Make node types feel related but not identical.
- Keep terminal, portal, and file-tree surfaces functional first.

## Non-Negotiables

- Do not drift into generic SaaS dashboard styling.
- Do not use purple-on-white default palettes.
- Do not use oversized glassmorphism, blurred neon glows, or decorative 3D effects.
- Do not make the canvas background louder than the node content.
- Do not bury operational state inside subtle copy-only indicators.
- Do not introduce a new visual language per feature; map all new UI into the selected system.

## What Good Output Looks Like

A good OpenWeave UI result should:

- name the target theme explicitly
- define or reuse concrete tokens
- describe the shell hierarchy clearly
- show how selected/running/warning/error states appear
- keep bright/dark mode parity when both modes are touched
- improve usability for operator tasks such as branching, verification, portal interaction, terminal review, and node inspection

## Review Checklist

Before finalizing, check:

- Is the canvas still the dominant working surface?
- Are navigation, inspector, and drawer quieter than the graph?
- Can users distinguish selected, running, warning, failed, and idle states immediately?
- Does typography feel tool-like and operational rather than marketing-oriented?
- Does the change match Blueprint Canvas in bright mode or Slate Terminal in dark mode?
- Would this still feel coherent if applied to portal, terminal, file-tree, and note nodes together?

## References

- `references/blueprint-canvas.md` - bright-mode tokens and layout guidance
- `references/slate-terminal.md` - dark-mode tokens and layout guidance
- `references/component-rules.md` - shared component anatomy, state rules, and do/don't checks
