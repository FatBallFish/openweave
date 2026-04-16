# OpenWeave Alpha Release Checklist (macOS only)

## Scope

- [ ] Alpha packaging scope is macOS only.
- [ ] Alpha packaging architecture is Apple Silicon (`arm64`) only.
- [ ] Windows/Linux packaging automation is not added in this branch.
- [ ] Future Windows preview packaging stays on a separate validation track with native smoke gates.

## Build and Package

- [ ] `npm ci` completed on macOS.
- [ ] `npm run build` passes.
- [ ] `npm run package:mac` generates arm64 artifacts under `release/alpha`.
- [ ] Packaged app bundle exists at `release/alpha/mac-arm64/OpenWeave.app`.
- [ ] Manual distribution artifact (zip) exists under `release/alpha`.

## Smoke Verification

- [ ] `bash scripts/verify-alpha.sh` passes end-to-end.
- [ ] `tests/e2e/smoke-alpha.spec.ts` passes against packaged executable.
- [ ] Smoke test confirms packaged app launches and opens a workspace seeded via registry repository APIs.

## CI and Delivery

- [ ] GitHub Actions workflow `.github/workflows/package-alpha.yml` is active for macOS packaging.
- [ ] Workflow uploads `openweave-alpha-macos-arm64` artifacts.
- [ ] Workflow uploads `release/alpha` as internal/manual distribution artifacts.
- [ ] Alpha delivery remains manual distribution from generated artifacts.
