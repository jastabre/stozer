# Project Research Summary: STOŽER

## Key Findings

### Stack
- **Next.js 15+ App Router + Supabase (PostgreSQL + Auth + Storage + Realtime)**: RSC eliminates client-side waterfalls for data-heavy pages; Supabase provides managed Postgres with native RLS for tenant isolation — no separate auth or ORM layer needed.
- **shadcn/ui + Tailwind CSS 4 + TanStack Table v9 + React Hook Form + Zod + Recharts 3**: Zero-runtime component ownership (copy-paste model), headless table/form primitives, single Zod schema serves client and server validation. No ORM (Prisma/Drizzle) — use Supabase JS client directly.
- **PWA via Serwist** (not next-pwa): Official Next.js-recommended PWA solution. Enables offline attendance for coaches — critical mobile workflow.

### Table Stakes Features
- Club/team/player management with role-based views (President, Youth Director, Coach, Admin/Finance)
- Practice & match scheduling with calendar view and conflict detection
- Training attendance with mobile one-tap workflow (<30 seconds per team)
- Membership fee definition, invoice generation, payment status tracking
- Basic bank statement CSV import for payment reconciliation (the #1 pain point)
- Document upload with expiry tracking (medical certs, licenses, contracts)
- "Today's activities" dashboard with status indicators

### Architecture
- **Shared-schema multi-tenancy** with `organization_id` on every business table + PostgreSQL RLS enforced at database level. JWT `app_metadata` carries active `organization_id` for fast tenant resolution without DB queries per request.
- **RBAC via `authorize()` function**: roles (club_president, youth_director, coach, admin_finance) mapped to granular permissions in `role_permissions` table. RLS policies combine tenant isolation AND role check with AND logic. Restrictive policies for sensitive data (salaries, contracts).
- **FIFO payment allocation as a PL/pgSQL database function**: atomic read-modify-write with `FOR UPDATE SKIP LOCKED`, overpayment becomes athlete credit, full audit trail. Single source of truth in the database, not application code.
- **Athlete identity is permanent across seasons**; team membership is the junction table with `started_at`/`ended_at`. Season rollover copies teams and staff; athletes are explicitly moved in UI.

### Biggest Risks
1. **Tenant data leakage via missing RLS** — a single table without RLS or a policy bug leaks all club data. Mitigation: enable RLS on every table at creation, CI check for un-RLS'd tables, test with two seeded organizations.
2. **FIFO payment allocation race condition** — concurrent payments can double-allocate the same charge. Mitigation: PL/pgSQL function with `FOR UPDATE SKIP LOCKED`, atomic transactions, idempotency keys on imports.
3. **Floating-point money errors** — JavaScript `0.1 + 0.2` bugs in financial calculations. Mitigation: store all amounts as integer cents/para, format only at UI layer, all balance math in SQL.
4. **Scope creep / feature bloat** — building for imaginary scale or adding features not in STOZER-BRIEF.md. Mitigation: brief is law, ship MVP to 3 beta clubs in 8 weeks, maintain "not now" list.
5. **RLS performance degradation** at scale — policies with subqueries or IN clauses become sequential scans at 10k+ rows. Mitigation: simple column comparisons in RLS, `(SELECT ...)` wrapper for per-query evaluation, index `organization_id` as first column in all composite indexes.

## Implications for Roadmap

### Suggested Phase Order
1. **Schema + Auth + RLS foundation** — organizations, members, roles, tenant resolution, `authorize()` function. Everything depends on this.
2. **Team/Player management** — core domain model, roster assignment, season structure. Prerequisite for all operational features.
3. **Scheduling + Calendar** — training and match scheduling with venue management. Prerequisite for attendance.
4. **Attendance** — mobile-first coach workflow. This is the daily-use feature that drives retention.
5. **Membership fees + basic payment tracking** — fee definition, invoices, status dashboard.
6. **Bank reconciliation (the killer feature)** — CSV import, auto-matching, FIFO allocation. This is why clubs adopt STOŽER.
7. **Documents + notifications** — expiry tracking, in-app alerts.
8. **Dashboard + reporting** — the "president view" that shows everything at a glance.

### Foundation First
- Multi-tenant schema with RLS on every table (verified via CI)
- JWT custom claims for `organization_id` in `app_metadata`
- `authorize()` PL/pgSQL function bridging RBAC to RLS
- Supabase Auth with `@supabase/ssr` cookie sessions
- Migration pipeline (supabase CLI, versioned SQL files)
- i18n framework (next-intl) with Serbian as primary locale
- PWA shell (Serwist) for offline-capable coach workflows

### Critical Path Items
- **RLS isolation test**: seed two organizations, verify complete data isolation — must pass before any feature work.
- **Payment allocation function**: implement, test with concurrent payments, verify FIFO correctness, test overpayment/partial/exact scenarios — this is the hardest business logic.
- **Bank statement parser**: support CSV formats from major Serbian banks (Raiffeisen, Intesa), idempotent import, reference number matching.
- **Mobile attendance UX**: validate with a real coach on a real phone before polishing anything else.

### Anti-Patterns to Avoid
- **Don't use Prisma/Drizzle** — adds abstraction over Supabase's native Postgres access, complicates RLS integration.
- **Don't use Clerk/NextAuth** — Supabase Auth integrates natively with RLS via `auth.uid()`, separate auth layers create JWT sync complexity.
- **Don't build schema-per-tenant or DB-per-tenant** — shared schema with RLS is correct for V1, the other models add operational overhead you won't need until hundreds of paying clubs.
- **Don't put business logic in application code** — payment allocation, balance calculations, and attendance summaries belong in PL/pgSQL functions as single source of truth.
- **Don't skip `(SELECT ...)` in RLS policies** — without it, policies evaluate per-row and performance degrades catastrophically at scale.
- **Don't use `user_metadata` for authorization** — users can self-modify it (privilege escalation). Only `app_metadata` is server-controlled.
- **Don't build offline-first for V1** — PWA handles slow networks; full offline sync with conflict resolution is a post-V1 investment.
- **Don't perfect UI before core works** — "works correctly" beats "looks beautiful" for the first 6 months. Ship with shadcn/ui defaults.
- **Don't build for imaginary scale** — single Postgres database, single Next.js app on Supabase + Vercel. Revisit when you have 100 paying clubs.
- **Don't hardcode for football** — use sport-agnostic terms ("venue" not "pitch"), `sport_type` enum drives behavior.

## Sources
- STACK.md
- FEATURES.md
- ARCHITECTURE.md
- PITFALLS.md
