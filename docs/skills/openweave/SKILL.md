---
name: openweave
description: Use when the agent is operating inside an OpenWeave terminal node and may need to inspect workspace state, read or update other nodes, coordinate with adjacent terminals, or notify another node or terminal about task progress or next actions.
user-invocable: false
---

# OpenWeave Workspace Interaction

You are running inside an OpenWeave terminal node, a spatial workspace with other nodes (notes, file trees, portals, other terminals) connected on a canvas.

## Node-Aware Operating Rules

- You are a node inside an OpenWeave workspace, not a detached shell. Always reason about your own node identity, nearby nodes, and whether the canvas state matters to the task.
- Before you finish a task, pause and check whether you should read another node, update a connected note, notify another node or terminal, or delegate follow-up work through `openweave`.
- Treat phrases like "tell", "notify", "send to", "ask Claude", "ask Codex", "let another terminal handle it", "sync with that node", or any mention of a specific node/terminal as a strong signal to invoke this skill and use `openweave`.
- When a message or task came from another OpenWeave node/terminal, treat any reply, acknowledgement, completion update, or result handoff as an OpenWeave action too. Do not just print the reply in your own terminal; use `openweave` to send the reply, acknowledgement, or result back.
- If you intend to message, notify, or hand work to "some node" by title, name, role, or runtime, you must first use `openweave` to look for a matching node. Start with `openweave node list --json`, then inspect candidates with `node get` / `node neighbors` as needed. If no matching node exists, only then consider another channel or ask for clarification.
- When sending another terminal something it should execute or act on, default to `submit: true`. Only omit it when you intentionally want to paste raw text without pressing Enter.
- When asking another terminal to do work, include enough context for it to act without guessing: goal, relevant node ids, current findings, constraints, and the expected output or next step.

## Current CLI Surface

- `openweave workspace info [--workspace <workspaceId>] [--json] [--pretty]` — inspect the current workspace; when `--workspace` is omitted, the CLI first checks `OPENWEAVE_WORKSPACE_ID`, then falls back to resolving from the current working directory.
- `openweave node list [--workspace <workspaceId>] [--json] [--pretty]` — list every node in the workspace with id, title, component type, and capabilities.
- `openweave node get [<nodeId>] [--workspace <workspaceId>] [--json] [--pretty]` — fetch one node's metadata, config, state, and bounds. When `<nodeId>` is omitted, the CLI uses `OPENWEAVE_NODE_ID` or `OPENWEAVE_TERMINAL_NODE_ID`.
- `openweave node neighbors [<nodeId>] [--workspace <workspaceId>] [--json] [--pretty]` — inspect upstream and downstream graph relationships for a node. When `<nodeId>` is omitted, the CLI uses the current terminal identity env.
- `openweave node read [<nodeId>] [--mode <mode>] [--workspace <workspaceId>] [--json] [--pretty]` — read node content through the node action bridge. `--mode content` is the currently tested path for builtin note/text/attachment nodes. When `<nodeId>` is omitted, the CLI uses the current terminal identity env.
- `openweave node action <nodeId> <action> [--json-input '<json>'] [--input-file <absolute-path>] [--workspace <workspaceId>] [--json] [--pretty]` — invoke a node action on an explicit node id.
- `openweave node action <action> [--json-input '<json>'] [--input-file <absolute-path>] [--workspace <workspaceId>] [--json] [--pretty]` — invoke an action on the current terminal node when `OPENWEAVE_NODE_ID` / `OPENWEAVE_TERMINAL_NODE_ID` is present. Explicit CLI args always override env fallback.

## Useful Patterns

- Current workspace metadata: `openweave workspace info --json`
- All canvas nodes: `openweave node list --json`
- Current terminal node details: `openweave node get --json`
- Resolve a target terminal before messaging or notifying it: `openweave node list --json`
- Confirm the exact target node before replying or reporting back: `openweave node get <nodeId> --json`
- Read the current terminal's connected context after resolving a neighbor id: `openweave node read <nodeId> --mode content --json`
- Update a Note node: `openweave node action <noteId> write --json-input '{"content":"hello"}' --json`
- Send input to another terminal node: `openweave node action <terminalNodeId> send --json-input '{"input":"echo hello\\n"}' --json`
- Send input to the current terminal node: `openweave node action send --json-input '{"input":"pwd\\n"}' --json`
- Send input and press Enter in one step: `openweave node action <terminalNodeId> send --json-input '{"input":"echo hello","submit":true}' --json`
- Press Enter without sending extra text: `openweave node action <terminalNodeId> submit --json`
- Send a contextual task handoff to another terminal: `openweave node action <terminalNodeId> send --json-input '{"input":"Please inspect node node-note-1. Context: we are debugging terminal dispatch. Return a short summary.","submit":true}' --json`

## Notes

- Prefer `--json` when another agent or script needs structured output; add `--pretty` for easier manual inspection.
- `node action` support is component-specific. The current codebase verifies read access for `builtin.note`, `builtin.text`, and `builtin.attachment`; verifies the `write` action for `builtin.note`; and verifies `send` / `input` / `submit` / `enter` for `builtin.terminal`.
- The CLI also exposes `openweave component list|install|uninstall`, but workspace graph work inside terminals is usually done through the `workspace` and `node` commands above.
- OpenWeave terminals inject identity env automatically: `OPENWEAVE_WORKSPACE_ID`, `OPENWEAVE_NODE_ID`, `OPENWEAVE_TERMINAL_NODE_ID`, `OPENWEAVE_WORKSPACE_ROOT`, and `OPENWEAVE_TERMINAL_WORKING_DIR`. Use these when you need to reason about "who am I" on the canvas.
- For terminal automation, prefer `{"input":"...","submit":true}` when you mean "type text and press Enter". Raw `\n` inside `input` is preserved as text/newline data and is not the same as a PTY Enter keypress.
- For terminal-to-terminal coordination, the safe default is: include enough context and default to `submit: true`.

The `openweave` CLI is pre-installed and available on PATH inside OpenWeave terminals. If `openweave` is not found on PATH (for example, a custom shell startup resets PATH), use `"$OPENWEAVE_CLI"` instead — this environment variable always points to the full CLI wrapper path.

## Terminal Input Hook

Other nodes can send messages to your terminal. These messages arrive as keyboard input (via `term.onData`). When you want the remote terminal to actually execute a command, prefer `send` with `submit: true` or the explicit `submit` / `enter` action so the PTY receives a real Enter keypress.

If you are preparing a response to another OpenWeave node or terminal, do not stop at printing the response locally. Resolve the target node through `openweave`, then send the reply or status update back through `openweave node action ... send`.

## Connected Notes

Notes connected to your terminal can be read and written. Changes are reflected on the canvas in real-time. Notes support Markdown.
