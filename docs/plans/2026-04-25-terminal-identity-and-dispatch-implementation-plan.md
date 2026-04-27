# Terminal Identity And Dispatch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make each OpenWeave terminal process aware of its bound workspace/node identity and let `openweave` CLI default to that identity while still allowing explicit overrides, plus add terminal-node input dispatch through `openweave node action`.

**Architecture:** Keep the current additive Phase 2 shape: terminal runs still launch through `runs` IPC + runtime bridge, and `openweave` CLI still uses the local workspace/node bridge for graph queries. Add per-run identity env injection at runtime launch, add CLI env fallback in argument parsing, and add a lightweight terminal-dispatch queue persisted in workspace DB so CLI-originated terminal sends can be delivered by the registered runs service without introducing a socket or headless bridge server.

**Tech Stack:** Electron main/worker TypeScript, React renderer, sqlite workspace repositories, existing `runs` service/runtime bridge, Vitest.

---

### Task 1: Add failing tests for terminal identity env injection

**Files:**
- Modify: `tests/unit/main/runs-ipc.test.ts`
- Modify: `tests/integration/main/runs-ipc.test.ts`

**Step 1: Write the failing tests**

Cover:
- run start forwards `OPENWEAVE_WORKSPACE_ID`, `OPENWEAVE_NODE_ID`, and terminal identity env into the runtime start request
- registered runs handlers use workspace root / working dir plus identity env when starting a terminal

**Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/unit/main/runs-ipc.test.ts tests/integration/main/runs-ipc.test.ts
```

Expected: FAIL because the current runtime launch env has no per-terminal identity injection.

### Task 2: Add failing tests for CLI identity fallback

**Files:**
- Modify: `tests/unit/cli/workspace-node-cli.test.ts`
- Modify: `tests/integration/cli/openweave-wrapper.test.ts`

**Step 1: Write the failing tests**

Cover:
- `workspace info` uses `OPENWEAVE_WORKSPACE_ID` when `--workspace` is omitted
- `node get/read/neighbors` use `OPENWEAVE_NODE_ID` when node id is omitted
- `node action <action>` uses current terminal identity when node id is omitted
- explicit CLI args still override env fallback

**Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/unit/cli/workspace-node-cli.test.ts tests/integration/cli/openweave-wrapper.test.ts
```

Expected: FAIL because the current CLI requires explicit node ids and only resolves workspace from `--workspace`/`cwd`.

### Task 3: Add failing tests for terminal dispatch queue delivery

**Files:**
- Modify: `tests/integration/main/workspace-node-query-service.test.ts`
- Modify: `tests/integration/main/runs-ipc.test.ts`
- Modify: `tests/integration/main/bridge-cli-roundtrip.test.ts`

**Step 1: Write the failing tests**

Cover:
- `runNodeAction({ action: 'send' })` on a `builtin.terminal` node persists a dispatch request
- registered runs handlers deliver pending dispatches into the active run for that terminal node
- CLI can trigger terminal dispatch through `openweave node action <terminalNodeId> send --json-input ...`

**Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/integration/main/workspace-node-query-service.test.ts tests/integration/main/runs-ipc.test.ts tests/integration/main/bridge-cli-roundtrip.test.ts
```

Expected: FAIL because terminal-node actions are currently unsupported and no dispatch queue exists.

### Task 4: Implement identity env injection minimally

**Files:**
- Create: `src/main/terminal/terminal-identity.ts`
- Modify: `src/shared/ipc/schemas.ts`
- Modify: `src/renderer/features/canvas/nodes/TerminalNode.tsx`
- Modify: `src/main/ipc/runs.ts`

**Step 1: Write minimal implementation**

Implement:
- additive optional `projectDir` on `RunStartInput`
- a helper that builds terminal identity env from workspace id, node id, workspace root, working dir, and project dir
- merge that env into each runtime launch request in the runs service

**Step 2: Run tests to verify it passes**

Run:
```bash
npm test -- tests/unit/main/runs-ipc.test.ts tests/integration/main/runs-ipc.test.ts tests/unit/renderer/terminal-node.test.ts
```

Expected: PASS

### Task 5: Implement CLI env fallback minimally

**Files:**
- Modify: `src/cli/index.ts`
- Modify: `docs/skills/openweave/SKILL.md`
- Modify: `docs/skills/openweave/SKILL.zh-CN.md`

**Step 1: Write minimal implementation**

Implement:
- env fallback helpers for workspace/node identity
- positional parsing rules that prefer explicit args but fall back to current terminal identity
- docs updates for the new default behavior and identity env variables

**Step 2: Run tests to verify it passes**

Run:
```bash
npm test -- tests/unit/cli/workspace-node-cli.test.ts tests/integration/cli/openweave-wrapper.test.ts
```

Expected: PASS

### Task 6: Implement terminal dispatch queue and builtin terminal action adapter

**Files:**
- Modify: `src/main/db/workspace.ts`
- Create: `src/main/components/action-adapters/builtin-terminal-action-adapter.ts`
- Modify: `src/main/components/component-action-dispatcher.ts`
- Modify: `src/main/components/component-action-adapter-registry.ts`
- Modify: `src/main/bridge/workspace-node-query-service.ts`
- Modify: `src/main/ipc/runs.ts`

**Step 1: Write minimal implementation**

Implement:
- a persisted pending-dispatch queue in workspace DB
- a `builtin.terminal` adapter that accepts `send`/`input` actions with payload text
- runs-service delivery that drains pending terminal dispatches into the active run for the target terminal node

**Step 2: Run tests to verify it passes**

Run:
```bash
npm test -- tests/integration/main/workspace-node-query-service.test.ts tests/integration/main/runs-ipc.test.ts tests/integration/main/bridge-cli-roundtrip.test.ts
```

Expected: PASS

### Task 7: Run focused regression verification

**Files:**
- Verify only

**Step 1: Run focused verification**

Run:
```bash
npm test -- \
  tests/unit/main/runs-ipc.test.ts \
  tests/integration/main/runs-ipc.test.ts \
  tests/unit/cli/workspace-node-cli.test.ts \
  tests/integration/main/workspace-node-query-service.test.ts \
  tests/integration/main/bridge-cli-roundtrip.test.ts \
  tests/integration/cli/openweave-wrapper.test.ts \
  tests/unit/main/app-skill-manager.test.ts
```

Expected: PASS

**Step 2: Run build verification**

Run:
```bash
npm run build:main
```

Expected: exit 0
