---
status: testing
phase: 02-club-people
source: [02-VERIFICATION.md]
started: 2026-08-28T20:30:00Z
updated: 2026-08-29T11:40:00Z
---

## Current Test

number: 1
name: Club setup user flow (MVP mode) — season, team, player with C-format ID (RETEST #4 in progress — dashboard CTA fixed)
expected: |
  Each step succeeds and the roster page shows the player with a stable C-prefixed club athlete ID.
awaiting: user response

## Tests

### 1. Club setup user flow (MVP mode)
test: Walk the full club setup user flow end-to-end: create season -> create team -> add player with all profile fields -> confirm roster + C-format club ID
expected: Each step succeeds and the roster page shows the player with a stable C-prefixed club athlete ID
why_human: No e2e/component tests exist; server actions + DB persistence are only statically verified
result: issue
reported: "Registration, email verification and login succeed; onboarding form is reached. Submitting 'Kreiraj klub' fails with: 'Greška pri kreiranju organizacije: permission denied for table organization_memberships'. Previous redirect/i18n and nested <html>/<body> issues are resolved."
severity: blocker
fix: "src/middleware.ts: public auth/landing paths now short-circuit before handleI18nRouting (next-intl localePrefix 'always' rewrote /login -> /en/login). Verified: /, /login, /register, /verify, /reset-password all return 200; /sr/dashboard (unauth) -> 307 -> /login; /en/login 404. Gates: vitest 98/98, tsc 0, lint 0, build 0."
retest: failed
retest_note: "RETEST #3: org creation blocked by RLS. RETEST #4 (in progress): org creation + team creation work. Fixes applied during test: (1) BottomNav.tsx used useState(() => loadRole()) as an effect hack — async setNavItems could run after unmount ('Can't perform a React state update...'). Replaced with useEffect + cancellation flag; role-based nav logic unchanged. (2) Dashboard empty-state 'Dodaj tim' CTA had actionHref='#' (did nothing). Fixed to `/{locale}/teams` using the [locale] page param (getLocale() was not locale-aware in this setup). Verified in a live session against localhost:3000: /sr renders href=/sr/teams, /en renders href=/en/teams, and /sr/teams contains the create-team form. No other EmptyState in the app uses a broken CTA (only dashboard used actionHref)."

### 2. CR-01 create-player edge case
test: Verify the create-player edge case from CR-01: select a team while no active season is resolvable and confirm no orphaned/invisible athlete row is left behind
expected: The action rejects cleanly before committing the athlete, or compensates; no burned counter values, no invisible orphans
why_human: Confirmed partial-commit defect in players/actions.ts:58-69 + club-data.ts:661-675; requires observing the live DB state
result: [pending]

### 3. Bulk import CSV + XLSX (>50 rows)
test: Bulk import a CSV and an XLSX with >50 rows, unknown teams, and duplicates; verify mapping, validation preview, duplicate resolution, and the result summary
expected: Import converges on 'done' with correct counts; unknown teams flagged; WR-06 means duplicates beyond row 50 default to skip — confirm that limitation is acceptable
why_human: Import wizard and batch actions hit a live DB/entitlement stack; only the pure row model is automated
result: [pending]

### 4. Season rollover identity persistence
test: Run 'Start New Season' rollover and verify athletes keep permanent identity, memberships + staff_teams carry forward, and only one active season exists
expected: Single active season per org; memberships/staff carried idempotently; WR-01 data-loss path does not trigger in normal use
why_human: Rollover commit ordering is a DB state transition with no automated test
result: [pending]

### 5. Registration status colors
test: Verify registration status colors: add registrations with expiry inside/at/after the org threshold and confirm green/yellow/red pills on the profile and team overview
expected: Pills match deriveStatus; threshold change on /club updates all pills
why_human: Status derivation is unit-tested; rendering + threshold propagation need a visual check
result: [pending]

### 6. Staff profile + license pill + account linking
test: Verify staff profile: assigned teams + license expiry pill + account linking; test as coach (WR-03) and as admin_finance (WR-04)
expected: Managers see full profiles and license pills; coaches see their own profile (currently empty list — known defect); account linking works for the acting role
why_human: Viewer scoping (WR-03) and membership-upsert RLS (WR-04) are live-behavior issues
result: [pending]

### 7. Documents upload/download/delete + expiry overview
test: Verify documents: upload athlete + staff documents, download via signed URL, delete; confirm /documents org-wide expiry overview and filters
expected: Private storage only, signed-URL downloads, expiry tones, overview filters work; WR-09 delete ordering is acceptable
why_human: Storage RLS/signed-URLs and browser flow need a live Supabase project
result: [pending]

### 8. Cross-tenant RLS sanity check
test: Cross-tenant RLS sanity check: create two orgs and confirm org B cannot read or write org A's athletes/registrations/documents/equipment
expected: RLS isolation holds on every new Phase 2 table; storage objects scoped by org folder
why_human: RLS policies are reviewed in SQL but not executed against two live tenants
result: [pending]

## Summary

total: 8
passed: 0
issues: 1
pending: 7
skipped: 0
blocked: 0

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
    - "Public paths (/ , /login, /register, /verify, /reset-password) must bypass the i18n redirect"
  resolved_by: inline fix during UAT
  resolved_at: 2026-08-28
  verification: "HTTP 200 on all five public routes; /sr/dashboard (unauth) -> 307 -> /login; vitest 98/98, tsc 0, lint 0, next build 0"
- gap_id: G-02-1R
  truth: "After login, a newly verified user reaches onboarding (or dashboard if setup complete) with no redirect loop, and the page renders a single <html>/<body> owned by the root layout"
  status: failed
  reason: "User reported: after login the app navigates to /sr/onboarding then fails with 'localhost redirected you too many times'; dev console shows nested <html>/<body> mount errors and 'Failed to fetch RSC payload for /sr/onboarding'"
  severity: blocker
  test: 1
  root_cause: "Two independent defects. (1) Redirect loop: src/middleware.ts redirected any authenticated no-org user to /sr/onboarding without checking whether they were already on /sr/onboarding -> infinite 307 loop. (2) Nested document elements: src/app/[locale]/layout.tsx rendered its own <html>/<body> inside the root layout's <html>/<body>; hydration failed on [locale] routes, which also broke client-side navigation (RSC payload fetch aborted, falling back to browser navigation)."
  artifacts:
    - path: "src/middleware.ts"
      issue: "No-org redirect did not exclude the onboarding path itself, producing a self-redirect loop on /sr/onboarding"
    - path: "src/app/[locale]/layout.tsx"
      issue: "Rendered nested <html>/<body> inside root layout -> hydration errors and RSC navigation failures"
  missing:
    - "Exempt /onboarding from the no-org middleware redirect so the page can render for first-time users"
    - "Remove <html>/<body> from [locale]/layout.tsx; root layout is the single owner of document elements"
  debug_session: "inline diagnosis during UAT"
  fix_status: applied
  verification: "vitest 98/98; tsc 0; lint 0 errors; next build 0; HTTP: /sr and /sr/onboarding (unauth) -> 307 /login; /login and / render single <html>/<body>"
- gap_id: G-02-1R2
  truth: "Submitting onboarding creates org + the user's own club_president membership + subscription in one step, then redirects into the club"
  status: failed
  reason: "User reported: 'Greška pri kreiranju organizacije: permission denied for table organization_memberships' when submitting Kreiraj klub as a fresh verified user"
  severity: blocker
  test: 1
  root_cause: "PRIMARY: the database was provisioned without Supabase's standard base grants — anon/authenticated/service_role had NO privileges on any public table, so every query surfaced 'permission denied for table X'. The onboarding org INSERT's RETURNING evaluated the org_select_members RLS policy subquery on organization_memberships, which failed on the missing grant -> exact reported error. SECONDARY: (a) circular RLS bootstrap — membership_insert requires already being a club_president of the target org; (b) createOrganization used auth.admin.updateUserById with the anon-key server client (service-role only) so JWT app_metadata claims were never set; (c) authorize()/every RLS policy read JWT claims only populated by a custom_access_token_hook that was never registered; (d) even with claims set, the existing session token is stale until refreshed; (e) RPC initially shipped with SET search_path='' which broke the AFTER INSERT seed triggers (seed_org_settings 00005, seed_equipment_types 00009)."
  artifacts:
    - path: "supabase/migrations/00016_restore_public_grants.sql"
      issue: "Restored standard Supabase base privileges (USAGE + ALL on tables/sequences/functions + default privileges) to anon/authenticated/service_role; RLS remains FORCE'd. Without grants, RLS cannot be evaluated."
    - path: "supabase/migrations/00014_org_onboarding_fix.sql"
      issue: "SECURITY DEFINER RPC create_organization_onboarding: atomic org + first club_president membership + subscription, guarded by auth.uid() and single-org-per-user"
    - path: "supabase/migrations/00015_org_onboarding_rpc_search_path.sql"
      issue: "RPC search_path '' -> public so AFTER INSERT seed triggers resolve unqualified public tables"
    - path: "src/app/[locale]/onboarding/actions.ts"
      issue: "Calls the RPC; sets JWT claims via service-role admin client; refreshes the session so RLS reads fresh claims"
    - path: "supabase/migrations/00014_org_onboarding_fix.sql"
      issue: "authorize() DB fallback to nested app_metadata claim and membership table when the top-level claim is absent"
  missing:
    - "Restore base grants (applied in 00016) — the actual blocker"
    - "SECURITY DEFINER RPC create_organization_onboarding (00014) with search_path = public (00015)"
    - "Service-role claims update + session refresh in the onboarding action"
    - "authorize() DB fallback for roles without the custom_access_token_hook"
  debug_session: "inline diagnosis during UAT"
  fix_status: applied
  verification: "LIVE DB verified with fresh users (service-role admin + user sessions): RPC creates org; membership role=club_president; subscription active; equipment_types (3) + organization_settings (1) seeded via triggers; user reads org/membership/subscription via RLS with refreshed token; authorize('seasons.manage')=true; cross-tenant user sees 0 orgs; second RPC call rejected ('User already belongs to an organization'). Gates: vitest 98/98, tsc 0, lint 0 errors, next build 0."
  follow_ups:
    - "service_role lacked base table privileges too — the app's account-linking queries (people/actions.ts) previously failed; now covered by 00016 grants"
    - "Dev server must be restarted to load SUPABASE_SERVICE_ROLE_KEY from .env.local"