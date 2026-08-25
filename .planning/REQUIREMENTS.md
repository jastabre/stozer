# Requirements: STOŽER

**Defined:** 2026-08-26
**Core Value:** A club president or youth director opens Stožer and instantly knows: who paid, who owes, who's registered, who's training today, what needs attention — without calling three people or searching through files.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Core Platform

- [ ] **CORE-01**: Multi-tenant organization system with RLS isolation — every data row scoped to organization_id
- [ ] **CORE-02**: User authentication via Supabase Auth (email/password, email verification, password reset)
- [ ] **CORE-03**: Role-based access control (Club President, Youth Director, Coach, Admin/Finance)
- [ ] **CORE-04**: Organization Owner / Club Admin — first user becomes owner with full access
- [ ] **CORE-05**: Organization switching for users belonging to multiple clubs
- [ ] **CORE-06**: FREE / trial / CLUB / PRO entitlement architecture with configurable limits
- [ ] **CORE-07**: Subscription locking — premium features shown locked with upgrade CTA, permission-restricted features hidden completely
- [ ] **CORE-08**: i18n framework with Serbian Latin as primary language and English fully supported
- [ ] **CORE-09**: Organization onboarding flow — create club with name, sport, country, language, currency, timezone, logo, colors

### Club Structure

- [ ] **STRC-01**: Season management — create, activate, archive seasons
- [ ] **STRC-02**: Team/selection management (Senior, U19, U17, U15, etc.) with sport abstraction
- [ ] **STRC-03**: Player profiles with permanent identity across seasons (name, DOB, nationality, position, status)
- [ ] **STRC-04**: Player equipment size (XS, S, M, L, XL, XXL, custom) and jersey number
- [ ] **STRC-05**: Player club athlete ID — stable unique number used as payment reference (poziv na broj)
- [ ] **STRC-06**: Staff/coach profiles (name, title, contact, teams, license, license expiration)
- [ ] **STRC-07**: Guardian contacts for minor players (name, relationship, phone, email, preferred contact method)
- [ ] **STRC-08**: Sport abstraction — football and basketball from day one, extensible to other sports

### Player Administration

- [ ] **REG-01**: Player registration tracking (federation/system, registration identifier, status)
- [ ] **REG-02**: Registration start and expiry dates with configurable warning thresholds
- [ ] **REG-03**: Registration status visual indicators (green=registered, yellow=expiring soon, red=expired/not registered)
- [ ] **REG-04**: Registration document upload and storage
- [ ] **REG-05**: Generic athlete identifier system for federation IDs (not hardcoded to COMET)
- [ ] **REG-06**: Basic player documents (medical, insurance, identity, custom types) with expiry tracking
- [ ] **REG-07**: Expiration alerts for registrations and documents

### Daily Operations

- [ ] **OPER-01**: Unified club calendar with event types (training, match, tournament, meeting, club event, deadline, task)
- [ ] **OPER-02**: Calendar filters by team, venue, coach, event type
- [ ] **OPER-03**: Venue/court/field management (name, description, address, location, type)
- [ ] **OPER-04**: Venue conflict detection — alert when two selections use same venue at same time
- [ ] **OPER-05**: Training scheduling (date, start time, duration, venue, team, coach, optional note)
- [ ] **OPER-06**: Very simple training attendance (present, absent, excused, late, unavailable)
- [ ] **OPER-07**: Basic match records (team, competition, opponent, home/away, date, time, venue, result, note)
- [ ] **OPER-08**: Attendance percentage per team and player attendance history

### Youth School Finance

- [ ] **FINC-01**: Membership fee schemes per youth team (amount, currency, billing frequency, due day)
- [ ] **FINC-02**: Automatic monthly charge generation based on fee schemes
- [ ] **FINC-03**: Payment status tracking (paid, partial, unpaid, waived, discounted)
- [ ] **FINC-04**: Individual player fee adjustments (custom amount, percentage discount, temporary/full exemption)
- [ ] **FINC-05**: Coach sees payment status only for their own team
- [ ] **FINC-06**: Youth Director sees all youth team payment status
- [ ] **FINC-07**: Club President sees youth-school finance overview
- [ ] **FINC-08**: Cash payment recording by coaches (amount, date, method, note)
- [ ] **FINC-09**: Bank statement import (CSV, XLSX) with transaction parsing
- [ ] **FINC-10**: Payment matching by club athlete ID / payment reference as primary key
- [ ] **FINC-11**: FIFO payment allocation — each payment allocated to oldest unpaid membership charge
- [ ] **FINC-12**: Partial payment handling — mark charge as partial, continue allocation
- [ ] **FINC-13**: Overpayment handling — excess becomes athlete credit/balance
- [ ] **FINC-14**: Audit trail on all payment operations (created, imported, reversed, reallocated)
- [ ] **FINC-15**: Payment reversal and correction capability with audit preserved
- [ ] **FINC-16**: All financial operations atomic — single database transaction, no double allocation

### Dashboard

- [ ] **DASH-01**: Today view — trainings, matches, events happening today
- [ ] **DASH-02**: Requires Attention view — expiring registrations, unpaid fees, venue conflicts, overdue items
- [ ] **DASH-03**: Youth payment overview — expected vs collected, outstanding, number unpaid
- [ ] **DASH-04**: Registration and document expiry warnings
- [ ] **DASH-05**: Attendance overview per team
- [ ] **DASH-06**: Simple useful charts (attendance trend, membership collections, players by team)

### Documents

- [ ] **DOCS-01**: Club documents with folder structure (federation, contracts, legal, sponsors, administration, finance, custom)
- [ ] **DOCS-02**: Club-owned document templates (saglasnost, prijava, opravdanje, etc.)
- [ ] **DOCS-03**: Template favorites and quick documents access from dashboard
- [ ] **DOCS-04**: Club brand assets — logo (PNG, SVG, PDF) and club colors (primary, secondary)
- [ ] **DOCS-05**: Brand colors used as accents throughout UI — core UI remains neutral

### Reporting

- [ ] **RPT-01**: Basic operational reports to support V1 workflows (attendance, payments, registrations, documents)
- [ ] **RPT-02**: Report filters (season, date range, team, category)
- [ ] **RPT-03**: Export to PDF and XLSX

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Player Contracts

- **CONT-01**: Player contract management (amateur/professional, start/end dates, files)
- **CONT-02**: Contract annexes and notes
- **CONT-03**: Loan and termination tracking
- **CONT-04**: Contract expiration alerts

### First-Team Finance

- **FTFI-01**: Player salary tracking (base salary, currency, payment period, validity)
- **FTFI-02**: Staff salary tracking
- **FTFI-03**: Bonus management (type, description, amount)
- **FTFI-04**: Match expenses (transport, venue, referees, accommodation, food)
- **FTFI-05**: First-team finance dashboard with charts
- **FTFI-06**: First-team finance permissions (view_first_team_finance, manage_first_team_finance)

### Sponsors

- **SPON-01**: Sponsor management (name, logo, contact, contract, value)
- **SPON-02**: Sponsor obligations tracking (description, due date, status)
- **SPON-03**: Sponsor alerts (contract expiring, obligation overdue)

### Notifications

- **NOTF-01**: In-app notification center
- **NOTF-02**: Notifications for expiring registrations, contracts, medical docs
- **NOTF-03**: Notifications for unpaid memberships
- **NOTF-04**: Provider-independent notification architecture

### Search & Quick Actions

- **SRCH-01**: Global search (athletes, staff, teams, sponsors, documents)
- **SRCH-02**: Quick Add menu (athlete, training, match, payment, document, task)

### Super Admin

- **SUPA-01**: Platform dashboard (organizations, subscriptions, metrics)
- **SUPA-02**: Organization management (plan changes, trial control, status)
- **SUPA-03**: Plan configuration (limits, entitlements, pricing)
- **SUPA-04**: Inactive club management (warning, scheduled deletion, archive)

### Advanced Reports

- **RPT-04**: Advanced youth finance reports
- **RPT-05**: First-team cost reports
- **RPT-06**: Sponsor reports
- **RPT-07**: Registration and contract reports

## Out of Scope

Explicitly excluded from V1. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| COMET integration | Stožer must work independently from federation systems |
| Detailed player development | Not in V1 scope — future module |
| Advanced match statistics | Minutes played, assists, shots — deferred |
| Complex training planning | Drills, warmups, tactics — deferred |
| Drill library | Deferred |
| Parent portal | No parent accounts in V1 |
| Online payments | No payment provider integration in V1 |
| AI features | Not in V1 scope |
| Full accounting | Not a club management tool |
| Advanced first-team finance | Planned post-V1 module |
| Advanced sponsor management | Planned post-V1 module |
| Advanced reporting | Basic reports only in V1 |
| Native Android/iOS | Web-first PWA |
| WhatsApp/SMS integration | Deferred |
| QR payments | Deferred |
| White-label custom domains | Deferred |
| Microservices | Modular monolith for V1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1 | Pending |
| CORE-02 | Phase 1 | Pending |
| CORE-03 | Phase 1 | Pending |
| CORE-04 | Phase 1 | Pending |
| CORE-05 | Phase 1 | Pending |
| CORE-06 | Phase 1 | Pending |
| CORE-07 | Phase 1 | Pending |
| CORE-08 | Phase 1 | Pending |
| CORE-09 | Phase 1 | Pending |
| STRC-01 | Phase 2 | Pending |
| STRC-02 | Phase 2 | Pending |
| STRC-03 | Phase 2 | Pending |
| STRC-04 | Phase 2 | Pending |
| STRC-05 | Phase 2 | Pending |
| STRC-06 | Phase 2 | Pending |
| STRC-07 | Phase 2 | Pending |
| STRC-08 | Phase 2 | Pending |
| REG-01 | Phase 2 | Pending |
| REG-02 | Phase 2 | Pending |
| REG-03 | Phase 2 | Pending |
| REG-04 | Phase 2 | Pending |
| REG-05 | Phase 2 | Pending |
| REG-06 | Phase 2 | Pending |
| REG-07 | Phase 2 | Pending |
| OPER-01 | Phase 3 | Pending |
| OPER-02 | Phase 3 | Pending |
| OPER-03 | Phase 3 | Pending |
| OPER-04 | Phase 3 | Pending |
| OPER-05 | Phase 3 | Pending |
| OPER-06 | Phase 3 | Pending |
| OPER-07 | Phase 3 | Pending |
| OPER-08 | Phase 3 | Pending |
| FINC-01 | Phase 4 | Pending |
| FINC-02 | Phase 4 | Pending |
| FINC-03 | Phase 4 | Pending |
| FINC-04 | Phase 4 | Pending |
| FINC-05 | Phase 4 | Pending |
| FINC-06 | Phase 4 | Pending |
| FINC-07 | Phase 4 | Pending |
| FINC-08 | Phase 4 | Pending |
| FINC-09 | Phase 5 | Pending |
| FINC-10 | Phase 5 | Pending |
| FINC-11 | Phase 5 | Pending |
| FINC-12 | Phase 5 | Pending |
| FINC-13 | Phase 5 | Pending |
| FINC-14 | Phase 5 | Pending |
| FINC-15 | Phase 5 | Pending |
| FINC-16 | Phase 5 | Pending |
| DASH-01 | Phase 6 | Pending |
| DASH-02 | Phase 6 | Pending |
| DASH-03 | Phase 6 | Pending |
| DASH-04 | Phase 6 | Pending |
| DASH-05 | Phase 6 | Pending |
| DASH-06 | Phase 6 | Pending |
| DOCS-01 | Phase 6 | Pending |
| DOCS-02 | Phase 6 | Pending |
| DOCS-03 | Phase 6 | Pending |
| DOCS-04 | Phase 6 | Pending |
| DOCS-05 | Phase 6 | Pending |
| RPT-01 | Phase 7 | Pending |
| RPT-02 | Phase 7 | Pending |
| RPT-03 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 57 total
- Mapped to phases: 57
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-26*
*Last updated: 2026-08-26 after initial definition*
