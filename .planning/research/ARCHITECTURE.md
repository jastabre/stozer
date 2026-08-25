# Architecture Research: STOZER

## Summary

STOZER is a multi-tenant SaaS for sports club management using Supabase + PostgreSQL + Next.js. This document covers architecture patterns for tenant isolation via RLS, RBAC authorization, FIFO payment allocation, data modeling for athletes across seasons, and performance optimization. All patterns are chosen for a modular monolith V1 with clear upgrade paths.

---

## Multi-Tenant Architecture

### Pattern: Shared Database + Row-Level Security

STOZER uses a shared database, shared schema model where every tenant-scoped table has an `organization_id` column and PostgreSQL RLS enforces isolation at the database level.

**Why this pattern:**
- Operational simplicity: single schema to manage, deploy, back up
- Supabase-native: RLS is the core security primitive, no middleware needed
- Cost-effective: no per-tenant database provisioning
- Proven at scale: works for thousands of tenants with proper indexing

**Trade-offs vs alternatives:**
- Schema-per-tenant: better per-tenant isolation but management overhead at scale (RLS migration scripts, connection pooling complexity, VACUUM per schema). Not worth it for V1 with hundreds of clubs.
- Database-per-tenant: highest isolation but prohibitive cost and operational complexity. Only justified for regulated enterprise tenants.

### Tenant Resolution

Every request must resolve which organization the user is acting within. Two approaches, layered:

**Primary: JWT Custom Claims (app_metadata)**

Store `organization_id` in the user's JWT via Supabase's `custom_access_token_hook`. This is the fastest path -- no DB query on every request.

```sql
-- Custom access token hook (runs at token issuance/refresh)
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  org_id uuid;
  user_role text;
BEGIN
  SELECT om.organization_id, r.name
  INTO org_id, user_role
  FROM public.organization_memberships om
  JOIN public.roles r ON r.id = om.role_id
  WHERE om.user_id = (event->>'user_id')::uuid
    AND om.is_current = true
  LIMIT 1;

  RETURN jsonb_set(
    event,
    '{app_metadata}',
    jsonb_set(
      COALESCE(event->'{app_metadata}', '{}'::jsonb),
      '{organization_id}',
      to_jsonb(org_id)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
```

**Performance: Always wrap in `(select ...)` to avoid per-row re-evaluation:**

```sql
-- BAD: evaluated for EVERY row scanned
CREATE POLICY "bad" ON teams
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- GOOD: evaluated ONCE per query
CREATE POLICY "good" ON teams
  USING (organization_id = (select current_setting('app.current_organization_id')::uuid));
```

**Fallback: security definer helper function**

```sql
CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid AS $$
  SELECT (select auth.jwt() ->> 'organization_id')::uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';
```

**Critical: app_metadata vs user_metadata**
- `app_metadata`: server-controlled, user CANNOT self-modify -> safe for authorization
- `user_metadata`: user CAN self-modify -> NEVER use for authorization (privilege escalation risk)

### Data Isolation

**Core RLS pattern for every tenant-scoped table:**

```sql
-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams FORCE ROW LEVEL SECURITY;

-- SELECT: only see your org's rows
CREATE POLICY "org_isolation_select" ON public.teams
  FOR SELECT TO authenticated
  USING (organization_id = (select public.current_organization_id()));

-- INSERT: can only create rows in your org
CREATE POLICY "org_isolation_insert" ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (select public.current_organization_id()));

-- UPDATE: can only modify your org's rows
CREATE POLICY "org_isolation_update" ON public.teams
  FOR UPDATE TO authenticated
  USING (organization_id = (select public.current_organization_id()))
  WITH CHECK (organization_id = (select public.current_organization_id()));

-- DELETE: can only delete your org's rows
CREATE POLICY "org_isolation_delete" ON public.teams
  FOR DELETE TO authenticated
  USING (organization_id = (select public.current_organization_id()));
```

`FORCE ROW LEVEL SECURITY` is critical: without it, the table owner role bypasses all RLS policies.

**Indexing for RLS performance:**

```sql
-- organization_id MUST be the FIRST column in composite indexes
CREATE INDEX idx_teams_org_id ON public.teams(organization_id);
CREATE INDEX idx_teams_org_season ON public.teams(organization_id, season_id);
CREATE INDEX idx_athletes_org ON public.athletes(organization_id);
```

### Cross-Tenant Operations (Super Admin)

**Approach A: Separate admin route with service_role** (recommended for V1)

```typescript
// Server-side only (API route, Edge Function)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // bypasses RLS
);
```

- Clean separation: admin UI never shares RLS context with tenant UI
- `service_role` key must NEVER be exposed to the client
- Audit all `service_role` usage

**Approach B: Admin bypass claim in JWT**

```sql
CREATE POLICY "admin_bypass" ON public.teams
  FOR ALL TO authenticated
  USING (
    (select current_setting('app.is_super_admin', true))::boolean = true
    OR organization_id = (select public.current_organization_id())
  );
```

Recommendation for V1: Use separate admin routes with `service_role` client. Simpler, safer, no RLS complexity leakage.

### Migration Strategies

```sql
-- ALWAYS include organization_id in WHERE clauses for data migrations
-- New columns should be nullable or have safe defaults
-- Never add NOT NULL without a default on existing tenant data
ALTER TABLE public.teams ADD COLUMN last_activity_at timestamptz;

-- RLS policy migrations: always test with pgTAP
CREATE POLICY "new_feature_policy" ON public.new_table
  FOR SELECT TO authenticated
  USING (organization_id = (select public.current_organization_id()));
```

---

## Authorization Model (RBAC)

### Role Hierarchy

STOZER defines four business roles with clear hierarchy:

| Role | Scope | Permissions |
|------|-------|-------------|
| **Club President** | Entire club | Everything -- all modules, all data, settings, staff management |
| **Youth Director** | Youth school only | Youth teams, youth athletes, youth finance, youth registrations, documents |
| **Coach** | Assigned teams only | His teams' athletes, training, attendance, team memberships, limited finance |
| **Admin/Finance** | Configured scope | Finance modules, registrations, contracts, documents (scope-limited) |

Roles are NOT rigid enums. A user can have multiple roles within an organization (e.g., Coach + Admin). One user can belong to multiple organizations.

### Permission Model

Three-layer design: **roles -> permissions -> policies**.

```sql
-- Enum for roles
CREATE TYPE public.app_role AS ENUM (
  'club_president',
  'youth_director',
  'coach',
  'admin_finance',
  'super_admin'
);

-- Granular permissions
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
  'club_settings.manage',
  'notifications.manage'
);

-- Role to permission mapping
CREATE TABLE public.role_permissions (
  role public.app_role NOT NULL,
  permission public.app_permission NOT NULL,
  PRIMARY KEY (role, permission)
);
```

### The authorize() Function

This is the bridge between RBAC and RLS. It reads the user's role from JWT and checks permission in a single query.

```sql
CREATE OR REPLACE FUNCTION public.authorize(
  requested_permission public.app_permission
)
RETURNS boolean AS $$
DECLARE
  bind_permissions int;
  user_role public.app_role;
BEGIN
  SELECT (auth.jwt() ->> 'user_role')::public.app_role INTO user_role;

  SELECT count(*)
  INTO bind_permissions
  FROM public.role_permissions
  WHERE role_permissions.permission = requested_permission
    AND role_permissions.role = user_role;

  RETURN bind_permissions > 0;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';
```

Key properties:
- `STABLE`: PostgreSQL knows this function is deterministic -> enables query planner optimizations
- `SECURITY DEFINER`: function runs with owner privileges, not the caller's
- `SET search_path = ''`: prevents search path injection attacks
- Call from RLS with `(select authorize('permission_name'))` for per-query evaluation

### Database-Level Enforcement

RLS policies combine tenant isolation AND role-based permission with AND:

```sql
CREATE POLICY "authorized_delete_athletes" ON public.athletes
  FOR DELETE TO authenticated
  USING (
    organization_id = (select public.current_organization_id())
    AND (select public.authorize('athletes.delete'))
  );
```

**Layered policy approach using AS RESTRICTIVE:**

For extra safety on critical tables (salary, contracts), use restrictive policies that cannot be bypassed by permissive policies:

```sql
-- Permissive: standard org isolation
CREATE POLICY "org_isolation" ON public.first_team_salary_records
  FOR ALL TO authenticated
  USING (organization_id = (select public.current_organization_id()));

-- Restrictive: additional permission gate that ALWAYS applies
CREATE POLICY "salary_requires_permission" ON public.first_team_salary_records
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING ((select public.authorize('first_team_finance.view')));
```

With AS RESTRICTIVE, both policies must pass. A permissive policy cannot override a restrictive one.

### Permission Granularity for STOZER

Sensitive data gets extra protection layers:

| Data | RLS | Column-Level | UI |
|------|-----|-------------|----|
| Athlete basic info | org_id | -- | role-based |
| First team salary | org_id + permission | restricted | hidden without permission |
| Medical documents | org_id + permission | separate bucket | hidden without permission |
| Contracts | org_id + permission | -- | role-based |
| Youth finance summary | org_id + permission | -- | role-scoped |

### JWT Snapshot Issue

A JWT is a snapshot -- when a role changes, the existing token keeps the old role until refresh.

Mitigation options:
1. For slow-changing roles (President, Youth Director): JWT claims are fine, token refresh handles it
2. For immediate revocation needs: check `organization_memberships` table directly in the `authorize()` function
3. On role change: trigger session refresh via `supabase.auth.updateUser()`

V1 recommendation: Use JWT claims for roles. Force session refresh after role changes in admin UI.

---

## Financial Data Patterns

### Payment Allocation (FIFO)

This is STOZER's most critical business algorithm. Every payment must be allocated atomically to the oldest unpaid charge.

```sql
CREATE OR REPLACE FUNCTION public.allocate_membership_payment(
  p_organization_id uuid,
  p_athlete_id uuid,
  p_amount numeric,
  p_currency text,
  p_payment_id uuid,
  p_allocated_by uuid
)
RETURNS jsonb AS $$
DECLARE
  v_remaining numeric := p_amount;
  v_charge record;
  v_allocations jsonb := '[]'::jsonb;
  v_allocation_amount numeric;
BEGIN
  -- Find oldest unpaid/partial charges, ordered by period
  FOR v_charge IN
    SELECT mc.id, mc.amount, mc.period_start, mc.status
    FROM public.membership_charges mc
    WHERE mc.athlete_id = p_athlete_id
      AND mc.organization_id = p_organization_id
      AND mc.status IN ('unpaid', 'partial')
    ORDER BY mc.period_start ASC, mc.id ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_allocation_amount := LEAST(v_remaining, v_charge.amount);

    INSERT INTO public.payment_allocations (
      organization_id, payment_id, charge_id,
      amount, currency, allocated_by, allocated_at
    ) VALUES (
      p_organization_id, p_payment_id, v_charge.id,
      v_allocation_amount, p_currency, p_allocated_by, now()
    );

    IF v_allocation_amount >= v_charge.amount THEN
      UPDATE public.membership_charges
      SET status = 'paid', paid_at = now()
      WHERE id = v_charge.id;
    ELSE
      UPDATE public.membership_charges
      SET status = 'partial',
          amount_paid = COALESCE(amount_paid, 0) + v_allocation_amount
      WHERE id = v_charge.id;
    END IF;

    v_allocations := v_allocations || jsonb_build_object(
      'charge_id', v_charge.id,
      'amount', v_allocation_amount,
      'period', v_charge.period_start
    );

    v_remaining := v_remaining - v_allocation_amount;
  END LOOP;

  -- Overpayment becomes athlete credit
  IF v_remaining > 0 THEN
    INSERT INTO public.athlete_credits (
      organization_id, athlete_id, amount, currency,
      source_payment_id, created_by
    ) VALUES (
      p_organization_id, p_athlete_id, v_remaining, p_currency,
      p_payment_id, p_allocated_by
    );
  END IF;

  -- Audit log
  INSERT INTO public.audit_log (
    organization_id, actor_user_id, action, entity_type, entity_id,
    new_value, created_at
  ) VALUES (
    p_organization_id, p_allocated_by, 'payment_allocated',
    'payment', p_payment_id,
    jsonb_build_object(
      'athlete_id', p_athlete_id,
      'total_amount', p_amount,
      'allocations', v_allocations,
      'remaining_credit', v_remaining
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'allocated', p_amount - v_remaining,
    'credit', v_remaining
  );
END;
$$ LANGUAGE plpgsql;
```

**Critical design decisions:**
- `FOR UPDATE SKIP LOCKED`: prevents two concurrent payments from double-allocating the same charge
- `ORDER BY period_start ASC, id ASC`: deterministic FIFO ordering, `id` as tie-breaker
- Single transaction: all allocations + status updates + audit log are atomic
- Credit creation: overpayment becomes athlete credit balance, not lost
- Audit log: every allocation is recorded with full detail

**Required indexes:**

```sql
CREATE INDEX idx_membership_charges_athlete_status
  ON public.membership_charges(organization_id, athlete_id, status)
  WHERE status IN ('unpaid', 'partial');

CREATE INDEX idx_membership_charges_period
  ON public.membership_charges(organization_id, period_start);
```

### Audit Trail Pattern

Every significant change gets an audit record:

```sql
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_audit_select" ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    organization_id = (select public.current_organization_id())
    AND (select public.authorize('reports.view'))
  );

CREATE INDEX idx_audit_log_org_entity ON public.audit_log(organization_id, entity_type, entity_id);
CREATE INDEX idx_audit_log_org_action ON public.audit_log(organization_id, action, created_at);
```

**What to audit:** payment created/imported/reversed/reallocated, membership waived/amount changed, registration changed, contract changed, salary/bonus changed, sensitive document deleted, permissions changed.

**Pattern:** Create audit log INSIDE database functions so application code doesn't need to remember to log.

### Transaction Safety

Non-negotiable rules for financial operations:

1. **Atomic operations**: All financial writes in a single database transaction
2. **No destructive deletes**: Payments, charges, allocations are never hard-deleted. Use reversal records.
3. **Idempotency**: Bank statement imports must be idempotent

```sql
-- Idempotency key on bank statement imports
CREATE TABLE public.bank_statement_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  file_hash text NOT NULL,
  imported_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  row_count int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, file_hash)
);
```

4. **Optimistic locking** for concurrent modifications:

```sql
ALTER TABLE public.membership_charges ADD COLUMN version int NOT NULL DEFAULT 1;

UPDATE public.membership_charges
SET status = 'paid', version = version + 1
WHERE id = charge_id AND version = expected_version;
```

5. **SKIP LOCKED** for concurrent payment allocation (prevents deadlocks on same charges)

### Bank Statement Import

**Architecture:** Upload -> Parse -> Match -> Auto-book / Suggest / Leave unmatched

**Matching priority:**
1. Payment reference / `club_athlete_id` (highest confidence)
2. Amount match
3. Payer identity
4. Previously confirmed payer mapping

```typescript
interface StatementParser {
  parse(file: Buffer, format: 'csv' | 'xlsx'): ParsedTransaction[];
}
```

---

## Data Modeling Patterns

### Athlete Identity (Permanent Profile Across Seasons)

An athlete is a permanent entity that exists across seasons. Never create a new athlete record for a new season.

```sql
CREATE TABLE public.athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  club_athlete_id text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  nationality text,
  photo_path text,
  position text,
  jersey_number int,
  equipment_size text,
  status text NOT NULL DEFAULT 'active',
  joined_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, club_athlete_id)
);
```

The `club_athlete_id` is the stable identifier used as payment reference. It never changes, even when the athlete moves between teams.

### Team Membership (History Tracking)

```sql
CREATE TABLE public.athlete_team_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.athletes(id),
  team_id uuid NOT NULL REFERENCES public.teams(id),
  season_id uuid NOT NULL REFERENCES public.seasons(id),
  jersey_number int,
  position text,
  status text NOT NULL DEFAULT 'active',
  started_at date NOT NULL,
  ended_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, athlete_id, season_id, team_id)
);

CREATE VIEW public.v_current_team_memberships AS
SELECT * FROM public.athlete_team_memberships
WHERE ended_at IS NULL AND status = 'active';
```

**Season rollover:** U15 season ends, U17 season starts. Old membership gets `ended_at` and `status = 'transferred'`. New membership created for U17. Athlete record is UNCHANGED.

### Registration and Contract Lifecycle

```sql
CREATE TABLE public.athlete_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  athlete_id uuid NOT NULL REFERENCES public.athletes(id),
  federation text NOT NULL,
  registration_number text,
  status text NOT NULL DEFAULT 'registered',
  registered_from date,
  registered_until date,
  document_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Status computed dynamically, not stored
CREATE OR REPLACE FUNCTION public.registration_status(
  p_registered_until date,
  p_warn_days int DEFAULT 30
)
RETURNS text AS $$
BEGIN
  IF p_registered_until IS NULL THEN RETURN 'not_registered'; END IF;
  IF p_registered_until < current_date THEN RETURN 'expired'; END IF;
  IF p_registered_until < current_date + p_warn_days THEN RETURN 'expiring_soon'; END IF;
  RETURN 'registered';
END;
$$ LANGUAGE sql IMMUTABLE;
```

### Season Rollover Pattern

```sql
CREATE OR REPLACE FUNCTION public.start_new_season(
  p_organization_id uuid,
  p_new_season_name text,
  p_new_season_start date,
  p_new_season_end date,
  p_created_by uuid
)
RETURNS uuid AS $$
DECLARE
  v_new_season_id uuid;
  v_old_season_id uuid;
BEGIN
  SELECT id INTO v_old_season_id
  FROM public.seasons
  WHERE organization_id = p_organization_id AND status = 'active'
  LIMIT 1;

  INSERT INTO public.seasons (organization_id, name, start_date, end_date, status)
  VALUES (p_organization_id, p_new_season_name, p_new_season_start, p_new_season_end, 'active')
  RETURNING id INTO v_new_season_id;

  UPDATE public.seasons SET status = 'completed' WHERE id = v_old_season_id;

  -- Copy teams to new season
  INSERT INTO public.teams (organization_id, season_id, name, sport, category, coach_id)
  SELECT p_organization_id, v_new_season_id, name, sport, category, coach_id
  FROM public.teams WHERE season_id = v_old_season_id;

  -- Copy staff assignments
  INSERT INTO public.team_staff (organization_id, team_id, staff_id, role)
  SELECT p_organization_id, new_t.id, ts.staff_id, ts.role
  FROM public.team_staff ts
  JOIN public.teams old_t ON old_t.id = ts.team_id
  JOIN public.teams new_t ON new_t.name = old_t.name AND new_t.season_id = v_new_season_id
  WHERE old_t.season_id = v_old_season_id;

  -- Athlete memberships are NOT copied -- user explicitly moves athletes in UI

  INSERT INTO public.audit_log (organization_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (p_organization_id, p_created_by, 'season_created', 'season', v_new_season_id,
    jsonb_build_object('name', p_new_season_name, 'previous_season_id', v_old_season_id));

  RETURN v_new_season_id;
END;
$$ LANGUAGE plpgsql;
```

### Document Management with Expiration Tracking

```sql
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  document_type text NOT NULL,
  filename text NOT NULL,
  storage_path text NOT NULL,
  issued_at date,
  expires_at date,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

## Real-Time Patterns

### Dashboard Updates (Supabase Realtime)

Supabase Realtime respects RLS automatically -- clients only receive change events for rows they can SELECT.

```typescript
const channel = supabase
  .channel('attendance-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'attendance',
      filter: `training_id=eq.${trainingId}`
    },
    (payload) => {
      setAttendance(prev => updateRecord(prev, payload));
    }
  )
  .subscribe();
```

Dashboard KPI updates:
- Subscribe to `payments` table changes -> refresh youth finance KPIs
- Subscribe to `attendance` table changes -> refresh attendance percentages
- Subscribe to `athletes` table changes -> refresh player counts

Throttle: Debounce client-side state updates when multiple rapid changes arrive (e.g., during attendance recording where 20+ rows change in seconds).

### Notification Delivery

Notifications generated server-side, stored in `notifications` table. Client polls or subscribes.

```sql
CREATE OR REPLACE FUNCTION public.check_expiring_registrations()
RETURNS void AS $$
BEGIN
  INSERT INTO public.notifications (organization_id, user_id, type, title, body, entity_type, entity_id)
  SELECT
    ar.organization_id, om.user_id,
    'registration_expiring',
    'Registration expiring: ' || a.first_name || ' ' || a.last_name,
    'Registration expires on ' || ar.registered_until::text,
    'athlete', a.id
  FROM public.athlete_registrations ar
  JOIN public.athletes a ON a.id = ar.athlete_id
  JOIN public.organization_memberships om ON om.organization_id = ar.organization_id
  WHERE ar.registered_until BETWEEN current_date AND current_date + 30
    AND ar.status != 'expired'
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.entity_id = a.id AND n.type = 'registration_expiring'
        AND n.created_at > now() - interval '7 days'
    );
END;
$$ LANGUAGE plpgsql;
```

Provider-independent architecture: V1 in-app + email, later SMS/WhatsApp/push.

### Calendar Synchronization

Calendar events are queries against trainings + games + meetings, not a separate table. Client-side renders unified view.

```sql
CREATE OR REPLACE FUNCTION public.get_calendar_events(
  p_organization_id uuid,
  p_team_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  event_id uuid,
  event_type text,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  venue_name text,
  team_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, 'training', t.team_id::text, t.starts_at, t.ends_at, v.name, tm.name
  FROM public.trainings t
  LEFT JOIN public.venues v ON v.id = t.venue_id
  LEFT JOIN public.teams tm ON tm.id = t.team_id
  WHERE t.organization_id = p_organization_id
    AND (p_team_id IS NULL OR t.team_id = p_team_id)
    AND t.starts_at::date BETWEEN p_start_date AND p_end_date

  UNION ALL

  SELECT g.id, 'match', g.opponent, g.kickoff_at, g.kickoff_at + interval '2 hours',
    v.name, tm.name
  FROM public.games g
  LEFT JOIN public.venues v ON v.id = g.venue_id
  LEFT JOIN public.teams tm ON tm.id = g.team_id
  WHERE g.organization_id = p_organization_id
    AND (p_team_id IS NULL OR g.team_id = p_team_id)
    AND g.kickoff_at::date BETWEEN p_start_date AND p_end_date

  ORDER BY starts_at ASC;
END;
$$ LANGUAGE plpgsql;
```

---

## Performance Considerations

### Dashboard Query Optimization

The "Requires Attention" section of the dashboard is the most query-heavy. Pre-compute with materialized views or caching:

```sql
-- Materialized view for expiring items (refresh periodically)
CREATE MATERIALIZED VIEW public.mv_expiring_items AS
SELECT
  organization_id,
  'registration' as item_type,
  athlete_id as entity_id,
  registered_until as expires_at
FROM public.athlete_registrations
WHERE registered_until IS NOT NULL AND registered_until > current_date

UNION ALL

SELECT
  organization_id,
  'contract' as item_type,
  athlete_id as entity_id,
  ended_at as expires_at
FROM public.athlete_contracts
WHERE ended_at IS NOT NULL AND ended_at > current_date

UNION ALL

SELECT
  organization_id,
  'document' as item_type,
  entity_id,
  expires_at
FROM public.documents
WHERE expires_at IS NOT NULL AND expires_at > current_date;

CREATE INDEX idx_mv_expiring_org ON public.mv_expiring_items(organization_id, expires_at);

-- Refresh periodically via pg_cron or Supabase Edge Function
-- REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_expiring_items;
```

### Search Implementation

For V1, use PostgreSQL full-text search with trigram similarity:

```sql
-- Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Search athletes within organization
CREATE OR REPLACE FUNCTION public.search_athletes(
  p_organization_id uuid,
  p_query text
)
RETURNS TABLE (
  athlete_id uuid,
  first_name text,
  last_name text,
  club_athlete_id text,
  team_name text,
  relevance real
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.first_name, a.last_name, a.club_athlete_id,
    COALESCE(tm.name, 'No team') as team_name,
    greatest(
      similarity(a.first_name || ' ' || a.last_name, p_query),
      similarity(a.club_athlete_id, p_query)
    )::real as relevance
  FROM public.athletes a
  LEFT JOIN public.v_current_team_memberships vtm ON vtm.athlete_id = a.id
  LEFT JOIN public.teams tm ON tm.id = vtm.team_id
  WHERE a.organization_id = p_organization_id
    AND (
      a.first_name % p_query
      OR a.last_name % p_query
      OR a.club_athlete_id LIKE '%' || p_query || '%'
    )
  ORDER BY relevance DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;
```

### Report Generation

Use database functions for report queries. Run complex aggregations server-side, never pull raw data to client.

```sql
CREATE OR REPLACE FUNCTION public.get_youth_finance_summary(
  p_organization_id uuid,
  p_season_id uuid
)
RETURNS TABLE (
  team_name text,
  total_players bigint,
  total_expected numeric,
  total_collected numeric,
  total_outstanding numeric,
  collection_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tm.name,
    COUNT(DISTINCT mc.athlete_id) as total_players,
    SUM(mc.amount) as total_expected,
    SUM(COALESCE(mc.amount_paid, 0)) as total_collected,
    SUM(mc.amount - COALESCE(mc.amount_paid, 0)) as total_outstanding,
    ROUND(COALESCE(SUM(mc.amount_paid), 0) / NULLIF(SUM(mc.amount), 0) * 100, 1) as collection_rate
  FROM public.membership_charges mc
  JOIN public.teams tm ON tm.id = mc.team_id
  WHERE mc.organization_id = p_organization_id
    AND mc.season_id = p_season_id
  GROUP BY tm.id, tm.name
  ORDER BY total_outstanding DESC;
END;
$$ LANGUAGE plpgsql;
```

### General Performance Rules

1. **Always index `organization_id`** as the first column in composite indexes
2. **Use partial indexes** for filtered queries (e.g., only unpaid charges)
3. **Use `MATERIALIZED VIEW`** for dashboard aggregations that don't need real-time freshness
4. **Paginate** all list queries (never return unbounded result sets)
5. **Use Supabase Edge Functions** for background jobs (notification generation, materialized view refresh)
6. **Avoid N+1 queries** -- use joins or batch fetching
7. **Profile slow queries** with `EXPLAIN (ANALYZE, BUFFERS)` before optimizing

---

## Sources

- Supabase Docs: Row Level Security -- https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Docs: Custom Claims and RBAC -- https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac
- Supabase Docs: Auth Hooks -- https://supabase.com/docs/guides/auth/auth-hooks
- Tomoda Hinata: Supabase RLS Production Design Guide -- https://tomodahinata.com/en/blog/supabase-rls-production-multi-tenancy-patterns
- Tomoda Hinata: RBAC with Supabase RLS -- https://tomodahinata.com/en/blog/supabase-rls-rbac-custom-claims-app-metadata-authorize-guide
- MetaDesign Solutions: Supabase RLS Patterns -- https://metadesignsolutions.com/blog/supabase-rls-patterns-production-guide-multi-tenant-saas
- ArborIA Technical Research: Multi-Tenant Supabase -- https://github.com/rfammon/Arboria2.0/blob/main/docs/analysis/research/technical-multi-tenant-supabase-research-2025-12-09.md
- point-source/supabase-tenant-rbac -- https://github.com/point-source/supabase-tenant-rbac
- PostgreSQL Documentation: Row-Level Security -- https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- STOZER-BRIEF.md -- product source of truth
