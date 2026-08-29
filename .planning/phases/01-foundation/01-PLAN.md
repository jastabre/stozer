---
phase: 01-foundation
plan: 01
type: execute
wave: 1
depends_on: ["01-00"]
files_modified:
  - package.json
  - tsconfig.json
  - next.config.ts
  - tailwind.config.ts
  - .env.local.example
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/app/globals.css
  - src/app/(auth)/register/page.tsx
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/verify/page.tsx
  - src/app/(auth)/reset-password/page.tsx
  - src/app/[locale]/layout.tsx
  - src/app/[locale]/onboarding/page.tsx
  - src/app/[locale]/onboarding/actions.ts
  - src/app/[locale]/(dashboard)/layout.tsx
  - src/app/[locale]/(dashboard)/page.tsx
  - src/components/layout/Sidebar.tsx
  - src/components/layout/Header.tsx
  - src/components/layout/EmptyState.tsx
  - src/components/layout/UserMenu.tsx
  - src/components/layout/NavItem.tsx
  - src/components/layout/BottomNav.tsx
  - src/components/auth/*.tsx
  - src/components/onboarding/*.tsx
  - src/components/subscription/LockedFeature.tsx
  - src/components/subscription/PlanBadge.tsx
  - src/components/subscription/UpgradeCTA.tsx
  - src/components/providers/SerwistProvider.tsx
  - src/lib/supabase/browser.ts
  - src/lib/supabase/server.ts
  - src/lib/supabase/middleware.ts
  - src/lib/auth.ts
  - src/lib/entitlements.ts
  - src/lib/rbac.ts
  - src/lib/organization.ts
  - src/i18n/request.ts
  - src/i18n/routing.ts
  - src/schemas/auth.ts
  - src/schemas/onboarding.ts
  - src/types/database.ts
  - src/types/navigation.ts
  - src/middleware.ts
  - messages/sr.json
  - messages/en.json
  - supabase/migrations/00001_foundation.sql
  - supabase/config.toml
  - public/manifest.json
  - public/icons/
  - public/offline.html
autonomous: false
requirements:
  - CORE-01
  - CORE-02
  - CORE-03
  - CORE-04
  - CORE-06
  - CORE-07
  - CORE-08
  - CORE-09
user_setup:
  - service: supabase
    why: "Supabase project required for database, auth, and RLS"
    env_vars:
      - name: NEXT_PUBLIC_SUPABASE_URL
        source: "Supabase Dashboard → Project Settings → API → Project URL"
      - name: NEXT_PUBLIC_SUPABASE_ANON_KEY
        source: "Supabase Dashboard → Project Settings → API → anon/public key"

must_haves:
  truths:
    - "User can sign up with email/password and verify their email"
    - "First user of a new org becomes club_president with full access"
    - "Two different organizations see completely isolated data (RLS enforced)"
    - "App shell loads with sidebar navigation and Serbian Latin text"
    - "Subscription status visible, locked features show inline upgrade CTA"
    - "Trial starts at 14 days, locks CLUB features on expiry"
    - "Coach sees 4-tab bottom nav on mobile, other roles see hamburger sidebar"
    - "PWA is installable, offline fallback page works"
    - "All UI strings go through next-intl, sr-Latn is default locale"
  artifacts:
    - path: "src/middleware.ts"
      provides: "Auth + org routing middleware"
      exports: ["middleware"]
    - path: "src/lib/supabase/server.ts"
      provides: "Server-side Supabase client with org resolution"
      exports: ["createServerClient"]
    - path: "src/lib/organization.ts"
      provides: "Org context provider, requireOrganization()"
      exports: ["requireOrganization", "getOrganizationContext"]
    - path: "src/lib/rbac.ts"
      provides: "Role-based navigation configs and authorize() reference"
      exports: ["navConfigs"]
    - path: "src/lib/entitlements.ts"
      provides: "checkEntitlement(), is_trial_active(), is_feature_locked()"
      exports: ["checkEntitlement", "is_trial_active", "is_feature_locked"]
    - path: "supabase/migrations/00001_foundation.sql"
      provides: "All 7 tables, RLS policies, seed data, PostgreSQL functions"
      contains: "CREATE TABLE"
    - path: "src/app/[locale]/(dashboard)/layout.tsx"
      provides: "Dashboard shell with sidebar, org context, role-based nav"
    - path: "messages/sr.json"
      provides: "Complete Serbian Latin translations"
    - path: "messages/en.json"
      provides: "Complete English translations"
    - path: "public/manifest.json"
      provides: "PWA manifest"
  key_links:
    - from: "src/middleware.ts"
      to: "src/lib/supabase/middleware.ts"
      via: "Middleware creates Supabase client to read JWT claims"
      pattern: "createMiddlewareClient"
    - from: "src/app/[locale]/(dashboard)/layout.tsx"
      to: "src/lib/organization.ts"
      via: "Dashboard layout calls requireOrganization() to validate access"
      pattern: "requireOrganization"
    - from: "src/lib/rbac.ts"
      to: "src/components/layout/Sidebar.tsx"
      via: "Sidebar reads role from JWT and filters nav items per role config"
      pattern: "navConfigs"
    - from: "src/lib/entitlements.ts"
      to: "src/components/subscription/LockedFeature.tsx"
      via: "LockedFeature checks is_feature_locked() to show lock icon + CTA"
      pattern: "is_feature_locked"
    - from: "src/app/[locale]/onboarding/actions.ts"
      to: "supabase/migrations/00001_foundation.sql"
      via: "Onboarding action creates org + membership + subscription in single transaction"
      pattern: "organization_id"
    - from: "src/lib/supabase/server.ts"
      to: "src/lib/organization.ts"
      via: "Server client provides session used by requireOrganization()"
      pattern: "createServerClient"
---

<objective>
Build the complete multi-tenant Foundation for STOZER: project scaffold, database schema with RLS, auth flow with organization onboarding, i18n with Serbian Latin, role-based sidebar navigation, subscription entitlements, RBAC enforcement, mobile optimization, PWA, and security verification.

Purpose: Establish every architectural pattern that all subsequent phases build upon — multi-tenant isolation, auth, RBAC, subscription gating, i18n, and the app shell.
Output: A working Next.js + Supabase app where a user can sign up, create a club, and see a role-appropriate dashboard with Serbian Latin text, subscription awareness, and PWA installability.
</objective>

<execution_context>
@C:/jastaBre_labs/stozer/.opencode/gsd-core/workflows/execute-plan.md
@C:/jastaBre_labs/stozer/.opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/01-foundation/02-RESEARCH.md
@.planning/phases/01-foundation/03-SKELETON.md
@STOZER-BRIEF.md
</context>

<tasks>

<!-- ============================================================ -->
<!-- WAVE 1: Walking Skeleton                                       -->
<!-- Thinnest working stack proving full architecture end-to-end.  -->
<!-- After Wave 1: user can sign up, create club, see dashboard.   -->
<!-- ============================================================ -->

<task type="auto">
  <name>Task 1.1: Project Scaffold + Supabase Client Setup</name>
  <files>package.json, tsconfig.json, next.config.ts, tailwind.config.ts, .env.local.example, src/app/layout.tsx, src/app/page.tsx, src/app/globals.css, src/lib/supabase/browser.ts, src/lib/supabase/server.ts, src/lib/supabase/middleware.ts</files>
  <read_first>STOZER-BRIEF.md, .planning/phases/01-foundation/03-SKELETON.md</read_first>
  <action>
Initialize Next.js 15 project with TypeScript strict mode and App Router. Install and configure Tailwind CSS 4 and shadcn/ui (New York style, neutral palette). Set up ESLint + Prettier. Create directory structure per SKELETON.md: src/app, src/components, src/lib, src/schemas, src/types, messages/.

Install @supabase/ssr + @supabase/supabase-js. Create three Supabase client helpers:
- src/lib/supabase/browser.ts: createBrowserClient() using createBrowserClient from @supabase/ssr
- src/lib/supabase/server.ts: createServerClient() using createServerClient from @supabase/ssr, reads cookies()
- src/lib/supabase/middleware.ts: createMiddlewareClient() using createServerClient from @supabase/ssr, reads/sets request/response cookies

Configure environment variables in .env.local.example: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.

Create root layout with html/body/fonts. Create one placeholder route to prove routing works.
  </action>
  <verify>npm run build exits 0; npm run dev starts on port 3000; npm run lint passes; Supabase client helpers importable without errors</verify>
  <acceptance_criteria>
    - package.json contains "next", "react", "@supabase/ssr", "@supabase/supabase-js", "tailwindcss"
    - src/lib/supabase/browser.ts exports createBrowserClient function
    - src/lib/supabase/server.ts exports createServerClient function
    - src/lib/supabase/middleware.ts exports createMiddlewareClient function
    - .env.local.example contains NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
    - npm run build exits with code 0
    - npm run lint passes
  </acceptance_criteria>
  <done>Dev server starts on port 3000, build succeeds, Supabase client helpers are importable, placeholder route renders</done>
</task>

<task type="auto">
  <name>Task 1.2: Database Foundation — Schema + RLS + Seed</name>
  <files>supabase/migrations/00001_foundation.sql, supabase/config.toml, src/types/database.ts</files>
  <read_first>.planning/phases/01-foundation/03-SKELETON.md §Database Schema, STOZER-BRIEF.md §4-6</read_first>
  <action>
Write first SQL migration (supabase/migrations/00001_foundation.sql) creating:

Enums:
- app_role: club_president, youth_director, coach, admin_finance, super_admin
- app_permission: teams.view, teams.create, teams.edit, teams.delete, athletes.view, athletes.create, athletes.edit, athletes.delete, athletes.view_sensitive, athletes.edit_sensitive, attendance.manage, youth_finance.view, youth_finance.manage, first_team_finance.view, first_team_finance.manage, registrations.view, registrations.manage, contracts.view, contracts.manage, documents.view, documents.manage, sponsors.view, sponsors.manage, staff.view, staff.manage, reports.view, reports.export, club_settings.manage, notifications.manage

Tables (organization_id as FIRST column in composite indexes):
- organizations: id uuid PK, name text NOT NULL, sport text, country text, language text DEFAULT 'sr', currency text DEFAULT 'RSD', timezone text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
- organization_memberships: id uuid PK, organization_id uuid FK, user_id uuid FK, role app_role NOT NULL, created_at timestamptz DEFAULT now(), UNIQUE(organization_id, user_id)
- roles: id uuid PK, name app_role UNIQUE NOT NULL, display_name text NOT NULL
- role_permissions: id uuid PK, role app_role NOT NULL, permission app_permission NOT NULL, UNIQUE(role, permission)
- plans: id uuid PK, name text UNIQUE NOT NULL, display_name text NOT NULL, is_active boolean DEFAULT true
- plan_entitlements: id uuid PK, plan_id uuid FK, key text NOT NULL, value integer NOT NULL, UNIQUE(plan_id, key)
- subscriptions: id uuid PK, organization_id uuid FK, plan_id uuid FK NOT NULL, status text DEFAULT 'active', trial_starts_at timestamptz, trial_ends_at timestamptz, created_at timestamptz DEFAULT now()

Enable FORCE ROW LEVEL SECURITY on every table.

Create PostgreSQL functions:
- current_organization_id(): SECURITY DEFINER, STABLE, returns uuid from current_setting('request.jwt.claims', true)::json->>'organization_id'
- authorize(p app_permission): SECURITY DEFINER, STABLE, returns boolean by checking role_permissions for current user's role via current_setting('request.jwt.claims', true)::json->>'user_role'

RLS policies:
- organizations: SELECT for members (org_id matches), INSERT for authenticated
- organization_memberships: SELECT/INSERT/UPDATE/DELETE scoped by organization_id
- roles, role_permissions, plans, plan_entitlements: SELECT for authenticated (shared reference data)
- subscriptions: SELECT/INSERT/UPDATE scoped by organization_id

Updated_at trigger function on organizations and subscriptions.

Seed data:
- 3 plans: FREE, CLUB, PRO
- Plan entitlements: max_teams (1/999/999), max_players (20/9999/99999), max_staff (2/999/9999), max_sports (1/999/999)
- 5 roles with display names
- Full permission mappings: club_president gets all, youth_director/coach/admin_finance get subsets per STOZER-BRIEF

Create supabase/config.toml for local development. Generate src/types/database.ts types.
  </action>
  <verify>supabase db reset succeeds; SQL: SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('organizations','organization_memberships','roles','role_permissions','plans','plan_entitlements','subscriptions') returns 7; SQL: SELECT * FROM plans returns FREE/CLUB/PRO; SQL: SELECT count(*) FROM role_permissions WHERE role='club_president' returns count matching app_permission enum size</verify>
  <acceptance_criteria>
    - supabase/migrations/00001_foundation.sql contains CREATE TABLE for all 7 tables
    - supabase/migrations/00001_foundation.sql contains ALTER TABLE ... ENABLE FORCE ROW LEVEL SECURITY for all tables
    - supabase/migrations/00001_foundation.sql contains CREATE POLICY for organizations, organization_memberships, subscriptions
    - supabase/migrations/00001_foundation.sql contains CREATE FUNCTION current_organization_id
    - supabase/migrations/00001_foundation.sql contains CREATE FUNCTION authorize
    - supabase/migrations/00001_foundation.sql contains INSERT INTO plans for FREE, CLUB, PRO
    - supabase/migrations/00001_foundation.sql contains INSERT INTO role_permissions for all role-permission combos
    - src/types/database.ts contains Database interface with all 7 table types
  </acceptance_criteria>
  <done>All 7 tables created with RLS enforced, seed data correct, authorize() function callable, types generated</done>
</task>

<task type="auto">
  <name>Task 1.3: Auth Flow + Organization Onboarding + Dashboard Shell (TRACER)</name>
  <files>src/app/(auth)/register/page.tsx, src/app/(auth)/login/page.tsx, src/app/(auth)/verify/page.tsx, src/app/(auth)/reset-password/page.tsx, src/middleware.ts, src/app/[locale]/onboarding/page.tsx, src/app/[locale]/onboarding/actions.ts, src/app/[locale]/(dashboard)/layout.tsx, src/app/[locale]/(dashboard)/page.tsx, src/schemas/auth.ts, src/schemas/onboarding.ts, src/lib/auth.ts, src/components/auth/*.tsx, src/components/onboarding/*.tsx</files>
  <read_first>.planning/phases/01-foundation/03-SKELETON.md §Directory Structure, src/lib/supabase/server.ts</read_first>
  <action>
Create auth pages under src/app/(auth)/:
- /register: email + password + display name form using React Hook Form + Zod. Calls supabase.auth.signUp(). Shows "check your email" on success.
- /login: email + password form. Calls supabase.auth.signInWithPassword(). Redirects to /dashboard (or /onboarding if no org).
- /verify: handles email verification callback from Supabase, redirects to /onboarding.
- /reset-password: email form -> Supabase sends reset link -> new password form -> redirect to /login.

Create auth middleware (src/middleware.ts):
- Check JWT for app_metadata.organization_id using createMiddlewareClient
- Unauthenticated -> redirect to /login
- Authenticated + no org -> redirect to /onboarding
- Authenticated + has org -> pass through
- NO database calls (JWT claims only, target < 50ms)
- Matcher excludes /api/*, /_next/*, static files, /favicon.ico

Create Zod schemas: src/schemas/auth.ts (register, login, reset-password), src/schemas/onboarding.ts (club name, sport, country, language, currency, timezone).

Create onboarding page (src/app/[locale]/onboarding/page.tsx):
- Single-step form: club name, sport (football/basketball dropdown), country, language (sr-Latn/en), currency, timezone (auto-suggested)
- React Hook Form with Zod resolver

Create onboarding Server Action (src/app/[locale]/onboarding/actions.ts):
1. Resolve user from session via createServerClient -> getUser()
2. Validate input with Zod
3. Create organization record
4. Create organization_membership with role = club_president (D-05: first user is always president)
5. Create default subscription (FREE plan, 14-day trial)
6. Set JWT claims (organization_id, user_role) via Supabase Admin API
7. Revalidate and redirect to /dashboard
8. All in a single database transaction

Create minimal dashboard (src/app/[locale]/(dashboard)/page.tsx):
- Server Component reading org name from JWT/session
- Displays "Welcome to {org_name}" with basic sidebar showing org name and user email
- Placeholder nav items (full nav in Task 2.1)
  </action>
  <verify>Full user flow: register -> email verify -> login -> create org "FK Partizan" -> dashboard shows org name. Second user registers -> creates "Crvena Zvezda" -> both see only their own org.</verify>
  <acceptance_criteria>
    - src/middleware.ts contains redirect to /login for unauthenticated
    - src/middleware.ts contains redirect to /onboarding for authenticated without org
    - src/middleware.ts matcher excludes /api/*, /_next/*, static files
    - src/app/(auth)/register/page.tsx contains signUp call
    - src/app/(auth)/login/page.tsx contains signInWithPassword call
    - src/app/[locale]/onboarding/actions.ts contains organization creation and membership creation
    - src/app/[locale]/(dashboard)/page.tsx renders org name from session
    - Two different orgs are isolated: Partizan user cannot see Zvezda data
  </acceptance_criteria>
  <done>Full signup -> verify -> create org -> dashboard flow works. Two organizations are completely isolated.</done>
</task>

<task type="auto">
  <name>Task 1.4: i18n Foundation</name>
  <files>src/i18n/request.ts, src/i18n/routing.ts, messages/sr.json, messages/en.json, src/app/[locale]/layout.tsx, all auth pages, onboarding, dashboard</files>
  <read_first>.planning/phases/01-foundation/03-SKELETON.md §Directory Structure</read_first>
  <action>
Install and configure next-intl v3+. Create i18n middleware for locale routing:
- Locales: ['sr', 'en'], default: 'sr', prefix: 'always' (/sr/dashboard, /en/dashboard)
- Matcher excludes API routes, static files, Next.js internals

Create translation files:
- messages/sr.json (primary, complete for ALL skeleton UI strings including auth, onboarding, dashboard, navigation, common, subscription)
- messages/en.json (secondary, complete)

Set up next-intl providers:
- src/i18n/request.ts: server-side request config
- src/i18n/routing.ts: locale routing config
- NextIntlClientProvider in root layout

Configure date/number/currency formatting per locale. Migrate ALL existing UI strings to use translation keys. Set up locale-aware metadata.

Translation key structure must include: auth.login.*, auth.register.*, onboarding.*, dashboard.*, navigation.*, subscription.*, common.*
  </action>
  <verify>Navigate to /sr/dashboard -> all text in Serbian Latin; Navigate to /en/dashboard -> all text in English; grep -r "Hardcoded" src/app/ returns no string literals in JSX</verify>
  <acceptance_criteria>
    - messages/sr.json contains keys for auth.login, auth.register, onboarding, dashboard, navigation, subscription, common
    - messages/en.json contains matching keys for all sr.json keys
    - src/i18n/routing.ts exports locales as ['sr', 'en'] with defaultLocale 'sr'
    - No hardcoded UI string literals remain in JSX (grep for common words like "Submit", "Cancel", "Save" in src/app/ returns 0 matches in JSX contexts)
    - /sr/ routes display Serbian Latin text
    - /en/ routes display English text
  </acceptance_criteria>
  <done>All UI strings go through next-intl, locale switching works, sr-Latn is default, en is complete</done>
</task>

<task type="auto">
  <name>Task 1.5: App Shell — Sidebar + Layout + Responsive</name>
  <files>src/app/[locale]/(dashboard)/layout.tsx, src/components/layout/Sidebar.tsx, src/components/layout/Header.tsx, src/components/layout/EmptyState.tsx, src/components/layout/UserMenu.tsx, src/app/globals.css</files>
  <read_first>.planning/phases/01-foundation/03-SKELETON.md §Directory Structure, src/app/[locale]/(dashboard)/layout.tsx</read_first>
  <action>
Build dashboard layout (src/app/[locale]/(dashboard)/layout.tsx) with left sidebar containing: logo placeholder, org name, user email, nav items (placeholder labels — full nav in Task 2.1), user menu (logout).

Design system foundation in src/app/globals.css:
- CSS variables for club accent colors: --primary, --primary-foreground (overridden per-org in Phase 6)
- Neutral base palette: whites, grays, clean typography
- shadcn/ui theme configured for clean/neutral direction

Responsive layout:
- Desktop (>= 768px): sidebar visible, collapsible
- Mobile (< 768px): sidebar hidden, hamburger menu triggers slide-out overlay
- Minimum touch target: 44px

Create EmptyState component (src/components/layout/EmptyState.tsx): title, description, CTA button.
Create UserMenu component (src/components/layout/UserMenu.tsx): display name, email, logout button, settings link (placeholder).
  </action>
  <verify>Desktop: sidebar visible with org name, user email, nav placeholders; Resize to mobile: sidebar collapses, hamburger appears; Click hamburger: sidebar slides in as overlay</verify>
  <acceptance_criteria>
    - src/components/layout/Sidebar.tsx renders org name and user email
    - src/components/layout/Sidebar.tsx has hamburger toggle for mobile (< 768px)
    - src/components/layout/Sidebar.tsx slide-out is full-height overlay (not push layout)
    - src/components/layout/EmptyState.tsx renders title, description, CTA
    - src/components/layout/UserMenu.tsx renders user info and logout
    - src/app/globals.css contains --primary CSS variable
    - All interactive elements have minimum 44px touch target (height/width >= 44px)
  </acceptance_criteria>
  <done>Sidebar renders correctly at all breakpoints, design is clean/neutral with accent colors, empty state pattern exists</done>
</task>

<!-- ============================================================ -->
<!-- WAVE 2: Expansion                                              -->
<!-- Role-based nav, subscriptions, RBAC, mobile, PWA.             -->
<!-- After Wave 2: complete multi-tenant shell with all features.  -->
<!-- ============================================================ -->

<task type="auto">
  <name>Task 2.1: Full Role-Based Sidebar Navigation</name>
  <files>src/lib/rbac.ts, src/components/layout/Sidebar.tsx, src/components/layout/NavItem.tsx</files>
  <read_first>src/components/layout/Sidebar.tsx, STOZER-BRIEF.md §17-19, src/lib/auth.ts</read_first>
  <action>
Define navigation configs per role in src/lib/rbac.ts:
- Club President (D-01): 8 sections — Pocetna, Timovi, Ljudi, Kalendar, Finansije, Dokumenta, Izvestaji, Klub
- Youth Director: 5 sections — Pocetna, Omladinska skola, Kalendar, Dokumenta, Izvestaji
- Coach: 4 mobile-first items — Danas, Tim, Kalendar, Vise
- Admin/Finance: configurable scope based on assigned permissions (Dashboard, Members, Finances, Reports, Settings — filtered by RBAC)

Navigation items include:
- Lucide icons (consistent icon system)
- Serbian and English labels via translation keys
- Active state highlighting (current route)
- Tooltip on hover (desktop)

Navigation filtering logic:
- Read user_role from JWT app_metadata
- Filter nav items based on role
- Unavailable items (subscription-locked): grayed out, non-clickable (D-13)
- Permission-restricted items (role lacks permission): completely hidden (not shown as locked)

Create NavItem component (src/components/layout/NavItem.tsx): icon + label + active state + tooltip.
Update Sidebar.tsx with role-based filtering.
  </action>
  <verify>Login as club_president -> 8 sidebar items; Login as youth_director -> 5 items; Login as coach -> 4 items (Danas, Tim, Kalendar, Vise); Login as admin_finance -> Dashboard, Members, Finances, Reports, Settings; Current route highlighted; /sr/ labels in Serbian, /en/ labels in English</verify>
  <acceptance_criteria>
    - src/lib/rbac.ts exports navConfigs object with keys: club_president, youth_director, coach, admin_finance
    - club_president config has exactly 8 nav items
    - youth_director config has exactly 5 nav items
    - coach config has exactly 4 nav items
    - admin_finance config has nav items filtered by user permissions
    - src/components/layout/Sidebar.tsx reads role from JWT and renders filtered nav
    - Subscription-locked items render with gray color and non-clickable state
    - Permission-restricted items are not rendered at all
  </acceptance_criteria>
  <done>Each role sees exactly the navigation items defined in STOZER-BRIEF sections 17-19. Locked items grayed, restricted items hidden.</done>
</task>

<task type="auto">
  <name>Task 2.2: Subscription Entitlements + Trial Management</name>
  <files>src/components/subscription/LockedFeature.tsx, src/components/subscription/PlanBadge.tsx, src/components/subscription/UpgradeCTA.tsx, src/lib/entitlements.ts</files>
  <read_first>STOZER-BRIEF.md §7, supabase/migrations/00001_foundation.sql, src/components/layout/Sidebar.tsx</read_first>
  <action>
Ensure plans + plan_entitlements are properly seeded (from Task 1.2):
- FREE: max_teams=1, max_players=20, max_staff=2, max_sports=1
- CLUB: max_teams=999, max_players=9999, max_staff=999, max_sports=999
- PRO: max_teams=999, max_players=99999, max_staff=9999, max_sports=999

Create Subscription status display in sidebar/header:
- Shows current plan name (FREE, CLUB, PRO) via PlanBadge component
- Shows trial status if on trial (e.g., "Trial: 12 days left")
- Shows "Upgrade" button if on FREE via UpgradeCTA component

Create LockedFeature wrapper component (src/components/subscription/LockedFeature.tsx):
- Props: feature name, description, children (locked content preview)
- Renders: lock icon + feature description + inline upgrade CTA button
- CTA links to /settings/upgrade (placeholder — payment in later phase)
- Two behaviors per brief section 7:
  1. Subscription locked (FREE plan, expired trial): visible with lock icon + upgrade CTA
  2. Permission denied (user lacks role): completely hidden

Implement trial management:
- Trial starts automatically on org creation (14 days, D-09)
- Trial dates stored in subscriptions.trial_starts_at, subscriptions.trial_ends_at
- On trial expiry (D-10): lock CLUB features, keep all data accessible, retain FREE features

Create src/lib/entitlements.ts with helpers:
- checkEntitlement(key): reads subscription -> plan -> entitlements, returns value or null
- is_trial_active(): checks trial_ends_at > now()
- is_feature_locked(feature_key): checks plan + trial status
  </action>
  <verify>FREE plan user: sidebar shows "FREE" badge, premium items show lock icon + tooltip; Click locked feature: sees description + "Upgrade to CLUB" CTA; CLUB plan user (trial active): all accessible, sidebar shows "Trial: X days left"; checkEntitlement('max_teams') returns 1 for FREE, 999 for CLUB</verify>
  <acceptance_criteria>
    - src/lib/entitlements.ts exports checkEntitlement, is_trial_active, is_feature_locked
    - src/components/subscription/LockedFeature.tsx renders lock icon + description + CTA
    - src/components/subscription/PlanBadge.tsx displays current plan name
    - checkEntitlement('max_teams') returns 1 for FREE plan subscription
    - checkEntitlement('max_teams') returns 999 for CLUB plan subscription
    - is_trial_active() returns true when trial_ends_at is in the future
    - is_trial_active() returns false when trial_ends_at is in the past
  </acceptance_criteria>
  <done>Subscription status visible, locked features show inline CTA, trial management works, checkEntitlement() ready for Phase 2+</done>
</task>

<task type="auto">
  <name>Task 2.3: RBAC Enforcement + Session Management</name>
  <files>src/lib/organization.ts, src/app/[locale]/(dashboard)/layout.tsx, src/lib/supabase/server.ts, src/middleware.ts</files>
  <read_first>src/lib/supabase/server.ts, src/middleware.ts, src/app/[locale]/(dashboard)/layout.tsx, STOZER-BRIEF.md §5-6</read_first>
  <action>
Create organization context provider (src/lib/organization.ts):
- Reads organization_id and user_role from JWT app_metadata
- Provides org context to dashboard layout and all child components
- Validates that user has at least one organization membership

Server-side permission checks in dashboard layout:
- Before rendering any dashboard page, verify user has valid org membership
- If no org -> redirect to /onboarding
- If membership revoked -> redirect to /login with message

JWT claims refresh mechanism:
- After role changes, force session refresh
- Helper: refreshSession() that calls supabase.auth.getSession() to get fresh JWT

Organization context for Server Actions:
- Every Server Action starts by resolving org from session
- Pattern: const orgId = await requireOrganization(session) — throws if no valid org
- Used as the first line in every future Server Action

Data scoping preparation:
- Document pattern: every query must include .eq('organization_id', orgId)
- createServerClient helper includes org_id resolution
  </action>
  <verify>Unauthenticated -> /login; Authenticated no org -> /onboarding; Authenticated with org -> dashboard loads; Org name in sidebar; Logout -> session cleared -> /login; JWT contains organization_id and user_role in app_metadata</verify>
  <acceptance_criteria>
    - src/lib/organization.ts exports requireOrganization function
    - src/lib/organization.ts exports getOrganizationContext function
    - src/app/[locale]/(dashboard)/layout.tsx calls requireOrganization before rendering
    - Unauthenticated request to /dashboard redirects to /login
    - Authenticated request with no org redirects to /onboarding
    - JWT decoded token contains organization_id in app_metadata
    - JWT decoded token contains user_role in app_metadata
  </acceptance_criteria>
  <done>Server-side RBAC foundation works, org context available to all dashboard routes, middleware correctly routes based on auth + org status</done>
</task>

<task type="auto">
  <name>Task 2.4: Responsive Mobile Optimization</name>
  <files>src/components/layout/BottomNav.tsx, src/components/layout/Sidebar.tsx, src/app/globals.css, src/app/[locale]/(dashboard)/layout.tsx</files>
  <read_first>src/components/layout/Sidebar.tsx, src/app/globals.css, STOZER-BRIEF.md §12</read_first>
  <action>
Create bottom tab navigation for coach role on mobile (src/components/layout/BottomNav.tsx):
- 4 tabs: Danas (home icon), Tim (users icon), Kalendar (calendar icon), Vise (more icon)
- Fixed bottom bar, 56px height, visible only on mobile (< 768px)
- Active tab highlighted with accent color
- "Vise" opens a sheet/drawer with remaining nav items

Update Sidebar behavior on mobile:
- Hidden by default
- Hamburger icon in top-left triggers slide-out
- Full-height overlay (not push), tap outside or swipe to close
- Backdrop overlay with 50% opacity

Responsive form layouts:
- Onboarding form: single column on mobile, two columns on desktop
- Form inputs: full-width on mobile, appropriate max-width on desktop
- Submit button: full-width on mobile

Touch-friendly targets:
- Minimum 44px for all interactive elements
- 8px minimum spacing between clickable items
- Form inputs: 48px height on mobile

Update dashboard layout to conditionally render BottomNav for coach role on mobile.
  </action>
  <verify>Mobile (coach): bottom 4-tab nav visible, sidebar hidden; Click hamburger: sidebar slides in, tap outside closes; Mobile (president): bottom nav hidden, hamburger sidebar works; Forms usable on 375px width; All touch targets >= 44px; No horizontal scrolling at 375px</verify>
  <acceptance_criteria>
    - src/components/layout/BottomNav.tsx renders 4 tabs for coach role
    - BottomNav is visible only when window width < 768px
    - BottomNav has fixed position at bottom, height 56px
    - Sidebar on mobile is full-height overlay (not push)
    - All interactive elements have min 44px touch target
    - Forms at 375px width have no horizontal overflow
    - BottomNav conditionally renders only for coach role
  </acceptance_criteria>
  <done>Coach mobile experience is excellent (4-tab bottom nav), all layouts responsive, forms usable on small screens</done>
</task>

<task type="auto">
  <name>Task 2.5: PWA Foundation</name>
  <files>public/manifest.json, public/icons/, public/offline.html, src/components/providers/SerwistProvider.tsx, src/app/layout.tsx</files>
  <read_first>src/app/layout.tsx, STOZER-BRIEF.md §16</read_first>
  <action>
Install and configure Serwist (@serwist/next).

Create public/manifest.json:
- name: "STOZER", short_name: "STOZER", description: "Sports club management"
- start_url: "/sr/dashboard", display: "standalone"
- theme_color: "#ffffff", background_color: "#ffffff"
- icons: placeholder SVG icons (192x192, 512x512)

Create service worker configuration:
- NetworkFirst for API data (stale-while-revalidate fallback)
- StaleWhileRevalidate for static assets (CSS, JS, fonts)
- CacheFirst for images
- Offline fallback page

Create SerwistProvider (src/components/providers/SerwistProvider.tsx) and add to root layout.
Create public/offline.html as offline fallback page.
Configure Next.js for PWA headers.
  </action>
  <verify>Lighthouse PWA audit passes; Chrome DevTools > Application: manifest detected, service worker registered; Disconnect network -> /sr/dashboard -> offline fallback; Reconnect -> app recovers</verify>
  <acceptance_criteria>
    - public/manifest.json exists with name "STOZER", start_url "/sr/dashboard", display "standalone"
    - public/manifest.json has icons array with 192x192 and 512x512 entries
    - src/components/providers/SerwistProvider.tsx exists and is imported in root layout
    - public/offline.html exists with fallback content
    - Service worker registers successfully (no console errors)
  </acceptance_criteria>
  <done>PWA is installable, service worker registered, offline fallback works</done>
</task>

<!-- ============================================================ -->
<!-- WAVE 3: Verification                                           -->
<!-- Final verification that all success criteria are met.         -->
<!-- ============================================================ -->

<task type="auto">
  <name>Task 3.1: RLS Security Verification</name>
  <files>supabase/migrations/00001_foundation.sql</files>
  <read_first>supabase/migrations/00001_foundation.sql, src/lib/supabase/server.ts</read_first>
  <action>
Seed two test organizations with distinct data:
- "FK Partizan" (football, Serbia, club_president user: partizan@example.com)
- "Crvena Zvezda" (football, Serbia, club_president user: zvezda@example.com)

Verify RLS isolation via direct SQL:
- Connect as Partizan user -> query organizations -> see only Partizan
- Connect as Zvezda user -> query organizations -> see only Zvezda
- Attempt cross-org read -> returns empty (RLS filters silently)
- Attempt cross-org write -> blocked by RLS policy

Verify RLS isolation via application layer:
- Login as Partizan -> dashboard shows only Partizan data
- Login as Zvezda -> dashboard shows only Zvezda data
- Tamper with JWT organization_id -> RLS still enforces correct isolation

Verify FORCE ROW LEVEL SECURITY on all tables:
- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' -> all true

Audit for service_role key exposure:
- grep -r "service_role" src/ -> zero results in client code
- service_role only in server-side code (Server Actions, API routes)

Audit for user_metadata authorization:
- grep -r "user_metadata" src/ -> zero results for authorization
- Only app_metadata used for org_id and role

Verify RLS policies cover INSERT, UPDATE, DELETE (not just SELECT).
  </action>
  <verify>SQL: Partizan user queries organizations -> 1 row; SQL: Zvezda user queries organizations -> 1 row; SQL: cross-org query returns 0 rows; FORCE RLS on all tables; service_role grep: zero in src/components/ and src/app/; user_metadata grep: zero for authorization</verify>
  <acceptance_criteria>
    - Partizan user SQL query on organizations returns exactly 1 row
    - Zvezda user SQL query on organizations returns exactly 1 row
    - Cross-org SQL query (Partizan accessing Zvezda org_id) returns 0 rows
    - All tables have rowsecurity = true (FORCE RLS)
    - grep -r "service_role" src/components/ src/app/ returns 0 matches
    - grep -r "user_metadata" src/ returns 0 matches used for authorization
    - RLS policies exist with WITH CHECK on INSERT, USING+WITH CHECK on UPDATE, USING on DELETE
  </acceptance_criteria>
  <done>Complete tenant isolation verified, no security violations, RLS enforced on all tables</done>
</task>

<task type="auto">
  <name>Task 3.2: Phase 1 Integration Verification</name>
  <files></files>
  <read_first>.planning/ROADMAP.md, .planning/phases/01-foundation/01-PLAN.md</read_first>
  <action>
Full flow per role (MVP-mode user walk-through):
1. Register -> verify -> login -> create org -> dashboard (president flow)
2. Login (existing user) -> dashboard with correct org context
3. Second user register -> create different org -> isolated dashboard

Role-based navigation verification:
- President: 8 sidebar items visible
- Youth Director: 5 sidebar items visible
- Coach: 4 bottom-tab items on mobile, 4 sidebar items on desktop
- Admin/Finance: finance/registration/contract modules only

Trial flow:
- New org starts with 14-day CLUB trial
- Sidebar shows trial badge with days remaining
- Simulate expiry: set trial_ends_at to past -> CLUB features lock
- FREE features remain accessible

i18n verification:
- /sr/ routes: all text in Serbian Latin
- /en/ routes: all text in English
- Locale switching preserves page
- Date formatting: sr = "27. avgust 2026.", en = "August 27, 2026"

Mobile responsive verification:
- Sidebar collapses at < 768px
- Coach bottom nav appears on mobile
- Forms usable at 375px width

Build verification:
- npm run typecheck (tsc --noEmit) -> passes
- npm run lint (next lint) -> passes
- npm run build (next build) -> passes, no errors

Security audit:
- No service_role in client code
- No user_metadata used for authorization
- All Server Actions resolve org from session (not client input)
- JWT claims set server-side only
  </action>
  <verify>npm run typecheck passes; npm run lint passes; npm run build passes; All 5 ROADMAP.md success criteria verified</verify>
  <acceptance_criteria>
    - npm run typecheck exits with code 0
    - npm run lint exits with code 0
    - npm run build exits with code 0
    - ROADMAP.md success criterion 1: signup + email verify works
    - ROADMAP.md success criterion 2: first user is org owner (club_president)
    - ROADMAP.md success criterion 3: two orgs have isolated data (RLS enforced)
    - ROADMAP.md success criterion 4: app shell loads with nav, sr-Latn text, neutral design
    - ROADMAP.md success criterion 5: org switching deferred (data model supports it)
    - No service_role in src/components/ or src/app/ client code
    - No user_metadata used for authorization decisions
  </acceptance_criteria>
  <done>All ROADMAP.md success criteria for Phase 1 are verified, build passes, no security violations</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] npm run build exits with code 0
- [ ] npm run lint exits with code 0
- [ ] npm run typecheck exits with code 0
- [ ] Dev server starts on port 3000 without console errors
- [ ] Full signup -> verify -> create org -> dashboard flow completes in < 2 minutes
- [ ] Two different orgs show isolated data (RLS enforced)
- [ ] All 7 database tables exist with RLS policies active
- [ ] authorize() function callable and returns correct boolean
- [ ] All UI strings go through next-intl translations
- [ ] /sr/ routes display Serbian Latin, /en/ routes display English
- [ ] 4 role nav configs match STOZER-BRIEF sections 17-19
- [ ] Subscription status visible, locked features show inline CTA
- [ ] Auth redirects work correctly (unauthenticated -> login, no org -> onboarding)
- [ ] Coach bottom nav appears on mobile (< 768px)
- [ ] All touch targets >= 44px
- [ ] PWA manifest detected, service worker registered
- [ ] Offline fallback page loads when network disconnected
- [ ] No service_role in client code (src/components/, src/app/ client components)
- [ ] No user_metadata used for authorization
</verification>

<success_criteria>
- All 12 tasks completed across 3 waves
- All ROADMAP.md success criteria for Phase 1 verified (signup, org creation, RLS isolation, app shell, deferred org switching)
- npm run build + lint + typecheck pass with zero errors
- Full tracer flow (signup -> verify -> create org -> dashboard) completes in < 2 minutes with zero errors
- Two orgs verified isolated via both SQL and application layer
- All gates G1-G11 pass with explicit pass/fail criteria
- No security violations: no service_role in client code, no user_metadata for auth
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-SUMMARY.md`
</output>

## Verification Gates

| Gate | Type | Task | Pass Criteria | Fail Criteria | Max Iterations |
|------|------|------|---------------|---------------|----------------|
| G1: Build Gate | Pre-flight | 1.1 | `npm run build` zero errors, dev server starts on port 3000, no console errors | Build fails, server won't start, or console errors present | 2 |
| G2: Database Gate | Pre-flight | 1.2 | All 7 tables exist, RLS policies active on all tables, seed data correct (3 plans, 5 roles, full permission mapping), `authorize()` function works | Missing tables, RLS disabled, seed data incomplete, function missing | 2 |
| G3: Tracer Gate | Revision | 1.3 | Signup -> email verify -> login -> create org -> dashboard completes in < 2 minutes, zero errors | Flow breaks at any step, takes > 2 min, or errors in console | 2 |
| G4: i18n Gate | Revision | 1.4 | All UI strings go through translations (zero hardcoded), locale switch works, sr-Latn primary | Hardcoded strings found, locale switch fails, sr missing translations | 2 |
| G5: Nav Gate | Revision | 2.1 | 4 role nav configs match brief sections 17-19 exactly, unavailable items grayed out, restricted items hidden | Wrong nav count, missing roles, locked items not grayed, restricted items visible | 2 |
| G6: Subscription Gate | Revision | 2.2 | FREE limits enforced, locked features visible with CTA, trial 14 days, `checkEntitlement()` returns correct values | Limits not enforced, CTA missing, trial wrong duration, entitlement returns wrong value | 2 |
| G7: RBAC Gate | Revision | 2.3 | Auth redirects work (unauthenticated -> login, no org -> onboarding), org context set, permissions enforced server-side | Redirects broken, org context missing, permissions not checked server-side | 2 |
| G8: Mobile Gate | Revision | 2.4 | Coach bottom nav on mobile, responsive at all breakpoints, touch targets >= 44px, no horizontal overflow at 375px | Bottom nav missing, layout broken on resize, touch targets < 44px, horizontal scroll | 2 |
| G9: PWA Gate | Escalation | 2.5 | Installable, offline fallback works, Lighthouse PWA score > 90 | Not installable, offline fails, Lighthouse < 90 | 1 (escalates to developer) |
| G10: Security Gate | Escalation | 3.1 | Two-org isolation verified (SQL + app layer), no data leaks, RLS enforced on all tables, no service_role in client code | Data leaks, RLS bypassed, service_role in client code, user_metadata for auth | 1 (escalates to developer) |
| G11: Phase Complete | Revision | 3.2 | All ROADMAP.md success criteria met, all tests pass, npm run build + lint + typecheck zero errors | Any success criteria unmet, build/lint/typecheck fails | 1 (escalates to developer) |

### Gate Iteration Rules

- **G3-G8 (Revision):** Max 2 iterations. After 2 failed iterations, escalate to developer with specific failure details.
- **G9, G10 (Escalation):** Max 1 iteration. Failure escalates immediately to developer for architectural decision.
- **G11 (Revision):** Max 1 iteration. Failure escalates to developer for root cause analysis.
- **Stall detection:** If issue count does not decrease between consecutive iterations, escalate early regardless of remaining iterations.
- **G1, G2 (Pre-flight):** Block entry. Fix precondition, then retry. No iteration cap (infinite retry until fixed).
