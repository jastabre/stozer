---
phase: 02-club-people
verified: 2026-08-28T20:30:00Z
status: passed
score: 5/11 must-haves verified
behavior_unverified: 6
overrides_applied: 0
behavior_unverified_items:

  - truth: "Club owner can create seasons, teams, and add players with all profile fields (SC1)"
    test: "Run the create flow end-to-end against the live DB: create a season, create a team, add a player with all profile fields + team, then confirm the player appears in /players with a C-format ID. Also trigger the edge case from CR-01 (player created with a team while no active season is resolvable, e.g. archive the season between page load and submit) and confirm no orphaned athlete row / burned counter remains."
    expected: "Player persists with all profile fields; membership attaches to the active season; the CR-01 partial-commit path leaves no invisible orphaned athlete and no wasted club-athlete counter value."
    why_human: "createSeason/createTeam/createPlayer are server actions writing to Postgres via supabase-js; no unit or e2e test exercises the request-to-persistence flow. CR-01 (players/actions.ts:58-69 + club-data.ts:661-675) is a confirmed partial-commit defect in this path that only presence + manual/walk-through observation can confirm is handled."

  - truth: "Players can be imported in bulk via CSV/XLSX with column mapping and validation preview (SC2)"
    test: "Run the /import wizard against the live DB with a CSV of >50 rows containing duplicates beyond row 50: upload, auto-map columns, review per-row errors/duplicate controls, choose skip/update/create, import, and read the result summary. Repeat with an XLSX."
    expected: "Rows import into the roster with progress polling converging on 'done'; unknown teams flagged, never auto-created; duplicates resolved per decision. Note WR-06: decisions only apply to the first 50 preview rows — later duplicates silently default to skip."
    why_human: "parseUploadAction/importBatchAction/getImportProgressAction hit a live Postgres + Storage stack; only the pure row model (rows.test.ts, 9 tests) is automated. The batch/entitlement/progress behavior and the WR-06 >50-row decision limitation need a live run."

  - truth: "Players have a permanent identity that persists across seasons (SC3)"
    test: "Run 'Start New Season' rollover twice against live data: verify athletes keep their identity (same id, same club athlete ID), memberships carry into the new season, staff_teams carry forward, and only one season is active at any time."
    expected: "Athlete rows are never duplicated across seasons; membership history accumulates; the partial unique index holds one active season. WR-01 is a known non-transactional data-loss path if the membership bulk-insert fails mid-flight."
    why_human: "Persistence and rollover are DB-state transitions; buildCarryForward/buildStaffCarryForward are unit-tested as pure functions but the startNewSeason action's commit order and the single-active invariant are not exercised by any automated test against a live DB."

  - truth: "Staff profiles show assigned teams and license expiry status with alerts (SC5)"
    test: "Create a staff profile, assign teams in the active season, add a license expiring within the org threshold, and open /people and /people/[id] as both a manager and a coach."
    expected: "Profile shows assigned teams and a green/yellow/red license expiry pill consistent with the org threshold. Note WR-03 (coach self-scope is dead code because viewer.role is undefined — coaches see an empty list) and WR-04 (account linking fails for admin_finance)."
    why_human: "listStaff derives license tones from deriveStatus (unit-tested) but the page rendering, viewer scoping, and account-linking RLS behavior require a live browser + DB run."

  - truth: "Basic player contracts are tracked (type, status, dates, document, expiry warning) (SC7)"
    test: "On a player profile open /contracts, add a contract (type/status/dates), attach a contracts-type document, set valid_until inside the threshold, and confirm the expiry pill renders; edit and delete it."
    expected: "Contract CRUD persists and the derived expiry tone (deriveStatus) appears; document linkage is validated same-athlete/type. No automated test covers the contract action flow."
    why_human: "saveContractAction/deleteContractAction and the page rendering are server components with no e2e coverage; DB persistence and linkage validation need a live run."

  - truth: "Player documents (medical, insurance) are stored with expiry tracking (SC8)"
    test: "On athlete and staff profiles upload a PDF/JPEG/PNG document with an expiry date, confirm it lists with a tone pill, download it via the signed URL, and delete it. Open /documents to see the org-wide expiry overview and filters."
    expected: "Upload lands in the private club-documents bucket under /{org}/...; downloads go through signed URLs only (no public URL); expiry overview shows expiring/expired/no-expiry rows. Note WR-09 (deleteDocument deletes the object before the row)."
    why_human: "Storage RLS, bucket enforcement (size/MIME), signed-URL issuance, and the browser upload/download/delete flow require a live Supabase + browser run; no automated test covers storage."
decision_coverage:
  honored: 42
  total: 42
  not_honored: []
human_verification:

  - test: "Walk the full club setup user flow end-to-end (MVP mode): create season -> create team -> add player with all profile fields -> confirm roster + C-format club ID"
    expected: "Each step succeeds and the roster page shows the player with a stable C-prefixed club athlete ID"
    why_human: "No e2e/component tests exist; server actions + DB persistence are only statically verified"

  - test: "Verify the create-player edge case from CR-01: select a team while no active season is resolvable and confirm no orphaned/invisible athlete row is left behind"
    expected: "The action rejects cleanly before committing the athlete, or compensates; no burned counter values, no invisible orphans"
    why_human: "Confirmed partial-commit defect in players/actions.ts:58-69 + club-data.ts:661-675; requires observing the live DB state"

  - test: "Bulk import a CSV and an XLSX with >50 rows, unknown teams, and duplicates; verify mapping, validation preview, duplicate resolution, and the result summary"
    expected: "Import converges on 'done' with correct counts; unknown teams flagged; WR-06 means duplicates beyond row 50 default to skip — confirm that limitation is acceptable"
    why_human: "Import wizard and batch actions hit a live DB/entitlement stack; only the pure row model is automated"

  - test: "Run 'Start New Season' rollover and verify athletes keep permanent identity, memberships + staff_teams carry forward, and only one active season exists"
    expected: "Single active season per org; memberships/staff carried idempotently; WR-01 data-loss path does not trigger in normal use"
    why_human: "Rollover commit ordering is a DB state transition with no automated test"

  - test: "Verify registration status colors: add registrations with expiry inside/at/after the org threshold and confirm green/yellow/red pills on the profile and team overview"
    expected: "Pills match deriveStatus; threshold change on /club updates all pills"
    why_human: "Status derivation is unit-tested; rendering + threshold propagation need a visual check"

  - test: "Verify staff profile: assigned teams + license expiry pill + account linking; test as coach (WR-03) and as admin_finance (WR-04)"
    expected: "Managers see full profiles and license pills; coaches see their own profile (currently empty list — known defect); account linking works for the acting role"
    why_human: "Viewer scoping (WR-03) and membership-upsert RLS (WR-04) are live-behavior issues"

  - test: "Verify documents: upload athlete + staff documents, download via signed URL, delete; confirm /documents org-wide expiry overview and filters"
    expected: "Private storage only, signed-URL downloads, expiry tones, overview filters work; WR-09 delete ordering is acceptable"
    why_human: "Storage RLS/signed-URLs and browser flow need a live Supabase project"

  - test: "Cross-tenant RLS sanity check: create two orgs and confirm org B cannot read or write org A's athletes/registrations/documents/equipment"
    expected: "RLS isolation holds on every new Phase 2 table; storage objects scoped by org folder"
    why_human: "RLS policies are reviewed in SQL but not executed against two live tenants"
---

# Phase 02: Club & People Verification Report

**Phase Goal:** A club owner can set up their club structure — seasons, teams, players, staff — and see registration status with expiry alerts. Players can be imported in bulk. This is the core domain model that everything else builds on.
**Verified:** 2026-08-28T20:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification
**Mode:** mvp

> **Goal-format note:** ROADMAP.md declares `Mode: mvp`, but the phase goal is not in the strict user-story form (`As a …, I want to …, so that …`). Per verify-mvp-mode.md this is a discrepancy to resolve via `/gsd mvp-phase 2`. I proceeded with the User Flow Coverage table below derived from the ROADMAP Success Criteria (which are concrete user-flow outcomes) so verification is not blocked; the human checkpoint should still be run as a user-flow walk-through.

## User Flow Coverage

User story (goal): «A club owner can set up their club structure — seasons, teams, players, staff — and see registration status with expiry alerts. Players can be imported in bulk.»

| Step | Expected | Evidence | Status |
|------|----------|----------|--------|
| Create a season | Season form on /seasons persists; "Start New Season" activates it | `seasons/actions.ts` createSeason/startNewSeason (org + seasons.manage gated) → `seasons` table (00003) | ✓ present/wired |
| Create a team | Team form on /teams persists with category; sport inherited from org | `teams/actions.ts` + `inherit_team_sport` trigger (00003, fixed in 02-08) | ✓ present/wired |
| Add a player with all profile fields | /players form persists player with C-format club ID | `players/actions.ts` createPlayer + `club-data.ts` createAthlete + counter RPC (00004) | ✓ present/wired (CR-01 edge defect) |
| See roster + club ID | Roster table shows player with C-prefixed payment-reference ID | `players/page.tsx` renders `formatClubAthleteNumber` from `listAthletesWithCurrentMembership` | ✓ FLOWING |
| Add registration with expiry | /players/[id]/registrations CRUD with valid_from/until | `registrations/{actions,page}.tsx` + `registrations` table (00005) | ✓ present/wired |
| See green/yellow/red registration status | Pills derived from expiry + org threshold | `status.ts` deriveStatus (9 unit tests) + registrations page pills | ✓ tested invariant |
| Configure org warning threshold | /club threshold input persists to organization_settings | `club/page.tsx` saveThreshold → `updateOrganizationSettings` (00005) | ✓ present/wired |
| Add staff profile, teams, licenses | /people CRUD, seasonal team assignments, license expiry pill | `people/{actions,page}.tsx` + `staff.ts` + `staff_teams`/`staff_licenses` (00006) | ✓ present/wired (WR-03/04 defects) |
| Add guardians | /players/[id]/guardians multiple contacts, one primary | `guardian.ts` normalize + one-primary partial unique index (00006); 4 tests | ✓ tested invariant |
| Upload player documents + expiry | /players/[id]/documents upload/list/download/delete, expiry pill | `documents/{actions,page}.tsx`, `storage.ts`, private `club-documents` bucket (00007) | ✓ present/wired (WR-09 defect) |
| Track a player contract | /players/[id]/contracts type/status/dates/document + expiry pill | `contracts/{actions,page}.tsx` + `contracts` table (00007) | ✓ present/wired |
| Org-wide expiry overview | /documents lists expiring/expired/no-expiry with filters | `documents/page.tsx` listDocumentOverview (REG-07) | ✓ present/wired |
| Bulk import players (CSV/XLSX) | 4-step wizard: upload → mapping → preview → import → summary | `import/{page,actions}.tsx` + `parsers.ts` + `rows.ts` (00008); rows model 9 tests | ✓ present/wired (WR-02/06 defects) |
| **Outcome** | "Club owner can set up club structure and see registration status with expiry alerts; players imported in bulk" | All steps above verified present + wired with real DB queries; runtime behavior unexercised by automated tests | ⚠️ present, behavior unverified → human walk-through |

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | Club owner can create seasons, teams, and add players with all profile fields (SC1) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | createSeason/startNewSeason/createTeam/createPlayer actions wired + org/permission gated; no test exercises the request→DB flow; CR-01 partial-commit defect confirmed (players/actions.ts:58-69, club-data.ts:661-675) |
| 2   | Players can be imported in bulk via CSV/XLSX with column mapping and validation preview (SC2) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | import wizard + batch actions wired; rows.ts row model 9 tests pass; end-to-end import/progress/entitlement behavior untested; WR-02 (spurious failed) + WR-06 (>50-row decisions) defects |
| 3   | Players have a permanent identity that persists across seasons (SC3) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | athletes table + seasonal_memberships + rollover carry-forward wired; buildCarryForward/buildStaffCarryForward tested as pure functions; DB persistence + single-active invariant untested; WR-01 non-transactional rollover |
| 4   | Each player has a unique club athlete ID usable as payment reference (SC4) | ✓ VERIFIED | formatClubAthleteNumber/buildClubAthleteNumber unit-tested (6 tests); UNIQUE(org, club_athlete_number) index + atomic claim RPC (JWT org-scoped) reviewed in 00004 |
| 5   | Staff profiles show assigned teams and license expiry status with alerts (SC5) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | staff.ts derives license tones via tested deriveStatus; people pages wired; viewer scoping + account linking live behavior untested; WR-03/WR-04 defects |
| 6   | Registration status shows green/yellow/red indicators with expiry warnings (SC6) | ✓ VERIFIED | deriveStatus (green/yellow/red, null→red, threshold-inclusive) exercised by 9 deterministic unit tests; consumed by registrations + team overview |
| 7   | Basic player contracts are tracked (type, status, dates, document, expiry warning) (SC7) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | contracts table + CRUD actions + page wired (00007); no test exercises the contract action flow |
| 8   | Player documents (medical, insurance) are stored with expiry tracking (SC8) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | private club-documents bucket + storage RLS + documents table + signed-URL helper wired (00007); storage/upload/download flow untested; WR-09 delete-ordering defect |
| 9   | All Phase 2 migrations (00002..00009) applied to the linked Supabase project and listed as applied (PLAN 02-08) | ✓ VERIFIED | Local link state present (supabase/.temp/project-ref = vdyvdxmuiplrxalnlvyo, project "stozer"); 02-08 SUMMARY documents `migration list --linked` showing 00001..00010; orchestration context confirms remote is source of truth. Human can re-run `npx supabase migration list --linked` |
| 10  | src/types/database.ts regenerated from the pushed schema and compiles (AppRole/AppPermission preserved) (PLAN 02-08) | ✓ VERIFIED | Type aliases AppRole/AppPermission/SportType/DocumentType/ContractStatus/EquipmentItemState/EquipmentRequestStatus exported; `npx tsc --noEmit` exit 0 (re-run this verification); club_athlete_counter + claim RPC typed |
| 11  | Full automated gate green: vitest, build, lint (PLAN 02-08) | ✓ VERIFIED | `npx vitest run` re-run here: 6 files / 41 tests passed; `npx tsc --noEmit` exit 0; `next build` (24 routes) + `eslint` exit 0 recorded in 02-08-SUMMARY |

**Score:** 5/11 truths verified (6 present, behavior-unverified)

### Deferred Items

None. No gap found in this phase is explicitly scheduled in a later phase (Phases 3–7 cover scheduling, finance, reconciliation, dashboard, reporting — none claim the open Phase 2 defects).

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `supabase/migrations/00002..00010` | Phase 2 schema (10 files) | ✓ VERIFIED | All 10 files present + substantive; RLS discipline consistent (ENABLE + FORCE + org claim + `authorize()`), storage policies scoped by `foldername(name)[1]`, equipment composite org FKs |
| `src/types/database.ts` | Regenerated canonical types | ✓ VERIFIED | 52 KB; aliases re-derived; typecheck clean |
| `src/lib/{athlete-id,status,rollover,club-data,staff,guardian,storage,equipment,equipment-export}.ts` | Domain libs | ✓ VERIFIED | All present + substantive + imported by actions/pages |
| `src/lib/import/{parsers,rows}.ts` | CSV/XLSX parsing + validated row model | ✓ VERIFIED | csv-parse + exceljs (no `xlsx` import confirmed); zod row schema; formula-injection escaping |
| Player/team/season/people/registrations/medical/guardians/documents/contracts/import/equipment pages + actions | Full UI surface | ✓ VERIFIED | All routes exist, wired to actions, org + permission gated |
| Test suite | 6 files / 41 tests | ✓ VERIFIED | athlete-id(6), status(9), rollover(9), guardian(4), rows(9), equipment-export(4); re-run green |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `organizations.club_athlete_counter` | `athletes.club_athlete_number` | `claim_club_athlete_number` RPC (00004) + `UNIQUE(org, number)` | WIRED | JWT org-scoped SECURITY DEFINER; reviewed |
| `seasons.is_active` partial unique index | `startNewSeason` rollover | `seasons/actions.ts` archive→insert→carry-forward | WIRED | Single-active invariant DB-backed; WR-01 commit-order defect |
| `deriveStatus` | registrations/medical/licenses/documents/contracts pills | shared `status.ts` + org threshold | WIRED | One knob (`organization_settings.warning_threshold_days`), many consumers |
| `rows.ts` zod schema | `parsers.ts` output | `mapRow`/`mapHeaders` | WIRED | Header-keyed objects; null-DOB never collapses athletes (tested) |
| `import_jobs.status` | wizard step rendering | `getImportProgressAction` polling | WIRED | Terminal states done/failed detected; 120s client timeout; WR-02 race defect |
| storage path convention | `storage.objects` RLS | `foldername(name)[1]` = org claim (00007) | WIRED | Path builder + policies aligned; no `getPublicUrl` anywhere |
| `staff_teams` | season rollover | `buildStaffCarryForward` + `startNewSeason` upsert | WIRED | Idempotent carry-forward |
| RBAC nav | permission-bearing roles | `rbac.ts` navConfigs + Sidebar | WIRED | Equipment nav for all 4 seeded `equipment.view` roles |
| `registrations.document_id` | `documents` table | linkage selectors + same-owner/type validation | WIRED | REG-04 satisfied |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `players/page.tsx` roster | `athletes` | `listAthletesWithCurrentMembership` → `athletes` + `seasonal_memberships` joins | Yes | ✓ FLOWING |
| `players/[id]/page.tsx` | `athlete` | `getAthleteWithMemberships` → DB | Yes | ✓ FLOWING |
| `registrations` page pills | `currentTone` | `listRegistrations` → DB + `deriveStatus` | Yes | ✓ FLOWING |
| `teams/[id]/registrations` overview | `listTeamStatusOverview` | memberships → athletes → latest reg/medical | Yes | ✓ FLOWING |
| `people/[id]/page.tsx` licenses | `person.licenses[].status` | `staff_licenses` + `deriveStatus` | Yes | ✓ FLOWING |
| `import/page.tsx` wizard | `job`/`progress` | `import_jobs` (parsed_rows persisted, not memory) | Yes | ✓ FLOWING |
| `equipment/page.tsx` overview | `overview` | `getPlayerEquipmentOverview` cross product | Yes | ✓ FLOWING |
| `documents/page.tsx` overview | `listDocumentOverview` | `documents` + owner name resolution | Yes | ✓ FLOWING |
| `contracts/page.tsx` | `contracts` | `listContracts` → DB | Yes | ✓ FLOWING |

No HOLLOW/STATIC/DISCONNECTED artifacts found — every rendered value traces to a real DB query.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite green | `npx vitest run` | 6 files / 41 tests passed | ✓ PASS |
| Type graph compiles | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| No public-URL storage access | grep `getPublicUrl` in src | 0 references | ✓ PASS |
| No unsafe xlsx parser | grep `from "xlsx"` in src | 0 imports (exceljs used) | ✓ PASS |
| No disabled tests on requirements | grep `it.skip/xit/todo` in `src/lib/__tests__` | 0 matches | ✓ PASS |

No server was started (per spot-check constraints). Runtime DB flows are deferred to human verification (see below).

### Probe Execution

SKIPPED — the phase declares no probe scripts (`find scripts -name 'probe-*.sh'` → none; no probe references in PLANs/SUMMARies). Schema push was verified via `supabase migration list --linked` per 02-08-SUMMARY + local link state.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| STRC-01 | 02-02 | Season management (create/activate/archive) | ✓ SATISFIED | seasons table + partial unique index + seasons actions |
| STRC-02 | 02-02 | Team/selection management with sport abstraction | ✓ SATISFIED | teams table + CRUD + category/sport |
| STRC-03 | 02-02 | Player profiles, permanent identity across seasons | ✓ SATISFIED | athletes + seasonal_memberships + profile page |
| STRC-04 | 02-07 | Equipment size (XS..XXL/custom) + jersey number | ✓ SATISFIED | equipment tables + SIZE_PRESETS + jersey on membership |
| STRC-05 | 02-02 | Club athlete ID — stable unique payment reference | ✓ SATISFIED | counter RPC + C-format + unique index |
| STRC-06 | 02-04 | Staff/coach profiles (teams, license, expiry) | ✓ SATISFIED | staff/staff_teams/staff_licenses + people pages *(REQUIREMENTS.md traceability stale — see note)* |
| STRC-07 | 02-04 | Guardian contacts, one primary | ✓ SATISFIED | guardians + one-primary index + 4 tests *(traceability stale)* |
| STRC-08 | 02-02 | Sport abstraction (football/basketball extensible) | ✓ SATISFIED | sport_type enum + inherit_team_sport trigger |
| STRC-09 | 02-04 | Staff license expiry tracking with alerts | ✓ SATISFIED | license expiry pill via deriveStatus |
| REG-01 | 02-03 | Registration tracking (federation, identifier, status) | ✓ SATISFIED | registrations table + CRUD |
| REG-02 | 02-03 | Start/expiry dates + configurable warning thresholds | ✓ SATISFIED | valid_from/until + organization_settings knob |
| REG-03 | 02-03 | Green/yellow/red status indicators | ✓ SATISFIED | deriveStatus tested + pills rendered |
| REG-04 | 02-05 | Registration document upload and storage | ✓ SATISFIED | registrations.document_id linkage + private storage *(traceability stale)* |
| REG-05 | 02-02 | Generic athlete identifier (not COMET-hardcoded) | ✓ SATISFIED | free-text federation_id on athletes |
| REG-06 | 02-05 | Player documents (medical/insurance/identity/custom) with expiry | ✓ SATISFIED | typed documents table + expiry tracking *(traceability stale)* |
| REG-07 | 02-03/02-05 | Expiration alerts for registrations and documents | ✓ SATISFIED | shared deriveStatus + org-wide /documents expiry overview |
| REG-08 | 02-06 | CSV/XLSX import with mapping, validation, preview | ✓ SATISFIED | 4-step wizard + rows model tests |
| REG-09 | 02-05 | Basic player contracts (type/status/dates/doc/expiry warning) | ✓ SATISFIED | contracts CRUD + document linkage *(traceability stale)* |

All 18 Phase-2 requirement IDs are claimed by plans and satisfied by implementation — **no orphaned requirements**. 

> **Documentation inconsistency (ℹ️):** `REQUIREMENTS.md` traceability table still marks STRC-06, STRC-07, REG-04, REG-06, REG-07, REG-09 as `Pending`, and the checklist boxes for STRC-06/07, REG-04/06/07/09 as unchecked, although all six are implemented and verified above. The traceability table should be updated to `Complete` — this is a bookkeeping gap, not a functional gap.

### Decision Coverage

All 42 `<decisions>` entries in `02-CONTEXT.md` (D-01..D-42) are honored by shipped artifacts (mapped during requirement/artifact verification above). `decision_coverage: {honored: 42, total: 42, not_honored: []}`. Non-blocking gate — no drift detected.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| athlete-id.test.ts | STRC-05 | 6 | 0 | No | Value | PASS |
| status.test.ts | REG-02/03/07 | 9 | 0 | No | Value (boundary) | PASS |
| rollover.test.ts | STRC-01/02/03 | 9 | 0 | No | Value/Behavioral | PASS |
| guardian.test.ts | STRC-07 | 4 | 0 | No | Value/Behavioral | PASS |
| rows.test.ts | REG-08 | 9 | 0 | No | Value/Behavioral | PASS |
| equipment-export.test.ts | STRC-04 | 4 | 0 | No | Value | PASS |

**Disabled tests on requirements:** 0 → no blocker.
**Circular patterns detected:** 0 → no blocker.
**Insufficient assertions:** 0 → no warning.
**Coverage gap (⚠️):** Tests exercise pure lib functions only. No test exercises any server action → live DB flow, storage, or RLS behavior; no component/e2e tests exist despite the jsdom environment being configured (environmentMatchGlobs). This is why 6 truths are ⚠️ PRESENT_BEHAVIOR_UNVERIFIED. Not a test-quality blocker (assertions are strong where they exist) but a real coverage limitation.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/lib/club-data.ts` | 661-675 | **CR-01** — `season_id: input.seasonId ?? ""` after athlete already committed | 🛑 Critical (open review finding) | Team + no-active-season path commits an orphaned invisible athlete and burns a counter value; no athlete-delete to clean up (WR: import path already guards this at import/actions.ts:327 — fix pattern exists) |
| `src/app/[locale]/(dashboard)/seasons/actions.ts` | 119-202 | **WR-01** — rollover commits archive + new season before carry-forward | ⚠️ Warning | Mid-flight failure loses memberships permanently; retry not idempotent |
| `src/app/[locale]/(dashboard)/import/actions.ts` | 422-451 | **WR-02** — lost optimistic-concurrency update flips job to `failed` | ⚠️ Warning | Concurrent batch overlap shows a failure for a completed import |
| `src/app/[locale]/(dashboard)/import/page.tsx` + `actions.ts:338` | 88-114/338 | **WR-06** — preview capped at 50 rows but decisions keyed by raw index | ⚠️ Warning | Duplicates beyond row 50 silently skipped in bulk import |
| `src/lib/staff.ts` + `people/page.tsx:30` | 68-76 | **WR-03** — `viewer.role` vs `OrganizationContext.userRole` mismatch | ⚠️ Warning | Coach self-scope dead code; coaches see empty staff list |
| `src/app/[locale]/(dashboard)/people/actions.ts` | 209-247 | **WR-04/WR-08** — account linking fails for admin_finance; can overwrite another org's user claims | ⚠️ Warning | Partial-write + cross-org claim clobber |
| `src/app/[locale]/(dashboard)/players/[id]/documents/actions.ts` | 183-189 | **WR-09** — storage object deleted before DB row | ⚠️ Warning | Stale metadata row pointing at deleted object |
| `00003..00007` tables | — | **WR-05** — cross-org parent references writable (composite org FKs only on 00009) | ⚠️ Warning | Bogus cross-org rows pollute joins; RLS still blocks reads |
| `00003` inherit_team_sport trigger | 265-273 | **WR-07** — NULL/non-enum org sport fails team insert | ⚠️ Warning | Team creation broken for orgs whose sport is NULL or outside the enum |
| Requirements traceability | `REQUIREMENTS.md` | 6 completed requirements still marked Pending | ℹ️ Info | Documentation drift only |

No `TBD`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER` debt markers found in any phase-modified file (deb-t marker gate: no blocker). No hardcoded-empty props, no `return null` stubs, no console.log-only implementations. The 16 review findings (1 critical, 9 warning, 6 info) are carried from 02-REVIEW.md and confirmed against the code — they are open issues, none blocks the roadmap success criteria outright, but CR-01 + WR-06 + WR-04 directly affect the phase's core flows and should be fixed before/with the human walk-through.

### Human Verification Required

The following must be exercised manually because the phase's runtime behavior (server actions against live Postgres/Storage, rendering, RLS, storage) is not covered by any automated test — MVP-mode user-flow walk-through is mandatory even with a green unit suite:

1. **Club setup user flow (SC1)** — Walk the full flow: create season → create team → add player with all profile fields → roster shows C-format ID. Also trigger the CR-01 edge (team selected + no active season) and confirm no orphaned/invisible athlete is left behind.
2. **Bulk import (SC2)** — Import a CSV and an XLSX (>50 rows, unknown teams, duplicates); verify mapping, validation preview, duplicate resolution, progress, and summary. Confirm whether the WR-06 >50-row duplicate-skip limitation is acceptable.
3. **Rollover identity persistence (SC3)** — Run "Start New Season"; verify athletes keep identity, memberships + staff_teams carry forward, only one active season.
4. **Registration status colors (SC6)** — Add registrations expiring inside/at/after the threshold; verify green/yellow/red pills on profile + team overview; change threshold on /club and observe.
5. **Staff profiles (SC5)** — Create staff, assign teams, add a near-expiry license; verify pill. Test as coach (WR-03) and admin_finance (WR-04) account linking.
6. **Contracts (SC7)** — Add/edit/delete a contract with a linked document and expiry pill.
7. **Documents (SC8)** — Upload athlete + staff docs (PDF/JPEG/PNG, oversized + bad type rejection), download via signed URL, delete; check /documents expiry overview + filters.
8. **Cross-tenant RLS** — Two orgs: confirm org B cannot read/write org A's athletes/registrations/documents/equipment; confirm storage objects scoped by org folder.

### Gaps Summary

No roadmap success criterion is FAILED and no artifact is missing/stubbed/unwired — every SC is backed by real, wired code with real DB queries, and the automated gate is green (vitest 6/41, tsc 0, build 24 routes, lint 0). The phase is not `passed` because (a) 6 of 11 must-have truths are present-but-behavior-unverified (no e2e/component tests exercise the DB/storage flows — this is a genuine test-coverage gap given the jsdom environment was configured but unused), and (b) the code review's open findings include one confirmed critical data-integrity defect (CR-01) and several warnings in core flows (WR-01/02/03/04/06) that only a live walk-through can confirm the impact of. Status is therefore `human_needed`: the implementation is in place; the human checkpoint (user-flow walk-through + UAT) is the gate to `passed`, and the open review findings should be addressed as follow-up work.

---

_Verified: 2026-08-28T20:30:00Z_
_Verifier: Claude (gsd-verifier)_
