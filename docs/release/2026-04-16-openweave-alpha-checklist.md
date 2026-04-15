# OpenWeave Alpha Release Checklist (macOS only)

## Scope

- [ ] Alpha packaging scope is macOS only.
- [ ] Windows/Linux packaging automation is not added in this branch.
- [ ] Future Windows preview packaging stays on a separate validation track with native smoke gates.

## Build and Package

- [ ] `npm ci` completed on macOS.
- [ ] `npm run build` passes.
- [ ] `npm run package:mac` generates `release/alpha` artifacts.
- [ ] Packaged app bundle exists at `release/alpha/**/OpenWeave.app`.
- [ ] Manual distribution artifact (zip) exists under `release/alpha`.

## Smoke Verification

- [ ] `bash scripts/verify-alpha.sh` passes end-to-end.
- [ ] `tests/e2e/smoke-alpha.spec.ts` passes against packaged executable.
- [ ] Smoke test confirms packaged app launches and opens a seeded existing workspace.

## CI and Delivery

- [ ] GitHub Actions workflow `.github/workflows/package-alpha.yml` is active for macOS packaging.
- [ ] Workflow uploads `release/alpha` as internal/manual distribution artifacts.
- [ ] Alpha delivery remains manual distribution from generated artifacts.
