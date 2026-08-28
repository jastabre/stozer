---
phase: 02-club-people
plan: 08
subsystem: database
tags: [supabase, postgres, migrations, typescript, db-push, enum, trigger]

# Dependency graph
requires:
  - phase: 02-club-people
    provides: migration files 00002..00009 authored across plans 02-02..02-07 (enum extensions, club core + counter RPC, registration/medical, staff/guardians, documents/contracts, import jobs, equipment)
provides:
  - All Phase 2 migrations (00001..00010) applied to the linked Supabase project — remote DB is now the source of truth
  - src/types/database.ts regenerated from the pushed schema, alias exports preserved
  - teams.sport org-inheritance restored via trigger (subquery DEFAULT is invalid PostgreSQL)
  - Full phase gate green: vitest, production build, lint, typecheck
affects: [02-checker verification, any future plan that reads the remote schema or regenerates types]

# Actuals (#2632) — pairs with the plan's estimate (14000 tokens) to calibrate future estimates.
actuals:
  tokens: 25000    # chars/4 over the realized diff (~2800 changed lines, mostly generated type content)
  tasks: 2         # tasks completed
  commits: 3       # 2 task commits + 1 docs commit

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ALTER TYPE ... ADD VALUE must live in a separate migration from any statement that uses the new value (PostgreSQL 55P04; supabase CLI executes each migration file in one transaction — COMMIT/BEGIN inside a file is not supported)"
    - "Org-inherited column defaults must use BEFORE INSERT triggers, never subquery DEFAULTs (PostgreSQL 0A000)"
    - "Regenerated database types: re-derive named alias exports (AppRole/AppPermission/...) that the generator drops"

key-files:
  created:
    - supabase/migrations/00010_app_permission_seeds.sql
  modified:
    - src/types/database.ts
    - src/lib/club-data.ts
    - supabase/migrations/00002_app_permission_extensions.sql
    - supabase/migrations/00003_club_core.sql
    - src/app/[locale]/(dashboard)/import/actions.ts
    - .gitignore

key-decisions:
  - "00002 keeps only the six ALTER TYPE ... ADD VALUE statements; its seed INSERTs moved verbatim to new migration 00010 — the split is required because PostgreSQL forbids using an ADD VALUE result in the same transaction (55P04) and the CLI cannot COMMIT inside a migration file"
  - "teams.sport subquery DEFAULT replaced with the teams_inherit_sport BEFORE INSERT trigger (PostgreSQL forbids subqueries in DEFAULT, 0A000); application code keeps omitting sport on insert"
  - "src/types/database.ts = generated output + re-derived alias exports; teams.sport stays optional in Insert (trigger fills it); registrations.created_at reconciled to string | null in club-data.ts (DB column is nullable)"
  - "supabase/.temp/ gitignored — machine-local CLI link state"

patterns-established:
  - "Pattern: enum extension migrations are enum-only; seed/usage statements go in a follow-up migration"

requirements-completed: [STRC-01, STRC-02, STRC-03, STRC-04, STRC-05, STRC-06, STRC-07, STRC-08, STRC-09, REG-01, REG-02, REG-03, REG-04, REG-05, REG-06, REG-07, REG-08, REG-09]

coverage:
  - id: D1
    description: "All Phase 2 migrations applied to the linked Supabase project and listed as applied by the migration tool (00002..00009, plus 00001 and new 00010)"
    verification:
      - kind: other
        ref: "npx supabase@latest migration list --linked (00001..00010 all show in Remote column)"
        status: pass
    human_judgment: false
  - id: D2
    description: "src/types/database.ts regenerated from the pushed schema and reconciled with the phase's code (AppRole/AppPermission exports preserved, source tree compiles)"
    verification:
      - kind: other
        ref: "npm run typecheck (exit 0)"
        status: pass
      - kind: other
        ref: "npm run build (compiled + TypeScript finished)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full phase automated gate green — vitest suite, production build, lint"
    verification:
      - kind: unit
        ref: "npx vitest run (6 files, 41 tests passed)"
        status: pass
      - kind: other
        ref: "npm run build (Next.js 16 production build, 24 routes)"
        status: pass
      - kind: other
        ref: "npm run lint (0 errors; 5 pre-existing warnings)"
        status: pass
    human_judgment: false

# Metrics
duration: 24min
completed: 2026-08-28
status: complete
---

# Phase 02 Plan 08: Push Phase 2 Migrations & Regenerate Database Types Summary

**Pushed all nine Phase 2 migration files to the linked Supabase project (00001..00009 plus a new 00010 seed-split), regenerated src/types/database.ts from the pushed schema with the AppRole/AppPermission import surface preserved, and proved the whole phase green (vitest 6/41, production build, lint, typecheck).**

## Performance

- **Duration:** 24 min
- **Started:** 2026-08-28T17:04:00Z
- **Completed:** 2026-08-28T17:28:25Z
- **Tasks:** 2 completed
- **Files modified:** 7

## Accomplishments

- **Remote DB is now the source of truth**: `supabase migration list --linked` shows 00001..00010 applied. 00001_foundation.sql was *also* not yet applied (fresh remote project) — the plan's task action anticipated this ("if not, the push applies it too — verify the full list afterwards"). The phase's seven migrations are 00002..00009 (renumbering correction from STATE.md).
- **Two unapplyable migrations fixed at the source** (both were rolled back cleanly, so no applied migration was ever mutated):
  - `00002`: split into enum-only (00002) + new `00010_app_permission_seeds.sql` (seed INSERTs) — PostgreSQL SQLSTATE 55P04 forbids using an `ALTER TYPE ... ADD VALUE` result in the same transaction, and the supabase CLI runs each migration file in one transaction (CLI issue #5047: `COMMIT; BEGIN;` inside a file is silently broken).
  - `00003`: `teams.sport` had `DEFAULT (SELECT sport::sport_type ...)` — PostgreSQL SQLSTATE 0A000 forbids subqueries in DEFAULT expressions. Replaced with a `teams_inherit_sport` BEFORE INSERT trigger that fills sport from the org when omitted (application `createTeam` omits it, relying on this inheritance).
- **Types regenerated + reconciled**: `supabase gen types typescript --linked` output grafted into `src/types/database.ts`; named alias exports (`AppRole`, `AppPermission`, `SportType`, `DocumentType`, `ContractStatus`, `EquipmentItemState`, `EquipmentRequestStatus`) re-derived from the generated enums (the generator drops them). Deltas reconciled via typecheck: `teams.sport` optional in Insert (trigger fills it), `registrations.created_at` → `string | null` in `club-data.ts`.
- **Full gate green**: vitest 6 files / 41 tests passed, `next build` succeeded (24 routes), `eslint` exit 0, `tsc --noEmit` exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Push migrations 00002-00009 and regenerate database types** - `d878d4c` (feat)
2. **Task 2: Full phase gate — vitest, production build, lint** - `f792758` (fix)

**Plan metadata:** `(docs commit below)`

## Files Created/Modified

- `src/types/database.ts` - Regenerated from the pushed schema (`gen types --linked`) with alias exports re-derived; `teams.sport` optional in Insert (trigger-inherited)
- `src/lib/club-data.ts` - `Registration.created_at` reconciled to `string | null` (DB column nullable)
- `supabase/migrations/00002_app_permission_extensions.sql` - Now enum-only (seeds moved to 00010); documents the 55P04 split
- `supabase/migrations/00003_club_core.sql` - `teams.sport` subquery DEFAULT removed; `inherit_team_sport()` trigger + `teams_inherit_sport` added
- `supabase/migrations/00010_app_permission_seeds.sql` - NEW: role_permissions seeds that use the 00002 enum values (own transaction)
- `src/app/[locale]/(dashboard)/import/actions.ts` - Empty `ImportPreviewAthlete` interface → type alias (lint gate)
- `.gitignore` - Added `supabase/.temp/` (CLI link state, machine-local)

## Decisions Made

- Enum extension migrations are enum-only in this project going forward; statements that *use* new values go in a follow-up migration (PostgreSQL 55P04 + CLI single-transaction-per-file behavior).
- `teams.sport` inheritance moved from a (never-valid) subquery DEFAULT to a BEFORE INSERT trigger — schema intent preserved exactly.
- `src/types/database.ts` keeps the generated table/enum shapes verbatim and layers the alias exports on top, rather than hand-editing the generated body.
- `supabase/.temp/` is gitignored (it is generated link state, not source).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Enum ADD VALUE split out of 00002 into new migration 00010**
- **Found during:** Task 1 (push step 2)
- **Issue:** `db push` failed at 00002 with `ERROR: unsafe use of new value "seasons.view" of enum type app_permission (SQLSTATE 55P04)`. PostgreSQL forbids using an `ALTER TYPE ... ADD VALUE` result in the same transaction, and the supabase CLI executes each migration file inside a single transaction (verified via CLI issue #5047 — `COMMIT; BEGIN;` inside a file is silently ignored). The INSERTs seeding the new permissions could never apply in the same file.
- **Fix:** 00002 now contains only the six `ADD VALUE IF NOT EXISTS` statements; the four seed INSERT blocks moved verbatim to new `00010_app_permission_seeds.sql` (its own transaction sees the committed values). 00002 was not applied (rollback was clean), so no applied migration was edited.
- **Files modified:** supabase/migrations/00002_app_permission_extensions.sql, supabase/migrations/00010_app_permission_seeds.sql
- **Verification:** `db push --linked` applied 00002..00010; `migration list --linked` shows all applied
- **Committed in:** d878d4c (Task 1 commit)

**2. [Rule 1 - Bug] teams.sport subquery DEFAULT replaced with inherit_team_sport trigger**
- **Found during:** Task 1 (push step 2)
- **Issue:** 00003 failed with `ERROR: cannot use subquery in DEFAULT expression (SQLSTATE 0A000)`. The `DEFAULT (SELECT sport::sport_type FROM organizations WHERE id = organization_id)` authored in 02-02 is invalid PostgreSQL and could never have applied to any database.
- **Fix:** Removed the subquery DEFAULT (column stays `NOT NULL`); added `inherit_team_sport()` BEFORE INSERT trigger that sets `NEW.sport` from the org's sport when omitted. `createTeam` (actions.ts) omits sport and relies on this inheritance, so behavior is preserved. Plain SECURITY INVOKER is sufficient — the org SELECT policy lets any member read their own org.
- **Files modified:** supabase/migrations/00003_club_core.sql
- **Verification:** `db push --linked` applied 00003 cleanly; subsequent gates green
- **Committed in:** d878d4c (Task 1 commit)

**3. [Rule 1 - Bug] Empty ImportPreviewAthlete interface → type alias (lint gate)**
- **Found during:** Task 2 (lint step)
- **Issue:** `eslint` errored on `export interface ImportPreviewAthlete extends AthleteRef {}` (`@typescript-eslint/no-empty-object-type`), a pre-existing Phase 2 (02-06) issue that blocked the plan's mandatory lint gate.
- **Fix:** Converted to `export type ImportPreviewAthlete = AthleteRef;` (used only as a type, never extended).
- **Files modified:** src/app/[locale]/(dashboard)/import/actions.ts
- **Verification:** `npm run lint` exit 0 (0 errors)
- **Committed in:** f792758 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All three fixes were required for the [BLOCKING] gate to pass — the pushed SQL is now valid PostgreSQL with identical schema semantics, and lint passes without weakening the gate. No scope creep.

## Issues Encountered

- **Push diff included 00001_foundation.sql** — the remote project had no migration history (Phase 1's push was evidently never executed). The plan's task action explicitly covers this case ("if not, the push applies it too — verify the full list afterwards"), so the push proceeded; final list verified 00001..00010 applied.
- **5 pre-existing eslint warnings** remain (unused vars in contracts/page.tsx, seasons/page.tsx, Sidebar.tsx, entitlements.ts). They do not fail the gate (exit 0) and are out of scope for this plan per the scope boundary rule; flagged for a future cleanup.
- **`middleware` deprecation warning** during `next build` (Next.js 16 prefers `proxy`) — pre-existing, known (STATE.md lessons learned).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The linked Supabase project now carries the full Phase 2 schema; all automated gates (vitest, build, lint, typecheck) are green — the phase is ready for checker verification.
- Note for the checker/verifier: `migration list --linked` shows 10 applied migrations (00001..00010), not 8 — 00001 was applied by this push and 00010 is the 55P04 seed split.
- Future migration authoring rule (adopted): enum `ADD VALUE` and its consumers must never share a migration file.

---
*Phase: 02-club-people*
*Completed: 2026-08-28*