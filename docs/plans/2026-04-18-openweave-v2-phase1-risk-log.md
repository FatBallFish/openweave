# OpenWeave V2 Phase 1 Risk Log

- Date: 2026-04-18
- Branch: `feat/phase1-kernel-shared`
- Purpose: track execution-time blockers/risks without expanding scope mid-session

## Re-baseline Checklist

### Accepted baseline already present on this branch

- Graph Schema V2 and shared IPC/contracts
- Component Manifest V1
- Component Registry and installer (`directory` / `zip`)
- `openweave` CLI workspace/node/component command surface
- Embedded workspace/node bridge service
- Component action dispatcher and builtin adapters for note/text/attachment
- Builtin name collision rejection for third-party installs

### Remaining Phase 1 scope for this session

1. Skill Pack Manager
2. Workspace Skill Injection Manager
3. Runtime adapter completion, including `opencode`
4. Demo/mock component closure test
5. Phase 1 verification and doc backfill

## Open Risks / Blockers

1. `docs/prd/2026-04-18-openweave-prd-v2-refactor.md` is still missing from this branch.
2. The branch is already dirty from earlier accepted Phase 1 work, so new changes must layer on top without reverting unrelated edits.
3. Task 2 review surfaced a non-blocking maintenance risk: default bundled skill-pack templates and `.tpl` source files can drift unless later backfilled into one source of truth.
4. Task 2 review surfaced a non-blocking template-authoring risk: unknown placeholders currently collapse to empty strings instead of failing fast.

## Resolved During This Session

1. Backfilled `docs/tech-design/2026-04-18-openweave-tech-design-v2-refactor.md`.
2. Backfilled `docs/plans/2026-04-18-openweave-refactor-execution-plan.md`.
3. Backfilled `docs/plans/2026-04-18-openweave-phase1-kernel-spec.md`.
4. Cleared the `npm run build:main` blocker caused by `src/main/ipc/runs.ts` runtime narrowing.

## Working Decision

- Treat the missing PRD doc as a documentation gap, not a stop-ship blocker for the landed Phase 1 code path.
- Use the available execution plan plus landed code as the source of truth for implementation.
- Backfill the missing/updated Phase 1 docs in Task 6 after code paths and tests are settled.
