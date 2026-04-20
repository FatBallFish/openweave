# Shared Component Rules

## Shell Hierarchy

Always prioritize visual attention in this order:

1. active graph work
2. active run state and selected node state
3. inspector and drawer content
4. navigation and secondary chrome

If navigation or decorative backgrounds compete with the graph, reduce them.

## Shared Anatomy

### Workspace Shell
- Top bar: global actions, search, high-level status only
- Left rail: workspace switching, flow grouping, compact signals
- Center: primary canvas
- Right inspector: properties and context for the selected item
- Lower drawer: run details, terminal state, validation output

### Node Cards
- Include a clear header, type marker, and content body
- Keep card internals optimized for the node's real function
- Prefer consistent outer structure with function-specific inner content

### Inspector
- Treat as an editable control panel, not a document page
- Group metadata, editable fields, and actions separately
- Keep field density high but scannable

### Run Drawer
- Show live stream, current status, and decision gates
- Keep it attached to the active workflow context
- Avoid turning it into a giant full-screen console unless explicitly requested

## Spacing and Shape

- Use small-to-medium radii; avoid bubbly shapes
- Use spacing to create rhythm before using color blocks
- Let node groups breathe, especially around portal / terminal / file-tree combinations

## State Rules

Every new UI surface should define these states explicitly:

- default
- hover
- selected / focused
- running / active
- warning / attention
- failed / error
- disabled when relevant

If a design proposal cannot explain these states, it is incomplete.

## Do / Don't

### Do
- preserve the infinite canvas as the primary work surface
- use restrained emphasis
- make operational states obvious
- keep bright and dark themes semantically aligned
- design for note, terminal, portal, and file-tree nodes as one family

### Don't
- design one-off visual languages per feature
- copy generic startup dashboards
- overuse blur, glow, or oversized shadows
- turn dialogs into marketing cards
- hide important status in low-contrast helper text

## Prompting Pattern

When using this skill for UI generation or review, explicitly state:

- target surface
- target theme: Blueprint Canvas or Slate Terminal
- whether the task is create, refactor, or review
- required states that must be visible
- whether parity with the opposite theme is required
