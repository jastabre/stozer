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

(None yet — ship to validate)

### Active

**Core Platform:**
- [ ] Multi-tenant organization system with RLS isolation
- [ ] Authentication and role-based access control
- [ ] Organization onboarding flow (create club, set identity)
- [ ] Organization switching for multi-club users

**People:**
- [ ] Player profiles with permanent identity across seasons
- [ ] Staff/coach profiles with licenses and documents
- [ ] Guardian contacts for minor players
- [ ] Club athlete ID system for payment references

**Teams & Structure:**
- [ ] Team/selection management (Senior, U19, U17, U15, etc.)
- [ ] Sport abstraction — football and basketball from day one
- [ ] Season management with rollover

**Activity:**
- [ ] Training scheduling (date, time, duration, venue, team, coach)
- [ ] Training attendance tracking (present, absent, excused, late, unavailable)
- [ ] Match scheduling (team, opponent, home/away, date, venue, result)
- [ ] Unified club calendar with filters (team, venue, coach, event type)
- [ ] Venue/court/field management with conflict detection

**Registration & Contracts:**
- [ ] Player registration tracking with expiration alerts
- [ ] Player contract management with expiration alerts
- [ ] Generic athlete identifier system (federation IDs)

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
- [ ] Player documents (registration, contract, medical, insurance)
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

## Context

- Solo founder building a comprehensive SaaS product for sports clubs
- Target market: Serbia initially, global from day one via multi-language/currency architecture
- Primary language: Serbian Latin, English fully supported via i18n
- Users currently manage clubs with Excel, WhatsApp, paper, and bank statements
- The product must be simple enough for non-technical club administrators
- Existing code in directory is greenfield — starting fresh
- Supabase project not yet created

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

---

*Last updated: 2026-08-26 after initialization*
