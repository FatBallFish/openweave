# Component Action Dispatcher Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introduce a generic component action dispatcher so `node read` / `node action` no longer hardcode per-component logic in the workspace-node service, while keeping Phase 1 runtime support limited to `builtin.note`.

**Architecture:** Add a dispatcher layer plus adapter registry in main process. `workspace-node-query-service` resolves workspace/node context and delegates execution to the dispatcher. The dispatcher selects a component adapter by `componentType`, normalizes unsupported cases, and lets adapters own component-local action behavior.

**Tech Stack:** TypeScript, Node.js, Vitest, existing graph v2 workspace repository, existing CLI/service bridge.

---

### Task 1: Add dispatcher RED tests

**Files:**
- Create: `tests/unit/main/component-action-dispatcher.test.ts`
- Reference: `src/main/components/component-action-dispatcher.ts`
- Reference: `src/main/components/action-adapters/builtin-note-action-adapter.ts`

**Step 1: Write the failing test**
- Cover dispatcher read for `builtin.note`
- Cover dispatcher write persistence callback
- Cover unsupported component type / unsupported action / unsupported mode

**Step 2: Run test to verify it fails**
Run: `npx vitest run tests/unit/main/component-action-dispatcher.test.ts`
Expected: FAIL because dispatcher and adapter files do not exist yet.

**Step 3: Write minimal implementation**
- Create dispatcher file
- Create builtin note adapter file
- Implement only the logic needed by the tests

**Step 4: Run test to verify it passes**
Run: `npx vitest run tests/unit/main/component-action-dispatcher.test.ts`
Expected: PASS

### Task 2: Move workspace-node service to dispatcher

**Files:**
- Modify: `src/main/bridge/workspace-node-query-service.ts`
- Test: `tests/integration/main/workspace-node-query-service.test.ts`

**Step 1: Write the failing test**
- Extend service integration tests so note read/write and unsupported type paths still pass through the public service API after refactor.

**Step 2: Run test to verify it fails**
Run: `npx vitest run tests/integration/main/workspace-node-query-service.test.ts`
Expected: FAIL if dispatcher wiring is missing.

**Step 3: Write minimal implementation**
- Build action context from resolved node/graph/repository
- Delegate read/action to dispatcher
- Keep existing query methods untouched

**Step 4: Run test to verify it passes**
Run: `npx vitest run tests/integration/main/workspace-node-query-service.test.ts`
Expected: PASS

### Task 3: Keep CLI behavior stable on top of dispatcher

**Files:**
- Modify: `src/cli/index.ts`
- Modify: `src/cli/commands/workspace.ts`
- Test: `tests/unit/cli/workspace-node-cli.test.ts`
- Test: `tests/integration/main/bridge-cli-roundtrip.test.ts`

**Step 1: Write the failing test**
- Add regression assertions for:
  - `node read --mode content`
  - unsupported mode => `NODE_ACTION_NOT_SUPPORTED`
  - `node action --json-input`
  - `node action --input-file`
  - persisted write then subsequent read

**Step 2: Run test to verify it fails**
Run: `npx vitest run tests/unit/cli/workspace-node-cli.test.ts tests/integration/main/bridge-cli-roundtrip.test.ts`
Expected: FAIL if dispatcher integration or parser behavior regresses.

**Step 3: Write minimal implementation**
- Adjust any typing/call wiring only if required by dispatcher split
- Keep JSON/text envelope stable

**Step 4: Run test to verify it passes**
Run: `npx vitest run tests/unit/cli/workspace-node-cli.test.ts tests/integration/main/bridge-cli-roundtrip.test.ts`
Expected: PASS

### Task 4: Slice verification

**Files:**
- Verify only

**Step 1: Run targeted full slice verification**
Run: `npx vitest run tests/unit/main/component-action-dispatcher.test.ts tests/integration/main/workspace-node-query-service.test.ts tests/integration/main/bridge-cli-roundtrip.test.ts tests/unit/cli/workspace-node-cli.test.ts tests/unit/cli/component-cli.test.ts`
Expected: PASS

**Step 2: Run build verification**
Run: `npm run build:main`
Expected: PASS

**Step 3: Review gates**
- spec review: dispatcher scope, unsupported behavior, stable CLI envelopes
- code quality review: adapter boundary, no hidden hardcoding in service, no parser regressions

### Task 5: Defer list for next slice

**Files:**
- Document in final response only

**Step 1: Record deferred items**
- external/custom worker-backed adapter
- manifest action existence validation
- timeout/idempotency/audit policy
- builtin text/attachment adapters
