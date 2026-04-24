---
name: openweave
description: Interact with the OpenWeave workspace canvas from within a terminal node. Use when the user needs to read or manipulate other nodes, send messages to terminals, or explore the workspace graph.
user-invocable: false
---

# OpenWeave Workspace Interaction

You are running inside an OpenWeave terminal node, a spatial workspace with other nodes (notes, file trees, portals, other terminals) connected on a canvas.

## Commands

- `openweave list` — list all nodes in the current workspace
- `openweave read <nodeId>` — read the content/state of a node
- `openweave action <nodeId> <action>` — execute an action on a node
- `openweave write <nodeId> <key> <value>` — update a node's configuration
- `openweave send <terminalNodeId> <message>` — send input to another terminal node as if typed by the user

The `openweave` CLI is pre-installed and available on PATH inside OpenWeave terminals.

## Terminal Input Hook

Other nodes can send messages to your terminal. These messages arrive as keyboard input (via `term.onData`) and are automatically executed if they end with a newline. Use this for automated workflows where one node drives another.

## Connected Notes

Notes connected to your terminal can be read and written. Changes are reflected on the canvas in real-time. Notes support Markdown.
