# OpenWeave Windows Runtime POC Result Report

## Overview

- Validation date: 2026-04-16
- Worktree: `.worktrees/feat-windows-pty-poc`
- Branch: `feat/windows-pty-poc`
- Baseline branch: `feat/pre-implementation-plan`
- Objective: validate the Windows-side runtime route in the tech design without overlapping the macOS-first MVP implementation track

## Scope

This POC only validates the runtime chain implied by the tech design:

- Electron `utilityProcess`
- `MessageChannelMain` to `process.parentPort` worker communication
- `node-pty` loaded only inside the worker process
- PowerShell-oriented smoke command modeling for future Windows verification

This POC does not implement:

- Portal PoC
- production app scaffold
- Windows installer packaging
- Codex CLI / Claude Code runtime compatibility on a native Windows host

## Deliverables

### 1. Validation analysis

- `docs/plans/2026-04-16-openweave-windows-runtime-poc-validation.md`

Detailed source-backed analysis for:

- runtime isolation choice
- `node-pty` viability and constraints
- future packaging direction
- Windows persistence path assumption

### 2. Executable probe

- `poc/windows-runtime-probe/package.json`
- `poc/windows-runtime-probe/src/main.cjs`
- `poc/windows-runtime-probe/src/worker.cjs`
- `poc/windows-runtime-probe/src/runtime-config.cjs`
- `poc/windows-runtime-probe/test/runtime-config.test.cjs`
- `poc/windows-runtime-probe/README.md`

## Verification commands and latest results

Executed on the current macOS host inside `poc/windows-runtime-probe`:

```bash
npm test
npm run smoke
```

Observed results:

- `npm test`: pass
- `npm run smoke`: pass
- smoke output: `OPENWEAVE_PTY_OK`

Additional setup evidence previously verified in this worktree:

```bash
npm install
```

Observed result:

- `postinstall` successfully ran `electron-rebuild -f -w node-pty`

## Result summary

### Confirmed

1. The proposed Electron runtime topology is locally viable:
   - `main -> utilityProcess -> node-pty` works on the current host.
2. `node-pty` can stay confined to the worker boundary, matching the tech design constraint.
3. Native module rebuild for the chosen Electron version can be automated in the probe workflow.
4. The current POC can be handed to another agent as an isolated Windows runtime validation seed.

### Not yet confirmed

1. Native Windows execution on a real Windows machine.
2. PowerShell launch behavior on Windows with real environment inheritance.
3. Compatibility for Codex CLI / Claude Code on Windows.
4. Windows/Linux packaging or installer generation.

## Recommended decisions

- Keep `Electron + utilityProcess + node-pty` as the future Windows runtime path.
- Add a Windows-specific runtime guard before preview support:
  - Windows 1809+ check
  - preserved environment pass-through, especially `SystemRoot`
  - smoke verification after every Electron upgrade
- Keep Windows preview validation separate from the current macOS-first MVP implementation stream.

## Handoff notes for the next agent

If another agent continues from this POC, the recommended order is:

1. Run the existing probe locally from `poc/windows-runtime-probe`.
2. Move the same smoke to a native Windows environment.
3. Extend the probe from plain shell smoke to real runtime commands.
4. Only then decide whether to add packaging automation.

## Suggested commit scope

This report expects the following files to be committed together:

- `docs/plans/2026-04-16-openweave-windows-runtime-poc-validation.md`
- `docs/plans/2026-04-16-openweave-windows-runtime-poc-report.md`
- `poc/windows-runtime-probe/.gitignore`
- `poc/windows-runtime-probe/README.md`
- `poc/windows-runtime-probe/package.json`
- `poc/windows-runtime-probe/package-lock.json`
- `poc/windows-runtime-probe/src/main.cjs`
- `poc/windows-runtime-probe/src/worker.cjs`
- `poc/windows-runtime-probe/src/runtime-config.cjs`
- `poc/windows-runtime-probe/test/runtime-config.test.cjs`
