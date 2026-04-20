# Slate Terminal

## Theme Intent

Use Slate Terminal when the UI should feel like an execution console for agents, runs, logs, and intervention-heavy workflows.

Keywords: low-light, runtime-native, focused, operational, developer-friendly.

## Core Tokens

- Typography
  - UI: `Public Sans` or `IBM Plex Sans`
  - Mono: `JetBrains Mono`
- Base colors
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

## Layout Character

- Use the same shell structure as bright mode to preserve mental continuity.
- Reduce decorative contrast; dark mode must feel calm, not cyberpunk.
- Keep panels separated by border and tonal step, not by dramatic glow.
- Let terminal output and run state carry the visual energy.

## Canvas Rules

- Use a darker, quieter grid than bright mode.
- Keep edges readable, but softer than active content.
- Bright blue should be rare and meaningful.
- Node selection can be stronger than in bright mode, but avoid neon bloom.

## Component Notes

- Run drawer and terminal sessions should feel native in this theme.
- Portal and file-tree cards must stay readable against dark node surfaces.
- Inspector should look like a runtime control module, not a glossy sidebar.
- Top bar should feel like an IDE command strip, not an admin dashboard.

## State Semantics

- selected: stronger border + controlled accent wash
- running: green dot and active status chip
- warning: amber signal; avoid full amber fills
- failed: red signal with high contrast text support
- idle: desaturated neutral surfaces with clear borders
