---
phase: 02-club-people
plan: 04
subsystem: people
tags: [postgres, supabase, nextjs, rls, staff, licenses, guardians, rollover, i18n]

# Dependency graph
requires:
  - phase: 02-club-people
    plan: 02
    provides: seasons, teams, athletes, seasonal memberships, rollover actions, club-data helpers
  - phase: 02-club-people
    plan: 03
    provides: shared deriveStatus helper, organization warning threshold, permission-gated profile routes
provides:
  - Staff profiles independent of login accounts, with seasonal team assignments and professional license expiry tracking
  - Multi-guardian athlete contacts with defensive one-primary normalization and database partial unique index
  - People/staff profile UI, account linking, guardian CRUD UI, and staff assignment carry-forward during season rollover
affects: [02-05, 02-08, scheduling, dashboard, documents]

# Actuals (#2632)
actuals:
  tokens: 20609
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Staff and guardian mutations use org-scoped server actions and data helpers; tenant ids come from requireOrganization.
    - License expiry surfaces reuse deriveStatus and the organization warning threshold rather than duplicating date logic.
    - Staff assignments are pure-function carry-forward data and idempotent season-scoped upserts.
    - Guardian replacement payloads are normalized before the database partial unique index provides the final invariant backstop.

key-files:
  created:
    - supabase/migrations/00006_staff_guardians.sql
    - src/lib/staff.ts
    - src/lib/guardian.ts
    - src/app/[locale]/(dashboard)/people/page.tsx
    - src/app/[locale]/(dashboard)/people/[id]/page.tsx
    - src/app/[locale]/(dashboard)/people/actions.ts
    - src/app/[locale]/(dashboard)/players/[id]/guardians/page.tsx
    - src/app/[locale]/(dashboard)/players/[id]/guardians/actions.ts
  modified:
    - src/types/database.ts
    - src/lib/club-data.ts
    - src/lib/rollover.ts
    - src/lib/__tests__/rollover.test.ts
    - src/lib/__tests__/guardian.test.ts
    - src/app/[locale]/(dashboard)/seasons/actions.ts
    - messages/sr.json
    - messages/en.json

key-decisions:
  - "Used migration 00006_staff_guardians.sql because 00005 is already registration_medical; this follows the reserved numbering requested for this execution."
  - "Staff account linking updates both organization_memberships and app_metadata claims; the reserved super_admin role cannot be granted by a staff manager."
  - "Staff licenses and guardians use replace semantics for their small profile sets; guardian and license row ids are not preserved across a replacement save."

patterns-established:
  - "A nullable unique staff.user_id preserves staff profiles when an account is absent, while linked profiles receive an app role."
  - "Coaches are scoped to their own linked staff profile in staff.ts; org RLS remains the database boundary."

requirements-completed: [STRC-06, STRC-07, STRC-09]

coverage:
  - id: D1
    description: "Staff, staff_teams, staff_licenses, and guardians schema with FORCE RLS, org authorization policies, nullable unique staff.user_id, and one-primary guardian index"
    requirement: STRC-06
    verification:
      - kind: other
        ref: "supabase/migrations/00006_staff_guardians.sql — 4 tables, 4 FORCE RLS statements, 16 policies, one_primary_guardian_per_athlete"
        status: pass
    human_judgment: true
    rationale: "SQL was reviewed locally; live migration/RLS behavior remains part of the Phase 2 schema push gate."
  - id: D2
    description: "Staff list and profile CRUD with active-season teams, contact fields, shared license status pills, and account linking"
    requirement: STRC-06
    verification:
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: true
    rationale: "Server-rendered forms and live Supabase account linking require manual UI verification against a configured project."
  - id: D3
    description: "Professional/federation license type, number, expiry, add/edit/delete controls, and shared green/yellow/red expiry status"
    requirement: STRC-09
    verification:
      - kind: other
        ref: "src/lib/staff.ts uses deriveStatus(valid_until, warning_threshold_days); npm run typecheck"
        status: pass
    human_judgment: false
  - id: D4
    description: "Season rollover carries every previous staff_teams assignment to the new active season idempotently"
    verification:
      - kind: unit
        ref: "src/lib/__tests__/rollover.test.ts#buildStaffCarryForward — 2 tests"
        status: pass
    human_judgment: false
  - id: D5
    description: "Guardian CRUD records multiple contacts and normalizes each athlete's payload to one primary guardian"
    requirement: STRC-07
    verification:
      - kind: unit
        ref: "src/lib/__tests__/guardian.test.ts — 4 tests; npm test: 37 passed"
        status: pass
    human_judgment: true
    rationale: "The pure invariant is automated; live RLS and browser form behavior need the schema-push/manual gate."

# Metrics
duration: 12min
completed: 2026-08-27
status: complete
---

# Phase 2 Plan 4: Club & People Summary

**Staff profiles with shared license expiry status, org-based account roles, one-primary guardian contacts, and staff assignment carry-forward across seasons.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-27T21:41:19Z
- **Completed:** 2026-08-27T21:52:37Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- Added migration `00006_staff_guardians.sql` with staff profiles, seasonal staff/team assignments, professional licenses, guardian contacts, FORCE RLS, org-scoped authorization, and the partial unique one-primary index.
- Added staff data helpers and people pages for profile CRUD, active-season team assignments, license management with `deriveStatus`, and secure account linking with membership plus refreshed app metadata claims.
- Extended the guided season rollover to carry staff assignments forward with an idempotent `ON CONFLICT DO NOTHING` equivalent.
- Replaced the guardian Wave-0 scaffold with four real primary-invariant tests and implemented the guardian list, add, edit, and delete flow.
- Verified the production build, typecheck, and complete Vitest suite (`37 passed`).

## Task Commits

1. **Task 1: Staff and guardian schema/types** — `63b2431` (feat)
2. **Task 2: Staff profiles, licenses, and rollover** — `326f2d2` (feat)
3. **Task 2 security follow-up: activate linked roles securely** — `257aa5b` (fix)
4. **Task 3 RED: guardian primary tests** — `2faba54` (test)
5. **Task 3 GREEN: guardian implementation and CRUD UI** — `553725d` (feat)

**Plan metadata:** pending docs commit.

## Files Created/Modified

- `supabase/migrations/00006_staff_guardians.sql` - Staff/guardian tables, indexes, FORCE RLS, policies, and update triggers.
- `src/types/database.ts` - Database Row/Insert/Update/Relationships shapes for the four new tables.
- `src/lib/staff.ts` - Org-scoped staff CRUD, license replacement, assignment replacement, role linking, and expiry derivation.
- `src/lib/guardian.ts` - Pure one-primary normalization plus org-scoped guardian reads/replacement.
- `src/lib/rollover.ts` and `src/app/[locale]/(dashboard)/seasons/actions.ts` - Staff carry-forward logic and rollover insert step.
- `src/app/[locale]/(dashboard)/people/` - Staff list/profile pages and guarded server actions.
- `src/app/[locale]/(dashboard)/players/[id]/guardians/` - Guardian list and guarded CRUD actions.
- `src/lib/__tests__/guardian.test.ts`, `src/lib/__tests__/rollover.test.ts` - Real guardian and staff rollover coverage.
- `messages/sr.json`, `messages/en.json` - Staff and guardian translations.

## Decisions Made

- The plan's named migration number was shifted to `00006`: `00005_registration_medical.sql` already exists, and the next reserved slot is `00006_staff_guardians.sql`.
- Account linking is organization-based rather than seat-based. The server-only Auth Admin API refreshes app metadata claims after the membership and staff profile are linked so `authorize()` sees the selected role in the next session.
- Staff managers can assign operational app roles but not the reserved `super_admin` role.
- Small staff license and guardian sets use delete-and-reinsert replacement semantics. This keeps the form payload simple and lets the pure guardian normalizer enforce the invariant before insert.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used the reserved migration number 00006**
- **Found during:** Task 1 (migration creation)
- **Issue:** The plan frontmatter named `00005_staff_guardians.sql`, but `00005_registration_medical.sql` already exists from 02-03.
- **Fix:** Created `00006_staff_guardians.sql`, preserving the user's reserved numbering and avoiding migration collision.
- **Files modified:** `supabase/migrations/00006_staff_guardians.sql`
- **Verification:** Migration scan confirmed four tables and four FORCE RLS statements; typecheck and build pass.
- **Committed in:** `63b2431`

**2. [Rule 2 - Security] Refreshed role claims and excluded super-admin grants from staff linking**
- **Found during:** Task 2 review
- **Issue:** A membership row alone would not update the JWT claims used by `authorize()`, and exposing `super_admin` in a staff-manager role selector would permit privilege escalation.
- **Fix:** Added server-only Auth Admin app-metadata refresh and restricted assignable roles to operational app roles.
- **Files modified:** `src/app/[locale]/(dashboard)/people/actions.ts`, `src/app/[locale]/(dashboard)/people/[id]/page.tsx`
- **Verification:** Typecheck and full suite pass; role grant remains behind `staff.manage`.
- **Committed in:** `257aa5b`

**3. [Rule 2 - Missing Critical] Added colocated server action modules for people and guardian forms**
- **Found during:** Task 2/Task 3 UI implementation
- **Issue:** The plan listed the pages but not the server action modules required for validated, permission-gated mutations.
- **Fix:** Added `people/actions.ts` and `players/[id]/guardians/actions.ts` with Zod validation, org scoping, and revalidation.
- **Files modified:** `src/app/[locale]/(dashboard)/people/actions.ts`, `src/app/[locale]/(dashboard)/players/[id]/guardians/actions.ts`
- **Verification:** Typecheck, build, and full suite pass.
- **Committed in:** `326f2d2`, `553725d`

---

**Total deviations:** 3 auto-fixed (1 × Rule 3 blocking, 2 × Rule 2 security/missing-critical).
**Impact on plan:** The migration shift was required to preserve ordered migrations; the action additions and claim hardening are required for secure functioning. No unrelated scope was changed.

## TDD Gate Compliance

- **RED:** `2faba54` — four guardian behavior tests committed before `guardian.ts` existed; the targeted suite failed at import as expected for the absent implementation.
- **GREEN:** `553725d` — guardian normalizer, DB helpers, actions, and UI implemented; guardian suite passed 4/4.
- **REFACTOR:** Not needed.

## Known Stubs

None in files created or modified by this plan. Empty states are intentional data-driven UI states.

## Issues Encountered

- The repository contained unrelated pre-existing changes (`AGENTS.md`, `README.md`, `.opencode/opencode.json`, `.planning/config.json`, and other untracked setup artifacts). They were not staged or modified.
- No live Supabase project was available for applying the migration or exercising RLS/browser flows; those checks remain part of the later Phase 2 schema-push gate.

## User Setup Required

No new setup file was generated. Account linking requires `SUPABASE_SERVICE_ROLE_KEY` to be available server-side; it is never exposed to the browser.

## Next Phase Readiness

- Staff and guardian records are ready for documents/contracts integration in 02-05; staff license documents can be attached once the typed documents table exists.
- The migration sequence is now `00001` through `00006`; 02-05 must use its reserved `00007_documents_contracts.sql` slot.
- Phase 2 still needs the live schema push and RLS/manual UI gates in 02-08.

---
*Phase: 02-club-people*
*Completed: 2026-08-27*

## Self-Check: PASSED

All 14 implementation/test/i18n key paths and all 5 plan commits were verified on disk and in git history. `npm test`, `npm run typecheck`, and `npm run build` passed.
