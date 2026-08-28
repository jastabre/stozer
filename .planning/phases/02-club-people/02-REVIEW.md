---
phase: 02-club-people
reviewed: 2026-08-28T00:00:00Z
depth: standard
files_reviewed: 68
files_reviewed_list:
  - .gitignore
  - messages/en.json
  - messages/sr.json
  - next.config.ts
  - package.json
  - src/app/[locale]/(dashboard)/club/page.tsx
  - src/app/[locale]/(dashboard)/documents/actions.ts
  - src/app/[locale]/(dashboard)/documents/page.tsx
  - src/app/[locale]/(dashboard)/equipment/actions.ts
  - src/app/[locale]/(dashboard)/equipment/export/route.ts
  - src/app/[locale]/(dashboard)/equipment/page.tsx
  - src/app/[locale]/(dashboard)/import/actions.ts
  - src/app/[locale]/(dashboard)/import/page.tsx
  - src/app/[locale]/(dashboard)/people/[id]/page.tsx
  - src/app/[locale]/(dashboard)/people/actions.ts
  - src/app/[locale]/(dashboard)/people/page.tsx
  - src/app/[locale]/(dashboard)/players/[id]/contracts/actions.ts
  - src/app/[locale]/(dashboard)/players/[id]/contracts/page.tsx
  - src/app/[locale]/(dashboard)/players/[id]/documents/page.tsx
  - src/app/[locale]/(dashboard)/players/[id]/equipment/page.tsx
  - src/app/[locale]/(dashboard)/players/[id]/guardians/actions.ts
  - src/app/[locale]/(dashboard)/players/[id]/guardians/page.tsx
  - src/app/[locale]/(dashboard)/players/[id]/medical/actions.ts
  - src/app/[locale]/(dashboard)/players/[id]/medical/page.tsx
  - src/app/[locale]/(dashboard)/players/[id]/page.tsx
  - src/app/[locale]/(dashboard)/players/[id]/registrations/actions.ts
  - src/app/[locale]/(dashboard)/players/[id]/registrations/page.tsx
  - src/app/[locale]/(dashboard)/players/actions.ts
  - src/app/[locale]/(dashboard)/players/page.tsx
  - src/app/[locale]/(dashboard)/seasons/actions.ts
  - src/app/[locale]/(dashboard)/seasons/page.tsx
  - src/app/[locale]/(dashboard)/teams/[id]/registrations/page.tsx
  - src/app/[locale]/(dashboard)/teams/actions.ts
  - src/app/[locale]/(dashboard)/teams/page.tsx
  - src/components/documents/DocumentDownloadButton.tsx
  - src/components/documents/DocumentSection.tsx
  - src/lib/__tests__/athlete-id.test.ts
  - src/lib/__tests__/equipment-export.test.ts
  - src/lib/__tests__/guardian.test.ts
  - src/lib/__tests__/rollover.test.ts
  - src/lib/__tests__/rows.test.ts
  - src/lib/__tests__/status.test.ts
  - src/lib/athlete-id.ts
  - src/lib/club-data.ts
  - src/lib/equipment-export.ts
  - src/lib/equipment.ts
  - src/lib/guardian.ts
  - src/lib/import/parsers.ts
  - src/lib/import/rows.ts
  - src/lib/rbac.ts
  - src/lib/rollover.ts
  - src/lib/staff.ts
  - src/lib/status.ts
  - src/lib/storage.ts
  - src/schemas/player.ts
  - src/types/database.ts
  - supabase/migrations/00002_app_permission_extensions.sql
  - supabase/migrations/00003_club_core.sql
  - supabase/migrations/00004_club_core_counter.sql
  - supabase/migrations/00005_registration_medical.sql
  - supabase/migrations/00006_staff_guardians.sql
  - supabase/migrations/00007_documents_contracts.sql
  - supabase/migrations/00008_import_jobs.sql
  - supabase/migrations/00009_equipment.sql
  - supabase/migrations/00010_app_permission_seeds.sql
  - vitest.config.ts
  - vitest.setup.ts
findings:
  critical: 1
  warning: 9
  info: 6
  total: 16
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-08-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 68
**Status:** issues_found

## Summary

Reviewed the Phase 2 (Club & People) implementation: seasons/teams/players with club athlete IDs, rollover, registration & medical tracking, staff/guardians, documents/contracts with signed-URL storage, CSV/XLSX import, equipment, and migrations 00002–00010. The RLS discipline is consistently applied (ENABLE + FORCE ROW LEVEL SECURITY on every new table, org claim + `authorize()` in every policy) and the storage-object policies correctly scope to the org folder prefix. No hardcoded secrets, no `eval`/`innerHTML`, no debug artifacts, and the i18n files are in full key parity (590/590).

The dominant defect classes are: (1) **partial-write sequences** — `createAthlete` inserts the athlete before a membership insert that can fail, and `startNewSeason` commits the archive+new-season before the carry-forward writes; (2) **inconsistent cross-org parent-reference validation** — migration 00009 added composite org FKs for equipment, but 00003/00005/00006/00007 tables and several write paths (guardians, registrations, medical, staff teams/licenses, `createAthlete` team_id) never verify the referenced parent belongs to the org; (3) **permission/type mismatches** — `linkStaffAccountAction` is blocked by the `organization_memberships` RLS for non-president `staff.manage` holders, and the `StaffViewer.role` vs `OrganizationContext.userRole` mismatch silently disables the coach self-scope; (4) a **concurrency race** in the import batch progress update that can spuriously mark a healthy job `failed`.

## Critical Issues

### CR-01: Player creation partially commits when a team is selected but no active season exists

**File:** `src/app/[locale]/(dashboard)/players/actions.ts:58-69`, `src/lib/club-data.ts:661-675`
**Issue:** `createPlayer` passes `seasonId: teamId ? active?.id ?? undefined : undefined` (line 66). When a team is selected and the org has no active season, `seasonId` is `undefined`, and `createAthlete` inserts the membership with `season_id: input.seasonId ?? ""` (club-data.ts:667) — an empty string that violates the `seasonal_memberships_season_id_fkey` FK. The athlete row (with its claimed club athlete number) is **already committed** by then (step 2, club-data.ts:640-654), so the action throws an error *after* a successful athlete insert. The user retries, mints a second athlete, and burns another club-athlete counter value. Worse, the roster page (`listAthletesWithCurrentMembership`, `!inner` join) hides athletes with no membership, so the orphaned athletes are **invisible in the UI** and there is no athlete-delete action to clean them up. The same partial-commit applies to `importBatchAction` (createAthlete path, import/actions.ts:381-398) whenever the membership insert fails for any reason.
**Fix:** Guard before inserting the athlete — reject when `team_id` is set but no active season exists; or skip the membership insert when `seasonId` is falsy:
```ts
// players/actions.ts
if (teamId && !active) {
  throw new Error("Nema aktivne sezone — dodajte sezonu pre nego što dodelite tim");
}
const result = await createAthlete(supabase, org.organizationId, {
  ...,
  seasonId: teamId && active ? active.id : undefined,
  team_id: teamId,
});
```
```ts
// club-data.ts — createAthlete membership branch
if (input.team_id) {
  if (!input.seasonId) {
    return { error: "Aktivna sezona je obavezna za dodelu tima" };
  }
  const { error: membershipError } = await supabase
    .from("seasonal_memberships")
    .insert({ ..., season_id: input.seasonId, ... });
  if (membershipError) {
    // compensate: delete the just-inserted athlete
    await supabase.from("athletes").delete().eq("id", athlete.id);
    return { error: membershipError.message };
  }
}
```

## Warnings

### WR-01: `startNewSeason` is non-transactional — a mid-flight failure loses the membership carry-forward permanently

**File:** `src/app/[locale]/(dashboard)/seasons/actions.ts:119-202`
**Issue:** Steps (2) archive and (3) insert the new active season are committed before steps (5)/(6) insert memberships and staff assignments. If the memberships bulk-insert fails (FK/RLS/transient), the action throws but the old season is already archived and the new one is active **with zero memberships**. A retry is not idempotent: `getActiveSeason` now returns the empty new season, so the carry-forward rebuilds from nothing — the previous season's memberships are never copied. The comment acknowledges the DB backstop for the single-active invariant but not this data-loss path.
**Fix:** Read-then-write in a compensating order: insert the new (inactive) season and memberships/staff assignments *first*, then archive the old season and activate the new one last — or use a server-side RPC (`SECURITY DEFINER`, one transaction) that performs all six steps atomically. At minimum, on membership-insert failure, delete the just-inserted season and restore `is_active = true` on the previous season before rethrowing.

### WR-02: Concurrent/duplicate import batches spuriously mark the job `failed`

**File:** `src/app/[locale]/(dashboard)/import/actions.ts:422-451`
**Issue:** The optimistic-concurrency update `.eq("processed_rows", offset)` with `.select("*").single()` is the only guard against double-processing, but when two requests for the same offset overlap (client retry, double-submit, or a stale polled batch), the loser matches zero rows, `.single()` raises PGRST116, the `catch` block (line 445-451) then **unconditionally flips the job to `failed`** — even though all batches actually succeeded. The failed status is then terminal (`job.status === "failed"` returns immediately, line 286) and the user sees a failure for an import that completed.
**Fix:** Distinguish a lost optimistic-concurrency update from a real failure — if the update matched zero rows, return the fresh progress instead of throwing:
```ts
const { data: updated, error: updateError } = await supabase
  .from("import_jobs").update(updatePayload)
  .eq("id", job.id).eq("organization_id", org.organizationId)
  .eq("processed_rows", offset).select("*").maybeSingle();
if (updateError) throw new Error("Could not update import progress");
if (!updated) {
  // another request already advanced this batch — not an error
  const fresh = await getImportProgressAction(jobId);
  return { nextOffset: fresh.processedRows, progress: fresh, rowErrors: [] };
}
```

### WR-03: `StaffViewer.role` vs `OrganizationContext.userRole` mismatch disables the coach self-scope

**File:** `src/lib/staff.ts:45-76`, `src/app/[locale]/(dashboard)/people/page.tsx:25`, `src/app/[locale]/(dashboard)/people/[id]/page.tsx:45-51`
**Issue:** `applyViewerScope` reads `viewer?.role === "coach"`, but both call sites pass the `OrganizationContext` object, whose property is `userRole` (organization.ts:7). `viewer.role` is therefore always `undefined` and the coach restriction (`query.eq("user_id", viewer.userId)`) is dead code. Since coaches lack `staff.view` (00001 seeds), the RLS boundary prevents a leak but the intended behavior — a coach seeing only their own linked profile — silently degrades to an empty staff list / `notFound()` on their own profile page. The type mismatch should have been caught by `tsc`; the two call sites compile because `OrganizationContext` is structurally assignable to `StaffViewer` minus `role`.
**Fix:** Align the shapes — either add `role` to `StaffViewer` consumption (`viewer?.role ?? (viewer as { userRole?: AppRole }).userRole`) or change the call sites to pass `{ role: org.userRole, userId: org.userId }`, and add `staff.view` for the coach role if self-profile visibility is intended.

### WR-04: `linkStaffAccountAction` fails for `admin_finance` — RLS on `organization_memberships` requires `club_president`

**File:** `src/app/[locale]/(dashboard)/people/actions.ts:209-247`, `supabase/migrations/00001_foundation.sql:207-214` (context), `src/lib/staff.ts:279-285`
**Issue:** `linkStaffToUser` upserts `organization_memberships`, whose INSERT policy (`membership_insert`) only permits a user who is already `club_president` *of the target org*. The only `staff.manage` holders per the seeds are `club_president` and `admin_finance` — so the UI form (rendered for `canManage`) always errors for `admin_finance` users with an opaque "Greška pri povezivanju naloga" after the staff row update already succeeded (a second partial-write: staff.user_id/role are updated, then the membership upsert fails, leaving the staff profile linked but the membership row absent).
**Fix:** Gate the feature on the DB capability — check `club_president` membership of the org before showing the form and before calling the upsert (or add a `staff.manage`-based INSERT policy scoped to the caller's org). Also compensate the staff row update if the membership upsert fails, or perform both inside a single RPC.

### WR-05: Cross-org parent references are writable on most Phase-2 tables (missing composite org FKs and org checks)

**File:** `src/lib/guardian.ts:81-109`, `src/lib/club-data.ts:661-675`, `src/app/[locale]/(dashboard)/players/[id]/registrations/actions.ts:84-93`, `src/app/[locale]/(dashboard)/players/[id]/medical/actions.ts:79-87`, `src/lib/staff.ts:206-258`, `supabase/migrations/00003..00007` (context), `supabase/migrations/00009_equipment.sql:89-125` (contrast)
**Issue:** Migration 00009 explicitly added composite org FKs ("prevent a caller from linking a row in this domain to a parent record belonging to another organization"), but the Phase-2 tables created in 00003–00007 (`seasonal_memberships.team_id`, `guardians.athlete_id`, `staff_teams.staff_id/team_id/season_id`, `staff_licenses.staff_id`, `registrations.athlete_id/season_id`, `medical_examinations.athlete_id`, `contracts.athlete_id`) still have only single-column FKs. Several write paths accept parent ids straight from the request without org verification: `createAthlete` (`team_id`), `updateGuardians` (athlete id), `saveRegistration` (`athlete_id`, `season_id`), `saveMedicalExamination` (`athlete_id`), `upsertStaffLicenses`, `setStaffTeams`. A caller with the required permission can therefore insert rows in their own org that reference another org's parents (e.g., a registration tied to another org's season). RLS prevents *reading* the foreign parent's data, but the bogus rows pollute joins and counters. The documents/contracts/equipment paths verify org membership — this class is an inconsistency with the app's own stated defense.
**Fix:** Mirror the 00009 pattern — add `(organization_id, <parent_id>)` composite FKs for `guardians`, `staff_teams`, `staff_licenses`, `registrations`, `medical_examinations`, `contracts`, `seasonal_memberships`, and add org-verification in `createAthlete`/`updateGuardians`/`saveRegistration`/`saveMedicalExamination`/`upsertStaffLicenses`/`setStaffTeams` before insert.

### WR-06: Duplicate decisions only cover the first 50 rows; later duplicates are silently skipped

**File:** `src/app/[locale]/(dashboard)/import/page.tsx:88-114,139-170`, `src/app/[locale]/(dashboard)/import/actions.ts:338-342`
**Issue:** `parseUploadAction` returns only `rows.slice(0, 50)` for preview, and `chooseDecision` keys decisions by the preview index. `beginImport` sends the same `decisions` record to every batch, but batch processing keys by the raw row index (`decisions[String(index)]`, actions.ts:338), so rows 50+ always fall to the default `"skip"`. For files with more than 50 rows containing duplicates, the user is shown `totalRows` (e.g., 200) but can only decide the first 50 — every later duplicate is skipped with no indication, silently discarding those rows.
**Fix:** Either paginate decisions per batch (send only the decisions for the rows the batch covers, keyed to raw indexes) or surface the limitation explicitly (cap the preview at 50 and clearly state "decisions apply to the first 50 rows only"), or validate all rows (not just the first 50) before allowing import.

### WR-07: `inherit_team_sport` fails for orgs whose `sport` is NULL or not in the enum

**File:** `supabase/migrations/00003_club_core.sql:265-273`, `src/app/[locale]/(dashboard)/teams/actions.ts:29-33`
**Issue:** `teams.sport` is `NOT NULL` and `createTeam` never sends it, relying entirely on the trigger. `organizations.sport` is unconstrained TEXT (00001, no NOT NULL, no enum check). If an org's `sport` is NULL, the trigger's `(SELECT sport::sport_type ...)` yields NULL and the insert dies with an opaque NOT NULL violation; if the org's sport is any value outside `('football','basketball')` (e.g., a future sport), the cast throws `invalid input value for enum sport_type`. Every team creation for such orgs is permanently broken.
**Fix:** Make the trigger explicit and fail loudly with a clear message, or constrain org sport at the source:
```sql
IF NEW.sport IS NULL THEN
  SELECT sport::sport_type INTO NEW.sport FROM organizations WHERE id = NEW.organization_id;
  IF NEW.sport IS NULL THEN
    RAISE EXCEPTION 'Organization % has no valid sport configured', NEW.organization_id;
  END IF;
END IF;
```
(and add a CHECK on `organizations.sport IN ('football','basketball')` or a real FK/enum for it).

### WR-08: `linkStaffAccountAction` can hijack/overwrite another org's user's access claims

**File:** `src/app/[locale]/(dashboard)/people/actions.ts:221-243`
**Issue:** After `findAuthUserByEmail` finds any user in the system, the action overwrites that user's `app_metadata.organization_id` and `user_role` with the caller's org and chosen role — with no check that the target user is not already a member of another org, not already linked to another staff profile, and no confirmation. Because access control (`requireOrganization`, `hasPermission`, and every RLS policy) reads these claims, a `staff.manage` holder in org B silently **revokes an org-A user's access** (their claims now point to B) and grants B a member. The `staff.user_id UNIQUE` only catches double-linking *within* the same org. The app is single-org-per-user by design, but this clobbers a claim another tenant set.
**Fix:** Before linking, check `organization_memberships` (via the admin client or `listUsers`) for the target user's existing memberships and refuse with a clear message ("account already linked to another organization"), and require an explicit confirmation in the UI.

### WR-09: `deleteDocument` deletes the storage object before the DB row — failure ordering leaves a dangling row

**File:** `src/app/[locale]/(dashboard)/documents/actions.ts:183-189`
**Issue:** `deleteStoredFile` runs first, then the `documents` row is deleted. If the row delete fails (transient error, RLS), the metadata row survives but points at a deleted object — the download button then errors for a document that still appears in lists. The upload path already handles the mirror case correctly (deleting the object when the row insert fails, line 136); the delete path should follow the same compensating order.
**Fix:** Delete the DB row first; on success, delete the object, and on object-deletion failure log/return a warning (or keep the current order but compensate: if the row delete fails, nothing further can be done — the object is gone and the row is stale, which is strictly worse).
```ts
const { error } = await supabase.from("documents").delete()
  .eq("id", documentId.data).eq("organization_id", org.organizationId);
if (error) throw new Error("Greška pri brisanju dokumenta: " + error.message);
await deleteStoredFile(supabase, org.organizationId, document.storage_path)
  .catch(() => { /* log orphaned object */ });
```

## Info

### IN-01: Dead fallback in `createAthlete`

**File:** `src/lib/club-data.ts:635-637`
**Issue:** `claimed ?? buildClubAthleteNumber({ club_athlete_counter: 0 })` is unreachable — the `typeof claimed !== "number"` guard above already rejects `null`/`undefined`, and the RPC can never return `0` (counter starts at 0 and is incremented before return). If it ever did, the fallback would mint `1` and collide with an existing athlete.
**Fix:** Drop the fallback; use `claimed` directly.

### IN-02: Misleading comment on `updateOrganizationSettings`

**File:** `src/lib/club-data.ts:356-360`
**Issue:** The doc comment claims "A null/negative guard keeps the DB CHECK happy" but no guard exists in this function — the enforcement lives in the caller's zod schema (`club/page.tsx:8-12`). The comment invites callers to assume the function self-guards.
**Fix:** Add the guard or correct the comment to point at the zod schema.

### IN-03: Duplicated transition logic in the equipment page

**File:** `src/app/[locale]/(dashboard)/equipment/page.tsx:215`
**Issue:** The rendered next-state buttons hard-code a nested ternary that mirrors `allowedTransitions` in `src/lib/equipment.ts:300-306`. The page list (`returned → [issued]`, `missing → [issued]`) drifts from the lib transitions (`missing → [missing, issued]`). If the lib transitions change, the UI will render buttons the server rejects.
**Fix:** Derive the button list from `allowedTransitions` (export it and compute per item state server-side).

### IN-04: `findAuthUserByEmail` paginates at 1000 users

**File:** `src/app/[locale]/(dashboard)/people/actions.ts:200-207`
**Issue:** `admin.auth.admin.listUsers({ page: 1, perPage: 1000 })` only scans the first page; an existing user beyond the first 1000 accounts is reported "not found". Also silently O(n) on every link request.
**Fix:** Loop pages until the email is found or the list is exhausted (or use `listUsers` with the email filter when the API supports it).

### IN-05: `getUserRole` silently falls back to `club_president`

**File:** `src/lib/organization.ts:97-100`
**Issue:** Missing role claims resolve to the most privileged non-admin role. Harmless today (navigation-only consumers) but a footgun if this helper is ever used for gating.
**Fix:** Return `null`/throw on missing role; let callers decide the fallback.

### IN-06: Duplicate preview/decision behavior is undocumented in the UI

**File:** `src/app/[locale]/(dashboard)/import/page.tsx:285`
**Issue:** The preview header states `count: job.totalRows` but renders only 50 rows; nothing tells the user decisions apply to the first 50 rows only (see WR-06). A one-line hint would prevent surprise.
**Fix:** Add a hint string (e.g., "Only the first 50 rows are previewed; later duplicate rows default to skip") and the corresponding i18n keys.

---

_Reviewed: 2026-08-28T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_