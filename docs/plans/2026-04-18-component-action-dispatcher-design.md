# Component Action Dispatcher Design

**Context**
- Current Phase 1 already has graph v2 persistence, workspace/node read-only query service, and minimal `node read` / `node action` CLI support.
- Runtime action execution is still hardcoded inside `workspace-node-query-service.ts` for `builtin.note`, which does not scale to more builtin actions or future external/custom component actions.
- We need a shared dispatch layer that keeps the current Phase 1 loop working while reserving stable extension points for builtin adapters and future external/custom executors.

**Goal**
- Introduce a generic component action dispatcher that decouples `workspace-node-query-service` from per-component action logic.
- Keep Phase 1 delivery tight: only `builtin.note` actually executes actions now.
- Make later support for `builtin.text`, `builtin.attachment`, and external/custom component actions additive instead of requiring another main-path refactor.

---

## 1. Recommended Architecture

### 1.1 Core split
- `workspace-node-query-service` keeps only workspace resolution, graph loading/saving coordination, and node lookup.
- New `component-action-dispatcher` becomes the single action orchestration entry.
- Per-component action logic moves behind adapter interfaces.

### 1.2 Layers
- `NodeActionContext`
  - current workspace id
  - current graph snapshot
  - target node
  - repository handle / save callback
  - optional registry metadata for later external/custom use
- `ComponentActionDispatcher`
  - validates node/action request
  - resolves adapter by `componentType`
  - routes `read` / `action`
  - normalizes errors (`NODE_NOT_FOUND`, `NODE_ACTION_NOT_SUPPORTED`)
- `ComponentActionAdapter`
  - component-local logic only
  - no workspace lookup logic
  - no CLI parsing logic

### 1.3 Initial adapter registry
- `builtin.note` adapter: real implementation
- fallback adapter path: unsupported => `NODE_ACTION_NOT_SUPPORTED`
- external/custom adapter registry hook: interface present, implementation deferred

---

## 2. Interface Design

### 2.1 Dispatcher contract
```ts
interface ComponentActionDispatcher {
  read(input: {
    workspaceId: string;
    nodeId: string;
    mode?: string;
  }): GraphNodeReadResponse;

  action(input: {
    workspaceId: string;
    nodeId: string;
    action: string;
    payload?: Record<string, unknown>;
  }): GraphNodeActionResponse;
}
```

### 2.2 Adapter contract
```ts
interface ComponentActionAdapter {
  supports(componentType: string): boolean;

  read?(context: NodeActionContext, input: { mode?: string }): GraphNodeReadResponse;

  action?(context: NodeActionContext, input: {
    action: string;
    payload?: Record<string, unknown>;
  }): GraphNodeActionResponse;
}
```

### 2.3 Context contract
```ts
interface NodeActionContext {
  workspaceId: string;
  graph: GraphSnapshotV2Input;
  node: GraphSnapshotV2Input['nodes'][number];
  saveGraph: (nextGraph: GraphSnapshotV2Input) => void;
}
```

### 2.4 Why this split
- `dispatcher` owns shared orchestration and compatibility surface.
- `adapter` owns component-specific action semantics.
- `context` is the seam that later lets us inject registry metadata, manifest-driven worker execution, audit logging, and action timeouts without rewriting every adapter.

---

## 3. Phase 1 Compatibility Strategy

### 3.1 What this slice really supports
- `builtin.note`
  - `read`
  - `write`
- CLI stays unchanged from the user perspective.
- Response envelopes stay exactly as current spec-compliant shapes.

### 3.2 What is deferred but explicitly reserved
- manifest-driven action validation
- external/custom worker execution
- request id / idempotency enforcement
- action timeout policy
- audit logging for dangerous actions
- adapter auto-registration from installed component packages

### 3.3 Compatibility rule
- If no adapter is registered for a component type, dispatcher returns `NODE_ACTION_NOT_SUPPORTED`.
- If adapter exists but requested action/mode is unsupported, dispatcher also returns `NODE_ACTION_NOT_SUPPORTED`.
- This keeps future expansion backward-compatible for AI/CLI callers.

---

## 4. Builtin Note Adapter Rules

### 4.1 `read`
- allowed only when node has `read` capability
- supported modes:
  - omitted
  - `content`
- response:
```json
{
  "nodeId": "node_note_1",
  "action": "read",
  "result": {
    "content": "# hello"
  }
}
```

### 4.2 `write`
- allowed only when node has `write` capability
- payload must contain `content: string`
- updates `node.state.content`
- updates `updatedAtMs`
- persists entire graph through repository save
- response:
```json
{
  "nodeId": "node_note_1",
  "action": "write",
  "ok": true,
  "result": {
    "updated": true
  }
}
```

---

## 5. External/Custom Action Compatibility Hook

We will not execute external/custom actions yet, but the dispatcher must make that path straightforward later.

### 5.1 Reserved extension points
- adapter registry accepts multiple adapters
- add future `manifest-backed external adapter`
- future adapter can use:
  - component registry lookup by `componentType + componentVersion`
  - manifest action metadata (`actions[]`)
  - worker / sandbox execution bridge

### 5.2 Future shape
- `ExternalComponentActionAdapter`
  - resolves installed component package
  - validates requested action exists in manifest
  - delegates to worker-backed executor
  - maps worker result to stable CLI envelope

This means later work should only add adapters or supporting dependencies, not rewrite the service or CLI surface.

---

## 6. File Plan

### New files
- `src/main/components/component-action-dispatcher.ts`
- `src/main/components/action-adapters/builtin-note-action-adapter.ts`

### Modified files
- `src/main/bridge/workspace-node-query-service.ts`
- `src/cli/index.ts` (only if dispatcher integration requires small call shape cleanup)
- `src/cli/commands/workspace.ts` (only if dispatcher integration changes service typing)
- `tests/unit/cli/workspace-node-cli.test.ts`
- `tests/integration/main/workspace-node-query-service.test.ts`
- `tests/integration/main/bridge-cli-roundtrip.test.ts`
- optionally unit tests for dispatcher/adapter under `tests/unit/main/`

---

## 7. Test Strategy

### 7.1 Dispatcher unit tests
- resolves `builtin.note` adapter for note node
- unsupported component type => `NODE_ACTION_NOT_SUPPORTED`
- unsupported mode/action => `NODE_ACTION_NOT_SUPPORTED`
- write action persists updated graph through save callback

### 7.2 Service integration tests
- service uses dispatcher for note read/write
- existing workspace/node query behavior unchanged
- unsupported terminal action still fails with stable code

### 7.3 CLI tests
- `node read --mode content`
- `node read --mode summary` => non-zero with `NODE_ACTION_NOT_SUPPORTED`
- `node action ... --json-input`
- `node action ... --input-file`
- regression for component CLI path still passing

---

## 8. Non-Goals For This Slice
- No worker-backed external component execution
- No automatic builtin manifest registration in main startup
- No audit pipeline yet
- No timeout policy yet
- No generic schema validation against manifest JSON schemas yet

---

## 9. Decision Summary
- Adopt a generic dispatcher plus adapter registry now.
- Keep only `builtin.note` as the real adapter in this slice.
- Make unsupported/custom/external behavior explicit rather than pretending to support it.
- Preserve the current CLI contract while creating a stable extension seam for later component action growth.
