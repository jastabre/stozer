# Pitfalls Research: STOZER

## Summary

The highest-risk areas for STOZER are **multi-tenant data isolation** (a single RLS bug can leak all club data), **financial correctness** (FIFO payment allocation with race conditions and balance drift), and **scope creep** (building for imaginary scale while the core workflow isn't simple enough for a non-technical club president). Supabase RLS performance is a sleeper risk — policies that work on 100 rows will crawl at 10,000.

---

## Critical Pitfalls

Data loss, security breach, financial error.

### Tenant Data Leakage via Missing RLS

- **Warning signs**: Any table created without `organization_id` column, any query that forgets the `.eq('organization_id', orgId)` filter, any database function that doesn't validate tenant context.
- **Prevention**: 
  - Every table gets `organization_id` (or `team_id` with team belonging to org) as a required column from day one.
  - Enable RLS on every table immediately — no exceptions.
  - Write RLS policies before writing app code: `CREATE POLICY ... USING (organization_id = (SELECT org_id FROM current_user_org()))`.
  - Use a Supabase migration lint rule: any new table without RLS fails CI.
  - Test with two seeded organizations and verify cross-org isolation.
- **Phase**: Schema design, every migration.

### RLS Policy Bypass via Service Role in Client

- **Warning signs**: Any usage of `supabase.auth.admin` or service-role key in client-side code, environment variable `SUPABASE_SERVICE_ROLE_KEY` exposed to the browser, API routes that use service-role for reads.
- **Prevention**: 
  - Service-role key never leaves the server. Period.
  - Use `SUPABASE_ANON_KEY` on the client, `SUPABASE_SERVICE_ROLE_KEY` only in server-side Edge Functions or API routes for admin operations (imports, bulk updates).
  - Audit every Edge Function to verify it extracts the user's JWT and uses it for authorization, not service-role.
- **Phase**: Auth setup, every Edge Function.

### FIFO Payment Allocation Race Condition

- **Warning signs**: Two simultaneous payments arriving for the same member, allocation functions that read open debts and then write without locking, any test that passes only with single-threaded execution.
- **Prevention**: 
  - Use a PostgreSQL advisory lock or `SELECT ... FOR UPDATE` inside a database function when allocating payments.
  - Make the allocation function atomic: read debts, compute allocation, insert payment_allocations, update balances — all in one transaction.
  - Use idempotency keys on payment imports (hash of member + amount + date + reference).
  - Write the allocation function as a PL/pgSQL function, not in application code, to guarantee atomicity.
  - Test: run two concurrent payments for the same member against overlapping open debts.
- **Phase**: Financial core (Phase 4-5).

### Incorrect Balance Calculations via Floating Point

- **Warning signs**: Using `DECIMAL` or `NUMERIC` with weird precision artifacts, JavaScript doing `0.1 + 0.2 = 0.30000000000000004`, any currency math in application code using floats.
- **Prevention**: 
  - Store all monetary values as **integer cents** (or integer amount in smallest currency unit: centimes for EUR, Para for RSD).
  - `1500 RSD` = `150000` (para). `15.50 EUR` = `1550` (centimes).
  - Display formatting happens only at the UI layer: `formatCurrency(cents) => ${(cents / 100).toFixed(2)}`.
  - In PostgreSQL: `INTEGER` or `BIGINT` for amounts, `INTEGER` for cents. Never `FLOAT` or `DOUBLE PRECISION`.
  - All balance calculations in SQL, never in JavaScript.
- **Phase**: Schema design, financial core.

### Missing Audit Trail for Financial Operations

- **Warning signs**: No `created_at`/`updated_at` on financial tables, no way to see who changed what, deletes on payment or debt tables, no reversal mechanism.
- **Prevention**: 
  - Financial tables never use `DELETE`. Use soft-delete with `deleted_at` or `status = 'reversed'`.
  - Create an `audit_log` table: `entity_type`, `entity_id`, `action`, `old_value`, `new_value`, `performed_by`, `performed_at`.
  - Trigger-based audit on all payment and balance mutations.
  - Payment corrections use a `reversal` entry, not editing the original.
- **Phase**: Financial core.

### Overpayment / Negative Balance Bug

- **Warning signs**: No validation on payment amount > remaining debt, no cap on how much a member can overpay, no handling of credit balances.
- **Prevention**: 
  - Validate: payment amount must be positive, and total allocated cannot exceed total open debt + allowed_overpayment.
  - Decide policy early: does STOZER allow overpayment (credit on account) or reject it?
  - If credit is allowed, track it explicitly as a separate balance type.
  - Test: exact payment, partial, overpayment, payment across multiple debts.
- **Phase**: Financial core.

### Duplicate Payment Import (Double Allocation)

- **Warning signs**: No deduplication on bank statement imports, same CSV imported twice creates duplicate allocations, no unique constraint on payment source references.
- **Prevention**: 
  - Generate a deterministic hash for each imported payment: `SHA256(member_id + amount + date + reference_number)`.
  - Unique constraint on this hash column.
  - On import, `INSERT ... ON CONFLICT DO NOTHING` or reject with clear error.
  - Show user which rows were skipped as duplicates.
- **Phase**: Financial import.

---

## High-Severity Pitfalls

Major UX issues, significant bugs.

### Building Too Complex for Non-Technical Users

- **Warning signs**: Feature requires more than 3 clicks to complete, admin needs to understand database concepts, UI shows fields that only matter for edge cases, documentation needed to use basic features.
- **Prevention**: 
  - The "grandma test": can a 60-year-old club president who uses WhatsApp do the core workflow without training?
  - Default to showing the simple path. Advanced options behind "More options" toggle.
  - Pre-fill everything the system already knows (org, team, season).
  - Every feature gets a user testing session with a real non-technical person before shipping.
- **Phase**: Every phase. Constant vigilance.

### Mobile Coach UX Afterthought

- **Warning signs**: Desktop-first layouts, attendance requires scrolling through long lists, no quick-action buttons, forms designed for keyboard input.
- **Prevention**: 
  - Design mobile-first for coach-facing features: attendance, quick stats, schedule.
  - Coach attendance: tap name → present/absent → done. Under 30 seconds for a full team.
  - Use bottom sheets, swipe actions, large tap targets.
  - Test on actual phones, not browser dev tools responsive mode.
- **Phase**: Every coach-facing feature.

### Feature Bloat / Scope Creep

- **Warning signs**: Building features not in STOZER-BRIEF.md, adding "just one more" capability, features only one of 100 beta users might want, complex configuration screens.
- **Prevention**: 
  - STOZER-BRIEF.md is the law. If it's not in the brief, it doesn't get built without explicit decision.
  - Ship V1 with the minimum workflow. Every new feature must prove demand from real users.
  - Maintain a "not now" list instead of "backlog" — things intentionally deferred.
  - The best feature is the one you don't build.
- **Phase**: Product decisions, every milestone.

### Season Transition Breakage

- **Warning signs**: Members don't carry over, team assignments get lost, historical data becomes inaccessible, financial records reset.
- **Prevention**: 
  - Seasons are a lens/filter, not a data partition. Members, teams, and clubs persist across seasons.
  - New season = new season record + assignments of members to teams for that season.
  - Historical data (attendance, payments, matches) always accessible by filtering on season.
  - Never delete or move data during season transitions.
- **Phase**: Season management.

### Hardcoding for Football Only

- **Warning signs**: Fields named "match" that assume 11-a-side, references to "pitch" instead of "court", terminology that only makes sense for football.
- **Prevention**: 
  - Use sport-agnostic terms: "match/game" → "event" or "game", "pitch" → "venue", "training" is universal.
  - Sport-specific rules (lineups, periods) go in sport-specific config, not hardcoded.
  - Test data includes both football and basketball examples.
  - `sport_type` enum drives behavior, not conditional checks on team names.
- **Phase**: Schema design, UI.

### Inconsistent State Between Offline/Online

- **Warning signs**: Coach takes attendance offline and it conflicts with another admin's edit, data saved locally doesn't sync, last-write-wins overwrites.
- **Prevention**: 
  - For V1: require connectivity for writes. Show clear offline state.
  - If offline support is needed later: use optimistic updates with server reconciliation.
  - Timestamps + version columns for conflict detection.
  - Never silently overwrite server state.
- **Phase**: Offline support (post-V1).

---

## Medium-Severity Pitfalls

Performance, maintainability.

### Supabase RLS Performance Degradation

- **Warning signs**: Queries get slower as data grows, `EXPLAIN ANALYZE` shows RLS policy as a sequential scan, policies with subqueries or `IN` clauses referencing other tables.
- **Prevention**: 
  - RLS policies should use simple column comparisons: `organization_id = <constant>`.
  - Avoid subqueries in RLS — pre-compute the org_id via a session variable or JWT claim.
  - Index `organization_id` on every table (it's the primary RLS filter).
  - For complex access patterns, use database functions instead of inline RLS.
  - Benchmark with 10k+ rows per table early.
- **Phase**: Schema + RLS design.

### Overly Complex RLS Policies

- **Warning signs**: RLS policy is more than 3 lines, policy references multiple tables, policy uses CTEs or window functions.
- **Prevention**: 
  - Simple model: `organization_id = (SELECT org_id FROM current_setting('app.current_org')::uuid)`.
  - Complex access (e.g., "coach can only see their teams") → database function with `SECURITY DEFINER`.
  - Test each policy independently with `SET LOCAL app.current_org = '...'`.
- **Phase**: RLS design.

### Next.js Server/Client Component Confusion

- **Warning signs**: `"use client"` on pages that should be server components, data fetching in client components causing waterfall, hydration mismatches in console.
- **Prevention**: 
  - Pages are server components by default. Add `"use client"` only when interactivity is needed.
  - Fetch data in server components, pass as props to client components.
  - Use `loading.tsx` for Suspense boundaries, not spinners in client components.
  - Server components: layout, data page, list views.
  - Client components: forms, interactive tables, modals, buttons.
- **Phase**: Every frontend phase.

### Waterfall Data Fetching

- **Warning signs**: Page load time increases linearly with data dependencies, Network tab shows sequential requests, users see loading spinners chaining.
- **Prevention**: 
  - Parallel data fetching with `Promise.all` in server components.
  - Use Supabase's `.select()` with joins to fetch related data in one query.
  - For client-side: batch Supabase queries or use RPC functions that return aggregated data.
  - Profile with Next.js DevTools and React Profiler.
- **Phase**: Every data-heavy page.

### Bundle Size Bloat

- **Warning signs**: `next build` output shows large chunks, dynamic imports needed but not used, importing entire libraries for one function.
- **Prevention**: 
  - Use dynamic imports for heavy libraries (chart libraries, date pickers, modals).
  - Import specific functions: `import { format } from 'date-fns'` not `import * from 'date-fns'`.
  - Audit bundle with `@next/bundle-analyzer` regularly.
  - Avoid adding UI component libraries (shadcn/ui is fine as it's tree-shakeable).
- **Phase**: Performance optimization.

### Incorrect Middleware Usage

- **Warning signs**: Middleware running on every request (including static files), middleware doing database calls, auth logic split between middleware and server components.
- **Prevention**: 
  - Middleware: auth redirects, locale detection, simple route protection. That's it.
  - No database calls in middleware. Use JWT claims for user/org context.
  - Use `matcher` config to exclude static files and API routes.
  - Keep middleware fast (< 50ms). Profile it.
- **Phase**: Auth/routing setup.

### Storage Bucket Misconfiguration

- **Warning signs**: Public buckets for private data, no file size limits, no MIME type restrictions, URLs with predictable file names.
- **Prevention**: 
  - Private buckets by default. Only public for club logos and public-facing images.
  - File size limits: 5MB for documents, 2MB for images.
  - MIME type restrictions per bucket.
  - Use signed URLs for private file access.
  - RLS policies on storage buckets matching org ownership.
- **Phase**: File upload features.

### Auth Session Management Issues

- **Warning signs**: Users randomly logged out, session refresh failing silently, JWT expiry not aligned with session expiry.
- **Prevention**: 
  - Use `@supabase/ssr` for cookie-based sessions (not localStorage tokens).
  - Handle token refresh automatically — Supabase client does this, but verify it works with middleware.
  - Set reasonable JWT expiry (1 hour) with refresh token rotation.
  - Test: leave app open for 2 hours, verify session refreshes without logout.
- **Phase**: Auth setup.

---

## Solo Founder Pitfalls

### Building in Isolation Without User Feedback

- **Warning signs**: No user interviews completed, features designed from assumptions, "I'll get feedback after I finish this feature", perfecting code before validating workflow.
- **Prevention**: 
  - Talk to 5 club administrators before writing code. Record their current workflow.
  - Ship an MVP of the core workflow (member management + attendance) and watch someone use it.
  - Set up a feedback channel (WhatsApp group with 3 beta clubs) from day one.
  - Measure: are they using it weekly? If not, the workflow is wrong.
- **Phase**: Pre-development, continuous.

### Overengineering for Scale

- **Warning signs**: Building multi-region deployment for 10 users, designing for 1M clubs when targeting 100, microservices architecture, complex caching layers.
- **Prevention**: 
  - Supabase + Vercel handle scale you won't hit for years. Trust them.
  - Single PostgreSQL database, single Next.js app. Scale vertically first.
  - Optimize for development speed and correctness, not throughput.
  - Revisit architecture when you have 100 paying clubs, not before.
- **Phase**: Architecture decisions (pre-development).

### Perfecting UI Before Core Works

- **Warning signs**: Spending days on color schemes, animation polish, or component libraries before payment allocation is correct, attendance works, or tenant isolation is verified.
- **Prevention**: 
  - Core business logic first. UI polish second. In that order.
  - "Works correctly" beats "looks beautiful" for the first 6 months.
  - Use shadcn/ui defaults. Don't customize until the product is validated.
  - Ship with functional UI. Polish based on user feedback about what actually matters to them.
- **Phase**: Every phase. Priority discipline.

### Not Shipping Early Enough

- **Warning signs**: "Just one more feature and then I'll launch", 6 months in with no external user, spending more time on infrastructure than product.
- **Prevention**: 
  - Set a hard deadline: MVP ships to 3 beta clubs within 8 weeks.
  - MVP = 1 club can add members, record attendance, and track payments. Nothing else.
  - Ship to production, not a staging environment. Real users on real data.
  - Iterate weekly based on feedback. Ship small, ship often.
- **Phase**: MVP milestone.

### Context Switching Between Too Many Features

- **Warning signs**: Multiple partially-completed features, constant refactoring, no feature feels "done", git history shows jumps between unrelated areas.
- **Prevention**: 
  - Work on ONE phase at a time. Complete it before starting the next.
  - Use GSD phases to enforce focus.
  - "Done" means: implemented, tested, deployed, verified with a real user.
  - Batch related small tasks, but never mix unrelated work in one branch.
- **Phase**: Workflow discipline (every day).

### Burnout from Solo Development

- **Warning signs**: Coding 12+ hour days, skipping weekends for weeks, loss of motivation, dreading the codebase.
- **Prevention**: 
  - Set boundaries: max 6 productive hours/day of coding.
  - Automate everything you can (CI/CD, tests, linting).
  - Celebrate milestones (first club onboarded, first payment tracked).
  - Remember: STOZER is a marathon, not a sprint. Sustainable pace wins.
- **Phase**: Ongoing.

---

## Supabase-Specific Pitfalls

### Forgetting to Enable RLS on New Tables

- **Warning signs**: Any `CREATE TABLE` without a corresponding `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, new table accessible without auth.
- **Prevention**: 
  - Migration template includes `ENABLE ROW LEVEL SECURITY` by default.
  - CI check: query `pg_tables` for tables without RLS enabled.
  - Never create tables via Supabase dashboard without also adding RLS policy in the same session.
- **Phase**: Every migration.

### Using `anon` Role for Privileged Operations

- **Warning signs**: Any client-side code that uses `supabase.auth.admin`, Edge Functions using service role without user JWT verification.
- **Prevention**: 
  - `anon` role = unauthenticated. `authenticated` role = logged-in user.
  - All writes from the client go through `authenticated` role with RLS.
  - Admin operations (imports, bulk updates) in Edge Functions that verify the user has admin permission.
  - Audit: grep for `service_role` in all non-server code.
- **Phase**: Auth/security.

### Not Using Database Functions for Complex Logic

- **Warning signs**: Complex business logic in application code that reads, processes, and writes multiple tables, logic that differs between client and server.
- **Prevention**: 
  - Payment allocation: PL/pgSQL function.
  - Balance calculation: SQL view or function.
  - Attendance summary: SQL function or materialized view.
  - Application code calls the function, doesn't reimplement the logic.
  - Single source of truth for business rules = database.
- **Phase**: Financial core, any complex business logic.

### Realtime Subscription Leaks

- **Warning signs**: Subscriptions not cleaned up on component unmount, multiple subscriptions to the same channel, memory usage growing over time.
- **Prevention**: 
  - Always return cleanup function from `useEffect` that calls `supabase.removeChannel()`.
  - One channel per component, not per data fetch.
  - Use Supabase's channel naming convention to avoid duplicates.
  - Test: navigate between pages 10 times, check for orphaned connections in DevTools.
- **Phase**: Realtime features.

### Edge Function Cold Start Issues

- **Warning signs**: First request after idle period takes 5+ seconds, user-facing operations feel slow.
- **Prevention**: 
  - Keep Edge Functions lightweight. Heavy computation goes in database functions.
  - Use warm pings for critical functions (payment processing).
  - Consider: if an Edge Function is called on every page load, move the logic server-side or to a database function.
- **Phase**: Any feature using Edge Functions.

### Not Leveraging Supabase's Built-in Features

- **Warning signs**: Reimplementing auth, building custom real-time, manually managing database backups, rolling custom file upload handling.
- **Prevention**: 
  - Use Supabase Auth (not custom auth).
  - Use Supabase Realtime (not polling).
  - Use Supabase Storage (not S3 directly).
  - Use Supabase Database Webhooks for event-driven logic.
  - Use Supabase's built-in connection pooling (PgBouncer).
- **Phase**: Architecture decisions.

---

## Sources

- Supabase documentation: Row Level Security, Edge Functions, Auth, Storage
- PostgreSQL documentation: Transaction isolation, Advisory locks, PL/pgSQL
- "Designing Data-Intensive Applications" (Martin Kleppmann) — Chapter 7: Transactions
- "Building Microservices" (Sam Newman) — Chapter on decomposing databases
- Stripe engineering blog — Idempotency and payment processing patterns
- Multi-tenant SaaS architecture patterns (various engineering blogs)
- Next.js documentation: Server Components, Middleware, Dynamic Imports
- Vercel Next.js best practices
- Sports club management market analysis (Technalysis, Mordor Intelligence)
