# OpenWeave Refactor Execution Plan

- Status: backfilled as an as-built execution ledger for `feat/phase1-kernel-shared`
- Date: 2026-04-18
- Purpose: record the Phase 1 refactor work that actually landed on this branch, not propose new scope
- Source of truth: landed code/tests plus `docs/plans/2026-04-18-openweave-v2-next-execution-plan.md`

---

## 1. Accepted baseline before this execution slice

Before the work captured here, the branch already contained:

- Graph Schema V2 and shared IPC/contracts
- Component Manifest V1
- Component registry and installer for local `directory` / `zip`
- `openweave` CLI workspace/node/component commands
- Embedded workspace/node query service
- Component action dispatcher and builtin adapters
- Builtin component name-collision protection

The remaining execution scope for this branch was the runtime-facing chain plus one framework-closure fixture.

## 2. Completed execution slices

### Task 2: Skill Pack Manager

Landed outcome:

- added `src/main/skills/skill-pack-manager.ts`
- generated managed guidance for `codex`, `claude`, and `opencode`
- kept generation deterministic for repeated identical inputs
- added stable manager errors for unsupported runtime, template load failure, and write failure
- covered rollback behavior when later managed-file writes fail

Primary coverage:

- `tests/unit/main/skill-pack-manager.test.ts`

### Task 3: Workspace Skill Injection Manager

Landed outcome:

- added `src/main/skills/workspace-skill-injection-manager.ts`
- added workspace-level persistence in `workspace_skill_injections`
- prepared managed files before managed runtime launch
- skipped rewrites when checksum plus on-disk state were unchanged
- removed only OpenWeave-owned files during cleanup
- treated runtime switches as stale-injection updates
- failed closed on user-modified managed files and symlink traversal

Primary files:

- `src/main/db/migrations/workspace/001_init.sql`
- `src/main/db/workspace.ts`
- `src/main/skills/workspace-skill-injection-manager.ts`
- `tests/unit/main/workspace-skill-injection-manager.test.ts`
- `tests/integration/main/workspace-skill-injection-manager.test.ts`

### Task 4: Runtime completion and OpenCode support

Landed outcome:

- expanded `runRuntimeSchema` to `shell`, `codex`, `claude`, `opencode`
- added `src/worker/adapters/opencode-runtime.ts`
- routed `opencode` in `src/worker/runtime-worker.ts`
- wired launch preflight in `src/main/ipc/runs.ts` before runtime spawn
- preserved shell/codex/claude launch behavior
- kept a stable coded unsupported-runtime error
- added a managed-runtime conflict guard so different managed runtimes do not launch concurrently in one workspace
- cleaned persisted managed runtime files on workspace-run disposal

Primary coverage:

- `tests/unit/worker/runtime-adapters.test.ts`
- `tests/integration/main/runtime-launch.test.ts`

### Task 5: Demo component closure

Landed outcome:

- added the external fixture package under `tests/fixtures/components/demo-echo/`
- proved install from local directory and zip archive
- preserved manifest metadata, schemas, renderer entry, and worker entry
- resolved the installed component through registry metadata
- closed a minimal read/write/echo action roundtrip through the dispatcher seam

Primary coverage:

- `tests/integration/main/component-installer.test.ts`
- `tests/integration/main/demo-component-roundtrip.test.ts`

## 3. Branch-level output of this execution

After the landed work, Phase 1 on this branch now includes:

- runtime-specific workspace guidance generation
- workspace-owned managed-file lifecycle with persistent metadata
- first-class `opencode` runtime support
- managed runtime preflight before launch
- one concrete external/demo component proving framework closure

## 4. Documentation backfill delivered by this branch state

The missing Phase 1 refactor docs are backfilled as as-built records:

- `docs/tech-design/2026-04-18-openweave-tech-design-v2-refactor.md`
- `docs/plans/2026-04-18-openweave-refactor-execution-plan.md`
- `docs/plans/2026-04-18-openweave-phase1-kernel-spec.md`

## 5. Relevant verification targets

This landed scope is anchored by the following focused tests:

```bash
npx vitest run \
  tests/unit/main/skill-pack-manager.test.ts \
  tests/unit/main/workspace-skill-injection-manager.test.ts \
  tests/integration/main/workspace-skill-injection-manager.test.ts \
  tests/unit/worker/runtime-adapters.test.ts \
  tests/integration/main/runtime-launch.test.ts \
  tests/integration/main/component-installer.test.ts \
  tests/integration/main/demo-component-roundtrip.test.ts
```

## 6. Explicit deferrals after this execution

The following did not become part of this landed slice:

- full socket or named-pipe bridge server
- full headless serve/runtime hosting
- npm install source support
- automatic external worker loading in product runtime paths
- renderer/canvas shell redesign
- broader plugin-runtime scope beyond the demo closure fixture
