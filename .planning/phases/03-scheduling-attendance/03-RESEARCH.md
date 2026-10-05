# Phase 03: Scheduling & Attendance — Research

**Researched:** 2026-10-05
**Input:** `03-CONTEXT.md` (locked decisions D-01..D-48), `REQUIREMENTS.md` (OPER-01..OPER-08), `ROADMAP.md`, `STATE.md`, `AGENTS.md`, `STOZER-BRIEF.md`.

## Summary of recommendations

| # | Topic | Recommendation |
|---|-------|----------------|
| 1 | Unified calendar data model | Separate first-class tables (`matches`, `trainings`, `calendar_events`) + one `calendar` view/UNION query. Match is a stable UUID entity (D-33). |
| 2 | Recurrence | Expanded occurrence rows linked by `series_id`, with a stored `recurrence_rule` for reference. |
| 3 | Attendance | `attendance` rows (training_id + athlete_id), `status ∈ {present,absent,late}` + `absence_resolution ∈ {unresolved,excused,unexcused}` + optional reason. |
| 4 | Attendance % (D-48) | LOCKED — (present + late) ÷ held trainings in period for which the player was an active member; late shown separately. |
| 5 | Venue conflict | `tstzrange(starts_at, ends_at, '[)') &&` overlap across trainings + matches + events at same venue; return colliding items for a WARNING. |
| 6 | Calendar UI | Custom day/week/month grid + agenda on `date-fns`, no heavy calendar library; shadcn Sheet for the detail drawer. |
| 7 | PDF/print | `@media print` + `window.print()` first (no new dependency); server PDF (`@react-pdf/renderer`) only if real download is later required. |
| 8 | Permissions | 6 new `app_permission` values (`calendar.view`, `venue.view`, `venue.manage`, `match.view`, `match.manage`, `attendance.view`) via two-file enum+seed migrations; coach team-scoped. |
| 9 | Sport-aware | Single `matches` table, `home_score`/`away_score` integers, generic `venue_type` enum. No parallel football/basketball tables. |
| 10 | Tests | vitest for pure libs (attendance aggregation, recurrence expansion, conflict predicate, date helpers, i18n parity). |

---

## 1. Unified calendar data model

**Decision context (D-01, D-06, D-29, D-33):** one calendar; a structured training/match IS its own calendar representation (no duplicate manual entry); meetings/events are manual entries; the match must be a stable central entity for future analytics.

**Recommendation — separate first-class tables + a unifying view/query, NOT a single polymorphic `activities` table:**

- `matches` — own table (D-33: stable UUID PK, sport-aware, the future analytics anchor).
- `trainings` — own table (structured, carries recurrence).
- `calendar_events` — meetings + events (manual entries) with an `event_type` discriminator (`meeting`|`event`), plus a `calendar_event_participants` join (staff attendees, D-05).
- A `calendar` view (or a single server query) that UNIONs all three with a common shape `(id, activity_type, team_id, venue_id, starts_at, ends_at, title, status)` so the calendar and conflict checks read one feed.

Why not one polymorphic `activities` table: it forces a wall of nullable columns, weakens `matches` as the first-class analytics anchor, and makes RLS/team-scoping per activity type messier. The UNION query keeps the calendar simple while each entity stays clean.

## 2. Recurrence model (D-11)

**Recommendation — expanded occurrence rows + `series_id`:**

- Each recurring training is expanded into one `trainings` row per occurrence at creation, all sharing a `series_id` and a `recurrence_rule` (text, e.g. `FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=2026-12-31`) stored on the series origin for display/re-generation.
- "Edit this one" = UPDATE the single row (and set `series_id = NULL` if it diverges).
- "Edit this and all future" = UPDATE all rows in the series with `date >= this occurrence`.
- "Cancel" = set `status = 'cancelled'` (never delete — D-12).
- Attendance attaches naturally to each occurrence row (no virtual-occurrence indirection).

Tradeoff: a bulk edit rewrites N rows, but club schedules are small (dozens of occurrences per team per season), and this keeps the mobile attendance path dead simple. An RRule+virtual-occurrence model would be over-engineering for "simple repeat until a date".

## 3. Attendance data model (D-14..D-20)

**Table `attendance`:**

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid | RLS scoping |
| training_id | uuid FK trainings | |
| athlete_id | uuid FK athletes | |
| status | text | `present` \| `absent` \| `late` |
| absence_resolution | text | `unresolved` (default) \| `excused` \| `unexcused` — only meaningful when `status='absent'` |
| reason_preset | text | nullable — `bolest` \| `povreda` \| `skola` \| `porodicne_obaveze` \| `drugo` (D-18) |
| reason_note | text | nullable free-text (D-17/D-19) |
| recorded_at / updated_at | timestamptz | |

- `UNIQUE (training_id, athlete_id)`.
- "Označi sve kao prisutne" = upsert one `status='present'` row per active-roster athlete (from `seasonal_memberships.status='active'` + active season), then the coach edits exceptions (D-15). Roster is derived, never hand-picked (D-09).
- "N odsustava čekaju razjašnjenje" = `SELECT ... WHERE status='absent' AND absence_resolution='unresolved'` grouped by team (D-19).
- "Kasnio" recorded as `status='late'` and enters stats (D-20).

## 4. Attendance % formula — LOCKED (D-48)

**Formula:** Attendance % = (Prisutan + Kasnio) ÷ (held trainings in the selected period for which the player was an active member of that team) × 100.

Locked rules:
- **Prisutan** counts as attendance.
- **Kasnio** counts as attendance; the late count is displayed separately.
- **Opravdano**, **Neopravdano** and **Nerazjašnjeno** absences do NOT count as attendance.
- **Cancelled** trainings never enter the denominator.
- A training enters a player's denominator only if it occurred within the membership period [joined_on, left_on): `joined_on ≤ training_date AND (left_on IS NULL OR training_date < left_on)`.
- Period = this month / last 30 days / active season / custom range.

Implementation note: "held" = `trainings.status = 'completed'` (Održano), so the denominator is per-player (the set of completed trainings the player was rostered for during the period). The membership period uses `seasonal_memberships.joined_on` / `.left_on` (D-49): a training on date D counts iff `joined_on ≤ D AND (left_on IS NULL OR D < left_on)`. `created_at` is audit metadata — never the business source for membership dates. Keep the formula in one function (`buildAttendanceStats`) so it is unambiguous and testable.

## 5. Venue conflict detection (D-37..D-39)

Store `starts_at`/`ends_at` as `timestamptz` (half-open `[start, end)`). Conflict predicate:

```sql
SELECT ... WHERE venue_id = :vid
  AND tstzrange(starts_at, ends_at, '[)') && tstzrange(:start, :end, '[)')
```

Run against trainings + matches + calendar_events that have a venue. Return the colliding items to render a WARNING (D-37), never a silent save. Conflict scope = venue/location only (D-39). Warning, not hard block (D-38).

## 6. Calendar UI + mobile "Danas" (D-02..D-04, D-44)

Custom grid built on `date-fns` + existing shadcn/ui/Tailwind — no `react-big-calendar` (heavy, opinionated). Month = grid; Week = 7-col grid; Day/"Danas" = a vertical agenda list of cards (mobile-first). Tapping an item opens a shadcn `Sheet`/`Dialog` drawer (D-04). Filters (team, type, venue) are server-query params (D-02). Keep it simple for a non-technical coach.

## 7. PDF / print (D-25..D-28, D-42..D-43)

**Recommendation: `@media print` CSS + `window.print()` on a dedicated print route/component.** No new dependency; prints exactly the operational schedule (crest, club name, date/week, venues, times, teams, activity type) with zero app chrome (D-43). A server-side PDF library (`@react-pdf/renderer`) is available later if a true download artifact is required, but is not needed to satisfy "PDF/Print" now. Reuse the print stylesheet across player/team/venue reports for a future reusable report system (D-28) without building a generic report builder.

## 8. Permissions (D-34, D-46)

New `app_permission` values (two-file enum+seed split, mirroring 00033/00034 and 00044/00045):

- `calendar.view`, `venue.view`, `venue.manage`, `match.view`, `match.manage`, `attendance.view`. `attendance.manage` already exists. (No `schedule.view` — the all-venues schedule and print reuse `calendar.view`.)

Seed by role: `club_president` + `youth_director` → all six new values (plus existing `attendance.manage`); `coach` → `calendar.view`, `venue.view`, `match.view`, `attendance.view` (team-scoped via `has_team_scope`/`has_athlete_scope`). `admin_finance` → no new scheduling permissions. Coach team-scoping via `has_team_scope(team_id)` on trainings/matches/attendance.

## 9. Sport-aware model (D-32, D-35)

Single `matches` table; `home_score`/`away_score` INTEGER (sport-agnostic score, football goals = basketball points). `venue_type` enum `field`|`hall`|`balloon`|`other` (generic; UI label sport-aware if needed). No `football_matches`/`basketball_matches`. One sport per org (already enforced by `organizations.sport` CHECK + `inherit_team_sport`).

## 10. Testing strategy

vitest unit tests for pure functions: attendance stat aggregation (counts + %, from raw attendance rows), recurrence expansion (given rule → occurrence dates, "until date" boundary), conflict predicate (overlap true/false, touching boundaries), date/time helpers (a new `src/lib/date-time.ts` for time-of-day, since `date-format.ts` is date-only), and an i18n parity test (sr/en keys equal). Plus `npm run typecheck` and `npm run lint`.

---

## Validation Architecture

Nyquist validation is enabled. Phase correctness is verified by:

1. **Unit tests (vitest)** — pure libs only: `attendance.ts` (aggregation + % + resolution counts), `recurrence.ts` (expansion + edit-one-vs-future boundaries), `venue-conflict.ts` (overlap predicate), `date-time.ts` (time parsing/format), i18n parity.
2. **Typecheck** — `npm run typecheck` (new tables/pages/actions in the type graph).
3. **Lint** — `npm run lint` (0 errors).
4. **RLS / tenant isolation** — every new table `ENABLE` + `FORCE ROW LEVEL SECURITY`, org claim scoping, `public.authorize(...)`, coach `has_team_scope`. Reviewed in the migration SQL.
5. **[BLOCKING] Supabase migration push** — `supabase db push` (or `npx supabase migration` path) + regenerate `src/types/database.ts`, so types come from the live DB, not hand-written config. This is a mandatory task before the final phase gate (mirrors Phase 2 plan 02-08).

---

## Concrete schema outline (for gsd-planner)

- `venues(id, organization_id, name, venue_type, address, note, is_active, created_at, updated_at)`
- `trainings(id, organization_id, team_id, venue_id nullable, starts_at, ends_at, duration_minutes, coach(s) via training_coaches, note, status scheduled|cancelled|completed, series_id nullable, recurrence_rule text nullable, created_at, updated_at)`
- `training_coaches(id, organization_id, training_id, staff_id)` (D-10: primary + assistant/GK/fitness)
- `attendance(id, organization_id, training_id, athlete_id, status, absence_resolution, reason_preset, reason_note, recorded_at, updated_at)`
- `matches(id, organization_id, team_id, opponent, competition nullable, round nullable, starts_at, venue_id nullable (home), away_location text nullable (away, D-31), home_away home|away, status scheduled|played|postponed|cancelled, home_score int nullable, away_score int nullable, note, created_at, updated_at)`
- `match_lineups(id, organization_id, match_id, athlete_id, ...)` (D-29: selected roster, no per-player stats)
- `calendar_events(id, organization_id, event_type meeting|event, title, starts_at, ends_at, venue_id nullable, note, created_at, updated_at)`
- `calendar_event_participants(id, organization_id, calendar_event_id, staff_id)` (D-05)

Membership period (D-49 — added to the existing `seasonal_memberships`): `joined_on DATE NOT NULL` (membership start) and `left_on DATE NULL` (membership end).

Migration sequence (append-only, two-step enum pattern):

- `00046` — `app_permission` enum ADD VALUE (6 values; no consumers in this file).
- `00047` — `role_permissions` seed for the 6 values.
- `00048` — scheduling core schema (venues, trainings, training_coaches, attendance).
- `00049` — scheduling events schema (matches, match_lineups, calendar_events, calendar_event_participants).
- `00050` — `seasonal_memberships.joined_on` + `.left_on` + backfill (non-destructive).
