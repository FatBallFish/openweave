# OpenWeave Windows Runtime POC Validation

## Context and boundary

- Baseline branch: `feat/pre-implementation-plan`
- Isolated workspace: `.worktrees/feat-windows-pty-poc`
- Non-overlap target: do not touch the Portal PoC or MVP app scaffold defined in `docs/plans/2026-04-16-openweave-mvp-implementation-plan.md`
- Validation focus: the Windows-side runtime path implied by `docs/tech-design/2026-04-15-openweave-tech-design-v1.md`, especially `Electron utilityProcess + node-pty + spawn + future packaging`

## Questions to validate

1. Is `utilityProcess` still the right isolation boundary for a future Windows runtime worker?
2. Does `node-pty` remain a viable PTY choice for Windows preview after the current Electron baseline?
3. What packaging path best matches the already approved release expectation: macOS first, then Windows MSI / Linux archive or deb after PTY verification?
4. What can be validated locally today, and what still requires a native Windows runner?

## Source-backed findings

### 1. Runtime process split still holds

- Electron documents `utilityProcess` as a Node.js child process entry point, and the Electron process model positions Utility as a dedicated process type outside the renderer sandbox.
- This matches the tech design constraint that `node-pty` must not load in renderer and should live inside the runtime worker.
- Conclusion: keep the current design direction of `main -> utilityProcess runtime worker -> node-pty / git child processes`.

Implication for implementation:

- Keep a narrow runtime adapter layer for PTY spawning and stream forwarding.
- Do not let renderer import `node-pty`, even indirectly.

References:

- https://www.electronjs.org/docs/latest/api/utility-process
- https://www.electronjs.org/docs/latest/tutorial/process-model

### 2. `node-pty` is still viable, but Windows constraints must be explicit

- The upstream `node-pty` README documents Windows support through ConPTY and notes that winpty support was removed.
- The same upstream docs say ConPTY requires Windows 1809 or newer.
- Electron's native Node module guide still recommends rebuilding native modules for the app's Electron version, typically via `@electron/rebuild`.
- `node-pty` also documents a Windows PowerShell launch pitfall when `SystemRoot` is missing from the environment.

Conclusion:

- Keep `node-pty` as the PTY layer for preview planning.
- Add an internal runtime guard that fails fast on unsupported Windows versions.
- Always pass through the process environment, especially `SystemRoot`, when spawning PowerShell-based smoke sessions.
- Treat Electron upgrades and `node-pty` rebuilds as a coupled validation step.

References:

- https://github.com/microsoft/node-pty
- https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules

### 3. Packaging should be selected separately from the app scaffold

- Electron Builder documents Windows targets including `nsis`, `portable`, `msi`, `msi-wrapped`, and `appx`.
- The same documentation covers Linux targets including `AppImage`, `deb`, `rpm`, `pacman`, and `tar.xz`.
- Electron Builder's multi-platform build guidance warns that native dependencies can only be compiled on the target platform unless prebuild artifacts are available.

Conclusion:

- For the post-macOS preview packaging layer, `electron-builder` is the better fit for the already recorded expectation of Windows MSI plus Linux archive or deb output.
- This should remain a release-layer decision and should not block the main MVP app scaffold, which can stay on the lighter Vite + Electron structure planned in the current implementation doc.
- Real Windows packaging and PTY smoke validation must run on a native Windows CI runner, not only on macOS.

References:

- https://www.electron.build/win.html
- https://www.electron.build/linux.html
- https://www.electron.build/multi-platform-build.html

### 4. Workspace data path assumption remains valid on Windows

- Electron's `app.getPath('userData')` is still the official per-app data location entry point.
- This supports the tech design statement that macOS uses platform-standard paths now, while Windows / Linux can rely on `userData` later without changing the higher-level persistence layout.

Reference:

- https://www.electronjs.org/docs/latest/api/app

## Local empirical probe

To avoid overlap with the main implementation plan, the runtime validation stays in an isolated throwaway probe:

- Path: `poc/windows-runtime-probe`
- Scope: validate `utilityProcess -> MessageChannelMain/process.parentPort -> node-pty` topology without creating the production app scaffold
- POC versions queried on 2026-04-16:
  - `electron`: `41.2.0`
  - `node-pty`: `1.1.0`
  - `@electron/rebuild`: `4.0.3`

### Probe contents

- `src/main.cjs`: boots Electron and starts a utility worker
- `src/worker.cjs`: loads `node-pty` only inside the worker, spawns a PTY smoke command, and reports results through a message port
- `src/runtime-config.cjs`: centralizes Windows vs POSIX shell selection and environment pass-through
- `test/runtime-config.test.cjs`: protects the Windows and POSIX smoke command contract

### Commands executed locally

```bash
cd poc/windows-runtime-probe
npm test
npm install
npm run smoke
```

### Observed result on the current macOS host

- `npm test`: passed
- `npm install`: passed, including `electron-rebuild -f -w node-pty`
- `npm run smoke`: passed and emitted `OPENWEAVE_PTY_OK`

What this proves:

- The proposed runtime topology works on the current host.
- Native module rebuild can be automated inside the probe.
- The implementation shape is ready for Windows-native smoke validation.

What this does not prove:

- It does not prove Windows runtime behavior on an actual Windows host.
- It does not prove packaging output or installer signing.
- It does not prove CLI compatibility for Codex CLI / Claude Code on Windows yet.

## Recommended decision update

Add one explicit gate before opening Windows preview packaging:

1. Run `poc/windows-runtime-probe` on a native Windows CI runner.
2. Verify PowerShell smoke launch, streamed output, and clean process exit.
3. Repeat the smoke against the first supported runtime commands:
   - plain shell
   - Codex CLI
   - Claude Code
4. Only after that, enable preview packaging work and choose the first Windows installer target.

## Recommendation

- Keep `Electron + utilityProcess + node-pty` as the future Windows runtime path.
- Add a runtime adapter boundary now so Windows-specific guards do not leak into renderer or shared UI code.
- Keep the main MVP implementation macOS-first exactly as planned.
- Treat Windows preview as a separate validation track with its own CI smoke gate and packaging layer.
