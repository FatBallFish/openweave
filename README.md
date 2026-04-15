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

## Packaging Scope Boundary

- macOS alpha packaging automation is provided via `.github/workflows/package-alpha.yml` (artifact: `openweave-alpha-macos-arm64`).
- Alpha artifact distribution remains manual from generated `release/alpha` artifacts.
- Windows/Linux packaging automation is intentionally out of scope for this branch.
