# OpenWeave

Open Workflow Engine for AI Visualization and Execution.

## Development

```bash
npm ci
npm run build
npm run test
npm run test:e2e -- app-launch.spec.ts
```

## macOS Alpha Packaging (Task 12)

OpenWeave MVP shell is Electron. Alpha packaging in this branch supports macOS only.

```bash
npm run package:mac
bash scripts/verify-alpha.sh
```

`scripts/verify-alpha.sh` performs build, macOS packaging, and packaged-app Playwright smoke validation (`tests/e2e/smoke-alpha.spec.ts`).

## Packaging Scope Boundary

- macOS alpha packaging automation is provided via `.github/workflows/package-alpha.yml`.
- Alpha artifact distribution remains manual from generated `release/alpha` artifacts.
- Windows/Linux packaging automation is intentionally out of scope for this branch.
