-- STOZER Staff & Guardians Migration (Phase 2, 02-04)
-- Staff profiles are independent from login accounts (D-16/D-17). Guardians
-- are athlete contact records with multiple entries and one primary (D-20).
-- All tables use the Phase 1/2 RLS convention: org claim + authorize().

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  role app_role,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  photo_url TEXT,
  phone TEXT,
  email TEXT,
  title TEXT,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_staff_org_name ON staff(organization_id, last_name, first_name);
CREATE INDEX idx_staff_user ON staff(user_id);

CREATE TABLE staff_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, team_id, season_id)
);

CREATE INDEX idx_staff_teams_staff_season ON staff_teams(staff_id, season_id);
CREATE INDEX idx_staff_teams_team_season ON staff_teams(team_id, season_id);

CREATE TABLE staff_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  license_type TEXT NOT NULL,
  license_number TEXT,
  valid_until DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_staff_licenses_staff ON staff_licenses(organization_id, staff_id);
CREATE INDEX idx_staff_licenses_expiry ON staff_licenses(organization_id, valid_until);

CREATE TABLE guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  preferred_contact TEXT CHECK (preferred_contact IN ('phone', 'email', 'sms', 'other')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_guardians_athlete ON guardians(organization_id, athlete_id);

-- Multiple guardians are allowed, but one athlete can have only one primary.
CREATE UNIQUE INDEX one_primary_guardian_per_athlete
  ON guardians(athlete_id) WHERE is_primary;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;

ALTER TABLE staff FORCE ROW LEVEL SECURITY;
ALTER TABLE staff_teams FORCE ROW LEVEL SECURITY;
ALTER TABLE staff_licenses FORCE ROW LEVEL SECURITY;
ALTER TABLE guardians FORCE ROW LEVEL SECURITY;

-- staff: staff.ts applies the coach's own-profile scope in addition to this
-- org + permission boundary.
CREATE POLICY "staff_select" ON staff
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.view')
  );

CREATE POLICY "staff_insert" ON staff
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
  );

CREATE POLICY "staff_update" ON staff
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
  );

CREATE POLICY "staff_delete" ON staff
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
  );

CREATE POLICY "staff_teams_select" ON staff_teams
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.view')
  );

CREATE POLICY "staff_teams_insert" ON staff_teams
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
  );

CREATE POLICY "staff_teams_update" ON staff_teams
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
  );

CREATE POLICY "staff_teams_delete" ON staff_teams
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
  );

CREATE POLICY "staff_licenses_select" ON staff_licenses
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.view')
  );

CREATE POLICY "staff_licenses_insert" ON staff_licenses
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
  );

CREATE POLICY "staff_licenses_update" ON staff_licenses
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
  );

CREATE POLICY "staff_licenses_delete" ON staff_licenses
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
  );

-- Guardians follow athlete-profile permissions: staff with staff.view may read;
-- only users with athlete editing permission may modify contact records.
CREATE POLICY "guardians_select" ON guardians
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('athletes.view') OR public.authorize('staff.view'))
  );

CREATE POLICY "guardians_insert" ON guardians
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.edit')
  );

CREATE POLICY "guardians_update" ON guardians
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.edit')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.edit')
  );

CREATE POLICY "guardians_delete" ON guardians
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.edit')
  );

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE TRIGGER staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER staff_licenses_updated_at
  BEFORE UPDATE ON staff_licenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER guardians_updated_at
  BEFORE UPDATE ON guardians
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
