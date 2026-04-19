# OpenWeave V2 Phase 2 Interactive Terminal Risk Log

## 2026-04-19 Initial review risks

### 1. Native PTY dependency integration
- Risk: `node-pty` is not yet in the product package set, so adding it may introduce Electron rebuild and local verification variance.
- Impact: build/test drift, especially around worker startup and future cross-platform validation.
- Mitigation: keep `node-pty` confined to `src/worker/**`, preserve current runtime bridge boundary, and verify with focused runtime tests plus `npm run build` before E2E.

### 2. Recovery semantics split between `stopped` and crash recovery
- Risk: current recovery logic only treats `queued`/`running` as recoverable-to-`failed`; explicit user stop must become a durable terminal outcome without weakening crash recovery.
- Impact: interrupted runs could be misclassified, masking genuine unclean shutdowns.
- Mitigation: only persist `stopped` from explicit stop flow; keep restart recovery behavior unchanged for orphaned `queued`/`running` records.

### 3. Legacy terminal node shape is shell-only today
- Risk: current canvas terminal nodes persist only `command`, while Phase 2 UI needs runtime selection additively.
- Impact: renderer/store/schema changes may ripple into persistence and E2E fixtures.
- Mitigation: add runtime as an additive field with a stable default and avoid widening into builtin component migration.

## 2026-04-19 Task 2 review follow-ups

### 4. Stop semantics must terminate the real runtime path, not only mark DB state
- Risk: current additive `runStop` contract can mark a run as `stopped` before the real worker/runtime chain guarantees subprocess termination.
- Impact: background runtime may continue mutating the workspace after UI/API reports stopped.
- Mitigation: Task 3 must propagate stop through runtime bridge -> worker -> PTY/runtime process and add focused tests that stop a real runtime path.

### 5. Input contract is additive-complete before transport is implemented
- Risk: `runInput` contract exists, but the default runtime bridge still returns `false` until the worker message path is implemented.
- Impact: production interactive input remains non-functional until Task 3 lands.
- Mitigation: implement bridge/worker input forwarding in Task 3 and add real-path tests instead of only stub-bridge tests.

### 6. Renderer terminal terminal-state handling still pending
- Risk: current renderer still treats only `completed`/`failed` as terminal.
- Impact: `stopped` can render as active until Task 5 updates the terminal UI.
- Mitigation: fold `stopped` into the renderer terminal-state handling during Task 5 interactive surface work.

## 2026-04-19 Task 3 review follow-ups

### 7. Stop-state persistence currently leads real worker exit
- Risk: `stopRun` can persist `stopped` before the worker/PTTY process fully exits.
- Impact: managed-runtime exclusivity can be bypassed during the stop grace window, and shutdown output may be dropped.
- Mitigation: Task 4 should move the final `stopped` transition to the confirmed runtime-exit path while preserving additive IPC and current recovery semantics.

### 8. Stop/exit race can mislabel near-finished runs
- Risk: a run that finishes naturally around the same time as a stop request can be recorded as `stopped` and ignore later exit output.
- Impact: tail logs and final status may not reflect the real terminal outcome.
- Mitigation: Task 4 should reconcile stop intent with actual worker exit result and keep terminal tail updates until the terminal state is finalized.

### 9. Renderer terminal-state handling still excludes `stopped`
- Risk: renderer status UI still treats only `completed` / `failed` as terminal.
- Impact: stopped runs can show as active until Task 5 updates the drawer/session surface.
- Mitigation: Task 5 should include `stopped` in renderer terminal-state handling.

## 2026-04-19 Batch 2 closure notes

### 10. Confirmed-exit stop semantics are now landed
- Status: mitigated in the current Phase 2 worktree.
- Landed behavior: `runStop` now records stop intent first and only persists final `stopped` after the real worker exit arrives, preserving late tail output and managed-runtime exclusivity during the stop grace window.
- Verification: `tests/integration/main/runs-ipc.test.ts`, `tests/integration/main/runs-register-recovery.test.ts`, and `tests/integration/main/runtime-launch.test.ts`.

### 11. Renderer interactive session surface is now landed with a thin terminal pane
- Status: mitigated for Phase 2 scope.
- Landed behavior: renderer now exposes an interactive session pane with output, follow-up input, stop control, runtime selection, and `stopped` terminal-state handling without introducing a second session subsystem.
- Verification: `tests/unit/renderer/terminal-session-pane.test.ts`, `tests/unit/renderer/terminal-node.test.ts`, `tests/unit/renderer/canvas.store.test.ts`, and `tests/e2e/terminal-run.spec.ts`.

### 12. `node-pty` needs a worker-local fallback in this environment
- Risk: on the current macOS/dev environment, direct `node-pty` shell launch can fail with `posix_spawnp failed.` for otherwise valid shell commands.
- Impact: relying on PTY-only launch would make the interactive terminal flaky or unusable in local Electron verification even though the rest of the runtime chain is correct.
- Mitigation: the worker-local runtime adapter now falls back to `child_process.spawn` when PTY launch throws, preserving input/stop behavior while keeping all process execution inside `src/worker/**`.
- Residual note: this keeps Phase 2 verification green, but cross-platform PTY behavior still needs future validation before claiming full parity across all host shells.

### 13. Deferred after Phase 2 closure
- Builtin component migration onto manifest-driven renderer hosts remains deferred to a later phase.
- Canvas Shell V2 / React Flow migration remains deferred to a later phase.
- Socket / named-pipe / headless `serve` transport remains deferred to a later phase.
