---
phase: 02-club-people
plan: 06
subsystem: import
tags: [nextjs, supabase, postgres, csv, xlsx, exceljs, csv-parse, zod, rbac, i18n]

# Dependency graph
requires:
  - phase: 02-club-people
    provides: seasons, teams, athletes, seasonal memberships, club athlete ID counter, org-scoped actions, entitlement helpers, and Vitest infrastructure
  - phase: 02-club-people
    provides: shared RLS/authorization and organization context patterns from plans 02-02 and 02-03
provides:
  - Durable org-scoped import_jobs progress ledger with parsed rows, mappings, decisions, counters, and terminal statuses
  - Strict CSV and formula-safe XLSX parsers using csv-parse and exceljs
  - Zod import row model with tolerant header mapping, team validation, strong-key dedupe, duplicate decisions, and CSV formula escaping
  - Re-authorized server actions for bounded upload parsing, batched athlete import, progress polling, entitlement gating, and org isolation
  - Four-step upload, mapping, preview, duplicate-resolution, progress, and result wizard in Serbian and English
affects: [02-07, 02-08, player-roster, registration, youth-finance]

# Actuals (#2632) — pairs with the plan's estimate (48000).
actuals:
  tokens: 16394
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Persist parsed import data and client decisions in import_jobs rather than process memory so batches are resumable.
    - Treat file cells as data only; formula cells become formula text and CSV exports use csvEscaped for formula-injection defense.
    - Re-authorize organization and athletes.create on every server action, with an additional athletes.edit check for duplicate updates.
    - Reject stale or out-of-order batches with processed_rows so a retried request cannot replay a committed slice.

key-files:
  created:
    - supabase/migrations/00008_import_jobs.sql
    - src/lib/import/parsers.ts
    - src/lib/import/rows.ts
    - src/lib/__tests__/rows.test.ts
    - src/app/[locale]/(dashboard)/import/actions.ts
    - src/app/[locale]/(dashboard)/import/page.tsx
  modified:
    - src/types/database.ts
    - next.config.ts
    - messages/sr.json
    - messages/en.json

key-decisions:
  - "Use migration 00008 for import_jobs because 02-02 consumed 00004, while downstream plans reserve 00006 for 02-04 and 00007 for 02-05; this prevents a future migration collision."
  - "Store parsed rows, column mappings, duplicate decisions, and processed_rows in the job ledger so server batches do not depend on a single server process."
  - "Keep the import's supported source vocabulary broader than the current athlete write shape (phone and guardian columns are validated and previewed, while only fields represented by the current athlete/membership schema are written)."

patterns-established:
  - "Strict RFC4180 CSV parsing with bom, trim, skip_empty_lines, and relax_column_count false."
  - "Complete identity dedupe requires a non-empty DOB; null/empty DOB never creates an identity match."
  - "Import polling recognizes done and failed as terminal states and has a 120-second client timeout."

requirements-completed: [REG-08]

coverage:
  - id: D1
    description: "Org-scoped import_jobs schema at migration 00008, strict CSV/XLSX parsing, 2 MB action cap, and 4 MB Server Actions ceiling."
    requirement: REG-08
    verification:
      - kind: other
        ref: "npm run typecheck"
        status: pass
      - kind: other
        ref: "static review: no xlsx package import in src; 00008 contains FORCE ROW LEVEL SECURITY"
        status: pass
    human_judgment: true
    rationale: "Migration ordering and live RLS behavior require the schema push and phase-level Supabase verification."
  - id: D2
    description: "Validated import row model with tolerant mapping, unknown-team errors, strong-key duplicate detection, duplicate decisions, required-field issues, and formula-safe CSV escaping."
    requirement: REG-08
    verification:
      - kind: unit
        ref: "src/lib/__tests__/rows.test.ts — 9 tests"
        status: pass
      - kind: other
        ref: "npx vitest run src/lib/__tests__/rows.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Server-side upload and batched import actions with entitlement checks, per-call authorization/org scope, counters, duplicate update/create/skip behavior, and stale-batch protection."
    requirement: REG-08
    verification:
      - kind: other
        ref: "npm run typecheck"
        status: pass
      - kind: unit
        ref: "npm test — 32 tests across 5 files"
        status: pass
    human_judgment: true
    rationale: "Action behavior against live Supabase RLS, entitlements, and a real multi-batch roster needs manual integration verification after migrations are pushed."
  - id: D4
    description: "Responsive four-step import wizard: upload, column mapping, first-50-row validation preview with duplicate controls, and bounded progress/result polling."
    requirement: REG-08
    verification:
      - kind: other
        ref: "npm run typecheck"
        status: pass
      - kind: other
        ref: "npm test — full suite green"
        status: pass
    human_judgment: true
    rationale: "Visual layout and end-to-end browser interaction are not covered by the current Vitest suite."

# Metrics
duration: 17min
completed: 2026-08-27
status: complete
---

# Phase 2 Plan 6: CSV/XLSX Player Import Summary

**Secure server-side CSV/XLSX roster import with column mapping, validation preview, strong-key duplicate resolution, entitlement enforcement, batched progress, and Serbian/English wizard copy.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-27T21:09:00Z
- **Completed:** 2026-08-27T21:25:51Z
- **Tasks:** 3
- **Files modified:** 10 planned files (plus the tracked test replacement)

## Accomplishments

- Added `import_jobs` at migration `00008_import_jobs.sql` with FORCE RLS, org-scoped policies, progress counters, persisted parsed rows, mappings, duplicate choices, and `processed_rows` replay protection.
- Added strict `csv-parse` and `exceljs` parsers. XLSX formulas are never evaluated, and the row model includes a formula-injection-safe CSV escaping helper.
- Replaced the Wave-0 rows stub with nine real RED/GREEN assertions covering team validation, required fields, mapping, dedupe keys, null DOB safety, and duplicate decisions.
- Added server actions that cap uploads at 2 MB, recheck permissions and organization scope on every call, enforce `max_players`, validate teams without creating them, and import in bounded slices.
- Added the complete four-step client wizard with automatic mapping, per-row errors, duplicate skip/update/create controls, summary counts, terminal-state polling, timeout handling, and upgrade gate.

## Task Commits

Each task was committed atomically:

1. **Task 1: Import storage + parsers + Server Action body budget** — `f037021` (feat)
2. **Task 2 RED: Import row validation and dedupe tests** — `70cac6e` (test)
3. **Task 2 GREEN: Validated rows and batched server actions** — `e4d059a` (feat)
4. **Task 2 follow-up: Blank optional cell handling** — `836c24a` (fix)
5. **Task 3: Four-step import wizard and translations** — `6c79e18` (feat)

**Plan metadata:** pending docs/tracking commit.

## Files Created/Modified

- `supabase/migrations/00008_import_jobs.sql` — durable import ledger, JSON payloads, progress cursor, and org/permission RLS.
- `src/types/database.ts` — `Json` type and `import_jobs` table shape.
- `next.config.ts` — preserved the existing config and set `experimental.serverActions.bodySizeLimit` to `4mb`; externalized exceljs.
- `src/lib/import/parsers.ts` — strict CSV and ExcelJS first-sheet parsers with safe formula treatment.
- `src/lib/import/rows.ts` — canonical fields, header mapping, Zod schema, team validation, dedupe, decisions, and CSV escaping.
- `src/lib/__tests__/rows.test.ts` — real RED/GREEN import row behavior tests replacing the scaffold.
- `src/app/[locale]/(dashboard)/import/actions.ts` — upload parse, import gate, batch mutation, progress polling, and server-side safeguards.
- `src/app/[locale]/(dashboard)/import/page.tsx` — four-step client wizard.
- `messages/sr.json`, `messages/en.json` — all import wizard labels and status copy.

## Decisions Made

- Import jobs use migration `00008`, not the plan's stale `00007`, because the reserved downstream sequence is `00006` (02-04), `00007` (02-05), `00008` (02-06), and `00009` (02-07).
- Job payload and cursor state are persisted in JSONB columns to keep server batch actions stateless across requests and prevent replayed offsets from duplicating writes.
- The import supports club athlete numbers as an additional mapping target because D-15's strongest duplicate key is the existing club athlete ID; new athletes still receive their permanent number from the atomic counter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renumbered the import migration to 00008**
- **Found during:** Task 1
- **Issue:** The plan named `00007_import_jobs.sql`, but the phase's existing counter migration consumed 00004 and downstream plans reserve 00006/00007.
- **Fix:** Created `supabase/migrations/00008_import_jobs.sql` and recorded the sequence decision here for future executors.
- **Files modified:** `supabase/migrations/00008_import_jobs.sql`
- **Verification:** Migration inventory and prior plan summaries reviewed; no duplicate number introduced.
- **Committed in:** `f037021`

**2. [Rule 2 - Missing Critical] Added persisted job payload and cursor fields**
- **Found during:** Task 1 / Task 2 action design
- **Issue:** A job containing only counters cannot support stateless server batches, saved mapping/duplicate choices, or safe retry handling as required by D-13.
- **Fix:** Added `parsed_rows`, `column_mapping`, `duplicate_decisions`, and `processed_rows` JSONB/integer fields, with offset checks in every batch action.
- **Files modified:** `supabase/migrations/00008_import_jobs.sql`, `src/types/database.ts`, `src/app/[locale]/(dashboard)/import/actions.ts`
- **Verification:** Typecheck passed; stale offsets return without replaying a batch.
- **Committed in:** `f037021`, `e4d059a`

**3. [Rule 1 - Bug] Accepted blank optional enum and numeric cells**
- **Found during:** Task 2 GREEN verification
- **Issue:** Ordinary blank CSV cells for optional gender/number columns were being treated as invalid values, blocking otherwise valid imports.
- **Fix:** Preprocess blank optional values to `undefined` before Zod enum/number validation.
- **Files modified:** `src/lib/import/rows.ts`
- **Verification:** Targeted rows tests and typecheck passed.
- **Committed in:** `836c24a`

---

**Total deviations:** 3 auto-fixed (1 Rule 3 blocking, 1 Rule 2 missing-critical, 1 Rule 1 bug).
**Impact on plan:** The migration renumber and persisted state are required for the phase's actual dependency order and server-side correctness; blank-cell handling prevents false validation failures. No unrelated files were changed.

## TDD Gate Compliance

Task 2 followed RED → GREEN:

1. **RED:** `70cac6e` — real rows tests failed because `src/lib/import/rows.ts` was absent.
2. **GREEN:** `e4d059a` — row model and actions implemented; targeted tests passed.

The `836c24a` follow-up fixed optional blank-cell behavior without changing the test gate. No separate refactor commit was needed.

## Tests and Verification

- `npx vitest run src/lib/__tests__/rows.test.ts` — **9 passed**.
- `npm test` — **32 passed across 5 files**.
- `npm run typecheck` — **passed**.
- Static review confirmed no `xlsx` package import in `src` and `00008_import_jobs.sql` contains FORCE RLS.

## Issues Encountered

- Existing unrelated worktree changes were present at dispatch (`AGENTS.md`, `README.md`, `.planning/config.json`, `.opencode/opencode.json`, and untracked setup artifacts). They were left untouched and are not included in any plan commit.
- Live Supabase schema/RLS and browser UI verification remain phase-level checks for 02-08 because no local Docker/Supabase emulator is available.

## User Setup Required

None — no new external service configuration is required.

## Next Phase Readiness

- The import route and actions are ready for the Phase 2 schema push once migrations `00006` and `00007` are present in sequence.
- Future executors must preserve the migration order: 02-04 → `00006`, 02-05 → `00007`, 02-06 → `00008`, 02-07 → `00009`.
- Browser/UAT verification should exercise a real CSV and XLSX, unknown team errors, duplicate choices, FREE-plan limit behavior, and a multi-batch import after 02-08 pushes the schema.

---
*Phase: 02-club-people*
*Completed: 2026-08-27*

## Self-Check: PASSED

All planned implementation files exist, all five plan-related production/test commits are present in git, the 9 targeted rows tests and 32-test suite pass, and `npm run typecheck` is clean. Unrelated pre-existing worktree changes remain uncommitted and untouched.
