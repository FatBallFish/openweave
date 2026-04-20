# Blueprint Canvas

## Theme Intent

Use Blueprint Canvas when the UI should feel like a live system map for AI workflow orchestration.

Keywords: precise, architectural, bright, diagrammatic, operator-first.

## Core Tokens

- Typography
  - UI: `Manrope`
  - Mono: `JetBrains Mono`
- Base colors
  - app background: `#edf4fb`
  - panel background: `rgba(255,255,255,0.62)`
  - strong panel: `rgba(255,255,255,0.90)`
  - canvas background: `#e8f0f8`
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

## Layout Character

- Use a structured shell: top bar, left rail, central canvas, right inspector, lower run region.
- Keep panel surfaces light and translucent, but avoid trendy heavy blur.
- Use finer radii than the bright default demo; shape language should feel technical, not soft-luxury.
- The canvas grid is part of the identity. It should feel like drafting paper, not notebook paper.

## Canvas Rules

- Make edges and anchor logic visually legible.
- Prefer thin blue-gray lines over thick brand-colored arrows.
- Use label chips on important edges if they improve reasoning.
- Selected nodes should emphasize border and header strip before using glow.

## Component Notes

- Workspace rail should feel like a systems register.
- Inspector should read like a parameter sheet.
- Dialogs should feel precise and transactional.
- Node cards should look like modules in a plan, not sticky-note toys.

## State Semantics

- selected: accent border + subtle accent wash
- running: success dot + restrained emphasis
- warning: amber dot + localized callout only
- failed: red indicator, never full-card saturation
- idle: neutral, low-noise metadata
