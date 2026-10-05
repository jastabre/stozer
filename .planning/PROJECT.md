# STOŽER

## What This Is

STOŽER is a multi-tenant SaaS operating system for sports clubs. It replaces scattered Excel sheets, WhatsApp messages, paper notes, and bank statement reconciliation with a single reliable source of truth. Starting with football and basketball in Serbia, designed from day one for global expansion across sports, countries, and languages.

Built for club presidents, youth directors, coaches, and administrators who currently manage teams with fragmented tools and unreliable data.

## Core Value

A club president or youth director opens Stožer and instantly knows: who paid, who owes, who's registered, who's training today, what needs attention — without calling three people or searching through files.

## Business Context

- **Customer**: Sports club administrators, presidents, youth directors, coaches
- **Revenue model**: Freemium SaaS — FREE tier for evaluation, CLUB and PRO tiers for serious clubs
- **Success metric**: A real club replaces their main Excel sheets and paper notes with Stožer
- **Strategy notes**: STOZER-BRIEF.md is the product source of truth

## Requirements

### Validated

- ✓ Player profiles with permanent identity across seasons — Phase 2
- ✓ Staff/coach profiles with licenses and documents — Phase 2
- ✓ Guardian contacts for minor players — Phase 2
- ✓ Club athlete ID system for payment references — Phase 2
- ✓ Team/selection management (Senior, U19, U17, U15, etc.) — Phase 2
- ✓ Sport abstraction — football and basketball from day one — Phase 2
- ✓ Season management with rollover — Phase 2
- ✓ Player registration tracking with expiration alerts — Phase 2
- ✓ Player contract management with expiration alerts — Phase 2
- ✓ Generic athlete identifier system (federation IDs) — Phase 2
- ✓ Player documents (registration, contract, medical, insurance) — Phase 2
- ✓ Player equipment sizes, issue tracking and per-team XLSX export — Phase 2
- ✓ Club identity: name, crest (Grb kluba), currency — Phase 2
- ✓ Users & Access — predefined role registry under Klub → Korisnici i pristup — Phase 2
- ✓ Club Documents (reusable club files/templates) under Klub → Dokumenti kluba — Phase 2
- ✓ First-team contracts & payments recording — Phase 2 (beyond the original Phase 2 roadmap)

### Active

**Core Platform:**
- [ ] Multi-tenant organization system with RLS isolation
- [ ] Authentication and role-based access control
- [ ] Organization onboarding flow (create club, set identity)
- [ ] Organization switching for multi-club users

**Activity:**
- [ ] Training scheduling (date, time, duration, venue, team, coach)
- [ ] Training attendance tracking (present, absent, excused, late, unavailable)
- [ ] Match scheduling (team, opponent, home/away, date, venue, result)
- [ ] Unified club calendar with filters (team, venue, coach, event type)
- [ ] Venue/court/field management with conflict detection

**Youth Finance:**
- [ ] Membership fee configuration per team/selection
- [ ] Monthly charge generation
- [ ] Payment status tracking (paid, partial, unpaid, waived)
- [ ] Club athlete ID as payment reference
- [ ] Bank statement import (CSV, XLSX) with payment reconciliation
- [ ] FIFO payment allocation algorithm with audit trail
- [ ] Cash payment recording by coaches
- [ ] Payer mapping for recurring payments

**Dashboard:**
- [ ] Today's schedule (trainings, matches, events)
- [ ] Requires attention items (expiring registrations, unpaid fees, conflicts)
- [ ] KPI overview (active players, attendance %, collections, debts)
- [ ] Useful charts where they help (attendance trend, membership collections)

**Documents:**
- [ ] Club documents with folder structure
- [ ] Document expiration alerts

**Subscriptions:**
- [ ] FREE plan (1 club, 1 sport, 1 selection, 20 players, 2 staff)
- [ ] CLUB plan with trial support
- [ ] PRO plan
- [ ] Configurable entitlements and limits via Super Admin
- [ ] Subscription locking with premium feature preview

**Notifications:**
- [ ] Notification center for expiring items, unpaid fees, overdue tasks
- [ ] Provider-independent notification architecture

**Search & Quick Actions:**
- [ ] Global search (athletes, staff, teams, sponsors, documents)
- [ ] Quick Add menu with contextual actions

**Super Admin:**
- [ ] Platform dashboard (organizations, subscriptions, metrics)
- [ ] Organization management (plan changes, trial control)
- [ ] Plan configuration (limits, entitlements, pricing)

### Out of Scope

- COMET integration — Stožer works independently from federation systems
- First-team finances (salaries, bonuses, operational expenses) — deferred to after V1 core
- Sponsors module — deferred to after V1 core
- Advanced reports — deferred to after V1 core
- Parent portal — no parent accounts in V1
- Online payments — no payment provider integration in V1
- Advanced player development scoring
- Detailed match statistics (minutes played, assists, shots)
- Complex training planning (drills, warmups, tactics)
- Drill library
- Scouting system
- AI chatbot or AI features
- Native Android/iOS apps — web-first PWA
- WhatsApp/SMS integration
- QR payments
- Full accounting or payroll/tax calculations
- White-label custom domains
- Microservices architecture

## Phase 3 Product Context (captured 2026-09-30 — pre-planning, NOT researched or planned)

Accepted product direction for Phase 3 (Scheduling & Attendance), captured so the future
discussion/research/planning does not lose it. This is context only — it deliberately
contains NO implementation plan and does NOT choose the data model.

### Sport support
- Initial supported sports: **Football and Basketball only**.
- **One sport is configured per organization (club)** — already implemented: `organizations.sport`
  (TEXT, CHECK in `football`/`basketball`), chosen at onboarding via `create_organization_onboarding`.
- Teams inherit the org sport automatically (trigger `inherit_team_sport`); player position presets
  already derive from it (`src/lib/positions.ts` → `positionsForSport`).
- Users must **NOT** re-select the sport when creating teams, trainings, matches or players —
  sport-specific behavior derives from the organization's configured sport (e.g. position presets,
  match behavior, sport-specific labels/rules).
- UI labels: Football → "Fudbal", Basketball → "Košarka". Never expose raw enum values.
- Architecture stays extensible to additional sports later, but do **NOT** implement volleyball,
  handball, tennis, etc. now.
- Known gap (out of scope for this capture): the org sport is not editable after onboarding, and the
  `teams.sports.*` i18n labels exist but are unused.

### Unified activity model
- The club has **ONE unified operational calendar**.
- Structured activity types at minimum: **Trening** (training), **Utakmica** (match), **Događaj** (event).
- Training and Match must **NOT** require duplicate manual calendar entries — creating a structured
  activity IS its calendar representation; editing/rescheduling keeps a single source of truth.
- Phase 3 research decides the cleanest data model. Do not choose it now.

### Matches
- Must **not** be football-only; initial sports are Football and Basketball.
- Common concepts: team, opponent, competition, home/away, date, time, venue/location, result, note.
- Prefer a **shared sport-aware model**. Do not create parallel `football_matches` / `basketball_matches`
  unless future research finds an exceptional reason.
- Out of scope: match statistics, lineups, goals, assists, detailed basketball box scores.

### Training attendance
- Top Phase 3 priority: a coach opens a training on mobile and marks attendance for the normal team
  extremely quickly.
- Success target: complete normal-team attendance in **under ~60 seconds**.
- Roster derives from the appropriate team / active-season membership — the coach does not manually
  build a roster per training.
- **Explicit Phase 3 decision:** the attendance status set. Existing planning lists present, absent,
  excused, late, **unavailable** — do NOT silently remove "unavailable" before deciding.
- **Explicit Phase 3 decision:** the attendance percentage formula — treatment of excused and late,
  the period/season denominator, and players joining/leaving mid-season.

### Venues / conflicts
- Venue management and conflict detection are already in Phase 3 scope.
- Expected UX: same venue + overlapping time → a clear **warning**. Do not assume this must hard-block
  saving; the exact behavior is a Phase 3 decision.

### Calendar tasks / deadlines
- OPER-01 mentions deadline and task event types. Do **NOT** turn Phase 3 into a task-management system.
- Phase 3 planning decides whether these remain simple calendar event types. Avoid enterprise
  project-management functionality.

The Phase 3 roadmap entry, its requirements (OPER-01..OPER-08) and its plan placeholders are unchanged
by this capture. Phase 3 is **defined but not researched, planned or implemented**.

## Context

- Solo founder building a comprehensive SaaS product for sports clubs
- Target market: Serbia initially, global from day one via multi-language/currency architecture
- Primary language: Serbian Latin, English fully supported via i18n
- Users currently manage clubs with Excel, WhatsApp, paper, and bank statements
- The product must be simple enough for non-technical club administrators
- Supabase project provisioned and linked; migrations applied (00001–00043 present locally)
- Never rely on UI hiding for security — server-side + database checks

## Constraints

- **Tech stack**: Next.js, TypeScript, React, Tailwind CSS, shadcn/ui, PostgreSQL, Supabase, Vercel
- **Architecture**: Modular monolith for V1 — no microservices
- **Multi-tenancy**: Every data row must have organization_id, enforced via RLS
- **Security**: Server-side + database-side authorization, never just UI hiding
- **Financial correctness**: Transactions, audit trail, FIFO payment allocation, no destructive deletes
- **Mobile**: Coach workflows must be excellent on phone (attendance < 1 minute)
- **Simplicity**: Never ask for data the system already knows
- **Role visibility**: Permission-restricted features hidden completely, not shown as locked
- **No deadline**: Quality over speed — ship when it's right

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase + PostgreSQL | Brief specifies, RLS for multi-tenancy, auth built-in | — Pending |
| Modular monolith | Brief requires, avoid overengineering for V1 | — Pending |
| Serbian Latin primary | Target market Serbia, English via i18n for global | — Pending |
| Free + paid from day one | Brief requires freemium model, trial support | — Pending |
| No COMET in V1 | Stožer must work independently from federations | — Pending |
| First-team finance deferred | After V1 core operational system is stable | — Pending |
| PWA over native | Brief requires responsive web, no native Android in V1 | — Pending |
| shadcn/ui component system | Brief specifies, high quality, customizable | — Pending |
| Sport is organization-level, one sport per club | Avoid re-selecting sport per team/training/match; presets derive from the org | Implemented — Phase 2 |
| One unified club calendar; structured activities are their own calendar representation | Avoid duplicate manual entries and calendar drift | Captured for Phase 3 — not yet designed |
| Matches use a shared sport-aware model | Avoid parallel football/basketball match systems | Captured for Phase 3 — not yet designed |
| Attendance status set and percentage formula are explicit Phase 3 decisions | Avoid silently dropping "unavailable" or inventing a formula | Captured for Phase 3 — open |

## Phase 3 Next Step

Begin with `/gsd-discuss-phase 3` (produces `03-CONTEXT.md`), then `/gsd-plan-phase 3`.
Phase 3 is **not** researched, planned or implemented as of 2026-09-30.

---

*Last updated: 2026-09-30 after Phase 2 completion (Phase 3 product context captured, pre-planning)*
