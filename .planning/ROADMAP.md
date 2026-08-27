# Roadmap: STOŽER

## Overview

STOŽER development proceeds in 7 phases: a thin Foundation phase establishing multi-tenant infrastructure, followed by 6 vertical MVP slices that each deliver an end-to-end user capability. Every phase includes database, permissions, UI, mobile behavior, and tests — not separate layers. Player import, basic contracts, and staff license tracking are part of the Club & People phase. The final phase includes production readiness verification (RLS, permissions, mobile UX, PWA, security audit). The journey goes from "club exists in the system" to "club can replace Excel, paper, and WhatsApp with Stožer."

## Phases

- [x] **Phase 1: Foundation** - Multi-tenant infrastructure, auth, RBAC, RLS, i18n, app shell, subscription entitlements
- [ ] **Phase 2: Club & People** - Seasons, teams, players, staff, guardians, club identity, player administration, registration tracking
- [ ] **Phase 3: Scheduling & Attendance** - Calendar, venues, training scheduling, attendance, matches, venue conflict detection
- [ ] **Phase 4: Youth Finance** - Membership fee schemes, automatic charges, payment tracking, cash payments, role-based finance views
- [ ] **Phase 5: Bank Reconciliation** - Bank statement import, payment matching, FIFO allocation, partial/overpayment, audit trail, reversals
- [ ] **Phase 6: Dashboard & Documents** - Today view, requires attention, payment overview, charts, club documents, templates, brand assets
- [ ] **Phase 7: Reporting & Polish** - Basic operational reports, export, subscription locking, final polish

## Phase Details

### Phase 1: Foundation

**Goal:** A running Next.js app with Supabase where users can sign up, create an organization, and see a basic app shell — the infrastructure every later feature depends on.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06, CORE-07, CORE-08, CORE-09
**Success Criteria** (what must be TRUE):

  1. User can sign up with email/password and verify their email
  2. First user of a new club becomes Organization Owner with full access
  3. Two different organizations see completely isolated data (RLS enforced)
  4. User can switch between organizations they belong to
  5. App shell loads with navigation, Serbian Latin text, and neutral design system

**Plans**: 01-PLAN (12 tasks)

Plans:

- [x] 01-01: Foundation (auth, database, i18n, app shell, RBAC, subscriptions, PWA)
- [ ] 01-02: (reserved)
- [ ] 01-03: (reserved)

### Phase 2: Club & People

**Goal:** A club owner can set up their club structure — seasons, teams, players, staff — and see registration status with expiry alerts. Players can be imported in bulk. This is the core domain model that everything else builds on.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: STRC-01, STRC-02, STRC-03, STRC-04, STRC-05, STRC-06, STRC-07, STRC-08, STRC-09, REG-01, REG-02, REG-03, REG-04, REG-05, REG-06, REG-07, REG-08, REG-09
**Success Criteria** (what must be TRUE):

  1. Club owner can create seasons, teams, and add players with all profile fields
  2. Players can be imported in bulk via CSV/XLSX with column mapping and validation preview
  3. Players have a permanent identity that persists across seasons
  4. Each player has a unique club athlete ID usable as payment reference
  5. Staff profiles show assigned teams and license expiry status with alerts
  6. Registration status shows green/yellow/red indicators with expiry warnings
  7. Basic player contracts are tracked (type, status, dates, document, expiry warning)
  8. Player documents (medical, insurance) are stored with expiry tracking

**Plans**: 5/8 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Test infrastructure (vitest) + all Phase 2 dependencies with legitimacy gate

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — TRACER: seasons/teams/players core schema, club athlete ID, roster, rollover

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — Registrations + shared status helper + medical examinations (D-33..D-42)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-04-PLAN.md — Staff profiles with licenses + guardian contacts (one primary)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 02-05-PLAN.md — Typed documents + private storage + basic player contracts

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 02-06-PLAN.md — CSV/XLSX import wizard (mapping, validation, dedupe, progress)

**Wave 7** *(blocked on Wave 6 completion)*

- [ ] 02-07-PLAN.md — Equipment (sizes, issue states, team tracking, requests, export)

**Wave 8** *(blocked on Wave 7 completion)*

- [ ] 02-08-PLAN.md — [BLOCKING] schema push to Supabase + type regen + full phase gates

### Phase 3: Scheduling & Attendance

**Goal:** A coach can schedule trainings, mark attendance on their phone in under a minute, and the club has a unified calendar showing all activities. This is the daily-use phase that drives retention.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: OPER-01, OPER-02, OPER-03, OPER-04, OPER-05, OPER-06, OPER-07, OPER-08
**Success Criteria** (what must be TRUE):

  1. Coach can open today's training on their phone and mark attendance for the whole team in under 60 seconds
  2. Club president sees a unified calendar with all trainings, matches, and events
  3. System alerts when two teams are booked at the same venue at the same time
  4. Attendance percentage is visible per team and per player
  5. Basic matches can be recorded with opponent, date, venue, and result

**Plans**: TBD

Plans:

- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Youth Finance

**Goal:** Youth director can configure membership fees, the system generates monthly charges, coaches can record cash payments, and everyone sees who paid and who owes — the single-source-of-truth for youth club money.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: FINC-01, FINC-02, FINC-03, FINC-04, FINC-05, FINC-06, FINC-07, FINC-08
**Success Criteria** (what must be TRUE):

  1. Youth Director configures membership fee per team and system auto-generates monthly charges
  2. Coach sees payment status for their team only — who paid, who owes, how much
  3. Youth Director sees all youth team payment status in one view
  4. Club President sees youth-school finance overview (expected vs collected, outstanding)
  5. Coach can record a cash payment for a player in their team

**Plans**: TBD

Plans:

- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Bank Reconciliation

**Goal:** The club can import a bank statement and the system automatically matches payments to the right athletes using their club ID, allocates money FIFO to oldest debts, handles partial and overpayments, and maintains a complete audit trail. This is the killer feature that replaces manual bank statement reconciliation.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: FINC-09, FINC-10, FINC-11, FINC-12, FINC-13, FINC-14, FINC-15, FINC-16
**Success Criteria** (what must be TRUE):

  1. User can upload a bank statement CSV/XLSX and system parses transactions
  2. Payments with matching club athlete ID are auto-matched with high confidence
  3. Each payment is allocated to the oldest unpaid membership charge (FIFO)
  4. Partial payments mark charges as partial and continue allocation
  5. Overpayment creates athlete credit that applies to future charges
  6. All payment operations have audit trail and can be reversed
  7. Concurrent payments cannot double-allocate the same charge (atomic transactions)

**Plans**: TBD

Plans:

- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

### Phase 6: Dashboard & Documents

**Goal:** The president opens Stozer and sees everything at a glance — today's schedule, what needs attention (expiring registrations, contracts, medical docs, staff licenses, unpaid fees, venue conflicts, overdue items), payment status, attendance, and useful charts. Club documents and templates are organized and accessible.
**Mode:** mvp
**Depends on**: Phase 3, Phase 4
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05
**Success Criteria** (what must be TRUE):

  1. Dashboard shows today's trainings, matches, and events
  2. Requires Attention section shows: expiring player registrations, expiring player contracts, expiring medical/documents, expiring staff/coach licenses, unpaid youth membership fees, venue conflicts, overdue operational items
  3. Youth payment overview shows expected vs collected vs outstanding
  4. Charts show attendance trend and membership collection trend
  5. Club documents are organized in folders with template support
  6. Club brand assets (logo, colors) are applied as accents throughout the UI

**Plans**: TBD

Plans:

- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 7: Reporting & Polish

**Goal:** Basic operational reports are available for attendance, payments, registrations, and documents — exportable to PDF/XLSX. Subscription locking works correctly. Product is verified for production readiness: responsive/mobile UX, PWA installability, cross-tenant RLS/security, role/permission enforcement, and sensitive-data exposure audit.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: RPT-01, RPT-02, RPT-03
**Success Criteria** (what must be TRUE):

  1. User can generate attendance, payment, registration, and document reports
  2. Reports can be filtered by season, date range, team, and category
  3. Reports can be exported to PDF and XLSX
  4. FREE plan limits are enforced (1 club, 1 sport, 1 selection, 20 players, 2 staff)
  5. Trial flow works correctly with 14-day CLUB functionality
  6. Premium features show locked state with upgrade CTA on FREE plan
  7. Responsive/mobile UX verified across all core workflows
  8. PWA installability confirmed (manifest, service worker, offline basics)
  9. Cross-tenant RLS isolation verified — Organization A cannot access Organization B data
  10. Role/permission enforcement verified — Coach cannot see other teams' data, salary data hidden without permission
  11. Sensitive-data exposure audit passed — no financial, medical, or contract data leaked to unauthorized roles

**Plans**: TBD

Plans:

- [ ] 07-01: TBD
- [ ] 07-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/TBD | Not started | - |
| 2. Club & People | 5/8 | In Progress|  |
| 3. Scheduling & Attendance | 0/TBD | Not started | - |
| 4. Youth Finance | 0/TBD | Not started | - |
| 5. Bank Reconciliation | 0/TBD | Not started | - |
| 6. Dashboard & Documents | 0/TBD | Not started | - |
| 7. Reporting & Polish | 0/TBD | Not started | - |
