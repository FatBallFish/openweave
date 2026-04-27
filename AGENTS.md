# Repository Guidelines

## Project Structure & Module Organization

OpenWeave is an Electron/Vite TypeScript application. Main-process code lives in `src/main`, renderer React UI in `src/renderer`, worker services in `src/worker`, shared contracts in `src/shared`, and CLI commands in `src/cli`. Packaging scripts are under `deploy`, wrappers under `bin`, and helpers under `scripts`. Tests mirror runtime areas in `tests/unit`, `tests/integration`, and `tests/e2e`; reusable fixtures are in `tests/fixtures`.

## Build, Test, and Development Commands

- `npm ci`: install dependencies; Node.js 22 or newer is required.
- `npm run dev`: build main-process code, start Vite on `localhost:5173`, and launch Electron.
- `npm run build`: compile the Electron main/worker/CLI TypeScript and build the renderer bundle.
- `npm test`: run Vitest unit and integration suites.
- `npm run test:e2e`: build the app, then run Playwright specs from `tests/e2e`.
- `npm run package:mac`: build and create macOS arm64 directory/zip artifacts.
- `npm run verify:alpha`: perform the alpha package build and packaged-app smoke validation.

## Coding Style & Naming Conventions

Use TypeScript throughout. Match the existing style: two-space indentation, single quotes, semicolons, and explicit exported types for cross-module contracts. React components use `PascalCase.tsx`; services, stores, adapters, and IPC modules use lowercase kebab-style filenames such as `portal-session-service.ts` or `canvas.store.ts`. Keep renderer styling in `src/renderer/styles` or feature-local components, and keep IPC schemas/contracts in shared modules rather than duplicating literals.

## Testing Guidelines

Vitest is used for unit and integration tests with V8 coverage reporting; Playwright is used for Electron end-to-end tests. Name Vitest files `*.test.ts` and place them under the matching area in `tests/unit` or `tests/integration`. Name E2E specs `*.spec.ts`. For targeted runs, use `npx vitest run tests/unit/main/path-boundary.test.ts` or `npm run test:e2e -- app-launch.spec.ts`. Add tests with behavioral changes, especially IPC, persistence, runtime adapters, workspace flows, and renderer state.

## Commit & Pull Request Guidelines

Recent history uses short imperative summaries, often Conventional Commit prefixes such as `feat:` and `fix:`; keep messages focused on the user-visible or architectural change. For pull requests, include a concise description, linked issue or context, test commands run, and screenshots or recordings for UI changes. Call out packaging, migration, or platform-specific impact explicitly.

## Security & Configuration Tips

Do not commit generated artifacts from `dist`, `release`, `test-results`, or packaged outputs unless a release process requires them. Keep filesystem operations within workspace boundaries and validate IPC inputs through shared schemas. Avoid hardcoded absolute paths, local credentials, or machine-specific assumptions.
