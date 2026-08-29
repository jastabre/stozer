---
phase: 02-club-people
plan: 07
subsystem: equipment
tags: [supabase, postgres, rls, nextjs, csv, rbac, i18n]

requires:
  - phase: 02-club-people
    provides: seasons, teams, athletes, seasonal memberships, staff profiles, org-scoped authorization, and typed database definitions
provides:
  - Organization-scoped athlete equipment sizing and issue-state management
  - Lightweight team/training quantity tracking and equipment requests
  - Team CSV export with selectable types, missing-only filtering, and formula escaping
  - Permission-gated Equipment navigation and concise player equipment summaries
affects: [02-08, scheduling, dashboard, youth-finance]

actuals:
  tokens: 21393
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - Equipment state transitions are whitelisted in the server data layer and re-authorized in every Server Action.
    - Missing athlete equipment is derived from the enabled-type cross product, so new or promoted athletes appear immediately.
    - Team, athlete, staff, season, and equipment-type references are checked in actions and protected by composite organization foreign keys.
    - CSV exports reuse the import module's formula-injection escaping guard.

key-files:
  created:
    - supabase/migrations/00009_equipment.sql
    - src/lib/equipment.ts
    - src/lib/equipment-export.ts
    - src/lib/__tests__/equipment-export.test.ts
    - src/app/[locale]/(dashboard)/equipment/actions.ts
    - src/app/[locale]/(dashboard)/equipment/page.tsx
    - src/app/[locale]/(dashboard)/equipment/export/route.ts
    - src/app/[locale]/(dashboard)/players/[id]/equipment/page.tsx
  modified:
    - src/types/database.ts
    - src/lib/rbac.ts
    - src/app/[locale]/(dashboard)/players/[id]/page.tsx
    - messages/sr.json
    - messages/en.json

key-decisions:
  - "Use the reserved 00009_equipment.sql migration slot because 00008_import_jobs.sql is already owned by Plan 02-06."
  - "Keep the operational model lightweight: quantities and explicit states, without serial numbers, warehouses, procurement, or accounting."
  - "Require a linked staff profile for request creation and request decisions so the workflow records accountable people."

patterns-established:
  - "Player equipment is a read-heavy overview; detailed state changes remain in the dedicated Equipment area rather than the player profile."
  - "The Equipment menu is exposed for every role seeded with equipment.view, while mutations independently require equipment.report or equipment.manage."

requirements-completed: [STRC-04]

coverage:
  - id: D1
    description: "Equipment types, team requirements, athlete equipment, team quantities, and requests schema with defaults, triggers, FORCE RLS, and tenant-safe references"
    requirement: STRC-04
    verification:
      - kind: other
        ref: "supabase/migrations/00009_equipment.sql — five FORCE ROW LEVEL SECURITY statements; default seed backfill and organization trigger"
        status: pass
    human_judgment: true
    rationale: "The migration was reviewed locally; applying it and exercising cross-tenant RLS requires the Phase 2 schema-push gate."
  - id: D2
    description: "Player Equipment overview derives missing rows, supports sizes and issue states, aggregates complete/missing/not-issued/lost-damaged filters, and enforces legal transitions"
    requirement: STRC-04
    verification:
      - kind: other
        ref: "npm run typecheck"
        status: pass
      - kind: other
        ref: "src/lib/equipment.ts — explicit allowedTransitions map and derived missing cross product"
        status: pass
    human_judgment: true
    rationale: "Live Supabase state transitions and permission combinations need browser/RLS verification after the schema is pushed."
  - id: D3
    description: "Team/training quantity records and Requested → Approved → Purchased/Rejected request workflow with manager controls"
    verification:
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: true
    rationale: "The server actions and rendered forms are statically verified; live role behavior and linked requester handling need manual UAT."
  - id: D4
    description: "Selectable team CSV export, formula-safe values, permission-based navigation, and concise per-athlete equipment summary"
    verification:
      - kind: unit
        ref: "src/lib/__tests__/equipment-export.test.ts — 4 tests"
        status: pass
      - kind: other
        ref: "npm run build — /[locale]/equipment, /equipment/export, and player equipment routes compiled"
        status: pass
    human_judgment: true
    rationale: "Visual navigation visibility and browser download behavior are not covered by the current automated suite."

duration: 16min
completed: 2026-08-28
status: complete
---

# Phase 02 Plan 07: Equipment Summary

**Permission-aware equipment operations with player sizing and issue states, lightweight shared quantities, request workflow, and safe team CSV export.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-28T00:15:00Z
- **Completed:** 2026-08-28T00:31:37Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Added the reserved `00009_equipment.sql` migration with configurable per-organization equipment types, Match Kit/Tracksuit/Training Kit defaults for existing and future organizations, team requirements, athlete kit rows, team quantities, and request statuses.
- Added organization-scoped equipment helpers and guarded actions. Athlete sizes are separate from issue state, missing rows are derived for the enabled-type overview, and invalid state transitions are rejected.
- Built the three-area Equipment page: player overview with counts and filters, team/training quantity tracking, and central request management with type/requirement settings.
- Added selectable, missing-only team CSV export through a permission-checked route and formula-safe field escaping, plus a read-only per-athlete summary.
- Added Equipment navigation to all four seeded `equipment.view` roles and hid the player profile's Equipment link when the viewer lacks that permission.

## Task Commits

1. **Task 1: Equipment schema and database types** — `53cd467` (feat)
2. **Task 1 security follow-up: organization-safe foreign keys** — `4083b57` (fix)
3. **Task 2: Equipment operations section** — `f276f34` (feat)
4. **Task 2 security/UI follow-up: guarded references and export controls** — `c91a11b` (fix)
5. **Task 3: summaries, export, navigation, and export tests** — `cbd82fd` (feat)

**Plan metadata:** pending docs/tracking commit.

## Files Created/Modified

- `supabase/migrations/00009_equipment.sql` — Equipment enums, five tables, default seeds/trigger, RLS, indexes, and organization-consistent foreign keys.
- `src/types/database.ts` — Typed equipment rows, inserts, updates, relationships, and enums.
- `src/lib/equipment.ts` — Overview aggregation, size/state operations, team quantities, requirements, and requests.
- `src/app/[locale]/(dashboard)/equipment/{page.tsx,actions.ts}` — Permission-aware three-area Equipment UI and server mutations.
- `src/lib/equipment-export.ts` — Pure CSV builder with selected-type and missing-only options.
- `src/app/[locale]/(dashboard)/equipment/export/route.ts` — Permission-checked CSV download route scoped to the active season/team.
- `src/app/[locale]/(dashboard)/players/[id]/equipment/page.tsx` — Concise read-only athlete summary.
- `src/lib/rbac.ts`, player profile, and `messages/{sr,en}.json` — Navigation visibility, profile link gating, and localized copy.
- `src/lib/__tests__/equipment-export.test.ts` — Identity/status columns, filters, selected types, and formula/punctuation escaping.

## Tests and Verification

- `npm test` — **41 tests passed across 6 files**.
- `npm run typecheck` — **passed**.
- `npm run build` — **passed**; equipment page, export route, and player equipment route compiled.
- Migration review — **5 equipment tables use FORCE ROW LEVEL SECURITY**, default seed backfill and future-organization trigger are present.
- Export review — all headers and values pass the shared formula-leading-character and CSV punctuation escaping helper.

## Decisions Made

- Equipment owns migration `00009_equipment.sql`; the plan frontmatter's `00008` is stale because Plan 02-06 owns `00008_import_jobs.sql`. The existing import migration was not overwritten.
- The three named default types are represented as three configurable equipment types with `upper_lower` sizing; top/bottom pieces are not modeled as separate inventory records.
- The export route uses the active season and current membership jersey numbers, while equipment records remain athlete/type scoped and reusable across seasons.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used the reserved equipment migration slot**
- **Found during:** Task 1
- **Issue:** The plan listed `00008_equipment.sql`, but `00008_import_jobs.sql` already exists and is owned by Plan 02-06.
- **Fix:** Created `00009_equipment.sql` and left `00008_import_jobs.sql` untouched.
- **Files modified:** `supabase/migrations/00009_equipment.sql`
- **Verification:** Migration inventory, typecheck, and final build passed.
- **Committed in:** `53cd467`

**2. [Rule 2 - Security] Added tenant-consistent references and action-side reference validation**
- **Found during:** Task 2 and final schema review
- **Issue:** Single-column foreign keys plus org-scoped row policies do not by themselves prevent a malicious authenticated client from attempting to link a team, athlete, staff member, season, or equipment type from another organization.
- **Fix:** Added composite organization foreign keys in the migration and validated referenced records in equipment helpers before writes.
- **Files modified:** `supabase/migrations/00009_equipment.sql`, `src/lib/equipment.ts`
- **Verification:** Typecheck, full tests, and build passed; migration review confirmed the composite constraints.
- **Committed in:** `c91a11b`, `4083b57`

**3. [Rule 2 - Missing Critical] Added colocated equipment actions and a secure export route**
- **Found during:** Task 2/Task 3 implementation
- **Issue:** The plan's page task required mutations and a CSV button, but the listed files did not include the server action boundary or a browser-download endpoint.
- **Fix:** Added re-authorized Server Actions for every mutation and a permission-checked active-season CSV route; added export unit tests.
- **Files modified:** `src/app/[locale]/(dashboard)/equipment/actions.ts`, `src/app/[locale]/(dashboard)/equipment/export/route.ts`, `src/lib/__tests__/equipment-export.test.ts`
- **Verification:** `npm test`, `npm run typecheck`, and `npm run build` passed.
- **Committed in:** `f276f34`, `cbd82fd`

---

**Total deviations:** 3 auto-fixed (1 × Rule 3 blocking, 2 × Rule 2 security/missing-critical).
**Impact on plan:** The migration shift preserves the ordered schema; tenant checks and action/route boundaries are required for secure operation. No ERP scope was added.

## Issues Encountered

- No local Docker/Supabase project was available, so live migration application, RLS isolation, and browser role/download checks remain in the 02-08 schema-push and manual gate.
- Vitest emits existing Vite configuration deprecation warnings; all tests remain green.

## Known Stubs

None in files created or modified by this plan. Empty equipment, team, and request states are intentional data-driven states.

## Authentication Gates

None encountered.

## User Setup Required

None — no new external service configuration is required.

## Next Phase Readiness

- Equipment is ready for 02-08 to push migrations `00002..00009` in order and test RLS with organization and role permutations.
- Manual UAT should cover default type seeding for old/new organizations, issue/return/lost/damaged transitions, team requirements, linked staff request attribution, selected/missing-only export downloads, and navigation visibility for all four seeded equipment-view roles.

---
*Phase: 02-club-people*
*Completed: 2026-08-28*

## Self-Check: PASSED

All 13 implementation files in the execution diff are present. Production commits `53cd467`, `f276f34`, `cbd82fd` and follow-up fixes `c91a11b`, `4083b57` are present in git history. Final `npm test` (41 passed), `npm run typecheck`, and `npm run build` passed. All 13 key files exist on disk and all five production commit hashes were found in git history.
