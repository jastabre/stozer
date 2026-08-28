---
status: testing
phase: 02-club-people
source: [02-VERIFICATION.md]
started: 2026-08-28T20:30:00Z
updated: 2026-08-28T20:30:00Z
---

## Current Test

number: 1
name: Club setup user flow (MVP mode) — season, team, player with C-format ID
expected: |
  Each step succeeds and the roster page shows the player with a stable C-prefixed club athlete ID.
awaiting: user response

## Tests

### 1. Club setup user flow (MVP mode)
test: Walk the full club setup user flow end-to-end: create season -> create team -> add player with all profile fields -> confirm roster + C-format club ID
expected: Each step succeeds and the roster page shows the player with a stable C-prefixed club athlete ID
why_human: No e2e/component tests exist; server actions + DB persistence are only statically verified
result: [pending]

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
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps