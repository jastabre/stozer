# Phase 3: Scheduling & Attendance - Context

**Gathered:** 2026-10-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers the club's daily operational core: a unified club calendar (trainings, matches, meetings, events), structured trainings with simple recurring scheduling, fast mobile-first training attendance, per-player and per-team attendance statistics, a club venue/location registry with venue-conflict detection and an all-venues schedule view (including a printable schedule), and basic sport-aware match records. This is the retention-driving phase: a coach can schedule a training and mark attendance for a whole team on a phone in under a minute, and the club sees one calendar as the single source of truth.

Explicitly out of scope (deferred, not Phase 3): task management, Google/Apple calendar sync, shareable calendar links, drill/training-plan libraries, and deep match analytics. The match model must, however, be architected so deep analytics can be added later without migration churn.

</domain>

<decisions>
## Implementation Decisions

### Unified Calendar
- **D-01:** One unified club calendar. Trainings, matches, meetings and events all appear in it automatically. A structured training/match is NOT re-created manually in the calendar — its structured record IS its calendar representation (single source of truth; editing/rescheduling never drifts). Meetings and events are manual calendar entries. — **Reversibility:** costly — [every scheduling query and calendar view depends on the one-record-per-activity invariant]
- **D-02:** Calendar filters: team, event type, venue/location.
- **D-03:** Calendar views: Month, Week, Day/"Danas" (Today). The mobile-first "Danas" view is a priority for coaches.
- **D-04:** Tapping a calendar item opens a simple detail/drawer — no administrative-heavy UX.
- **D-05:** Meeting/Event fields: name, date/time, optional location, note, and participants. Participants must allow selecting coaches and other relevant staff invited.
- **D-06:** Phase 3 calendar event types = training / match / meeting / event ONLY. Tournament, deadline and task types are out of scope (supersedes the OPER-01 list in REQUIREMENTS.md).

### Trainings
- **D-07:** Training is a structured event linked to the calendar. Create fields: team, date, start time, duration, venue/location, coach(es), short optional note.
- **D-08:** The active season is used automatically — no season dropdowns.
- **D-09:** Players are NOT selected per training. The roster derives from the team's active-season membership (`seasonal_memberships.status = 'active'` + active season).
- **D-10:** Coaches: the team's primary coach can be auto-added; assistant, goalkeeper, fitness coach and other relevant staff can be added.
- **D-11:** Recurring trainings: a simple repeat option (e.g. Mon/Wed/Fri until a date). Editing a recurring training offers "Samo ovaj trening" / "Ovaj i svi budući". — **Reversibility:** costly — [recurrence representation affects how attendance and statistics attach to each occurrence]
- **D-12:** Training status: Zakazano / Otkazano / Održano (completed, derived by appropriate logic). Cancelled trainings are NOT deleted — history is preserved.
- **D-13:** Today's training card shows immediately: team, time, venue, player count, whether attendance is recorded, and a large clear "Evidentiraj prisustvo" action.

### Training Attendance
- **D-14:** On-training statuses are exactly three: **Prisutan / Odsutan / Kasnio**. No "Nedostupan"/"Unavailable" status. — **Reversibility:** one-way — [the status set drives every attendance stat and history; changing it later requires a data migration plus stats re-derivation]
- **D-15:** Fastest workflow: "Označi sve kao prisutne" (mark all present), then the coach changes only exceptions. Target: whole-team attendance in 15–30s normally, always under 60s.
- **D-16:** The reason for absence is NOT required at training time. An absence first stays "Odsutan / nerazjašnjeno" (unresolved).
- **D-17:** Later the coach resolves an absence as **Opravdano / Neopravdano**, optionally adding a reason/note.
- **D-18:** Optional quick reason presets: Bolest, Povreda, Škola, Porodične obaveze, Drugo. The reason is never mandatory; the coach is never forced through a complex form.
- **D-19:** Resolution UX: show "N odsustava čekaju razjašnjenje" → tap opens only the list of those players → per player Opravdano/Neopravdano + optional reason. No complex edit pages.
- **D-20:** "Kasnio" (late) is recorded and enters statistics.

### Player Attendance Statistics
- **D-21:** The player profile shows explicitly and clearly: total trainings, attended, missed, excused, unexcused, unresolved, late, and attendance %. Not reduced to just a percentage — the club must explicitly know how many trainings the player had and how many they missed.
- **D-22:** A per-date/per-training history with status and optional note/reason must exist.
- **D-48:** Attendance % = (Prisutan + Kasnio) ÷ (held trainings in the selected period for which the player was an active member of that team) × 100. Rules: Prisutan and Kasnio both count as attendance (Kasnio is shown as a separate count); Opravdano, Neopravdano and Nerazjašnjeno absences do NOT count as attendance. "Held" = training status 'Održano' (completed) — cancelled and not-yet-held trainings never enter the denominator. A training enters a player's denominator only if it occurred within the player's membership period for that team (joined_on ≤ date AND (left_on IS NULL OR date < left_on), per D-49). Period = this month / last 30 days / active season / custom range. — **Reversibility:** costly — [the percentage feeds every attendance report; changing the formula later invalidates previously shown % figures unless recomputed]
- **D-49:** Membership period: `seasonal_memberships` gains `joined_on DATE NOT NULL` (membership start — first date as a member, INCLUSIVE) and `left_on DATE NULL` (membership end — first date the player is NO LONGER a member, EXCLUSIVE; null = still a member). A player is an active member of a team during the half-open interval [joined_on, left_on): joined_on INCLUSIVE, left_on EXCLUSIVE. `created_at` is audit metadata and is NEVER the business source for membership dates. Non-destructive backfill: `joined_on = seasons.starts_on`, `left_on = NULL`. When a player leaves/moves teams, the executor sets `left_on` (and keeps the row), so historical statistics remain accurate. — **Reversibility:** costly — [the membership period underlies attendance % and roster eligibility]

### Team Attendance Statistics
- **D-23:** Team view lists all players with the same aggregate data.
- **D-24:** Period filter (minimum): this month, last 30 days, active season, custom range. Compact enough for 20–30+ players.

### PDF / Print Reports
- **D-25:** For attendance, a well-formatted PDF/Print report is preferred over Excel. XLSX is used only where a real downstream data-processing need exists; where a quality PDF/Print exists, XLSX is not required.
- **D-26:** Player PDF/Print: club crest + name, player name, team, period/season, total trainings, attended, missed, excused, unexcused, unresolved, late, %, and optional detailed history.
- **D-27:** Team PDF/Print: a clean table of all players with the same statistics, ready for staff/board/parent meetings.
- **D-28:** Design toward a reusable report/print system that other modules can later reuse, but do NOT build a large generic report builder now.

### Matches
- **D-29:** Match is a central structured entity and appears in the calendar automatically. Phase 3 operational fields: team, opponent, competition, round (if meaningful), date, time, home/away, venue/location, status, result, note, and players/lineup linked to the match.
- **D-30:** Match statuses (minimum): Zakazana / Odigrana / Odložena / Otkazana.
- **D-31:** Home match: venue selected from the club registry. Away match: an external location can be used WITHOUT adding it permanently to the club registry.
- **D-32:** Sport-aware shared match model. One sport per organization (football or basketball only). Teams inherit the org sport. Do NOT create separate `football_matches`/`basketball_matches` models. — **Reversibility:** costly — [parallel per-sport match models would force a redesign of calendar, schedule and future analytics]

### Future Analytics (architectural obligation — NOT Phase 3 scope)
- **D-33:** Model the match as a stable central entity with a persistent ID so future deep analytics (lineups, minutes, goals, assists, individual/team stats, pass %, duels, shots, possession, video, event/tagging, charts) can attach without migration churn — for the first team and all youth categories. Do NOT implement that analytics now and do NOT add half-finished stat models. — **Reversibility:** one-way — [the match primary key becomes the anchor every future stats table FKs to; changing it later means migrating the whole analytics surface]

### Venues & Locations
- **D-34:** Venue registry lives under **Klub → "Tereni i lokacije"** (not hidden in technical Settings).
- **D-35:** Venue fields (minimum): name, type (field / hall / balloon / other, or a sport-aware equivalent), address, short note/description, active/inactive.
- **D-36:** A venue is defined once and reused across trainings, matches, calendar, conflict detection and the schedule view. No enterprise venue-management features.

### Venue Conflict Detection
- **D-37:** When scheduling a training or home match on a club venue, the system checks whether the venue is already occupied in that period. A conflict shows an immediate clear warning plus what already occupies the slot — never a silent conflict.
- **D-38:** Prefer a WARNING (not a hard block) unless research/planning finds a clear reason otherwise.
- **D-39:** Conflict detection is venue/location-only. Do NOT extend automatically to coach conflicts.

### All-Venues Schedule View
- **D-40:** Klub → Tereni i lokacije → Raspored. Minimum: Day and Week views; filter by team; filter by venue/location.
- **D-41:** The view clearly shows venue, time, team, and activity type (training/match/event), so board/coaches immediately see what is occupied, what is free, and where conflicts are.

### Printable Venue Schedule
- **D-42:** The club can print a weekly/daily all-venues schedule and post it physically (club rooms, locker room, pitch, office). PDF/Print must be a real operational club schedule (A4/A3, very readable), not an app screenshot.
- **D-43:** Print content: club crest, club name, date/week, clearly separated venues, times, team, training/match/event — with no application UI chrome.

### General UX
- **D-44:** Everything simple, fast, clear, mobile-responsive, understandable to a non-technical coach. Avoid many dropdowns, huge forms, unnecessary "Apply" actions, enterprise scheduling complexity, raw enum values in the UI, and deep navigation.
- **D-45:** Every mutation has real pending feedback (disabled + spinner + pending text, no double submit).
- **D-46:** Serbian Latin default; English switch remains supported; no missing-i18n-key errors.

### Supersedes prior research
- **D-47:** These decisions supersede any older research/planning ideas that conflict. Specifically: attendance on the training is 3 statuses (not 5), with Opravdano/Neopravdano as post-hoc resolution; there is no "unavailable" status; the absence reason is optional; one sport per org (football/basketball only); conflict detection focuses on venue; no task-management; no Google/Apple calendar sync or shareable links in Phase 3; no drill/training-plan system; no match-analytics implementation in Phase 3 (only architectural readiness). The "Phase 3 Product Context" in PROJECT.md and the OPER-01/OPER-06 text in REQUIREMENTS.md are superseded where they differ.

### Open questions
None — the attendance percentage formula was locked as D-48 (2026-10-05).

### the agent's Discretion
- Exact table/column names and schema (venues, activities/trainings/matches, attendance, recurrence); next migration number is **00046**.
- Exact venue "type" taxonomy (sport-aware values).
- New permission names following the existing `<module>.<action>` convention (e.g. `attendance.view`, `calendar.view`, `venue.*`, `match.*`, `training.*`) — `attendance.manage` already exists.
- PDF/print implementation (print stylesheet/`window.print` vs. a server-side PDF library — none exists yet; only `exceljs` is installed).
- Recurrence storage model (recurrence rule vs. expanded rows).
- Match result representation (sport-agnostic home/away integer score).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product & Requirements
- `STOZER-BRIEF.md` — Product source of truth. §3 (product philosophy: never ask for data the system already knows), §12 (sport abstraction), §15 (roles/permissions incl. `manage_attendance`), §19 (coach nav: Danas / Tim / Kalendar; Tim → Treninzi / Utakmice / Prisustvo), §20 (dashboard "Danas" + venue conflicts), §21 (team card: next training, next match, attendance %), §30 (training fields), §31 (attendance — NOTE: status set superseded by D-14), §32 (matches), §33 (calendar + filters), §34 (venues + conflict), §55 (Quick Add: Training/Match), §56 (venue-conflict notification), §59 (database domains: venues/events/trainings/attendance/games/game_rosters), §63 (UI), §64 (mobile coach workflow < 1 min), §66 (empty states), §69 (out of V1).
- `.planning/REQUIREMENTS.md` — v1 requirements. Phase 3 maps to OPER-01..OPER-08. NOTE: OPER-01 (event types) and OPER-06 (attendance status set) are superseded where they differ from D-01..D-47.
- `.planning/ROADMAP.md` — Phase 3 goal + success criteria (attendance < 60s, unified calendar, venue-conflict alert, attendance % per team/player, basic matches).
- `.planning/PROJECT.md` — Project context, constraints, key decisions. The "Phase 3 Product Context" (2026-09-30) is partially superseded by this document.

### Prior Phase Context (locked decisions that still apply)
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-01..D-13: app shell, i18n (sr-Latn default + en), entitlements, RBAC/nav, empty states.
- `.planning/phases/02-club-people/02-CONTEXT.md` — D-01..D-42: seasons/teams/athletes/memberships, staff + staff functions, roles/permissions, team scope. Key for roster derivation and coach team-scoping.

### Engineering Rules
- `AGENTS.md` — Standing rules: TypeScript strict, RLS (ENABLE + FORCE) on every table, `organization_id` scoping, append-only migrations, i18n sr-Latn primary, never rely on UI hiding for security.

### Schema & Code Integration Points
- `supabase/migrations/00001_foundation.sql` — `app_role`/`app_permission` enums, `roles`, `role_permissions`, `authorize()`, RLS pattern.
- `supabase/migrations/00003_club_core.sql` — `seasons`, `teams`, `athletes`, `seasonal_memberships`, `inherit_team_sport` trigger, active-season partial unique index.
- `supabase/migrations/00035_team_scope_and_permission_separation_rls.sql` — `is_team_scoped`/`has_team_scope`/`has_athlete_scope` (coach team-scoping that attendance RLS must respect).
- `src/lib/organization.ts` — `requireOrganization` / `hasPermission` / `requirePermission`.
- `src/lib/club-data.ts` — `getActiveSeason()` and roster queries (active membership).
- `src/lib/roles.ts` — `TEAM_SCOPED_ROLES`, `isTeamScopedRole`.
- `src/lib/staff-functions.ts` — staff function presets (coach, assistant_coach, goalkeeper_coach, fitness_coach, …).
- `src/lib/rbac.ts` — `navConfigs` / `getNavConfig` (add Calendar + "Tereni i lokacije").
- `src/lib/club-nav.ts` — `buildClubTabs` (add "Tereni i lokacije" under Klub).
- `src/lib/role-capabilities.ts` — `AVAILABLE_AREAS` (must add `attendance` to make the module visible in role UI).
- `src/lib/date-format.ts` — DD.MM.GGGG ↔ ISO (date-only; no time-of-day helper exists yet).
- `src/components/ui/MutationForm.tsx`, `src/components/FormSubmitButton.tsx`, `src/components/ConfirmDeleteButton.tsx`, `src/components/ui/useMutationFeedback.ts` — pending-feedback mutation primitives.
- `src/lib/equipment-export.ts` + `src/app/[locale]/(dashboard)/equipment/export/route.ts` — existing XLSX export pattern (PDF/print is net-new; no PDF library installed).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getActiveSeason()` + roster queries in `src/lib/club-data.ts` — the Phase 3 roster source for trainings/attendance (active season + `seasonal_memberships.status='active'`).
- `hasPermission`/`requirePermission`/`requireOrganization` in `src/lib/organization.ts` — gate every Phase 3 page/action.
- `MutationForm`, `FormSubmitButton`, `ConfirmDeleteButton`, `useMutationFeedback` — the pending-feedback mutation pattern D-45 requires (already implemented app-wide).
- `buildClubTabs` in `src/lib/club-nav.ts` + `ProfileTabs`/`SectionTabs` — add "Tereni i lokacije" (and its "Raspored") as Klub sub-tabs.
- `navConfigs`/`getNavConfig` in `src/lib/rbac.ts` + `NavItem`/`BottomNav` `iconMap` — add "Kalendar" to coach/president/youth-director nav.
- `src/lib/date-format.ts` (DD.MM.GGGG ↔ ISO) + `date-fns` — calendar/date math; a time-of-day helper is still needed.
- `src/lib/staff-functions.ts` — `coach`, `assistant_coach`, `goalkeeper_coach`, `fitness_coach` presets for training coach selection.

### Established Patterns
- Server Components by default; Server Actions (`actions.ts`, `"use server"`) for mutations; `revalidatePath` after writes.
- Zod + react-hook-form; Zod as single source of truth.
- RLS on every table with `ENABLE` + `FORCE`, `organization_id` scoping, `public.authorize('<module>.<action>')`, and coach team-scope via `public.has_team_scope()` / `has_athlete_scope()`.
- Permission model: `<module>.<action>` enum values + `role_permissions` seed; two-file forward-only migration split (enum-only + seed) as in 00033/00034 and 00044/00045.
- i18n keys in `messages/{sr,en}.json`; `useTranslations()`/`getTranslations()`. No `MISSING_MESSAGE` fallback convention — every key must exist in both files.
- Route `loading.tsx` mirrors each screen with `Skeleton` to prevent layout jump.

### Integration Points
- New tables (venues, activities/trainings/matches, attendance, match lineup) all get `organization_id` + RLS (ENABLE/FORCE) + org-claim + `authorize()` + coach team-scope.
- Next migration number: `00046` (continue `000NN_*.sql` convention).
- Nav: `rbac.ts` (top-level "Kalendar") and `club-nav.ts` (Klub sub-tab "Tereni i lokacije").
- `AVAILABLE_AREAS` in `role-capabilities.ts` must gain `attendance` so the role UI exposes it.
- PDF/print is greenfield — no PDF library installed (only `exceljs`); reuse the `equipment/export/route.ts` handler + `ExportButton` pattern for any server-generated file.

</code_context>

<specifics>
## Specific Ideas

- Mobile "Danas" (Today) is especially important to coaches — the day view drives the attendance workflow.
- Fastest attendance path: "Označi sve kao prisutne", then edit only the exceptions.
- Absence resolution flow: a count like "3 odsustva čekaju razjašnjenje" → tap → only those players → Opravdano/Neopravdano + optional reason.
- Reason presets: Bolest, Povreda, Škola, Porodične obaveze, Drugo (all optional).
- Venue schedule print is meant to be physically posted in the club — locker room, pitch, office — so it must be a clean operational document, not a screenshot.
- Attendance stats must explicitly show how many trainings were done and missed, not just a percentage.
- Match "igrači/sastav" = the selected roster for that match, with NO per-player statistics in Phase 3.

</specifics>

<deferred>
## Deferred Ideas

- **Task management / "Obaveze" / deadlines** (brief §52) — explicitly out of Phase 3; own phase if ever.
- **Google/Apple calendar sync** and **shareable calendar links** — out of Phase 3.
- **Drill library / exercise plans / training tactics / warmups / GPS-perf metrics / coaching curriculum** — out of Phase 3.
- **Deep match analytics** (lineups, minutes, goals, assists, pass %, duels, shots, possession, video, event/tagging, charts) — future phase; only architectural readiness is required now (D-33).
- **Match scorers / advanced per-player stats** — deferred (brief §32 "later").
- **Venue enterprise management** (multi-site, booking rules, approval workflows) — deferred.
- **Automatic coach-conflict detection** — deferred (D-39; venue-only for now).
- **Notification center / venue-conflict notifications** (brief §56) — Phase 6 (NOTF-*), not Phase 3; Phase 3 shows in-context warnings only.
- **Parent portal** — already out of V1 (Phase 2 D-20), unchanged.

</deferred>

---

*Phase: 3-Scheduling & Attendance*
*Context gathered: 2026-10-05*
