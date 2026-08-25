# Stack Research: STOZER

## Summary

STOZER is a multi-tenant SaaS platform for sports clubs (football, basketball) built on Next.js 15+ App Router, Supabase (PostgreSQL + Auth + Storage), Tailwind CSS, and shadcn/ui. The architecture uses row-level tenant isolation via `organization_id` on all business tables, enforced at the database layer with PostgreSQL RLS. The stack targets a modular monolith deployed on Vercel, with PWA support for mobile-first coach workflows, i18n in Serbian (Latin) and English, and multi-currency support.

---

## Frontend Framework

### Next.js 15+ App Router

- **Recommendation:** Next.js 15+ with App Router, React Server Components (RSC) as default, `"use client"` only when interactive state is needed.
- **Rationale:** RSC eliminates client-side waterfalls for data-heavy pages (rosters, match stats, attendance). Server components fetch tenant-scoped data directly without shipping JS to the client. The App Router's nested layouts map naturally to the tenant → organization → team → selection hierarchy. ISR (Incremental Static Regeneration) is available for marketing/landing pages but most dashboard pages will be dynamically rendered due to tenant context.
- **Pattern:** Server components fetch data; client components handle interactivity (forms, attendance toggles, modals). Pass translated strings and formatted data from server to client as props, not raw message keys.
- **Confidence:** High

### Project Structure

```
src/
├── app/
│   ├── (auth)/                    # Auth routes (login, register, reset)
│   │   ├── login/
│   │   └── register/
│   ├── (marketing)/               # Public pages (homepage, pricing, about)
│   ├── [locale]/                  # i18n locale segment
│   │   ├── (dashboard)/           # Authenticated app shell
│   │   │   ├── layout.tsx         # Sidebar, nav, tenant context
│   │   │   ├── page.tsx           # Dashboard overview
│   │   │   ├── teams/
│   │   │   ├── matches/
│   │   │   ├── attendance/
│   │   │   ├── finances/
│   │   │   └── settings/
│   │   └── layout.tsx             # Locale-aware root layout
│   ├── api/                       # Route handlers (webhooks, cron)
│   └── layout.tsx                 # Root layout (html, fonts, providers)
├── components/
│   ├── ui/                        # shadcn/ui primitives (auto-generated)
│   ├── dashboard/                 # Dashboard-specific components
│   ├── forms/                     # Form components (team, player, etc.)
│   └── shared/                    # Cross-cutting components
├── lib/
│   ├── supabase/                  # Client, server, middleware helpers
│   ├── i18n/                      # next-intl config
│   └── utils.ts                   # Shared utilities
├── hooks/                         # Custom React hooks
├── types/                         # Shared TypeScript types
└── middleware.ts                   # Auth + locale + tenant resolution
```

- **Confidence:** High

### Server Actions vs API Routes

- **Recommendation:** Use Server Actions for mutations (create/update/delete). Use Route Handlers for webhooks, cron jobs, and external integrations.
- **Rationale:** Server Actions eliminate boilerplate API route files for form submissions. They integrate natively with React's transition API for optimistic updates and pending states. Route Handlers are appropriate when you need raw HTTP control (webhook signature verification, streaming responses, non-JSON payloads).
- **Pattern:** Every Server Action that modifies data must: (1) resolve the active organization from the session, (2) verify the user's role, (3) execute within a Supabase transaction, (4) call `revalidatePath` or `revalidateTag` for cache invalidation.
- **Confidence:** High

---

## Component Library

### shadcn/ui

- **Recommendation:** shadcn/ui (latest) with Tailwind CSS 4.
- **Rationale:** Copy-paste component model means zero runtime dependencies and full code ownership. The bundle stays lean. Components are built on Radix UI primitives (headless, accessible). Integrates natively with Next.js App Router. The theming system uses CSS variables, which makes dark mode and custom branding straightforward. shadcn/ui is not an npm package you install — you copy components into your project and own the code.
- **Components to install:** Button, Card, Dialog, Sheet, Table, Form, Input, Select, Tabs, Sidebar, Command, Dropdown Menu, Avatar, Badge, Separator, Skeleton, Toast/Sonner, Tooltip, Popover, Calendar, DataTable, Chart.
- **Confidence:** High

### Tailwind CSS 4

- **Recommendation:** Tailwind CSS v4 (latest stable).
- **Rationale:** v4 uses a new engine with better performance. Pairs natively with shadcn/ui. Utility-first approach enables rapid prototyping of sports-specific UI patterns (match cards, player stats grids, attendance matrices). CSS variables for theming integrate with shadcn's theming system.
- **Confidence:** High

### What NOT to use:
- **MUI / Ant Design:** Too heavy, wrong aesthetic for a clean SaaS dashboard. Bundle size 100-500KB+.
- **Chakra UI:** Maintenance concerns, not aligned with the Tailwind ecosystem.
- **Radix Themes (standalone):** shadcn/ui already uses Radix primitives — adding Radix Themes creates redundancy.

---

## Data Tables

### TanStack Table v9

- **Recommendation:** TanStack Table v9 (headless) integrated with shadcn/ui DataTable component.
- **Rationale:** TanStack Table is the industry standard for headless React tables. v9 is the current major version. It handles sorting, filtering, pagination, row selection, and column visibility without imposing UI. The shadcn/ui DataTable pattern provides a pre-built wrapper with column definitions, toolbar, pagination, and search — you just define columns and fetch data.
- **Pattern:** Define column definitions in `schema/` files co-located with Zod schemas. Use server-side pagination for large lists (players, members, transactions). Client-side pagination acceptable for small datasets (team roster < 50 players).
- **Confidence:** High

---

## Forms

### React Hook Form + Zod

- **Recommendation:** React Hook Form with Zod resolver via `@hookform/resolvers`.
- **Rationale:** RHF is the mature, battle-tested choice. shadcn/ui's Form components integrate directly with RHF via `Controller`. Zod schemas serve as single source of truth for both client validation and server-side validation (in Server Actions). RHF's uncontrolled component model means minimal re-renders during typing — critical for complex forms like player registration with many fields.
- **Pattern:** Define Zod schemas in `schemas/` files. Use `z.infer<typeof schema>` for TypeScript types. Server Actions re-use the same Zod schemas for validation.
- **Alternative considered:** TanStack Form — newer, fine-grained reactivity, better for deeply nested dynamic arrays. However, RHF has wider adoption, more examples, and shadcn/ui's Form component is built for RHF. **Use RHF for now; consider TanStack Form if complex multi-step wizard forms emerge.**
- **Confidence:** High

---

## Charts & Visualization

### Recharts 3 (via shadcn/ui Chart)

- **Recommendation:** Recharts v3, used through shadcn/ui's Chart component wrapper.
- **Rationale:** shadcn/ui ships a `ChartContainer` and `ChartTooltip` that wrap Recharts and integrate with the CSS variable theming system. This means dark mode, custom club colors, and responsive sizing all work automatically. Recharts v3 (released Dec 2024) is a full TypeScript rewrite with a `useChart` hook, improved accessibility, and Web Animations API. At ~150KB it's lightweight enough. For a sports club dashboard, the common chart types (line, bar, area, pie/donut) are sufficient.
- **Chart use cases:** Attendance trends over season, revenue/expenses over time, player age distribution, match results summary, budget vs actuals.
- **Confidence:** High

### What NOT to use:
- **Nivo:** Too heavy (500KB+ full install), overkill for standard dashboard charts.
- **Chart.js:** Not React-native, poor SSR support.
- **Victory:** Maintenance concerns, less integration with Tailwind ecosystem.
- **D3 directly:** Too low-level for a dashboard. Recharts wraps D3 internally.

---

## Database

### PostgreSQL + Supabase

- **Recommendation:** Supabase as the database, auth, storage, and real-time layer. PostgreSQL 15+ with Row-Level Security (RLS).
- **Rationale:** Supabase provides a managed PostgreSQL with built-in Auth, Storage, Edge Functions, and Realtime — all things STOZER needs. RLS eliminates the risk of cross-tenant data leaks at the application code level. A single Supabase project with shared-schema multi-tenancy (all tenants in one database, `organization_id` on every table) is the right approach for early-to-mid stage SaaS. Schema-per-tenant or database-per-tenant can be added later for enterprise customers if needed.
- **Confidence:** High

### Multi-Tenant Data Model

```
organizations (tenants)
├── organization_members (user ↔ org mapping with role)
├── teams
│   ├── team_members (coach ↔ team)
│   ├── selections (age groups / categories)
│   │   ├── players
│   │   └── players_selections (many-to-many)
├── matches
├── attendance_records
├── financial_transactions
├── files (Supabase Storage references)
└── settings (org-level config, currency, timezone)
```

- Every business table has `organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`.
- Composite indexes: `(organization_id, created_at)` on all high-volume tables.
- `user_id` on rows where individual ownership matters (created_by, assigned_to).
- **Confidence:** High

### RLS Policies

- **Recommendation:** RLS on every table. Two-layer defense: application-level scoping + database-level RLS.
- **Pattern:**

```sql
-- Helper function (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT organization_id FROM public.organization_members
  WHERE user_id = auth.uid() AND status = 'active'
$$;

-- Example policy
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_can_read_teams"
  ON teams FOR SELECT TO authenticated
  USING (organization_id = any(public.get_user_organization_ids()));

CREATE POLICY "org_admins_can_write_teams"
  ON teams FOR ALL TO authenticated
  USING (
    organization_id = any(public.get_user_organization_ids())
    AND public.get_user_organization_role(auth.uid(), organization_id) IN ('owner', 'admin')
  )
  WITH CHECK (
    organization_id = any(public.get_user_organization_ids())
  );
```

- **Key rules:**
  - Every new table MUST have `ENABLE ROW LEVEL SECURITY` (and `FORCE ROW LEVEL SECURITY`).
  - INSERT policies need `WITH CHECK`, not `USING`.
  - UPDATE policies need both `USING` and `WITH CHECK`.
  - Helper functions must be `SECURITY DEFINER` and use `plpgsql` (not `sql`) to avoid inlining recursion.
  - Use `(SELECT auth.uid())` wrapper in policies for performance (evaluated once, not per row).
  - Add `(SELECT ...)` wrapper around JWT function calls in policies.
- **Confidence:** High

### Migration Strategy

- **Recommendation:** Supabase CLI migrations. All schema changes go through versioned SQL migration files. Never make manual changes to production.
- **Pattern:** `supabase migration new <name>` → edit SQL → `supabase db push` (dev) → `supabase db push` (prod via CI).
- **Confidence:** High

---

## Auth & Authorization

### Supabase Auth

- **Recommendation:** Supabase Auth (built-in) with email/password + optional social providers (Google for coaches/admins).
- **Rationale:** Supabase Auth integrates natively with RLS via `auth.uid()` and `auth.jwt()`. No need for a separate auth provider. The JWT's `app_metadata` can carry `organization_id` for the active org, which RLS policies read directly.
- **Invite flow:** Use Supabase's built-in invite flow for adding coaches/players. Admin creates an invite → Supabase sends email → user sets password → becomes `organization_member`.
- **Session management:** Supabase handles session tokens, refresh, and revocation. The `@supabase/ssr` package handles cookie-based sessions for Next.js App Router.
- **Confidence:** High

### Role-Based Access Control

- **Recommendation:** Role column on `organization_members` table. Roles: `owner`, `admin`, `coach`, `member`, `viewer`.
- **Pattern:** Check role in Server Actions and Server Components. RLS handles read access (any member can read). Write access requires role check. Permission-restricted features are hidden in UI based on role.
- **Roles for STOZER:**
  - `owner` — full access, billing, org settings
  - `admin` — manage teams, players, finances
  - `coach` — manage assigned teams, attendance, training
  - `member` — view own data, pay membership
  - `viewer` — read-only (board members, parents)

- **Confidence:** High

### What NOT to use:
- **Clerk / NextAuth / Auth.js:** Adds unnecessary complexity when Supabase Auth handles everything and integrates with RLS natively. Using a third-party auth with Supabase requires JWT template hacks and loses the native `auth.uid()` integration.
- **Custom JWT implementation:** Never roll your own JWT handling.

---

## File Storage

### Supabase Storage

- **Recommendation:** Supabase Storage with organization-scoped paths.
- **Pattern:** Buckets: `logos` (org logos), `avatars` (user profile photos), `documents` (contracts, medical docs), `media` (photos, videos).
- **Path structure:** `{bucket}/{organization_id}/{file_path}`.
- **RLS for storage:** Supabase Storage supports RLS policies. Members can read files in their org. Only admins can upload/delete.
- **Signed URLs:** Use signed URLs for private documents (medical records, contracts). Public assets (logos) use public URLs.
- **Confidence:** High

---

## i18n

### next-intl

- **Recommendation:** next-intl v3+ (latest stable).
- **Rationale:** next-intl is the only i18n library with full App Router + RSC support. It works natively in Server Components via `getTranslations()` — no client-side waterfalls. Type-safe translation keys. Middleware handles locale detection from `Accept-Language` header, URL prefix routing (`/sr/`, `/en/`), and cookie persistence.
- **Locales:** `sr` (Serbian Latin, primary), `en` (English, secondary).
- **Pattern:**
  - `[locale]` segment in URL: `/sr/dashboard`, `/en/dashboard`.
  - Translation files: `messages/sr.json`, `messages/en.json`.
  - Server Components use `getTranslations()`. Client Components use `useTranslations()`.
  - Date/number/currency formatting via `getFormatter()` (server) or `useFormatter()` (client) — uses `Intl.DateTimeFormat` and `Intl.NumberFormat`.
  - Currency formatting: `{style: 'currency', currency: 'RSD'}` for Serbian Dinar, `{style: 'currency', currency: 'EUR'}` for Euro.
- **Confidence:** High

### What NOT to use:
- **next-i18next:** Pages Router only, no RSC support.
- **i18next + react-i18next:** Manual configuration, no native App Router integration.
- **Lingui:** Good but less mature App Router support than next-intl.

---

## PWA

### Serwist (replaces next-pwa)

- **Recommendation:** Serwist (`@serwist/next` or `@serwist/turbopack`) — the modern successor to next-pwa.
- **Rationale:** The original `next-pwa` by shadowwalker is unmaintained for Next.js 14+. `@ducanh2912/next-pwa` was a fork but Serwist is now the recommended PWA solution per Next.js official docs (as of 2026). Serwist supports both Webpack and Turbopack builds, provides Workbox 7 integration, and has a clean Next.js App Router integration.
- **Pattern:**
  - `app/manifest.json` for web app manifest (Next.js Metadata API).
  - `app/sw.ts` for service worker (TypeScript, typed).
  - `SerwistProvider` in root layout for registration.
  - Workbox strategies: `NetworkFirst` for API data, `StaleWhileRevalidate` for static assets, `CacheFirst` for images.
  - Offline fallback page at `/~offline`.
- **Key features for STOZER:**
  - Coach attendance should work offline (cache team roster, mark attendance, sync when online).
  - Match schedules viewable offline.
  - Basic financial overview cached for quick access.
- **Build note:** If using Turbopack (Next.js 15+ default), use `@serwist/turbopack`. If Webpack, use `@serwist/next`. The Turbopack approach uses a Route Handler instead of a bundler plugin — more elegant.
- **Confidence:** High

### What NOT to use:
- **next-pwa (shadowwalker):** Unmaintained for Next.js 14+.
- **@ducanh2912/next-pwa:** Fork that works but Serwist is now the official recommendation.
- ** vite-plugin-pwa:** Vite-specific, not for Next.js.

---

## Multi-Language & Multi-Currency

### Date/Number/Currency Formatting

- **Recommendation:** Use `Intl.DateTimeFormat` and `Intl.NumberFormat` via next-intl's `getFormatter()` / `useFormatter()`.
- **Pattern:**
  - Dates: `format.dateTime(date, { dateStyle: 'medium' })` — auto-formats per locale.
  - Numbers: `format.number(value)` — locale-aware thousand separators.
  - Currency: `format.number(value, { style: 'currency', currency: 'RSD' })` or `'EUR'`.
  - Relative time: `format.relativeTime(date)` — "pre 2 sata", "2 hours ago".
- **Timezone:** Set per-locale timezone in next-intl config (`Europe/Belgrade` for sr, `UTC` or user-selected for en).
- **Confidence:** High

---

## Deployment

### Vercel

- **Recommendation:** Vercel for frontend + Supabase for backend.
- **Rationale:** Vercel is the recommended deployment platform for Next.js. Native support for ISR, edge middleware, automatic preview deployments, and analytics. Supabase handles database, auth, storage, and edge functions separately.
- **Environment:** Separate Supabase projects for development, staging, and production. Vercel environment variables per branch.
- **Confidence:** High

---

## What NOT to Use

| Library/Pattern | Why Not |
|---|---|
| **Prisma** | Supabase provides direct Postgres access; Prisma adds a query engine layer that complicates RLS integration and connection pooling. Use Supabase JS client. |
| **Drizzle ORM** | Same concern as Prisma — adds abstraction over Postgres when Supabase client already provides typed queries. If ORM is needed later, Drizzle is the better choice over Prisma. |
| **NextAuth / Auth.js** | Supabase Auth integrates natively with RLS. Adding a separate auth layer creates JWT synchronization complexity. |
| **Clerk** | Same as above. Clerk + Supabase RLS requires JWT template hacks and loses native `auth.uid()`. |
| **MUI / Ant Design / Chakra** | Wrong ecosystem (not Tailwind-native), heavier bundles, wrong aesthetic for clean SaaS dashboard. |
| **Chart.js / Victory / D3 direct** | Not React-native, poor RSC support, or too low-level. Recharts v3 via shadcn/ui is optimal. |
| **next-pwa (shadowwalker)** | Unmaintained for Next.js 14+. Use Serwist. |
| **next-i18next** | Pages Router only, no App Router / RSC support. Use next-intl. |
| **Database-per-tenant** | Operational overhead is too high for early-stage SaaS. Shared schema with RLS is the right default. |
| **Schema-per-tenant** | Connection pool complexity with `search_path` switching. Shared schema is simpler. |
| **Custom auth / JWT** | Never roll your own. Use Supabase Auth. |
| **Native mobile (React Native)** | PWA covers mobile needs for coach workflows. Native adds 2-3x development cost for minimal UX gain in this context. |

---

## Sources

- Next.js official docs: Multi-tenant guide, i18n guide, PWA guide (nextjs.org/docs)
- Supabase docs: Row-Level Security, Auth, Storage
- shadcn/ui docs: Forms (RHF + Zod, TanStack Form), DataTable, Charts
- next-intl docs: App Router setup, Server/Client Components, formatting
- Serwist docs: Next.js integration (serwist.pages.dev)
- Production reports from multi-tenant SaaS builders (Moditra, Velocity, various 2025-2026 case studies)
- Recharts v3 vs Tremor vs Nivo comparison (pkgpulse.com, 2026)
- TanStack Table v9 documentation
- Supabase Multi-Tenancy Template (github.com/0Itsuki0)
