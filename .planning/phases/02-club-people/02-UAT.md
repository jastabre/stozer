---
status: complete
phase: 02-club-people
source: [02-VERIFICATION.md]
started: 2026-08-28T20:30:00Z
updated: 2026-09-30T00:00:00Z
acceptance: manual
accepted_at: 2026-09-30
accepted_by: user
---

## Current Test

[testing complete]

## Tests

### 1. Club setup user flow (MVP mode)
test: Walk the full club setup user flow end-to-end: create season -> create team -> add player with all profile fields -> confirm roster + C-format club ID
expected: Each step succeeds and the roster page shows the player with a stable C-prefixed club athlete ID
why_human: No e2e/component tests exist; server actions + DB persistence are only statically verified
result: pass
acceptance: "Manually accepted by the user on 2026-09-30. Earlier blockers G-02-1 (i18n routing), G-02-1R (no-org redirect loop + nested <html>/<body>) and G-02-1R2 (missing base grants / org-creation RLS) were fixed inline and re-tested; org + season + team + player creation works."

### 2. CR-01 create-player edge case
test: Verify the create-player edge case from CR-01: select a team while no active season is resolvable and confirm no orphaned/invisible athlete row is left behind
expected: The action rejects cleanly before committing the athlete, or compensates; no burned counter values, no invisible orphans
why_human: Confirmed partial-commit defect in players/actions.ts + club-data.ts; requires observing the live DB state
result: pass
acceptance: "Manually accepted by the user on 2026-09-30. CR-01 fixed in commit 7d66e08 (createPlayer rejects team-without-active-season; createAthlete compensates)."

### 3. Bulk import CSV + XLSX (>50 rows)
test: Bulk import a CSV and an XLSX with >50 rows, unknown teams, and duplicates; verify mapping, validation preview, duplicate resolution, and the result summary
expected: Import converges on 'done' with correct counts; unknown teams flagged; WR-06 limitation resolved so decisions apply per batch
why_human: Import wizard and batch actions hit a live DB/entitlement stack; only the pure row model is automated
result: pass
acceptance: "Manually accepted by the user on 2026-09-30. WR-02 (lost-race no longer flips the job to failed) and WR-06 (per-batch decision keying) fixes applied."

### 4. Season rollover identity persistence
test: Run 'Start New Season' rollover and verify athletes keep permanent identity, memberships + staff_teams carry forward, and only one active season exists
expected: Single active season per org; memberships/staff carried idempotently; WR-01 data-loss path does not trigger in normal use
why_human: Rollover commit ordering is a DB state transition with no automated test
result: pass
acceptance: "Manually accepted by the user on 2026-09-30. WR-01 compensating rollover sequence applied (insert inactive first, carry forward, archive/activate last)."

### 5. Registration status colors
test: Verify registration status colors: add registrations with expiry inside/at/after the org threshold and confirm green/yellow/red pills on the profile and team overview
expected: Pills match deriveStatus; threshold change on /club updates all pills
why_human: Status derivation is unit-tested; rendering + threshold propagation need a visual check
result: pass
acceptance: "Manually accepted by the user on 2026-09-30."

### 6. Staff profile + license pill + account linking
test: Verify staff profile: assigned teams + license expiry pill + account linking; test as coach (WR-03) and as admin_finance (WR-04)
expected: Managers see full profiles and license pills; coaches see their own profile; account linking works for the acting role
why_human: Viewer scoping (WR-03) and membership-upsert RLS (WR-04) are live-behavior issues
result: pass
acceptance: "Manually accepted by the user on 2026-09-30. WR-03 (coach self-scope via userRole) and WR-04 (club_president-gated account linking) fixes applied."

### 7. Documents upload/download/delete + expiry overview
test: Verify documents: upload athlete + staff documents, download via signed URL, delete; confirm expiry indicators on profiles
expected: Private storage only, signed-URL downloads, expiry tones on profile document sections
why_human: Storage RLS/signed-URLs and browser flow need a live Supabase project
result: pass
acceptance: "Manually accepted by the user on 2026-09-30 with reconciled scope: documents are profile-scoped with per-profile expiry tone indicators (WR-09 delete ordering fixed); Club Documents live under Klub -> Dokumenti kluba; the former org-wide /documents route now redirects to /club/documents."

### 8. Cross-tenant RLS sanity check
test: Cross-tenant RLS sanity check: create two orgs and confirm org B cannot read or write org A's athletes/registrations/documents/equipment
expected: RLS isolation holds on every new Phase 2 table; storage objects scoped by org folder
why_human: RLS policies are reviewed in SQL but not executed against two live tenants
result: pass
acceptance: "Manually accepted by the user on 2026-09-30."

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Manual Acceptance

- **Acceptance type:** MANUAL — browser walk-through by the user. No automated UAT/e2e suite exists; this file records human acceptance only and must not be reported as automated UAT.
- **Accepted:** 2026-09-30
- **Confirmation:** user declared "PHASE 2 = COMPLETE / UAT = PASSED" on 2026-09-30.

## Deferred Follow-Ups

- test: 1
  idea: "Country dropdown in onboarding currently lists only Serbia, Bosnia and Herzegovina, Croatia, Montenegro, North Macedonia, Slovenia and Germany (RS, BA, HR, ME, MK, SI, DE). Recorded for product review — do not change the list yet."
  deferred_at: 2026-08-29

## Gaps

- gap_id: G-02-1
  truth: "Unauthenticated visits reach the login page and can start the club setup flow"
  status: resolved
  reason: "User reported: every unauthenticated visit is redirected to /en/login and that route returns 404"
  severity: blocker
  test: 1
  root_cause: "next-intl middleware defaults to localePrefix 'always', rewriting unprefixed /login -> /en/login, but auth pages live outside the [locale] route group"
  artifacts:
    - path: "src/middleware.ts"
      issue: "handleI18nRouting ran before the public-path short-circuit, redirecting unprefixed auth/landing paths to non-existent locale-prefixed routes"
  missing:
    - "Public paths (/, /login, /register, /verify, /reset-password) must bypass the i18n redirect"
  resolved_by: inline fix during UAT
  resolved_at: 2026-08-28
  verification: "HTTP 200 on all five public routes; /sr/dashboard (unauth) -> 307 -> /login; vitest 98/98, tsc 0, lint 0, next build 0"
- gap_id: G-02-1R
  truth: "After login, a newly verified user reaches onboarding (or dashboard if setup complete) with no redirect loop, and the page renders a single <html>/<body> owned by the root layout"
  status: resolved
  reason: "User reported: after login the app navigated to /sr/onboarding then failed with 'localhost redirected you too many times'; nested <html>/<body> mount errors in the dev console"
  severity: blocker
  test: 1
  root_cause: "Two independent defects: (1) the no-org middleware redirect did not exclude /onboarding, producing a self-redirect loop; (2) src/app/[locale]/layout.tsx rendered nested <html>/<body> inside the root layout, breaking hydration and client navigation"
  artifacts:
    - path: "src/middleware.ts"
      issue: "No-org redirect did not exclude the onboarding path itself"
    - path: "src/app/[locale]/layout.tsx"
      issue: "Rendered nested <html>/<body> inside root layout"
  missing:
    - "Exempt /onboarding from the no-org middleware redirect"
    - "Remove <html>/<body> from [locale]/layout.tsx; root layout owns document elements"
  resolved_by: inline fix during UAT
  resolved_at: 2026-09-30
  verification: "vitest 98/98; tsc 0; lint 0 errors; next build 0; /sr/onboarding renders a single <html>/<body>"
- gap_id: G-02-1R2
  truth: "Submitting onboarding creates org + the user's own club_president membership + subscription in one step, then redirects into the club"
  status: resolved
  reason: "User reported: 'Greška pri kreiranju organizacije: permission denied for table organization_memberships' when submitting Kreiraj klub as a fresh verified user"
  severity: blocker
  test: 1
  root_cause: "PRIMARY: the database was provisioned without Supabase's standard base grants, so every query surfaced 'permission denied for table X'. SECONDARY: circular RLS bootstrap, anon-key claims writes, and an RPC search_path that broke seed triggers"
  artifacts:
    - path: "supabase/migrations/00016_restore_public_grants.sql"
      issue: "Restored standard Supabase base privileges to anon/authenticated/service_role; RLS remains FORCE'd"
    - path: "supabase/migrations/00014_org_onboarding_fix.sql"
      issue: "SECURITY DEFINER RPC create_organization_onboarding (atomic org + president membership + subscription)"
    - path: "supabase/migrations/00015_org_onboarding_rpc_search_path.sql"
      issue: "RPC search_path -> public so AFTER INSERT seed triggers resolve"
    - path: "src/app/[locale]/onboarding/actions.ts"
      issue: "Calls the RPC; sets JWT claims via service-role admin client; refreshes the session"
  missing:
    - "Restore base grants (00016) — the actual blocker"
    - "SECURITY DEFINER RPC create_organization_onboarding (00014/00015)"
    - "Service-role claims update + session refresh in the onboarding action"
  resolved_by: inline fix during UAT
  resolved_at: 2026-09-30
  verification: "Live DB verified with fresh users: RPC creates org, membership role=club_president, subscription active, seed triggers ran, RLS reads succeed with a refreshed token, cross-tenant user sees 0 orgs. Gates: vitest 98/98, tsc 0, lint 0 errors, next build 0."
