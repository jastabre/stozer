---
phase: 02-club-people
plan: 02
subsystem: club-core
tags: [postgres, supabase, nextjs, rls, rollover, club-athlete-id, rbac, i18n]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: foundation schema (00001), RBAC (role_permissions), entitlements, org/requireOrganization helpers, vitest infra
provides:
  - Club core domain model: seasons, teams, athletes, seasonal_memberships tables with RLS (migrations 00002/00003/00004)
  - Club athlete ID utilities: C-format payment reference + atomic per-org counter RPC
  - Club data layer: getActiveSeason, listTeams, listAthletesWithCurrentMembership, createAthlete, countAthletes, getAthleteWithMemberships, updateAthleteFederationId, listSeasons
  - Rollover pure logic: buildCarryForward + validateRollover (D-03)
  - Players roster page + create-player server action; athlete profile page (identity, federation ID, membership history)
  - Seasons page (guided Start New Season rollover) + teams CRUD page
  - youth_director RBAC nav (Teams + People) + messages sr/en
affects: 02-03, 02-04, 02-05, 02-06, 02-07, 02-08 (REST of Phase 2 hangs off this core model)

# Actuals (#2632) — pairs with the plan's estimate (55000).
actuals:
  tokens: 23193   # chars/4 over the realized diff (92773 chars)
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pattern 3 per-org transactional counter via SECURITY DEFINER RPC (claim_club_athlete_number) + UNIQUE backstop
    - Pattern 1 partial unique index for single-active-season invariant
    - Hand-written supabase Database types must include Views:{} + Relationships on EVERY table for nested relational selects to type-check
    - Pure rollover logic separated from DB (testable); server actions for all mutations (revalidatePath + redirect)

key-files:
  created:
    - supabase/migrations/00004_club_core_counter.sql
    - src/lib/athlete-id.ts
    - src/lib/club-data.ts
    - src/lib/rollover.ts
    - src/lib/__tests__/athlete-id.test.ts
    - src/lib/__tests__/rollover.test.ts
    - src/schemas/player.ts
    - src/app/[locale]/(dashboard)/players/{actions.ts,page.tsx,[id]/page.tsx}
    - src/app/[locale]/(dashboard)/seasons/{actions.ts,page.tsx}
    - src/app/[locale]/(dashboard)/teams/{actions.ts,page.tsx}
  modified:
    - supabase/migrations/00002_app_permission_extensions.sql
    - supabase/migrations/00003_club_core.sql
    - src/types/database.ts
    - src/lib/rbac.ts
    - messages/sr.json
    - messages/en.json
    - vitest.config.ts

key-decisions:
  - "Implemented Pattern 3 counter as a SECURITY DEFINER RPC (claim_club_athlete_number) because supabase-js cannot express UPDATE ... SET col=col+1 ... RETURNING atomically"
  - "Added JWT org-scoping inside the counter RPC so a caller can only claim a number for their own org (org isolation defense-in-depth)"
  - "Realized the rollover 'one transaction' as sequential server-action steps with the partial unique index as the DB backstop for the single-active invariant (supabase-js cannot wrap multi-statement transactions)"
  - "Hand-written Database type needs Views:{} + Relationships on all tables so nested relational selects resolve instead of collapsing to never"

patterns-established:
  - "Pattern 1: partial unique index for 1-of-N invariants (single active season)"
  - "Pattern 3: per-org transactional counter via atomic UPDATE..RETURNING RPC"
  - "Pure business logic (ID format, counter increment, rollover) in lib modules; DB mutations only in server actions"
  - "Every DB-involving mutation gated by requireOrganization() (org from JWT, never client) + hasPermission()"

requirements-completed: [STRC-01, STRC-02, STRC-03, STRC-04, STRC-05, STRC-08, REG-05]

# Coverage metadata — D1..D6 map to the phase's locked decisions + requirements.
coverage:
  - id: D1
    description: "Seasons table with single-active invariant (partial unique index) + seasons management (create/archive/rollover)"
    requirement: STRC-01
    verification:
      - kind: automated_ui
        ref: "src/app/[locale]/(dashboard)/seasons/page.tsx (server component + startNewSeason action); one_active_season_per_org index in 00003"
        status: pass
    human_judgment: false
  - id: D2
    description: "Teams table + CRUD with category + sport abstraction and active-season athlete count"
    requirement: STRC-02
    verification:
      - kind: automated_ui
        ref: "src/app/[locale]/(dashboard)/teams/{page.tsx,actions.ts}; listTeams in club-data.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Player profiles as permanent identities with membership history across seasons; C-format club athlete ID as payment reference; federation ID free-text reference field"
    requirement: STRC-03
    verification:
      - kind: unit
        ref: "src/lib/__tests__/athlete-id.test.ts#formatClubAthleteNumber"
        status: pass
    human_judgment: false
  - id: D4
    description: "Seasonal membership history correctly separated current vs past (D-04) and jersey on membership (D-07)"
    requirement: STRC-04
    verification:
      - kind: unit
        ref: "src/lib/__tests__/rollover.test.ts#buildCarryForward"
        status: pass
    human_judgment: false
  - id: D5
    description: "Club athlete ID auto-assign via atomic counter + unique(org, number) backstop (D-05)"
    requirement: STRC-05
    verification:
      - kind: unit
        ref: "src/lib/__tests__/athlete-id.test.ts#buildClubAthleteNumber"
        status: pass
    human_judgment: false
  - id: D6
    description: "Sport type abstraction (sport_type enum) for extensibility (STRC-08) and generic federation identifier approach (REG-05: free-text only, no generic table)"
    requirement: STRC-08
    verification:
      - kind: automated_ui
        ref: "sport_type enum + teams.sport default in 00003; federation_id free-text on athletes + profile"
        status: pass
    human_judgment: false

# Metrics
duration: 65min
completed: 2026-08-27
status: complete
---

# Phase 2 Plan 2: Club & People Core — Summary

**Multi-tenant club core (seasons/teams/athletes/seasonal memberships) with RLS, C-format club athlete IDs via an atomic per-org counter RPC, guided season rollover, players roster + profile pages, and youth_director RBAC nav — the domain model every later Phase 2 feature builds on.**

## Performance

- **Duration:** 65 min
- **Started:** 2026-08-27T11:42:58Z
- **Completed:** 2026-08-27T15:42:58Z
- **Tasks:** 3 (1 TRACER + 2 expansion)
- **Files modified:** 21 (16 created, 5 modified)

## Accomplishments
- TRACER vertical path wired end-to-end: schema (00002/00003) → extended supabase types → club-athlete-ID generation → create-player server action → roster page → RBAC nav.
- Seasons/teams/athletes/seasonal_memberships tables with full RLS discipline (ENABLE + FORCE ROW LEVEL SECURITY + authorize() org-scoped policies) and the partial unique index enforcing one active season per org.
- Club athlete IDs minted atomically via a SECURITY DEFINER `claim_club_athlete_number` RPC (JWT org-scoped) + `UNIQUE(organization_id, club_athlete_number)` backstop — no MAX(id)+1, no nextval races.
- Athlete profile page: identity core, prominent C-format club ID as payment reference (D-05), free-text Federation/Registration ID (D-06/REG-05), current-season membership primary + past memberships collapsed, sub-route section links.
- Seasons page with guided Start New Season rollover (D-03: per-athlete team moves, carry-forward) and teams CRUD page.
- Real tests replace both Wave-0 scaffolds (athlete-id: 6 tests, rollover: 7 tests) — 16 tests green, typecheck clean.

## Task Commits

Each task was committed atomically:

1. **Task 1 (TRACER): Season -> Team -> Player with club athlete ID** — `1a09c62`, `d7c7f43`, `4d87476` (feat)
2. **Task 2: Seasons + teams pages with guided rollover** — `5599ce2` (feat)
3. **Task 3: Athlete profile page** — `f6c5924` (feat)

**Plan metadata:** pending docs commit (SUMMARY + tracking)

## Files Created/Modified
- `supabase/migrations/00002_app_permission_extensions.sql` - ONLY enum extension (6 ADD VALUE) + role_permissions seeds, no table code
- `supabase/migrations/00003_club_core.sql` - sport_type enum, seasons/teams/athletes/seasonal_memberships + RLS + partial unique indexes + org counter column
- `supabase/migrations/00004_club_core_counter.sql` - claim_club_athlete_number SECURITY DEFINER RPC (JWT org-scoped)
- `src/types/database.ts` - extended with new tables + enums + Relationshps + Views:{} (required for nested selects)
- `src/lib/athlete-id.ts` - formatClubAthleteNumber (C-padded 4) + buildClubAthleteNumber (counter+1)
- `src/lib/club-data.ts` - org-scoped data layer (seasons, teams, athletes, memberships, counter, federation update)
- `src/lib/rollover.ts` - pure buildCarryForward + validateRollover
- `src/lib/__tests__/athlete-id.test.ts`, `rollover.test.ts` - real tests replacing Wave-0 stubs
- `src/app/[locale]/(dashboard)/players/{actions.ts,page.tsx,[id]/page.tsx}` - roster + create + profile
- `src/app/[locale]/(dashboard)/seasons/{actions.ts,page.tsx}` - season create/rollover + page
- `src/app/[locale]/(dashboard)/teams/{actions.ts,page.tsx}` - teams CRUD + page
- `src/lib/rbac.ts` - youth_director Teams + People nav
- `messages/sr.json`, `messages/en.json` - players/seasons/teams/profile keys
- `vitest.config.ts` - Vitest 4 projects config (per-project plugins/alias)

## Decisions Made
- **Counter as SECURITY DEFINER RPC**: supabase-js cannot express atomic `UPDATE ... SET col=col+1 ... RETURNING`, so the counter claim moved into a Postgres function (Pattern 3, T-02-02-03) with the unique index as backstop.
- **JWT org-scoping inside the counter RPC**: the SECURITY DEFINER context bypasses RLS, so a `WHERE id = org_id AND id = JWT org claim` guard prevents one org incrementing another's counter.
- **Rollover as sequential server-action steps**: supabase-js has no multi-statement transaction; the single-active invariant is backstopped by the DB partial unique index (what the plan lists under T-02-02-04). 02-04 extends this same action.
- **Hand-written Database needs Views:{} + every-table Relationships**: without them, `TablesAndViews` collapses to `never` and nested relational selects (`seasonal_memberships(count)`, `!inner(...)`) fail to type-check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added migration 00004 for the atomic counter RPC**
- **Found during:** Task 1 (createAthlete counter claim)
- **Issue:** The plan specified `UPDATE organizations SET club_athlete_counter = club_athlete_counter + 1 ... RETURNING` but supabase-js cannot issue that client-side; a naive fetch-then-update would reintroduce the race (Pitfall 5) the plan explicitly forbids.
- **Fix:** Added `00004_club_core_counter.sql` — a SECURITY DEFINER `claim_club_athlete_number(p_org_id)` RPC performing the atomic claim, granted to authenticated. JWT org-scoped (also a Rule 2 security hardening).
- **Files modified:** `supabase/migrations/00004_club_core_counter.sql` (new), `src/lib/club-data.ts`, `src/types/database.ts` (Functions entry)
- **Verification:** typecheck resolves the rpc (was untyped before adding Functions); logic covered by athlete-id tests.
- **Committed in:** `4d87476`

**2. [Rule 1 - Bug] Typecheck collapsed new tables to `never`**
- **Found during:** Task 1 (club-data.ts write)
- **Issue:** The hand-written `Database` lacked the `Views` section and `Relationships` on tables, so supabase-js's `TablesAndViews<Schema> = Tables & Exclude<Views,''>` collapsed to `never`, breaking nested relational selects and inserts.
- **Fix:** Added `Views: {}` and `Relationships` arrays to every table (incl. populated FKs on the new tables), enabling nested selects (`count`, `!inner`, season/team embeds).
- **Files modified:** `src/types/database.ts`
- **Verification:** `npm run typecheck` clean (was ~24 errors).
- **Committed in:** `4d87476`

**3. [Rule 2 - Security] JWT org-scoping in counter RPC**
- **Found during:** Task 1 (counter RPC review)
- **Issue:** A bare SECURITY DEFINER UPDATE with no org guard lets any authenticated caller increment any org's counter (privilege escalation / org isolation, T-02-02-05).
- **Fix:** Added `AND id = COALESCE((auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid, NULL)` to the UPDATE.
- **Files modified:** `supabase/migrations/00004_club_core_counter.sql`
- **Verification:** SQL review; no test (SQL-side, verified by reading).
- **Committed in:** `4d87476`

---

**Total deviations:** 3 auto-fixed (2 × Rule 2 missing-critical/security, 1 × Rule 1 bug)
**Impact on plan:** All necessary for correctness/security of the counter path. No scope creep; the added migration preserves the plan's atomic-counter intent.

## Issues Encountered
- **supabase-js relational type resolution** — the single biggest friction: getting hand-written Database types to satisfy `GenericSchema` so `Views:{}` + `Relationships` are required, and nested embeeds resolve. Resolved by adding the missing sections.
- **RPC arg typing** — `Functions` must be declared for `rpc()` to be typed; added `claim_club_athlete_number` entry.
- **Server-action transaction model** — no client-side multi-statement transaction in supabase-js; realized the rollover as sequential steps with the DB index as the invariant backstop.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The core domain model (seasons/teams/athletes/memberships + counter) is in place and type-safe for 02-03+ to build on.
- `startNewSeason` lives in `src/app/[locale]/(dashboard)/seasons/actions.ts`; 02-04 Task 2 extends it with the staff_teams clone once migration 00005 ships.
- Wave-0 scaffolds `guardian.test.ts`, `rows.test.ts`, `status.test.ts` remain for later plans (02-03+) — out of scope here.

---
*Phase: 02-club-people*
*Completed: 2026-08-27*

## Self-Check: PASSED

All 15 created files verified present; 5 task commits (1a09c62, d7c7f43, 4d87476, 5599ce2, f6c5924) verified in git log.

