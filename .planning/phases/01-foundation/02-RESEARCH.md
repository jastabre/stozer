# Phase 1: Foundation — Research

**Date:** 2026-08-27
**Status:** Ready for planning

---

## Executive Summary

Phase 1 establishes the entire multi-tenant infrastructure that every subsequent phase depends on. This is the most architecturally critical phase — mistakes here propagate through all 7 phases. The research covers 9 requirements (CORE-01 through CORE-09) across 6 functional areas: multi-tenant isolation, authentication, RBAC, organization onboarding, subscription entitlements, and i18n. The key finding is that these areas have tight coupling: the order of implementation matters, and each layer builds on the one below it.

**Critical dependency chain:**
Supabase project setup -> Database schema (organizations, users, memberships, roles) -> JWT custom claims (organization_id in app_metadata) -> RLS policies (enforced at DB level) -> authorize() function (RBAC bridge) -> Auth flow (signup, login, email verification) -> Organization onboarding (create club, assign President) -> Subscription entitlements (FREE/trial defaults) -> App shell (sidebar, role-based navigation) -> i18n (all UI strings through next-intl)

---

## 1. Multi-Tenant Isolation (CORE-01)

### Pattern: Shared Database + Row-Level Security

**Decision:** Shared schema multi-tenancy with organization_id on every business table, enforced via PostgreSQL RLS.

**Why this pattern:**
- Supabase-native: RLS is the core security primitive
- Single schema to manage, deploy, back up
- Cost-effective: no per-tenant database provisioning
- Proven at scale for hundreds-to-thousands of tenants

**Trade-offs accepted:**
- Schema-per-tenant: rejected (management overhead, migration complexity, connection pooling issues)
- Database-per-tenant: rejected (prohibitive cost, operational complexity)

### Tenant Resolution Architecture

Two-layer approach, both necessary:

**Primary: JWT Custom Claims (app_metadata)**
- Store organization_id and user_role in JWT via Supabase custom_access_token_hook
- Fastest path — no DB query on every request
- Claims persist until token refresh (max ~1 hour)
- app_metadata is server-controlled, user CANNOT self-modify (safe for authorization)
- NEVER use user_metadata for authorization (privilege escalation risk)

**Fallback: Security Definer Helper Function**
- current_organization_id() reads from JWT, returns UUID
- Used in RLS policies for clean, reusable pattern
- Must be STABLE for query planner optimization

**Performance critical:** Always wrap in (SELECT ...) to avoid per-row re-evaluation in RLS policies. Without this wrapper, policies evaluate for EVERY row scanned. With it, they evaluate ONCE per query.

### Tables Requiring RLS in Phase 1

| Table | organization_id | Notes |
|-------|----------------|-------|
| organizations | (is itself the tenant) | Owner-scoped access |
| organization_memberships | Yes | User-org mapping with role |
| roles | No (shared reference data) | Pre-seeded, read-only |
| role_permissions | No (shared reference data) | Pre-seeded, read-only |
| plans | No (shared reference data) | Pre-seeded, read-only |
| plan_entitlements | No (shared reference data) | Pre-seeded, read-only |
| subscriptions | Yes | Org-level subscription |

**Critical rules:**
- FORCE ROW LEVEL SECURITY is mandatory — without it, the table owner role bypasses all policies
- INSERT policies need WITH CHECK, not USING
- UPDATE policies need both USING and WITH CHECK
- Index organization_id as FIRST column in all composite indexes

### Verification Strategy

**Must-pass test before any feature work:**
1. Seed two test organizations
2. Create users belonging to different organizations
3. Verify complete data isolation — Organization A cannot see Organization B data
4. Verify via both direct queries AND the application layer

---

## 2. Authentication (CORE-02)

### Supabase Auth Setup

**Decision:** Supabase Auth with email/password + email verification + password reset.

**Why Supabase Auth:**
- Integrates natively with RLS via auth.uid() and auth.jwt()
- No separate auth provider needed (no Clerk, no NextAuth)
- Session management built-in (token refresh, revocation)
- @supabase/ssr handles cookie-based sessions for Next.js App Router

**What NOT to use:**
- Clerk: adds JWT template hacks, loses native auth.uid() integration
- NextAuth/Auth.js: separate auth layer creates JWT synchronization complexity
- Custom JWT: never roll your own

### Session Management Pattern

**Use @supabase/ssr for cookie-based sessions:**
- Server-side: createServerClient() from @supabase/ssr
- Client-side: createBrowserClient() from @supabase/ssr
- Middleware: createMiddlewareClient() from @supabase/ssr

**Middleware responsibilities (keep fast, < 50ms):**
- Auth redirects (unauthenticated -> login)
- Locale detection/redirect
- Simple route protection
- NO database calls in middleware — use JWT claims only
- Use matcher config to exclude static files and API routes

### Auth Flows

**Signup -> Org Creation:**
1. User visits /en/register
2. User submits email + password + display name
3. Supabase Auth creates user record
4. Supabase sends verification email
5. User clicks verification link -> redirected to /en/verify
6. On successful verification -> redirect to /en/onboarding
7. User creates organization (CORE-09)
8. First user automatically assigned club_president role
9. JWT updated with organization_id and user_role
10. Redirect to /en/dashboard

**Login:**
1. User visits /en/login
2. User submits email + password
3. Supabase Auth validates credentials
4. JWT issued with app_metadata
5. Middleware checks: has organization? -> dashboard. No org? -> onboarding

**Password Reset:**
1. User clicks "Forgot password" on /en/login
2. User submits email
3. Supabase sends reset email
4. User clicks link -> /en/reset-password
5. User enters new password -> redirect to /en/login

### JWT Claims Structure

`json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "app_metadata": {
    "organization_id": "org-uuid",
    "user_role": "club_president"
  },
  "user_metadata": {
    "display_name": "Marko Petrovic"
  },
  "role": "authenticated"
}
`

**Critical:**
- app_metadata = server-controlled, safe for authorization
- user_metadata = user-modifiable, NEVER for authorization
- role = Supabase internal ("authenticated" for logged-in users)

---

## 3. Role-Based Access Control (CORE-03, CORE-04)

### Role Definitions

**Decision:** Four business roles + Super Admin, with granular permissions.

| Role | Scope | Description |
|------|-------|-------------|
| club_president | Entire club | Everything — all modules, all data, settings, staff management |
| youth_director | Youth school only | Youth teams, youth athletes, youth finance, youth registrations |
| coach | Assigned teams only | His teams' athletes, training, attendance, team memberships |
| admin_finance | Configured scope | Finance modules, registrations, contracts, documents |
| super_admin | Platform-wide | Cross-tenant access (separate admin routes, service_role) |

**Design decision:** Roles are NOT rigid in the database. A user can have multiple roles within an organization. The app_role enum is a type hint; the actual role assignment is in organization_memberships.

### Permission Model: Three-Layer Design

roles -> permissions -> policies

**Layer 1: Roles (enum)**
`sql
CREATE TYPE public.app_role AS ENUM (
  'club_president', 'youth_director', 'coach', 'admin_finance', 'super_admin'
);
`

**Layer 2: Granular Permissions (enum + mapping table)**
`sql
CREATE TYPE public.app_permission AS ENUM (
  'teams.view', 'teams.create', 'teams.edit', 'teams.delete',
  'athletes.view', 'athletes.create', 'athletes.edit', 'athletes.delete',
  'athletes.view_sensitive', 'athletes.edit_sensitive',
  'attendance.manage',
  'youth_finance.view', 'youth_finance.manage',
  'first_team_finance.view', 'first_team_finance.manage',
  'registrations.view', 'registrations.manage',
  'contracts.view', 'contracts.manage',
  'documents.view', 'documents.manage',
  'sponsors.view', 'sponsors.manage',
  'staff.view', 'staff.manage',
  'reports.view', 'reports.export',
  'club_settings.manage', 'notifications.manage'
);

CREATE TABLE public.role_permissions (
  role public.app_role NOT NULL,
  permission public.app_permission NOT NULL,
  PRIMARY KEY (role, permission)
);
`

**Layer 3: The authorize() function (bridge to RLS)**
- STABLE: PostgreSQL knows this is deterministic for query planner optimizations
- SECURITY DEFINER: function runs with owner privileges, not the callers
- SET search_path = '': prevents search path injection attacks
- Call from RLS with (select authorize('permission_name')) for per-query evaluation

### RBAC Enforcement: Database Level

RLS policies combine tenant isolation AND role-based permission with AND logic. For sensitive data (salary, contracts), use AS RESTRICTIVE policies that always apply and cannot be bypassed by permissive policies.

### RBAC Enforcement: Application Level

- Server Components: Check permissions before rendering data
- Server Actions: Verify permissions before executing mutations
- Client Components: Hide UI elements based on permissions (but NEVER rely on this alone)

### CORE-04: First User = President

**Decision (D-05):** First user of a new organization automatically gets club_president role.

**Implementation:** Happens in the organization creation Server Action:
1. Create organization record
2. Create organization_membership with role = club_president
3. Set JWT claims (organization_id, user_role)
4. Create default subscription (FREE plan)
5. Initialize trial (14 days CLUB features)

**Reversibility note:** One-way decision. Changing first-user role later requires migration + permission restructure.

### CORE-05: Organization Switching (Deferred in V1)

**Decision (D-06):** Single organization per user in V1. No org switching UI.

**What this means for Phase 1:**
- The data model supports multi-org (organization_memberships allows multiple rows per user)
- JWT claims store a single organization_id (the active one)
- No org switcher component needed
- Multi-org switching deferred to post-V1

**Architecture must not assume single-org:** organization_memberships table is the junction. JWT claims can be updated to switch active org. RLS works correctly regardless of how many orgs a user belongs to.

---

## 4. Organization Onboarding (CORE-09)

### Onboarding Flow

**Decision (D-04):** Single-step organization creation.

**Fields (per brief section 67):**
1. Club Name (required)
2. Sport (required) — football or basketball
3. Country (required)
4. Language (required) — default: sr-Latn
5. Currency (required) — default: RSD
6. Timezone (auto-suggested from country, editable)
7. Logo (optional, editable later in settings per D-04)
8. Primary Color (optional, editable later per D-04)
9. Secondary Color (optional, editable later per D-04)

**Design decisions:**
- Single form, not multi-step wizard (simpler for non-technical users)
- Logo and colors are deferred to settings (D-04) — don't block onboarding for branding
- Sport selection is mandatory — drives team/venue terminology
- Country determines default currency and timezone suggestions
- First team/selection creation is NOT part of onboarding — let user explore first (D-12)

### Database Tables for Onboarding

`sql
-- Organization
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sport text NOT NULL,
  country text NOT NULL,
  locale text NOT NULL DEFAULT 'sr-Latn',
  timezone text NOT NULL DEFAULT 'Europe/Belgrade',
  default_currency text NOT NULL DEFAULT 'RSD',
  logo_url text,
  primary_color text,
  secondary_color text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Organization membership (user <-> org mapping)
CREATE TABLE public.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
`

---

## 5. Subscription Entitlements (CORE-06, CORE-07)

### Plan Architecture

**Decision (D-07, D-08, D-09, D-10):** Configurable entitlements system.

| Plan | Status | Limits |
|------|--------|--------|
| FREE | Always available | 1 club, 1 sport, 1 selection, 20 players, 2 staff |
| CLUB | Trial (14 days) or paid | Full features |
| PRO | Paid | Extended limits + advanced features |

**Key design:**
- Plan limits are NOT hardcoded — stored in plan_entitlements table
- Super Admin can configure limits per plan
- Trial gives CLUB features for 14 days, no credit card
- On trial expiry: data preserved, premium features locked
- FREE limits: 1 organization, 1 sport, 1 team/selection, 20 players, 2 staff users

### Database Tables

`sql
-- Plans (shared reference data, not tenant-scoped)
CREATE TABLE public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Plan entitlements (configurable limits per plan)
CREATE TABLE public.plan_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL REFERENCES public.plans(id),
  entitlement_key text NOT NULL,
  entitlement_value integer NOT NULL,
  UNIQUE(plan_id, entitlement_key)
);

-- Subscriptions (per-organization)
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'active',
  trial_starts_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`

### Subscription Locking UX (D-07, D-08)

**Two distinct concepts:**
1. **Subscription locked** (FREE plan, expired trial): Feature is visible with lock icon + upgrade CTA
2. **Permission denied** (user lacks role): Feature is completely hidden

**UI component pattern:** Subscription-locked features render with a LockedFeature wrapper showing description + upgrade button. Permission-denied features simply do not render at all.

### Trial Management

**Default trial (D-09):** 14 days of CLUB features, no credit card required.

**On trial expiry (D-10):**
- Lock premium features (show with lock icon)
- Keep all data accessible
- User retains FREE features
- Data created during trial preserved but locked

---

## 6. Internationalization (CORE-08)

### Library Choice: next-intl

**Decision:** next-intl v3+ (latest stable).

**Why next-intl:**
- Only i18n library with full App Router + RSC support
- Works natively in Server Components via getTranslations()
- Type-safe translation keys
- Middleware handles locale detection, URL prefix routing, cookie persistence

**What NOT to use:**
- next-i18next: Pages Router only
- i18next + react-i18next: Manual config, no native App Router integration
- Lingui: Less mature App Router support

### Locale Configuration

**Initial locales (brief section 11):**
- sr — Serbian Latin (primary)
- en — English (secondary)

**Architecture must support future:** sr-Cyrl, de, es, it, fr

### URL Pattern

/sr/dashboard — Serbian Latin
/en/dashboard — English

[locale] segment in route: All authenticated routes live under /[locale]/(dashboard)/...

### Translation File Structure

messages/
  sr.json — Serbian Latin (primary, complete)
  en.json — English (secondary, complete)

### Date/Number/Currency Formatting

Use getFormatter() (server) and useFormatter() (client) from next-intl. Auto-formats per locale using Intl.DateTimeFormat and Intl.NumberFormat. Currency formatting supports RSD, EUR, and any ISO currency code.

### i18n Middleware

- Locales: ['sr', 'en']
- Default locale: 'sr'
- Locale prefix: 'always' (/sr/dashboard, /en/dashboard)
- Matcher excludes API routes and static files

### Organization Locale

Each organization stores its preferred locale. When user switches organizations, the locale segment in URL updates accordingly.

---

## 7. App Shell and Navigation

### Layout Structure

`
src/app/
  (auth)/                    # Public auth routes (no locale prefix)
    login/
    register/
    reset-password/
  (marketing)/               # Public pages (homepage, pricing)
  [locale]/                  # i18n locale segment
    layout.tsx               # Locale-aware root layout
    (dashboard)/             # Authenticated app shell
      layout.tsx             # Sidebar, navigation, tenant context
      page.tsx               # Dashboard overview
      teams/
      people/
      calendar/
      finances/
      documents/
      reports/
      settings/
  api/                       # Route handlers (webhooks, cron)
  layout.tsx                 # Root layout (html, body, fonts)
`

### Sidebar Navigation Per Role

**Club President (brief section 17) — 8 sections:**
Pocetna, Timovi, Ljudi, Kalendar, Finansije, Dokumenta, Izvestaji, Klub

**Youth Director (brief section 18) — 5 sections:**
Pocetna, Omladinska skola, Kalendar, Dokumenta, Izvestaji

**Coach (brief section 19) — 4 mobile-first items:**
Danas, Tim, Kalendar, Vise

**Admin/Finance — configurable scope based on assigned permissions.**

**Decision (D-13):** Full sidebar navigation shown for new users, unavailable items grayed out.

### Responsive Behavior

- Desktop: Full sidebar visible, collapsible
- Tablet: Sidebar collapsible
- Mobile: Bottom tab navigation (4 items for coach), sidebar hidden
- Sidebar collapse trigger: agent discretion (suggest: 768px breakpoint)

### Design Direction (D-02, D-03)

- Clean, neutral base UI
- Club accent colors on interactive elements (buttons, active nav items, headers)
- Logo in sidebar header
- shadcn/ui components with Tailwind CSS

---

## 8. Empty States and First Use

**Decision (D-11, D-12):** Contextual empty states per section, user picks what to do first.

Each section has its own empty state with title, description, and CTA button. No forced order — user decides what to set up first.

---

## 9. PWA Foundation

### Serwist Setup

**Decision:** Serwist (@serwist/next or @serwist/turbopack) for PWA support.

**Key files:**
- app/manifest.json — Web app manifest
- app/sw.ts — Service worker
- SerwistProvider in root layout

**Workbox strategies for Phase 1:**
- NetworkFirst for API data
- StaleWhileRevalidate for static assets
- CacheFirst for images

**Offline considerations for Phase 1:**
- Basic offline fallback page
- No complex offline sync yet (deferred to post-V1 per PITFALLS.md)

---

## 10. Key Patterns to Follow

### Pattern 1: Server Components by Default

- Pages are server components by default
- Add "use client" ONLY when interactivity is needed (forms, modals, state)
- Fetch data in server components, pass as props to client components
- Use loading.tsx for Suspense boundaries

### Pattern 2: Server Actions for Mutations

Every Server Action that modifies data must:
1. Resolve the active organization from the session
2. Verify the user's role (server-side)
3. Execute within a Supabase transaction
4. Call revalidatePath or revalidateTag for cache invalidation

### Pattern 3: Zod Schemas as Single Source of Truth

Define Zod schemas in schemas/ files. Use z.infer for TypeScript types. Server Actions re-use the same Zod schemas for validation. Client forms use RHF + Zod resolver.

### Pattern 4: Middleware Stays Fast

- Auth redirects: check JWT claims for organization_id
- Locale detection: from Accept-Language, URL prefix, cookie
- Simple route protection: redirect unauthenticated to login
- NO database calls
- Keep under 50ms
- Use matcher to exclude static files

### Pattern 5: Database Functions for Complex Logic

Any logic that reads and writes multiple tables goes into PL/pgSQL. Application code calls the function, does not reimplement the logic.

---

## 11. Risks and Mitigation

### Critical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| RLS policy missing on new table | Data leakage across tenants | Migration template includes ENABLE RLS by default; CI check for un-RLS'd tables |
| service_role key exposed to client | Complete RLS bypass | Audit every file for service_role; never in client code; env var validation |
| JWT claims stale after role change | User retains old permissions | Force session refresh after role changes; 1-hour JWT expiry |
| Wrong role assigned during onboarding | User gets too much or too little access | Hardcode first user as club_president in org creation; test with seeded data |

### High Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| RLS performance degradation | Slow queries at scale | Simple column comparisons in RLS; (SELECT ...) wrapper; index organization_id |
| Middleware doing too much | Slow page loads, auth loops | Keep middleware fast; no DB calls; profile with dev tools |
| i18n not set up from start | Expensive retrofit | Set up next-intl before any UI work; all strings through translation keys |
| Subscription entitlement check missed | Users bypass plan limits | Create reusable checkEntitlement() helper; use in every resource creation action |

### Medium Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Server/Client component confusion | Hydration mismatches, waterfalls | Pages are server by default; "use client" only for interactivity |
| Bundle size bloat | Slow initial load | Dynamic imports for heavy libs; tree-shaking; audit with bundle analyzer |
| Storage bucket misconfiguration | Private data exposed | Private buckets by default; RLS policies on storage; signed URLs |
| Auth session issues | Random logouts, failed refresh | Use @supabase/ssr cookie sessions; test 2+ hour sessions |

---

## 12. Implementation Order

Based on dependency analysis, the recommended implementation sequence:

### Step 1: Project Initialization
- Initialize Next.js 15 project with TypeScript strict
- Configure Tailwind CSS 4
- Install and configure shadcn/ui
- Set up project structure (src/app, src/components, src/lib, etc.)

### Step 2: Supabase Setup
- Create Supabase project
- Install @supabase/supabase-js, @supabase/ssr
- Create client/server/middleware Supabase helpers
- Configure environment variables

### Step 3: Database Foundation (Migrations)
1. Create enums: app_role, app_permission
2. Create organizations table
3. Create organization_memberships table
4. Create plans and plan_entitlements tables
5. Create subscriptions table
6. Seed default plans and entitlements
7. Enable RLS + FORCE RLS on all tables
8. Create current_organization_id() helper function
9. Create authorize() function
10. Create RLS policies for all tables
11. Create custom_access_token_hook for JWT claims

### Step 4: Authentication
- Configure Supabase Auth (email/password, email verification)
- Create middleware for auth redirects
- Implement login page
- Implement registration page
- Implement password reset flow
- Implement email verification handling
- Test: signup -> verify -> login -> session persistence

### Step 5: Organization Onboarding
- Create onboarding form (React Hook Form + Zod)
- Create organization creation Server Action
- Test: create org -> president assigned -> JWT updated -> redirect to dashboard

### Step 6: i18n Foundation
- Install and configure next-intl
- Set up middleware for locale routing
- Create translation files (sr.json, en.json)
- Set up date/number/currency formatting
- Migrate existing auth pages to use translation keys

### Step 7: App Shell
- Create root layout with providers
- Create dashboard layout with sidebar
- Implement role-based navigation
- Create empty state components
- Create subscription lock component
- Test: login -> dashboard loads -> sidebar shows correct nav for role

### Step 8: PWA Foundation
- Install and configure Serwist
- Create manifest.json
- Create service worker
- Add SerwistProvider to root layout
- Test: PWA installability

### Step 9: Verification
- Seed two organizations -> verify RLS isolation
- Test all 4 roles -> verify correct nav and permissions
- Test trial flow -> 14-day CLUB trial, expiry locks features
- Test i18n -> locale switching, formatting
- Test mobile responsive -> sidebar collapse, bottom nav
- Security review -> no service_role in client, no user_metadata for auth

---

## 13. Design Decisions Summary

| Decision | Choice | Reversibility | Rationale |
|----------|--------|---------------|-----------|
| D-01: Layout pattern | Left sidebar, collapsible on mobile | Costly | Affects every page and route |
| D-02: Design direction | Clean/neutral + club accent colors | Reversible | CSS variable swap |
| D-03: Logo/colors | Sidebar header, accent on interactive elements | Reversible | Component props |
| D-04: Onboarding | Single-step form, logo/colors in settings | Reversible | Form field additions |
| D-05: First user role | Automatic club_president | One-way | Foundational to RBAC |
| D-06: Org switching | Single org in V1 | Costly | Requires session management |
| D-07: FREE limits | Visible + locked with upgrade CTA | Costly | Enforcement pattern across features |
| D-08: Upgrade CTA | Inline on feature (lock icon + tooltip) | Reversible | Component swap |
| D-09: Trial | 14 days CLUB, no card, configurable | Reversible | Config value change |
| D-10: Trial expiry | Lock features, keep data, retain FREE | Reversible | Expiry behavior config |
| D-11: Empty states | Contextual per section with CTA | Reversible | Component content |
| D-12: First use | No forced order, user picks | Reversible | UX flow |
| D-13: Nav visibility | Full nav shown, unavailable grayed out | Reversible | Nav visibility logic |

---

## 14. Testing Strategy for Phase 1

### Unit Tests
- Zod schema validation (all form schemas)
- Utility functions (slug generation, date formatting)
- Navigation item filtering by role

### Integration Tests
- Auth flow: signup -> verify -> login -> create org -> dashboard
- RLS isolation: two organizations, cross-org query attempts
- Role permissions: each role sees only permitted resources
- Entitlement checks: FREE plan limits enforced

### Security Tests
- Cross-tenant data access attempts (Org A trying to read Org B)
- Unauthorized role escalation attempts
- service_role key exposure audit
- user_metadata usage audit (should be zero for auth)

### Manual Tests
- Mobile responsive: sidebar collapse, bottom nav, form usability
- i18n: locale switching, formatting, RTL support preparation
- PWA: install prompt, offline fallback

---

*Phase: 1-Foundation*
*Research completed: 2026-08-27*
*Next: 03-PLAN.md (implementation planning)*