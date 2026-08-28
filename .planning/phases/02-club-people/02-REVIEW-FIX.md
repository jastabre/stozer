---
phase: 02-club-people
fixed_at: 2026-08-28T19:00:00Z
review_path: .planning/phases/02-club-people/02-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-08-28T19:00:00Z
**Source review:** `.planning/phases/02-club-people/02-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (1 critical, 9 warnings; info findings out of scope)
- Fixed: 10
- Skipped: 0

All fixes were applied in an isolated worktree (`git worktree`, branch
`gsd-reviewfix/02-4448`), each committed atomically, then fast-forwarded onto
`master` (HEAD `59ef7a8`). Migrations 00011–00013 were **pushed to the live
Supabase project** (`supabase db push --linked`); no applied migration was
edited. No TypeScript type regeneration was needed — the new migrations only
add FK constraints, a trigger body, a CHECK constraint, and a role_permissions
seed, none of which change generated table shapes.

**Verification location:** gates ran in the **main checkout** after the
fast-forward (the isolated worktree has no `node_modules`), so the results are
reproducible from the tree at `59ef7a8`.

**Gate results (main checkout @ 59ef7a8):**
- `npx vitest run` — **PASS** (6 files, 41 tests)
- `npm run typecheck` — **PASS** (0 errors)
- `npm run lint` — **PASS** (0 errors, 5 pre-existing warnings in untouched files: contracts/page.tsx, seasons/page.tsx, Sidebar.tsx, entitlements.ts)
- `npm run build` — **PASS** (Next.js 16.3.3, compiled successfully)

## Fixed Issues

### CR-01: Player creation partially commits when a team is selected but no active season exists

**Files modified:** `src/app/[locale]/(dashboard)/players/actions.ts`, `src/lib/club-data.ts`
**Commit:** `7d66e08`
**Applied fix:** `createPlayer` now rejects up front when `team_id` is set but no active season exists (no athlete insert, no counter burn). `createAthlete`'s membership branch now also (a) refuses with a clear message when `team_id` is set without a `seasonId` and **compensates** by deleting the just-inserted athlete, and (b) deletes the just-inserted athlete on any membership-insert failure. Both guard paths in `createAthlete` apply to every caller, including `importBatchAction`.

### WR-01: `startNewSeason` is non-transactional — a mid-flight failure loses the membership carry-forward permanently

**Files modified:** `src/app/[locale]/(dashboard)/seasons/actions.ts`
**Commit:** `fafa398`
**Applied fix:** Reordered `startNewSeason` into a compensating sequence: insert the new season **inactive** first, build/validate the carry-forward, insert memberships, carry staff teams, then archive the old season and activate the new one **last**. A `compensate` helper deletes the just-inserted season (cascading its memberships/staff rows) on any failure — the previous season remains active, so a retry rebuilds from real data. On activation failure the previous season's `is_active` flag is restored before compensating.

### WR-02: Concurrent/duplicate import batches spuriously mark the job `failed`

**Files modified:** `src/app/[locale]/(dashboard)/import/actions.ts`
**Commit:** `e144235`
**Applied fix:** The optimistic-concurrency progress update now uses `.maybeSingle()`. When the update matches zero rows (a lost race — another request already advanced this batch), the action returns the **fresh** progress via `getImportProgressAction` instead of throwing, so the catch block no longer flips a healthy job to the terminal `failed` status. Real DB errors still throw and mark the job failed.

### WR-03: `StaffViewer.role` vs `OrganizationContext.userRole` mismatch disables the coach self-scope

**Files modified:** `src/lib/staff.ts`, `supabase/migrations/00013_coach_staff_view.sql`
**Commits:** `f0fad63`, `59ef7a8`
**Applied fix:** `StaffViewer` now accepts `userRole` (the `OrganizationContext` property both call sites actually pass) alongside `role`, and `applyViewerScope` reads `viewer?.role ?? viewer?.userRole` — the coach self-scope is no longer dead code. Migration **00013** (pushed) grants the `coach` role `staff.view`, which the staff_select RLS policy requires; combined with the app-level `query.eq("user_id", viewer.userId)` scope, a coach now sees only their own linked profile as documented. Follow-up commit `59ef7a8` satisfies a tsc narrowing error (`viewer && role === "coach" && viewer.userId`).

### WR-04: `linkStaffAccountAction` fails for `admin_finance` — RLS on `organization_memberships` requires `club_president`

**Files modified:** `src/lib/staff.ts`, `src/app/[locale]/(dashboard)/people/actions.ts`, `src/app/[locale]/(dashboard)/people/[id]/page.tsx`
**Commit:** `8bb1cca`
**Applied fix:** The action now gates on the DB capability the membership INSERT policy requires — the caller must be a `club_president` of the org (`organization_memberships` check via the user's own readable membership rows) — so `admin_finance` gets a clear error instead of an opaque failure after the staff row was updated. The UI link-account section only renders for `org.userRole === "club_president"`. `linkStaffToUser` now reads the current `staff.user_id/role` first and **compensates** (reverts) the staff update if the membership upsert fails, eliminating the second partial-write path.

### WR-05: Cross-org parent references are writable on most Phase-2 tables (missing composite org FKs and org checks)

**Files modified:** `supabase/migrations/00011_cross_org_parent_fks.sql`, `src/lib/club-data.ts`, `src/lib/guardian.ts`, `src/lib/staff.ts`, `src/app/[locale]/(dashboard)/players/[id]/registrations/actions.ts`, `src/app/[locale]/(dashboard)/players/[id]/medical/actions.ts`
**Commit:** `b82e09f`
**Applied fix:** Migration **00011** (pushed) mirrors the 00009 pattern: composite `(organization_id, parent_id)` FKs for `seasonal_memberships` (athlete/season/team), `guardians` (athlete), `staff_teams` (staff/team/season), `staff_licenses` (staff), `registrations` (athlete/season), `medical_examinations` (athlete), and `contracts` (athlete), referencing the existing 00009 UNIQUE `(id, organization_id)` pairs. App-level org verification added before writes in `createAthlete` (team), `updateGuardians` (athlete), `saveRegistration` (athlete + optional season), `saveMedicalExamination` (athlete), `upsertStaffLicenses` (profile), and `setStaffTeams` (profile/season/all teams).

### WR-06: Duplicate decisions only cover the first 50 rows; later duplicates are silently skipped

**Files modified:** `src/app/[locale]/(dashboard)/import/page.tsx`
**Commit:** `4c363cb`
**Applied fix:** `beginImport` now sends each batch only the decisions whose raw row index falls inside that batch's `[offset, offset+50)` window (instead of the full decisions record to every batch). Decisions the user made on previewed rows now land on exactly those rows; the server-side `decisions[String(index)]` keying is honored for all batches.

### WR-07: `inherit_team_sport` fails for orgs whose `sport` is NULL or not in the enum

**Files modified:** `supabase/migrations/00012_team_sport_hardening.sql`
**Commit:** `cdaf88f`
**Applied fix:** Migration **00012** (pushed) `CREATE OR REPLACE`s the `inherit_team_sport` trigger body so a NULL org sport raises a clear `RAISE EXCEPTION 'Organization % has no valid sport configured'` instead of an opaque NOT NULL violation, and adds `organizations_sport_check` (`sport IS NULL OR sport IN ('football','basketball')`) so an un-migrated future sport value fails fast at the org level.

### WR-08: `linkStaffAccountAction` can hijack/overwrite another org's user's access claims

**Files modified:** `src/app/[locale]/(dashboard)/people/actions.ts`, `src/app/[locale]/(dashboard)/people/[id]/page.tsx`, `messages/en.json`, `messages/sr.json`
**Commit:** `dbc6cb3`
**Applied fix:** Before linking, the action now queries `organization_memberships` (via the service-role admin client, so all tenants are visible) and refuses with "Korisnički nalog je već povezan sa drugom organizacijom" when the target user belongs to another org, and refuses when the user is linked to a staff profile in another org. The UI now requires an explicit confirmation checkbox (`people.confirmLink`, added to both message files, key parity maintained 591/591) and the action rejects submissions without it.

### WR-09: `deleteDocument` deletes the storage object before the DB row — failure ordering leaves a dangling row

**Files modified:** `src/app/[locale]/(dashboard)/documents/actions.ts`
**Commit:** `70cf492`
**Applied fix:** The `documents` row is deleted first (org-scoped). Only on success is the storage object removed, and an object-deletion failure is caught and logged as an orphaned object (`console.warn`) instead of failing the action — a failed row delete now leaves the document fully usable, mirroring the upload path's compensating order.

## Skipped Issues

None — all 10 in-scope findings were fixed.

---

_Fixed: 2026-08-28T19:00:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_