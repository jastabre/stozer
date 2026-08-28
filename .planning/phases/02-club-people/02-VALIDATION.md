---
phase: 2
slug: club-people
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-27
updated: 2026-08-28
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + @vitejs/plugin-react + jsdom + @testing-library/react + @testing-library/dom + @testing-library/jest-dom + vite-tsconfig-paths **[CITED: node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md]** |
| **Config file** | `vitest.config.ts` + `vitest.setup.ts` — created in 02-01 Task 3 (Wave 0) |
| **Quick run command** | `npx vitest run src/lib/__tests__/<target>.test.ts` (targeted per task) |
| **Full suite command** | `npm test` (package script = `vitest run`); `npx vitest run --coverage` for wave merges |
| **Estimated runtime** | ~60 seconds |
| **Test files** | 10 (athlete-id, status, rows, rollover, guardian, equipment-export, storage, parsers, equipment, staff) — 98 tests |
| **Suite status (2026-08-28)** | ✅ 98 passed / 10 files; typecheck + build + lint green (02-08 gate) |

---

## Sampling Rate

- **After every task commit:** Run the target test file: `npx vitest run src/lib/__tests__/<file>.test.ts`
- **After every plan wave:** Run the full suite: `npm test` (= `vitest run`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | STRC-01, STRC-05, STRC-09, REG-01..03, REG-08 (deps) | T-02-01-01 | system | `npm ls exceljs date-fns @date-fns/tz` | — | ✅ green |
| 02-01-02 | 01 | 1 | package-legitimacy gate | T-02-01-01 | checkpoint | blocking-human | — | ✅ green |
| 02-01-03 | 01 | 1 | STRC-01, STRC-05, STRC-09, REG-01..03, REG-08 (infra) | T-02-01-01 | system | `npm test` | vitest.config.ts + 5 scaffolds | ✅ green |
| 02-02-01 | 02 | 2 | STRC-01, STRC-03, STRC-05, STRC-08, REG-05 | T-02-02-01..05 | unit | `npx vitest run src/lib/__tests__/athlete-id.test.ts` ; `npm run typecheck` | ✅ athlete-id.test.ts | ✅ green |
| 02-02-02 | 02 | 2 | STRC-01, STRC-02, STRC-03 | T-02-02-04 | unit | `npx vitest run src/lib/__tests__/rollover.test.ts` ; `npm run typecheck` | ✅ rollover.test.ts | ✅ green |
| 02-02-03 | 02 | 2 | STRC-03, REG-05 | — | typecheck | `npm run typecheck` ; `npm test` | — (server page) | ✅ green |
| 02-03-01 | 03 | 3 | REG-01 | T-02-03-02 | schema | `npm run typecheck` | migration 00005 (SQL review) | ✅ green |
| 02-03-02 | 03 | 3 | REG-02, REG-03 | T-02-03-03 | unit | `npx vitest run src/lib/__tests__/status.test.ts` ; `npm run typecheck` | ✅ status.test.ts | ✅ green |
| 02-03-03 | 03 | 3 | REG-02, REG-07 | T-02-03-01 | typecheck | `npm run typecheck` ; `npm test` | — (server page + lib) | ✅ green |
| 02-04-01 | 04 | 4 | STRC-06, STRC-07 | T-02-04-02 | schema | `npm run typecheck` | migration 00006 (SQL review) | ✅ green |
| 02-04-02 | 04 | 4 | STRC-06, STRC-09 | T-02-04-01 | unit + mocked supabase | `npx vitest run src/lib/__tests__/staff.test.ts` ; `npx vitest run src/lib/__tests__/rollover.test.ts` | ✅ staff.test.ts, rollover.test.ts | ✅ green |
| 02-04-03 | 04 | 4 | STRC-07 | T-02-04-03 | unit | `npx vitest run src/lib/__tests__/guardian.test.ts` | ✅ guardian.test.ts | ✅ green |
| 02-05-01 | 05 | 5 | REG-04 | T-02-05-01 | schema | `npm run typecheck` | migration 00007 (SQL review) | ✅ green |
| 02-05-02 | 05 | 5 | REG-04, REG-06 | T-02-05-01..03 | unit | `npx vitest run src/lib/__tests__/storage.test.ts` ; `npm run typecheck` | ✅ storage.test.ts | ✅ green |
| 02-05-03 | 05 | 5 | REG-09, REG-07 | T-02-05-04 | typecheck | `npm run typecheck` ; `npm test` | — (server page + lib) | ✅ green |
| 02-06-01 | 06 | 6 | REG-08 | T-02-06-01..04 | unit | `npx vitest run src/lib/__tests__/parsers.test.ts` ; `npm run typecheck` | ✅ parsers.test.ts | ✅ green |
| 02-06-02 | 06 | 6 | REG-08 | T-02-06-03, T-02-06-04 | unit | `npx vitest run src/lib/__tests__/rows.test.ts` ; `npm run typecheck` | ✅ rows.test.ts | ✅ green |
| 02-06-03 | 06 | 6 | REG-08 | T-02-06-02 | typecheck | `npm run typecheck` ; `npm test` | — (wizard client page) | ✅ green |
| 02-07-01 | 07 | 7 | STRC-04 | T-02-07-04 | schema | `npm run typecheck` | migration 00009 (SQL review) | ✅ green |
| 02-07-02 | 07 | 7 | STRC-04 | T-02-07-01, T-02-07-03 | unit + mocked supabase | `npx vitest run src/lib/__tests__/equipment.test.ts` ; `npm run typecheck` | ✅ equipment.test.ts | ✅ green |
| 02-07-03 | 07 | 7 | STRC-04 | T-02-07-02 | unit | `npx vitest run src/lib/__tests__/equipment-export.test.ts` ; `npm run typecheck` | ✅ equipment-export.test.ts | ✅ green |
| 02-08-01 | 08 | 8 | all STRC/REG | T-02-08-01..03 | system | `npx supabase@latest migration list --linked` ; `npm run typecheck` | — | ✅ green |
| 02-08-02 | 08 | 8 | all STRC/REG | T-02-08-02 | system | `npm test` ; `npm run build` ; `npm run lint` | — | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Wave 0 (02-01) established the vitest runner, config, and the five scaffold test files; every later plan replaced its scaffold with real RED/GREEN tests.*

---

## Wave 0 Requirements

- [x] `vitest.config.ts` + `vitest.setup.ts` (02-01 Task 3)
- [x] Wave-0 stubs: `src/lib/__tests__/{athlete-id,status,rows,guardian,rollover}.test.ts` (02-01 Task 3) — all replaced by real behavioral tests (02-02..02-06)
- [x] vitest + @testing-library/* + jsdom + vite-tsconfig-paths installed (02-01, after the blocking-human package-legitimacy gate)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CSV/XLSX column-mapping wizard UX | REG-08 | Interactive file mapping cannot be faithfully automated | Import a CSV, map columns, validate preview, confirm import |
| Green/yellow/red registration status rendering | REG-03 | Visual expiry-state indicators | Open a player's registration with expiry warnings and verify indicator colors |
| Teams CRUD server-action flows | STRC-02 | DB-write + RLS behavior; no pure logic to unit-test (typecheck-verified) | Create/edit/delete a team and verify RLS + org scoping against the pushed schema |
| Registration / contract CRUD + RLS | REG-01, REG-09 | DB-write + RLS behavior; no pure logic to unit-test (typecheck-verified) | Add/edit a registration and a contract; verify RLS + date validation in browser |
| Sport abstraction enum | STRC-08 | DB-level enum extensibility, not unit-testable | Push an additional sport and verify `teams.sport` inheritance trigger |
| Federation ID free-text field | REG-05 | Explicitly non-validated free text by design (D-06) | Save any value on a profile and confirm it round-trips unmodified |
| Live storage RLS isolation + signed-URL download | REG-04, REG-06 | Cross-tenant storage.objects behavior requires a real bucket + two orgs | Upload in org A, verify org B cannot read; download via signed URL within 7 days |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated — 2026-08-28 (validate-phase audit)

---

## Validation Audit 2026-08-28

| Metric | Count |
|--------|-------|
| Gaps found | 4 |
| Resolved | 4 |
| Escalated | 0 |

**Gaps resolved by gsd-nyquist-auditor:**
- `storage.test.ts` (10 tests) — REG-06: filename sanitization + org-rooted path shape (migration 00007 RLS convention)
- `parsers.test.ts` (11 tests) — REG-08: strict RFC4180 CSV parsing, BOM, malformed-row rejection, format detection
- `equipment.test.ts` (28 tests) — STRC-04: transition-validity whitelist + overview aggregation via mocked supabase
- `staff.test.ts` (8 tests) — STRC-06/09: coach viewer self-scope + license status derivation via mocked supabase

**Suite after audit:** 10 files / 98 tests passed; `npm run typecheck` clean; no implementation files modified.