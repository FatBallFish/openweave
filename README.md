# OpenWeave

Open Workflow Engine for AI Visualization and Execution.

## Development

OpenWeave requires Node.js 22 or newer.

```bash
npm ci
npm run build
npm run test
npm run test:e2e -- app-launch.spec.ts
```

## macOS Alpha Packaging

OpenWeave MVP shell is Electron. This alpha packaging flow is macOS-only and targets Apple Silicon (`arm64`).

```bash
npm run package:mac
bash scripts/verify-alpha.sh
```

`scripts/verify-alpha.sh` performs a clean alpha package build and packaged-app Playwright smoke validation (`tests/e2e/smoke-alpha.spec.ts`).

## Native Client Packaging

Cross-platform release packaging scripts live under `deploy/` and emit native Electron client artifacts into `deploy/target/`.

```bash
# macOS host -> dmg + zip
bash deploy/package-mac.sh

# Linux host -> AppImage
bash deploy/package-linux.sh

# Windows host -> NSIS installer
powershell -ExecutionPolicy Bypass -File .\\deploy\\package-windows.ps1
```

Notes:

- Each script builds the desktop app first via `npm run build`.
- Each script packages only the matching host platform; a macOS script must run on macOS, Linux on Linux, Windows on Windows.
- Output artifacts are written to `deploy/target/macos`, `deploy/target/linux`, or `deploy/target/windows`.
