# OpenWeave Phase 1 Kernel Spec

- Status: backfilled from the landed implementation on `feat/phase1-kernel-shared`
- Date: 2026-04-18
- Purpose: define the concrete Phase 1 kernel contract implemented on this branch

---

## 1. Phase 1 scope

Phase 1 on this branch covers:

- Graph Schema V2 persistence and shared IPC contracts
- Component Manifest V1
- Component registry plus local `directory` / `zip` installer flows
- `openweave` CLI workspace/node/component command surfaces
- Embedded workspace/node query service
- Component action dispatcher with builtin adapters
- Managed runtime guidance generation and workspace injection lifecycle
- Runtime launch matrix for `shell`, `codex`, `claude`, `opencode`
- One external/demo component used to prove framework closure

Anything outside that list is out of scope unless called out below as an explicit current behavior.

## 2. Runtime matrix contract

Supported run runtimes are:

| Runtime | Launch behavior | Managed workspace files |
| --- | --- | --- |
| `shell` | launches command as-is through shell runtime adapter | none |
| `codex` | launches `codex <command>` | `AGENTS.md`, `.agents/skills/openweave-workspace.md` |
| `claude` | launches `claude <command>` | `.claude/skills/openweave-workspace.md` |
| `opencode` | launches `opencode <command>` | `AGENTS.md`, `.opencode/skills/openweave-workspace.md` |

`runRuntimeSchema` is the shared validation gate for this matrix.

## 3. Skill pack contract

The main-process skill pack manager must:

1. Generate deterministic runtime-specific guidance files from workspace id, workspace root, runtime kind, bridge hint, and CLI hint.
2. Support `codex`, `claude`, and `opencode`.
3. Write all managed files under the target workspace root.
4. Roll back earlier writes if a later managed-file write fails.
5. Surface stable manager errors for:
   - unsupported runtime
   - template load failure
   - managed-file write failure

Bundled template content is acceptable Phase 1 behavior; an external template authoring system is not required in this slice.

## 4. Workspace injection contract

Managed runtime injection is persisted per workspace in `workspace_skill_injections`.

Each record stores:

- `workspace_id`
- `runtime_kind`
- `checksum`
- `managed_files_json`
- `created_at_ms`
- `updated_at_ms`

### Prepare-before-launch guarantees

For managed runtimes, `prepareForRuntimeLaunch()` must:

1. Generate the next managed snapshot before runtime process spawn.
2. Return `created`, `updated`, or `unchanged`.
3. Avoid rewriting workspace files when checksum and on-disk managed files already match the persisted record.
4. Persist the new checksum plus managed-file manifest after successful creation/update.

### Ownership guarantees

OpenWeave may only remove a managed file when the current on-disk content still matches the checksum it recorded for that file. This means cleanup is intentionally narrow:

- user-modified managed files are left in place
- user-created sibling files are left in place
- only OpenWeave-owned files are eligible for automatic removal

### Runtime-switch guarantees

When switching between managed runtimes:

- the next runtime snapshot is prepared first
- old runtime records are removed only after validation passes
- stale files from the previous runtime are removed only if they are still OpenWeave-owned
- user-modified managed files cause the switch to fail closed instead of being overwritten

### Path-safety guarantees

Managed injection paths may not traverse symlinks. Any symlinked managed ancestor or managed target path must fail the operation closed.

## 5. Runtime launch contract

The main-process run service must preserve this order:

1. validate run input
2. resolve workspace root
3. detect conflicting active managed runtimes in the same workspace
4. run managed-runtime preflight
5. start the runtime bridge worker

Current managed-runtime conflict rule:

- `codex`, `claude`, and `opencode` are mutually exclusive while an earlier managed runtime run in the same workspace is still non-terminal
- `shell` is not part of that managed-runtime exclusivity rule

### Error contract

Unsupported runtime resolution in the worker must surface a stable coded error:

- code: `RUNTIME_UNSUPPORTED`
- message shape: `[RUNTIME_UNSUPPORTED] Unsupported runtime: <runtime>`

That coded message is preserved through failed run summaries/tails.

### Cleanup-on-dispose behavior

When workspace runs are disposed, persisted managed injections for that workspace are also cleaned up.

## 6. Component-framework closure contract

Phase 1 includes one narrow external fixture to prove the framework is viable beyond builtin components:

- package: `external.demo-echo`
- install sources: local directory and zip archive
- capabilities: `read`, `write`
- actions: `read`, `write`, `echo`
- permissions: no filesystem, network, or process access requested in the fixture manifest

Current closure guarantee:

1. the package installs into the component registry
2. the registry resolves exact manifest metadata
3. renderer and worker entrypoints are present
4. a dispatcher/adapter seam can execute `read`, `write`, and `echo` against graph-backed node state

This does not imply a generalized product runtime for arbitrary external workers yet.

## 7. Explicit non-goals and deferrals

The following are not part of the Phase 1 kernel contract on this branch:

- socket or named-pipe transport surfaces
- full headless `openweave serve`
- npm package install sources
- automatic production auto-registration of external worker adapters
- renderer/canvas shell redesign
- broader plugin sandbox/runtime orchestration beyond the demo closure fixture
