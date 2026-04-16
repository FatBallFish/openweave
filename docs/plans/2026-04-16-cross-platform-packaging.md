# Cross-Platform Packaging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add native packaging scripts under `deploy/` so macOS, Linux, and Windows can each build an Electron-distributed desktop client into `deploy/target/`.

**Architecture:** Keep the existing alpha packaging flow intact, and add a new release-packaging layer under `deploy/`. A small Node packaging helper will centralize platform/arch/output resolution, while thin OS-specific wrapper scripts call it. Electron Builder will use a new release config rooted in `deploy/` so artifacts land in `deploy/target/<platform>/`.

**Tech Stack:** Node.js 22, Electron, electron-builder, Bash, PowerShell, Vitest.

---

### Task 1: Add a tested packaging plan helper

**Files:**
- Create: `deploy/package-plan.cjs`
- Create: `tests/unit/deploy/package-plan.test.ts`

**Step 1: Write the failing test**
- Assert macOS resolves to `dmg` + `zip`, Linux resolves to `AppImage`, Windows resolves to `nsis`.
- Assert output directories land under `deploy/target/<platform>/`.
- Assert unsupported platforms throw a useful error.

**Step 2: Run test to verify it fails**
- Run: `npm test -- tests/unit/deploy/package-plan.test.ts`
- Expected: FAIL because helper does not exist yet.

**Step 3: Write minimal implementation**
- Export a `buildPackagePlan()` helper that maps platform + arch to builder CLI args, output directories, and wrapper metadata.

**Step 4: Run test to verify it passes**
- Run: `npm test -- tests/unit/deploy/package-plan.test.ts`
- Expected: PASS.

### Task 2: Add deploy packaging scripts and config

**Files:**
- Create: `deploy/electron-builder.release.yml`
- Create: `deploy/package-release.mjs`
- Create: `deploy/package-mac.sh`
- Create: `deploy/package-linux.sh`
- Create: `deploy/package-windows.ps1`
- Create: `deploy/package-windows.cmd`
- Modify: `.gitignore`

**Step 1: Write the failing test**
- Extend the helper test or add assertions that the generated command uses the new release config and output root.

**Step 2: Run test to verify it fails**
- Run: `npm test -- tests/unit/deploy/package-plan.test.ts`
- Expected: FAIL until script-facing metadata exists.

**Step 3: Write minimal implementation**
- Add a release electron-builder config that packages compiled Electron assets.
- Add the Node entrypoint to run `npm run build`, clean target dirs, and invoke `electron-builder` with platform-appropriate targets.
- Add thin OS wrappers in `deploy/`.
- Ignore `deploy/target/` in git.

**Step 4: Run test to verify it passes**
- Run: `npm test -- tests/unit/deploy/package-plan.test.ts`
- Expected: PASS.

### Task 3: Wire docs and verify end-to-end packaging commands

**Files:**
- Modify: `README.md`
- Optional: `package.json` only if command aliases clearly help and still point into `deploy/`

**Step 1: Update docs**
- Document the native packaging commands for macOS/Linux/Windows and note that each script builds host-native Electron artifacts into `deploy/target/`.

**Step 2: Run verification**
- Run: `npm test -- tests/unit/deploy/package-plan.test.ts tests/integration/main/runs-ipc.test.ts tests/integration/main/workspaces-ipc.test.ts tests/integration/main/branch-workspace.test.ts tests/unit/create-workspace-dialog.test.ts`
- Run: `npm run build`
- Run one host-appropriate packaging smoke command from `deploy/` (on this machine: macOS).

**Step 3: Commit**
- Commit packaging changes separately from the already-created fix commit.
