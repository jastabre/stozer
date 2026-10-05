# Phase 3: Scheduling & Attendance — Discussion Log

**Date:** 2026-10-05

## How decisions were captured

The user supplied all Phase 3 product decisions upfront as a single locked batch (15 sections of locked product decisions). No interactive Q&A loop was required — the discuss step was a synthesis of those locked decisions against the real codebase, Supabase migrations, existing `.planning` files, `STOZER-BRIEF.md`, and the current GSD state.

Newer decisions from the prompt override older research ideas where they conflict (recorded as D-47 and D-48).

## Areas & captured decisions

- Unified Calendar — D-01..D-06
- Trainings — D-07..D-13
- Training Attendance — D-14..D-20
- Player Attendance Statistics — D-21..D-22
- Team Attendance Statistics — D-23..D-24
- PDF / Print Reports — D-25..D-28
- Matches — D-29..D-32
- Future Analytics (architectural only) — D-33
- Venues & Locations — D-34..D-36
- Venue Conflict Detection — D-37..D-39
- All-Venues Schedule View — D-40..D-41
- Printable Venue Schedule — D-42..D-43
- General UX — D-44..D-46
- Supersedes prior research — D-47

## Open questions

None — OQ-01 was resolved as D-48 (2026-10-05): attendance % = (present + late) ÷ held trainings for which the player was an active member.

## Deferred ideas

See `03-CONTEXT.md` → "Deferred Ideas".

## Notes

- No scheduling/calendar/attendance/venue/match/event tables exist in the schema; next migration number is `00046`.
- Only `attendance.manage` exists today among scheduling-related permissions.
- No PDF library is installed (only `exceljs`); PDF/print is net-new for Phase 3.
