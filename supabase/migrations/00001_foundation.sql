-- STOZER Foundation Migration
-- Phase 1: Multi-tenant schema with RLS, auth, subscriptions

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE app_role AS ENUM (
  'club_president',
  'youth_director',
  'coach',
  'admin_finance',
  'super_admin'
);

CREATE TYPE app_permission AS ENUM (
  'teams.view',
  'teams.create',
  'teams.edit',
  'teams.delete',
  'athletes.view',
  'athletes.create',
  'athletes.edit',
  'athletes.delete',
  'athletes.view_sensitive',
  'athletes.edit_sensitive',
  'attendance.manage',
  'youth_finance.view',
  'youth_finance.manage',
  'first_team_finance.view',
  'first_team_finance.manage',
  'registrations.view',
  'registrations.manage',
  'contracts.view',
  'contracts.manage',
  'documents.view',
  'documents.manage',
  'sponsors.view',
  'sponsors.manage',
  'staff.view',
  'staff.manage',
  'reports.view',
  'reports.export',
  'club_settings.manage',
  'notifications.manage'
);

-- ============================================================
-- TABLES
-- ============================================================

-- Organizations (tenants)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sport TEXT,
  country TEXT,
  language TEXT DEFAULT 'sr',
  currency TEXT DEFAULT 'RSD',
  timezone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Organization memberships (user-org junction)
CREATE TABLE organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Roles (reference data)
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name app_role UNIQUE NOT NULL,
  display_name TEXT NOT NULL
);

-- Role permissions (reference data)
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission app_permission NOT NULL,
  UNIQUE(role, permission)
);

-- Subscription plans
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true
);

-- Plan entitlements (configurable limits per plan)
CREATE TABLE plan_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value INTEGER NOT NULL,
  UNIQUE(plan_id, key)
);

-- Subscriptions (per-organization)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  status TEXT DEFAULT 'active',
  trial_starts_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_org_memberships_org ON organization_memberships(organization_id);
CREATE INDEX idx_org_memberships_user ON organization_memberships(user_id);
CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX idx_plan_entitlements_plan ON plan_entitlements(plan_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- FORCE RLS on all tables (even superuser must go through policies)
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE plans FORCE ROW LEVEL SECURITY;
ALTER TABLE plan_entitlements FORCE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;

-- ============================================================
-- POSTGRESQL FUNCTIONS
-- ============================================================

-- Get current organization_id from JWT claims
CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json->>'organization_id',
    ''
  )::UUID;
$$;

-- Check if current user has a specific permission
CREATE OR REPLACE FUNCTION public.authorize(p app_permission)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role = (
      current_setting('request.jwt.claims', true)::json->>'user_role'
    )::app_role
    AND rp.permission = p
  );
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Organizations: members can see their own org
CREATE POLICY "org_select_members" ON organizations
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Organizations: authenticated users can create orgs
CREATE POLICY "org_insert_auth" ON organizations
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Organization memberships: members can see their own memberships
CREATE POLICY "membership_select" ON organization_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Organization memberships: org president can manage memberships
CREATE POLICY "membership_insert" ON organization_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_memberships om
      WHERE om.user_id = auth.uid() AND om.role = 'club_president'
    )
  );

-- Organization memberships: president can update, users can update own role changes
CREATE POLICY "membership_update" ON organization_memberships
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id IN (
      SELECT om.organization_id FROM organization_memberships om
      WHERE om.user_id = auth.uid() AND om.role = 'club_president'
    )
  );

-- Organization memberships: president can delete memberships
CREATE POLICY "membership_delete" ON organization_memberships
  FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_memberships om
      WHERE om.user_id = auth.uid() AND om.role = 'club_president'
    )
  );

-- Roles: all authenticated users can read (shared reference data)
CREATE POLICY "roles_select" ON roles
  FOR SELECT TO authenticated
  USING (true);

-- Role permissions: all authenticated users can read (shared reference data)
CREATE POLICY "role_permissions_select" ON role_permissions
  FOR SELECT TO authenticated
  USING (true);

-- Plans: all authenticated users can read (shared reference data)
CREATE POLICY "plans_select" ON plans
  FOR SELECT TO authenticated
  USING (true);

-- Plan entitlements: all authenticated users can read (shared reference data)
CREATE POLICY "plan_entitlements_select" ON plan_entitlements
  FOR SELECT TO authenticated
  USING (true);

-- Subscriptions: org members can see their org's subscription
CREATE POLICY "subscription_select" ON subscriptions
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_memberships om
      WHERE om.user_id = auth.uid()
    )
  );

-- Subscriptions: org president can insert subscription
CREATE POLICY "subscription_insert" ON subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_memberships om
      WHERE om.user_id = auth.uid() AND om.role = 'club_president'
    )
  );

-- Subscriptions: org president can update subscription
CREATE POLICY "subscription_update" ON subscriptions
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_memberships om
      WHERE om.user_id = auth.uid() AND om.role = 'club_president'
    )
  );

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at on organizations
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED DATA: PLANS
-- ============================================================

INSERT INTO plans (id, name, display_name, is_active) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'FREE', 'Free', true),
  ('a0000000-0000-0000-0000-000000000002', 'CLUB', 'Club', true),
  ('a0000000-0000-0000-0000-000000000003', 'PRO', 'Pro', true);

-- ============================================================
-- SEED DATA: PLAN ENTITLEMENTS
-- ============================================================

-- FREE plan entitlements
INSERT INTO plan_entitlements (plan_id, key, value) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'max_teams', 1),
  ('a0000000-0000-0000-0000-000000000001', 'max_players', 20),
  ('a0000000-0000-0000-0000-000000000001', 'max_staff', 2),
  ('a0000000-0000-0000-0000-000000000001', 'max_sports', 1);

-- CLUB plan entitlements
INSERT INTO plan_entitlements (plan_id, key, value) VALUES
  ('a0000000-0000-0000-0000-000000000002', 'max_teams', 999),
  ('a0000000-0000-0000-0000-000000000002', 'max_players', 9999),
  ('a0000000-0000-0000-0000-000000000002', 'max_staff', 999),
  ('a0000000-0000-0000-0000-000000000002', 'max_sports', 999);

-- PRO plan entitlements
INSERT INTO plan_entitlements (plan_id, key, value) VALUES
  ('a0000000-0000-0000-0000-000000000003', 'max_teams', 999),
  ('a0000000-0000-0000-0000-000000000003', 'max_players', 99999),
  ('a0000000-0000-0000-0000-000000000003', 'max_staff', 9999),
  ('a0000000-0000-0000-0000-000000000003', 'max_sports', 999);

-- ============================================================
-- SEED DATA: ROLES
-- ============================================================

INSERT INTO roles (name, display_name) VALUES
  ('club_president', 'Predsednik kluba'),
  ('youth_director', 'Direktor omladine'),
  ('coach', 'Trener'),
  ('admin_finance', 'Admin/Finansije'),
  ('super_admin', 'Super Admin');

-- ============================================================
-- SEED DATA: ROLE PERMISSIONS
-- ============================================================

-- Club President: ALL permissions
INSERT INTO role_permissions (role, permission)
SELECT 'club_president', unnest(ARRAY[
  'teams.view'::app_permission,
  'teams.create'::app_permission,
  'teams.edit'::app_permission,
  'teams.delete'::app_permission,
  'athletes.view'::app_permission,
  'athletes.create'::app_permission,
  'athletes.edit'::app_permission,
  'athletes.delete'::app_permission,
  'athletes.view_sensitive'::app_permission,
  'athletes.edit_sensitive'::app_permission,
  'attendance.manage'::app_permission,
  'youth_finance.view'::app_permission,
  'youth_finance.manage'::app_permission,
  'first_team_finance.view'::app_permission,
  'first_team_finance.manage'::app_permission,
  'registrations.view'::app_permission,
  'registrations.manage'::app_permission,
  'contracts.view'::app_permission,
  'contracts.manage'::app_permission,
  'documents.view'::app_permission,
  'documents.manage'::app_permission,
  'sponsors.view'::app_permission,
  'sponsors.manage'::app_permission,
  'staff.view'::app_permission,
  'staff.manage'::app_permission,
  'reports.view'::app_permission,
  'reports.export'::app_permission,
  'club_settings.manage'::app_permission,
  'notifications.manage'::app_permission
]);

-- Youth Director: youth academy scope
INSERT INTO role_permissions (role, permission)
SELECT 'youth_director', unnest(ARRAY[
  'teams.view'::app_permission,
  'teams.create'::app_permission,
  'teams.edit'::app_permission,
  'athletes.view'::app_permission,
  'athletes.create'::app_permission,
  'athletes.edit'::app_permission,
  'athletes.view_sensitive'::app_permission,
  'athletes.edit_sensitive'::app_permission,
  'attendance.manage'::app_permission,
  'youth_finance.view'::app_permission,
  'youth_finance.manage'::app_permission,
  'documents.view'::app_permission,
  'documents.manage'::app_permission,
  'registrations.view'::app_permission,
  'registrations.manage'::app_permission,
  'reports.view'::app_permission,
  'reports.export'::app_permission,
  'staff.view'::app_permission,
  'notifications.manage'::app_permission
]);

-- Coach: team operations only
INSERT INTO role_permissions (role, permission)
SELECT 'coach', unnest(ARRAY[
  'teams.view'::app_permission,
  'athletes.view'::app_permission,
  'athletes.view_sensitive'::app_permission,
  'attendance.manage'::app_permission,
  'documents.view'::app_permission,
  'notifications.manage'::app_permission
]);

-- Admin/Finance: finance and admin scope
INSERT INTO role_permissions (role, permission)
SELECT 'admin_finance', unnest(ARRAY[
  'teams.view'::app_permission,
  'athletes.view'::app_permission,
  'athletes.view_sensitive'::app_permission,
  'youth_finance.view'::app_permission,
  'youth_finance.manage'::app_permission,
  'first_team_finance.view'::app_permission,
  'first_team_finance.manage'::app_permission,
  'registrations.view'::app_permission,
  'registrations.manage'::app_permission,
  'contracts.view'::app_permission,
  'contracts.manage'::app_permission,
  'documents.view'::app_permission,
  'documents.manage'::app_permission,
  'staff.view'::app_permission,
  'staff.manage'::app_permission,
  'reports.view'::app_permission,
  'reports.export'::app_permission,
  'club_settings.manage'::app_permission,
  'notifications.manage'::app_permission,
  'sponsors.view'::app_permission,
  'sponsors.manage'::app_permission
]);
