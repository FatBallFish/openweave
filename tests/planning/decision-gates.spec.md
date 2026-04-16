# Decision Gates Spec

This planning spec records the Gate 0 checks that must stay true before MVP implementation proceeds.

## Required decisions

- [x] DC-01 owner map copied into ADR
- [x] DC-02 Electron locked for MVP
- [x] DC-04 schema timestamps locked to `*_at_ms`
- [x] DC-06 Portal allowlist copied into ADR
- [x] DC-10 Playwright Electron baseline copied into ADR
- [x] DC-11 Branch Workspace boundary copied into ADR

## Verification commands

```bash
rg -n "Status：Pending|状态：Pending|\| Pending \|" docs/plans/2026-04-16-openweave-decision-checklist.md
rg -n "Electron|Playwright Electron|required|file://|王凌超|GitHub Actions|\*_at_ms|cookies|登录态|截图|portal session" docs/decisions/2026-04-16-*.md
```

## Expected result

- Gate 0 shows no pending entries.
- ADRs contain the approved MVP shell, QA baseline, owner map, portal security rules, and branch workspace isolation boundary.
