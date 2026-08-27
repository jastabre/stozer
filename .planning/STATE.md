---
gsd_state_version: 1.0
current_phase: 2
current_phase_name: Club & People
status: executing
stopped_at: Completed 02-04-PLAN.md
last_updated: "2026-08-27T21:55:41.074Z"
state_head: 257aa5b5289205cd91b4f9fd5148e4d0ee3a5600
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 9
  completed_plans: 6
  percent: 0
---

# Project State: STOŽER

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-26)

**Core value:** A club president or youth director opens Stožer and instantly knows: who paid, who owes, who's registered, who's training today, what needs attention — without calling three people or searching through files.

**Current focus:** Phase 2 — Club & People

## Current Position

**Phase:** 2 (Club & People) — EXECUTING
**Plan:** 6 of 8
**Status:** Ready to execute
**Progress:** ████░░░░░░ [░░░░░░░░░░] 0% (Phase 1 of 7 complete)

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files | Completed |
|-------|------|----------|-------|-------|-----------|
| 01-foundation | 01 | 45min | 12 | 45+ | 2026-08-27 |
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 02-club-people P01 | 8min | 3 tasks | 8 files |
| Phase 02-club-people P02 | 65min | 3 tasks | 21 files |
| Phase 02-club-people P03 | 16min | 3 tasks | 14 files |
| Phase 02 P06 | 17 min | 3 tasks | 10 files |
| Phase 02 P04 | 12min | 3 tasks | 16 files |

## Accumulated Context

### Decisions Made

- 2026-08-26: Greenfield project, fresh start
- 2026-08-26: Solo founder, no deadline, quality first
- 2026-08-26: Serbian Latin primary, English via i18n
- 2026-08-26: Free + paid from day one with trial
- 2026-08-26: Vertical MVP structure with Foundation phase first
- 2026-08-26: Sequential execution (no parallel plans)
- 2026-08-26: Interactive mode (confirm at each step)
- 2026-08-26: Left sidebar, collapsible, clean/neutral design
- 2026-08-26: Single-step org creation, first user = President
- 2026-08-26: Single org per user in V1
- 2026-08-26: FREE limits visible+locked, inline upgrade CTA
- 2026-08-26: 14-day trial, no card, lock features on expiry
- 2026-08-26: Section empty states, context-guided first use
- 2026-08-27: Integer cents/para for all financial data (D-07)
- 2026-08-27: RLS on every table with FORCE ROW LEVEL SECURITY
- 2026-08-27: First user of org becomes club_president (D-05)
- 2026-08-27: 14-day CLUB trial on org creation (D-09)
- 2026-08-27: Middleware handles both auth routing and i18n locale detection
- 2026-08-27: Role stored in JWT app_metadata for server-side RBAC
- [Phase 2]: Phase 2 test infra: vitest runner + 5 Wave-0 lib test scaffolds; deps approved via blocking-human package legitimacy gate
- [Phase 2]: Pattern 3 club athlete counter realized as SECURITY DEFINER RPC claim_club_athlete_number (JWT org-scoped) since supabase-js cannot express atomic UPDATE..RETURNING
- [Phase 2]: Hand-written supabase Database type must include Views:{} and Relationships on every table or nested relational selects collapse to never
- [Phase 2]: Season rollover runs as sequential server-action steps; single-active invariant backstopped by partial unique index (supabase-js has no multi-statement transaction)
- [Phase 2]: Migration numbering shifted: 02-03 registration/medical migration ships as 00005 because 02-02's counter-RPC deviation consumed 00004. Downstream plans 02-04..02-07 must renumber +1 (00006..00009); 02-08 pristine-diff range becomes 00002..00009.
- [Phase 2]: 'Current' registration/medical record = created_at DESC, first wins (not earliest-expiry) — chosen in 02-03, applied consistently to profile lists + team overview (8c9b060) so views never disagree.
- [Phase 2]: Medical examination writes ride existing registrations.manage (no medical.manage); reads = registrations.view OR medical.view (coach D-38 visibility) — no app_permission additions in 00005.
- [Phase 2]: registrations.document_id linkage UI deferred to 02-05 (documents table = migration 00006, W1 cross-plan guard); column created + writable now, dropdown population lands with documents module.
- [Phase 2]: Phase 2 Plan 6 uses migration 00008 for import_jobs because 00004 is consumed and downstream plans reserve 00006/00007.
- [Phase 2]: Import jobs persist parsed rows, mappings, duplicate decisions, and processed_rows so server batches are stateless and retries cannot replay writes.
- [Phase 2]: Import parsers use strict csv-parse and exceljs, never evaluate formulas, and keep null-DOB duplicate matching disabled.
- [Phase 2]: 2026-08-27: 02-04 uses migration 00006_staff_guardians.sql because 00005 is registration_medical.
- [Phase 2]: 2026-08-27: Staff account linking refreshes app_metadata claims and cannot grant the reserved super_admin role.
- [Phase 2]: 2026-08-27: Staff licenses and guardians use small-set replacement semantics with pure guardian primary normalization.

### Lessons Learned

- Next.js 16 deprecates `middleware` in favor of `proxy` — middleware still works
- PowerShell `git add` with parentheses requires quoting: `git add "src/app/(auth)/"`
- Auth pages outside `[locale]` route need their own i18n provider wrapper
- React Hooks purity rule: extract `Date.now()` to helper functions in server components

### Blockers

(None)

## Session Continuity

**Stopped at:** Completed 02-04-PLAN.md

**Last session:** 2026-08-27T21:55:41.034Z
**Resume file:** None
**Next action:** Run `/gsd-plan-phase 2` to plan Phase 2 (Teams & People / Club & People)

---
*Last updated: 2026-08-27 after Phase 2 discuss-phase*
