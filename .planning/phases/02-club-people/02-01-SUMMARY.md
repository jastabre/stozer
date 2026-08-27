---
phase: 02-club-people
plan: 01
subsystem: testing
tags: [vitest, testing-library, jsdom, exceljs, date-fns, csv-parse, react-table]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Next.js app skeleton (src/lib, tsconfig @/* paths, package.json)
provides:
  - Vitest test runner + config (vitest.config.ts) with node lib env / jsdom component env
  - vitest.setup.ts wired to @testing-library/jest-dom
  - 5 Wave-0 scaffold test files under src/lib/__tests__ (athlete-id, status, rows, guardian, rollover)
  - All Phase 2 runtime + dev deps present in package.json
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07]

# Actuals (#2632) — chars/4 over the realized diff of files actually changed.
actuals:
  tokens: 1334    # chars/4 over realized diff (package.json + config + scaffold files, incl lockfile)
  tasks: 3        # tasks completed
  commits: 2      # commits made (Task 1 via 5ce7fdb, Task 3 via 315f3f1)

# Tech tracking
tech-stack:
  added:
    - vitest@4.1.11
    - @vitejs/plugin-react@6.1.0
    - jsdom@29.1.1
    - @testing-library/react@16.3.2
    - @testing-library/dom@10.4.1
    - @testing-library/jest-dom@7.0.1
    - vite-tsconfig-paths@6.1.1
    - csv-parse@6.2.1
    - @tanstack/react-table@8.21.3
  patterns:
    - node-environment lib tests + jsdom component tests via environmentMatchGlobs
    - Wave-0 scaffold test files (trivial passing tests, no impl import) for future RED tests

key-files:
  created:
    - vitest.config.ts
    - vitest.setup.ts
    - src/lib/__tests__/athlete-id.test.ts
    - src/lib/__tests__/status.test.ts
    - src/lib/__tests__/rows.test.ts
    - src/lib/__tests__/guardian.test.ts
    - src/lib/__tests__/rollover.test.ts
  modified:
    - package.json (test scripts + deps)
    - package-lock.json

key-decisions:
  - "Phase 2 test runner is vitest; lib tests run in node env, component/app tests in jsdom (environmentMatchGlobs)"
  - "5 Wave-0 scaffold tests created as trivial passing stubs that do NOT import future impl modules"
  - "csv-parse + @tanstack/react-table added as runtime deps, vitest family as devDeps, all approved via blocking-human package legitimacy gate"

patterns-established:
  - "Scaffold test files precede implementation modules so later plans can write RED tests immediately"

requirements-completed: [STRC-01, STRC-05, STRC-09, REG-01, REG-02, REG-03, REG-08]

# Coverage metadata — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "Vitest runner operational; `npm test` runs green with 5 passing Wave-0 scaffold tests"
    requirement: STRC-01
    verification:
      - kind: unit
        ref: "npm test"
        status: pass
    human_judgment: false
  - id: D2
    description: "Wave-0 test scaffolds exist for athlete-id, status, import rows, guardian, rollover"
    requirement: STRC-05
    verification:
      - kind: unit
        ref: "src/lib/__tests__/{athlete-id,status,rows,guardian,rollover}.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "vitest.config.ts wired to node lib env + jsdom component env, setupFiles, @ alias"
    verification:
      - kind: unit
        ref: "vitest.config.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "All Phase 2 runtime + dev deps present in package.json, no invalid/missing flags"
    requirement: REG-08
    verification:
      - kind: unit
        ref: "npm ls exceljs date-fns @date-fns/tz csv-parse @tanstack/react-table vitest"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-08-27
status: complete
---

# Phase 2 Plan 1: Test Infrastructure & Dependencies Summary

**Vitest test runner established with a green 5-test suite, 5 Wave-0 scaffold files under src/lib/__tests__, and all Phase 2 runtime/dependency installs passing the blocking-human package-legitimacy gate**

## Performance

- **Duration:** 8 min (Task 3 this session; Tasks 1–2 in prior session)
- **Started:** 2026-08-27 (plan start prior session)
- **Completed:** 2026-08-27
- **Tasks:** 3
- **Files modified:** 8 (+lockfile)

## Accomplishments
- Vitest 4 runner configured: `vitest.config.ts` with node environment for lib tests and jsdom (via `environmentMatchGlobs`) for future component/app tests, `setupFiles` wired to `vitest.setup.ts`, and `@` → `./src` alias resolution (tsconfig paths + explicit alias).
- `vitest.setup.ts` imports `@testing-library/jest-dom/vitest` for DOM matchers when jsdom tests land.
- 5 Wave-0 scaffold test files created (athlete-id, status, rows, guardian, rollover), each a trivial passing test that does NOT import its future implementation module.
- `package.json` scripts added: `test` (`vitest run`) and `test:watch` (`vitest`).
- Installed dev deps (vitest family, jsdom, @testing-library/*, vite-tsconfig-paths) and, per the approved Task 2 gate, runtime deps csv-parse + @tanstack/react-table.
- `npm test` is green: **5 files / 5 tests passing**.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install runtime deps (exceljs, date-fns, @date-fns/tz)** - `5ce7fdb` (chore, prior session)
2. **Task 2: Package legitimacy gate (blocking-human checkpoint)** - approved by user; no code commit
3. **Task 3: Install dev deps + vitest config + Wave-0 scaffolds** - `315f3f1` (chore)

**Plan metadata:** (SUMMARY commit — see final docs commit)

## Files Created/Modified
- `vitest.config.ts` - Vitest config: node lib env, jsdom component/app env via environmentMatchGlobs, setupFiles, @ alias
- `vitest.setup.ts` - Imports @testing-library/jest-dom/vitest
- `src/lib/__tests__/athlete-id.test.ts` - Wave-0 scaffold (future src/lib/athlete-id.ts)
- `src/lib/__tests__/status.test.ts` - Wave-0 scaffold (future src/lib/status.ts)
- `src/lib/__tests__/rows.test.ts` - Wave-0 scaffold (future src/lib/import/rows.ts)
- `src/lib/__tests__/guardian.test.ts` - Wave-0 scaffold (future src/lib/guardian.ts)
- `src/lib/__tests__/rollover.test.ts` - Wave-0 scaffold (future src/lib/rollover.ts)
- `package.json` - Added test scripts + runtime/dev deps
- `package-lock.json` - Lockfile updated by installs

## Decisions Made
- Phase 2 test runner is vitest; lib tests run in node env, component/app tests switch to jsdom via `environmentMatchGlobs`.
- The 5 scaffold tests are trivial passing stubs that deliberately do NOT import future implementation modules (they don't exist yet) — later plans replace stub bodies with real RED tests.
- csv-parse + @tanstack/react-table are runtime deps; vitest family are devDeps. csv-parse (RFC4180) and react-table were approved by the user in the Task 2 blocking-human package-legitimacy gate.

## Deviations from Plan

None - plan executed exactly as written. Task 2 checkpoint returned for human approval and was approved; execution then continued per plan.

## Issues Encountered
- None. `npm test` passed on the first run (5/5). Two non-blocking vitest startup warnings appeared (ESM-in-CJS config note and vite-tsconfig-paths natively supported suggestion) — informational only, do not affect the green suite.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Vitest runner fully operational; every later plan's `<verify>` can target a real existing test file (Nyquist rule satisfied).
- Later plans (02-02..02-07) can immediately write RED tests against the Wave-0 scaffolds.
- All Phase 2 runtime + dev dependencies are installed and approved.

## Self-Check: PASSED
- All 7 created files verified present.
- Commits `5ce7fdb` and `315f3f1` verified in git history.
- `npm test` green: 5 files / 5 tests passing (verified live).

---
*Phase: 02-club-people*
*Completed: 2026-08-27*
