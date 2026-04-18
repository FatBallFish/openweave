# OpenWeave V2 Remaining Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining high-priority Phase 1 gaps on top of the already-landed kernel foundation, so the refactor can move from "core substrate exists" to "AI runtime chain is actually usable end-to-end".

**Architecture:** Keep the current direction: reuse the landed Graph Schema V2, Component Manifest V1, Component Registry / Installer, workspace-node local bridge service, and `openweave` CLI. Do not restart Phase 1 from scratch. Focus this session on the missing runtime-facing chain: Skill Pack generation, workspace-level injection lifecycle, Runtime Adapter completion with OpenCode, and one demo/mock component for framework closure. Treat socket / named-pipe / full headless serve as deferred unless the codebase proves a tiny extraction is necessary.

**Tech Stack:** Electron main/worker process TypeScript, existing sqlite repositories, local filesystem templating, Vitest unit/integration tests, existing CLI and runtime worker.

---

## Context Baseline

Before touching code, assume the following slices are already accepted on branch `feat/phase1-kernel-shared`:

1. Graph Schema V2 + shared contracts
2. Component Manifest V1
3. Component Registry
4. Component Installer (directory / zip)
5. `openweave` CLI core commands
6. Local embedded workspace/node bridge service
7. Generic component action dispatcher
8. Builtin action adapters for:
   - `builtin.note` read/write
   - `builtin.text` read
   - `builtin.attachment` read

This plan is for the **remaining Phase 1 work only**. Do not churn already-accepted slices unless a direct blocker appears.

## Session Scope

### In Scope

1. Skill Pack Manager
2. Workspace Skill Injection Manager
3. Runtime Adapter completion, including OpenCode first-class support
4. Minimal demo/mock component to validate framework closure
5. Phase 1 exit verification and doc backfill

### Out of Scope

1. Full socket / named-pipe agent bridge server
2. Full headless `openweave serve`
3. Builtin component product UI rewrite
4. Canvas Shell V2 migration
5. npm package install source

### Hard Constraints

1. Do not work on `main`.
2. Do not revert unrelated dirty changes.
3. Builtin component names must remain protected from third-party override.
4. OpenCode is first-class, not beta.
5. Local directory / zip install stays as Phase 1 install scope.
6. Preserve existing accepted CLI envelopes and existing accepted error behavior unless the plan explicitly calls for a contract change.

## Task 1: Re-baseline the branch before implementation

**Files to read:**
- `docs/prd/2026-04-18-openweave-prd-v2-refactor.md`
- `docs/tech-design/2026-04-18-openweave-tech-design-v2-refactor.md`
- `docs/plans/2026-04-18-openweave-refactor-execution-plan.md`
- `docs/plans/2026-04-18-openweave-phase1-kernel-spec.md`
- `docs/plans/2026-04-18-component-action-dispatcher-design.md`
- `docs/plans/2026-04-18-component-action-dispatcher-implementation-plan.md`

**Files to inspect:**
- `src/cli/*`
- `src/main/bridge/workspace-node-query-service.ts`
- `src/main/components/*`
- `src/shared/ipc/schemas.ts`
- `src/worker/runtime-worker.ts`

**Step 1: Review current completion state**

Write down a short checklist of:
- already accepted slices
- missing Phase 1 slices
- any blocker that would invalidate this plan

**Step 2: Stop if a structural blocker appears**

If docs and code disagree on a way that changes scope, stop and report before implementing.

**Step 3: Create the execution todo list**

Use the tasks below as the only execution scope for this session.

## Task 2: Implement Skill Pack Manager

**Goal:** Generate runtime-specific workspace guidance/config files for Codex, Claude, and OpenCode from one main-process entry.

**Files:**
- Create: `src/main/skills/skill-pack-manager.ts`
- Create: `src/main/skills/templates/*`
- Create: `tests/unit/main/skill-pack-manager.test.ts`
- Modify if needed: `src/shared/ipc/contracts.ts`

**Step 1: Write the failing tests**

Cover:
- Codex output includes `AGENTS.md` and `.agents/skills/...`
- Claude output includes `.claude/skills/...`
- OpenCode output includes `AGENTS.md` and `.opencode/...`
- repeated generation is deterministic for same inputs
- failed write / invalid template path produces a stable error

**Step 2: Run tests to verify RED**

Run:
```bash
npx vitest run tests/unit/main/skill-pack-manager.test.ts
```

Expected: FAIL because manager/template implementation does not exist yet.

**Step 3: Write minimal implementation**

Implement:
- one manager entry
- runtime-specific template mapping
- deterministic render inputs:
  - workspace id
  - workspace root
  - bridge/CLI usage hints
  - runtime kind

**Step 4: Run tests to verify GREEN**

Run:
```bash
npx vitest run tests/unit/main/skill-pack-manager.test.ts
```

Expected: PASS

## Task 3: Implement Workspace Skill Injection Manager

**Goal:** Bind skill-pack generation to workspace/runtime lifecycle and avoid repeated dirty writes.

**Files:**
- Create: `src/main/skills/workspace-skill-injection-manager.ts`
- Modify: `src/main/db/migrations/workspace/001_init.sql` or add a new migration if needed
- Modify: `src/main/db/workspace.ts`
- Create: `tests/integration/main/workspace-skill-injection-manager.test.ts`
- Create: `tests/unit/main/workspace-skill-injection-manager.test.ts`

**Step 1: Write the failing tests**

Cover:
- injection writes managed files into workspace root
- second prepare with same checksum does not rewrite
- template/runtime change marks stale injection and updates files
- cleanup only removes OpenWeave-managed files

**Step 2: Run tests to verify RED**

Run:
```bash
npx vitest run tests/unit/main/workspace-skill-injection-manager.test.ts tests/integration/main/workspace-skill-injection-manager.test.ts
```

Expected: FAIL because manager/persistence support does not exist yet.

**Step 3: Write minimal implementation**

Implement:
- prepare-before-runtime-launch
- checksum-based staleness detection
- managed-file manifest or equivalent narrow ownership model
- workspace-level persistence for injection metadata

**Step 4: Run tests to verify GREEN**

Run:
```bash
npx vitest run tests/unit/main/workspace-skill-injection-manager.test.ts tests/integration/main/workspace-skill-injection-manager.test.ts
```

Expected: PASS

## Task 4: Complete Runtime Adapter abstraction and OpenCode support

**Goal:** Finish the runtime matrix promised by V2 docs: `shell`, `codex`, `claude`, `opencode`, with injection preflight included in the launch path.

**Files:**
- Create: `src/worker/adapters/opencode-runtime.ts`
- Modify: `src/worker/runtime-worker.ts`
- Modify: `src/shared/ipc/schemas.ts`
- Modify: `src/main/runtime/runtime-bridge.ts`
- Modify if needed: terminal/run launch path in main process
- Create or extend: `tests/unit/worker/runtime-adapters.test.ts`
- Create or extend: `tests/integration/main/runtime-launch.test.ts`

**Step 1: Write the failing tests**

Cover:
- `runRuntimeSchema` accepts `opencode`
- runtime worker routes `opencode`
- runtime launch performs skill-injection preflight before spawn
- invalid runtime still fails with stable coded error

**Step 2: Run tests to verify RED**

Run:
```bash
npx vitest run tests/unit/worker/runtime-adapters.test.ts tests/integration/main/runtime-launch.test.ts
```

Expected: FAIL because OpenCode and preflight wiring are incomplete.

**Step 3: Write minimal implementation**

Implement:
- `opencode` launcher
- runtime schema expansion
- launch path hook that prepares workspace injection before runtime process start
- preserve existing shell/codex/claude behavior

**Step 4: Run tests to verify GREEN**

Run:
```bash
npx vitest run tests/unit/worker/runtime-adapters.test.ts tests/integration/main/runtime-launch.test.ts
```

Expected: PASS

## Task 5: Add one demo/mock component to validate the framework

**Goal:** Prove the component framework is not only for builtin/static code paths.

**Files:**
- Create: `tests/fixtures/components/demo-echo/*`
- Modify: `tests/integration/main/component-installer.test.ts`
- Create if needed: `tests/integration/main/demo-component-roundtrip.test.ts`
- Modify if needed: `src/main/components/component-installer.ts`
- Modify if needed: `src/main/components/component-registry.ts`

**Step 1: Write the failing tests**

Cover:
- install demo component from directory or zip
- component appears in list
- graph/runtime can resolve its manifest metadata
- one minimal read/write/echo action closure, if framework surface allows it without large new infrastructure

**Step 2: Run tests to verify RED**

Run:
```bash
npx vitest run tests/integration/main/component-installer.test.ts tests/integration/main/demo-component-roundtrip.test.ts
```

Expected: FAIL because the demo fixture/closure test does not exist yet.

**Step 3: Write minimal implementation**

Prefer validating through existing installer/registry/CLI surfaces. Do not invent a larger plugin runtime just for the demo.

**Step 4: Run tests to verify GREEN**

Run:
```bash
npx vitest run tests/integration/main/component-installer.test.ts tests/integration/main/demo-component-roundtrip.test.ts
```

Expected: PASS

## Task 6: Phase 1 exit verification and doc backfill

**Goal:** End the session with a clean statement of what Phase 1 now covers and what is intentionally deferred.

**Files:**
- Modify: `docs/plans/2026-04-18-openweave-refactor-execution-plan.md`
- Modify if needed: `docs/plans/2026-04-18-openweave-phase1-kernel-spec.md`
- Modify if needed: `docs/tech-design/2026-04-18-openweave-tech-design-v2-refactor.md`

**Step 1: Run the focused Phase 1 verification batch**

Run at minimum:
```bash
npx vitest run \
  tests/unit/main/component-action-dispatcher.test.ts \
  tests/unit/main/component-action-adapter-registry.test.ts \
  tests/unit/main/skill-pack-manager.test.ts \
  tests/unit/main/workspace-skill-injection-manager.test.ts \
  tests/unit/worker/runtime-adapters.test.ts \
  tests/unit/cli/workspace-node-cli.test.ts \
  tests/unit/cli/component-cli.test.ts \
  tests/integration/main/component-installer.test.ts \
  tests/integration/main/workspace-node-query-service.test.ts \
  tests/integration/main/bridge-cli-roundtrip.test.ts \
  tests/integration/main/workspace-skill-injection-manager.test.ts \
  tests/integration/main/runtime-launch.test.ts \
  tests/integration/main/demo-component-roundtrip.test.ts
```

Expected: PASS

**Step 2: Run build verification**

Run:
```bash
npm run build:main
```

Expected: PASS

**Step 3: Update docs**

Backfill:
- what is now complete in Phase 1
- what remains explicitly deferred to Phase 2 / 3 / 4
- any contract changes introduced by the session

**Step 4: Final review gates**

Perform:
- spec compliance review
- code quality review

Do not call the session complete until both are green or explicitly dispositioned.

## Exit Criteria For This Session

This session is successful if all of the following are true:

1. Skill pack generation exists for Codex / Claude / OpenCode.
2. Workspace injection lifecycle exists and is idempotent.
3. Runtime matrix includes OpenCode and injection preflight.
4. One demo/mock component closes the installer/registry/framework loop.
5. Focused tests and `npm run build:main` pass.
6. Docs are updated to reflect the new real completion state.

## Explicitly Deferred After This Plan

These stay for later sessions unless the user expands scope:

1. Full agent bridge server (`socket` / `named pipe` / independent `serve`)
2. True Web Terminal productization
3. Full builtin component UI rewrite
4. Canvas Shell V2 migration
5. Alpha packaging / regression wave
