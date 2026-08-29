# Walking Skeleton � STOZER

**Phase:** 1
**Generated:** 2026-08-27

## Capability Proven End-to-End

> A new user signs up with email/password, verifies their email, creates a sports club (organization), and lands on a dashboard with sidebar navigation � all served by a multi-tenant Next.js app backed by Supabase with RLS-enforced tenant isolation.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 App Router (TypeScript strict) | App Router enables RSC, streaming, middleware � fits multi-tenant auth + i18n routing. TypeScript strict prevents runtime surprises in a security-critical system. |
| UI Components | shadcn/ui + Tailwind CSS 4 | Copy-paste components (no runtime dependency), Tailwind for rapid neutral design. Club accent colors applied via CSS variables, not component library config. |
| Data layer | PostgreSQL via Supabase (shared database, RLS) | Supabase provides native RLS enforcement, Auth, and real-time. Shared database with RLS is the cost-effective multi-tenant pattern that scales to hundreds of tenants. |
| Auth | Supabase Auth + @supabase/ssr (cookie-based sessions) | Native integration with RLS via auth.uid() and auth.jwt(). No separate auth provider needed. Cookie-based sessions work in both server and client components. |
| RBAC | Database-level authorize() function + JWT custom claims | authorize() is SECURITY DEFINER + STABLE for query planner optimization. JWT claims (app_metadata) carry organization_id + user_role for fast, DB-level permission checks without extra queries. |
| i18n | next-intl v3+ (App Router native) | Only i18n library with full RSC support via getTranslations(). Locale-prefix URL routing (/sr/, /en/) with middleware detection. |
| Deployment target | Local dev (npm run dev) + Vercel-ready | Vercel is the native Next.js host. Architecture avoids Vercel-specific features to remain deployable elsewhere. Local dev is the primary development loop. |
| PWA | Serwist (@serwist/next) | Lightweight, works with App Router. StaleWhileRevalidate for static assets, NetworkFirst for API, CacheFirst for images. |
| State management | Server Components + React Context (minimal) | Server Components handle most data fetching. Client state limited to UI state (sidebar collapse, modals). No global state library needed. |
| Forms | React Hook Form + Zod | Zod schemas are single source of truth (validated server-side in Actions, client-side in forms). RHF for uncontrolled form performance. |
| Directory layout | `src/app/[locale]/(auth)` + `src/app/[locale]/(dashboard)` + `src/components` + `src/lib` + `src/schemas` | Route groups separate public auth pages from authenticated dashboard. Shared components and lib utilities outside route tree. |

## Stack Touched in Phase 1

- [x] Project scaffold � Next.js 15, TypeScript strict, Tailwind 4, shadcn/ui, ESLint, Prettier
- [x] Routing � `[locale]/(auth)/register`, `[locale]/(auth)/login`, `[locale]/(dashboard)/` with middleware
- [x] Database � organizations, organization_memberships, roles, role_permissions, plans, plan_entitlements, subscriptions (all with RLS + seed data)
- [x] UI � onboarding form (React Hook Form ? Server Action ? DB write ? redirect to dashboard)
- [x] Deployment � `npm run dev` exercises the full stack locally; Vercel-ready for preview deployments

## Directory Structure

```
src/
  app/
    (auth)/                        # Public auth routes (no locale prefix)
      login/page.tsx
      register/page.tsx
      verify/page.tsx
      reset-password/page.tsx
    (marketing)/                   # Public pages (homepage, pricing)
    [locale]/                      # i18n locale segment
      layout.tsx                   # Locale-aware root layout with next-intl provider
      (dashboard)/                 # Authenticated app shell
        layout.tsx                 # Sidebar, navigation, tenant context
        page.tsx                   # Dashboard overview
        teams/
        people/
        calendar/
        finances/
        documents/
        reports/
        settings/
    api/                           # Route handlers (webhooks, cron)
    layout.tsx                     # Root layout (html, body, fonts)
  components/
    ui/                            # shadcn/ui primitives
    layout/                        # Sidebar, nav, header, empty states
    auth/                          # Auth form components
    onboarding/                    # Org creation form
    subscription/                  # LockedFeature, UpgradeCTA
  lib/
    supabase/
      browser.ts                   # createBrowserClient()
      server.ts                    # createServerClient() for RSC + Server Actions
      middleware.ts                # createMiddlewareClient()
    auth.ts                        # Session helpers, permission checks
    entitlements.ts                # checkEntitlement() helper
    rbac.ts                        # authorize(), role navigation configs
    i18n.ts                        # next-intl configuration
    utils.ts                       # Date formatting, slug generation, etc.
  schemas/
    onboarding.ts                  # Zod schemas for org creation
    auth.ts                        # Zod schemas for auth forms
  types/
    database.ts                    # Generated Supabase types
    navigation.ts                  # Navigation item types
messages/
  sr.json                          # Serbian Latin (primary, complete)
  en.json                          # English (secondary, complete)
supabase/
  migrations/                      # SQL migrations (timestamp-named)
  seed.sql                         # Development seed data
```

## Database Schema (Phase 1 Tables)

### Enums
- `app_role`: club_president, youth_director, coach, admin_finance, super_admin
- `app_permission`: teams.view, teams.create, teams.edit, teams.delete, athletes.view, athletes.create, athletes.edit, athletes.delete, athletes.view_sensitive, athletes.edit_sensitive, attendance.manage, youth_finance.view, youth_finance.manage, first_team_finance.view, first_team_finance.manage, registrations.view, registrations.manage, contracts.view, contracts.manage, documents.view, documents.manage, sponsors.view, sponsors.manage, staff.view, staff.manage, reports.view, reports.export, club_settings.manage, notifications.manage

### Tables
| Table | organization_id | RLS | Notes |
|---|---|---|---|
| organizations | (is itself the tenant) | Owner-scoped | Core tenant record |
| organization_memberships | Yes | User-org mapping | junction table, UNIQUE(org, user) |
| roles | No | Read-only shared | Pre-seeded reference data |
| role_permissions | No | Read-only shared | Pre-seeded permission mapping |
| plans | No | Read-only shared | FREE/CLUB/PRO |
| plan_entitlements | No | Read-only shared | Configurable limits per plan |
| subscriptions | Yes | Org-level | Active plan + trial dates |

### PostgreSQL Functions
- `current_organization_id()` � SECURITY DEFINER, STABLE, reads org_id from JWT
- `authorize(permission)` � SECURITY DEFINER, STABLE, checks role_permissions for current user's role

### JWT Custom Claims (app_metadata)
```json
{
  "organization_id": "uuid",
  "user_role": "club_president"
}
```
Set via Supabase `custom_access_token_hook`. Server-controlled, user cannot self-modify.

## Navigation Configuration (Per Role)

### Club President
- **Scope:** Full club access
- **Nav items (8):** Pocetna, Timovi, Ljudi, Kalendar, Finansije, Dokumenta, Izvestaji, Klub

### Youth Director
- **Scope:** Youth academy management
- **Nav items (5):** Pocetna, Omladinska skola, Kalendar, Dokumenta, Izvestaji

### Coach
- **Scope:** Team operations (mobile-first)
- **Nav items (4):** Danas, Tim, Kalendar, Vise
- **Mobile:** Bottom tab navigation (4 tabs), not sidebar

### Admin/Finance
- **Scope:** All modules the user has permissions for (filtered by RBAC authorize() checks)
- **Nav items (5, filtered):** Dashboard, Members, Finances, Reports, Settings
- **Filtering:** Each item only renders if the user's role has the corresponding permission in role_permissions. Items without matching permissions are completely hidden (not grayed out).
- **Behavior:** Admin/Finance sees a subset of full-app modules based on their assigned permissions. For example, a user with youth_finance.view + registrations.view sees Finances and Members but not Settings.club_settings.manage.

### Super Admin
- **Scope:** System-wide (v2, deferred)
- **Nav items:** TBD (out of scope V1)

### Navigation Rules
- Subscription-locked items (user on FREE, feature requires CLUB): **grayed out, non-clickable, shows lock icon + upgrade CTA**
- Permission-restricted items (user role lacks permission): **completely hidden, not shown as locked**
- Active route highlighted in sidebar/bottom nav
- Labels via i18n translation keys (sr + en)

## Out of Scope (Deferred to Later Phases)

- Multi-organization switching (single org per user in V1, D-06)
- Logo and color customization during onboarding (deferred to settings, D-04)
- Guided setup wizard / tooltip tour (section empty states chosen for V1, D-11/D-12)
- Full-page trial expiry screen (inline lock chosen for V1, D-07/D-08)
- Seasons, teams, players, staff (Phase 2: Club & People)
- Calendar, venues, training, attendance, matches (Phase 3: Scheduling)
- Membership fees, payments, cash recording (Phase 4: Youth Finance)
- Bank import, FIFO allocation, reconciliation (Phase 5: Bank Reconciliation)
- Dashboard data widgets, documents, templates (Phase 6: Dashboard & Documents)
- Reports, export, final polish (Phase 7: Reporting & Polish)
- Online payment processing (out of scope V1)
- COMET integration (out of scope V1)
- Native Android/iOS (PWA only)
- Super Admin panel (v2, SUPA-01 through SUPA-04)
- Advanced features: AI, scouting, drill library, full accounting

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2 (Club & People):** Seasons, teams, player profiles, staff, guardians, registration tracking, player import, contracts, documents � the core domain model.
- **Phase 3 (Scheduling & Attendance):** Calendar, venues, training scheduling, attendance (coach mobile-first), matches, venue conflict detection � daily-use operations.
- **Phase 4 (Youth Finance):** Membership fee schemes, automatic charges, cash payment recording, role-based finance views � single-source-of-truth for club money.
- **Phase 5 (Bank Reconciliation):** Bank statement import, payment matching, FIFO allocation, partial/overpayment, audit trail, reversals � the killer feature replacing manual reconciliation.
- **Phase 6 (Dashboard & Documents):** Today view, requires-attention, payment overview, charts, club documents, templates, brand assets � the "at a glance" layer.
- **Phase 7 (Reporting & Polish):** Operational reports, export (PDF/XLSX), subscription locking verification, production readiness audit � ship-quality polish.
