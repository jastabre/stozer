-- STOZER Equipment Migration (Phase 2, 02-07)
-- Lightweight athlete kit, team equipment quantities, and requests.
-- This deliberately does not model serials, warehouses, suppliers, or stock.

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE equipment_item_state AS ENUM ('missing', 'issued', 'returned', 'lost', 'damaged');
CREATE TYPE equipment_request_status AS ENUM ('requested', 'approved', 'purchased', 'rejected');

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE equipment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size_model TEXT NOT NULL CHECK (size_model IN ('single', 'upper_lower')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  is_club_property BOOLEAN NOT NULL DEFAULT true,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, name)
);

CREATE TABLE team_equipment_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  equipment_type_id UUID NOT NULL REFERENCES equipment_types(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, equipment_type_id)
);

CREATE TABLE athlete_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  equipment_type_id UUID NOT NULL REFERENCES equipment_types(id) ON DELETE CASCADE,
  size_value TEXT,
  size_value_upper TEXT,
  state equipment_item_state NOT NULL DEFAULT 'missing',
  issued_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(athlete_id, equipment_type_id)
);

CREATE TABLE team_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  responsible_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity SMALLINT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  state equipment_item_state NOT NULL DEFAULT 'issued',
  season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE equipment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity SMALLINT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  note TEXT,
  requester_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  status equipment_request_status NOT NULL DEFAULT 'requested',
  decided_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_equipment_types_org_enabled ON equipment_types(organization_id, enabled, sort_order);
CREATE INDEX idx_team_equipment_requirements_team ON team_equipment_requirements(organization_id, team_id);
CREATE INDEX idx_athlete_equipment_lookup ON athlete_equipment(organization_id, athlete_id, equipment_type_id);
CREATE INDEX idx_team_equipment_lookup ON team_equipment(organization_id, team_id, season_id);
CREATE INDEX idx_equipment_requests_status ON equipment_requests(organization_id, status);

-- Composite organization keys prevent a caller from linking a row in this
-- domain to a parent record belonging to another organization. The ordinary
-- single-column foreign keys above preserve the normal delete behavior; these
-- constraints enforce tenant consistency at the database boundary as well.
ALTER TABLE teams ADD CONSTRAINT teams_id_organization_unique UNIQUE (id, organization_id);
ALTER TABLE seasons ADD CONSTRAINT seasons_id_organization_unique UNIQUE (id, organization_id);
ALTER TABLE athletes ADD CONSTRAINT athletes_id_organization_unique UNIQUE (id, organization_id);
ALTER TABLE staff ADD CONSTRAINT staff_id_organization_unique UNIQUE (id, organization_id);
ALTER TABLE equipment_types ADD CONSTRAINT equipment_types_id_organization_unique UNIQUE (id, organization_id);

ALTER TABLE team_equipment_requirements
  ADD CONSTRAINT team_equipment_requirements_team_org_fkey
  FOREIGN KEY (organization_id, team_id) REFERENCES teams(organization_id, id),
  ADD CONSTRAINT team_equipment_requirements_type_org_fkey
  FOREIGN KEY (organization_id, equipment_type_id) REFERENCES equipment_types(organization_id, id);

ALTER TABLE athlete_equipment
  ADD CONSTRAINT athlete_equipment_athlete_org_fkey
  FOREIGN KEY (organization_id, athlete_id) REFERENCES athletes(organization_id, id),
  ADD CONSTRAINT athlete_equipment_type_org_fkey
  FOREIGN KEY (organization_id, equipment_type_id) REFERENCES equipment_types(organization_id, id);

ALTER TABLE team_equipment
  ADD CONSTRAINT team_equipment_team_org_fkey
  FOREIGN KEY (organization_id, team_id) REFERENCES teams(organization_id, id),
  ADD CONSTRAINT team_equipment_staff_org_fkey
  FOREIGN KEY (organization_id, responsible_staff_id) REFERENCES staff(organization_id, id),
  ADD CONSTRAINT team_equipment_season_org_fkey
  FOREIGN KEY (organization_id, season_id) REFERENCES seasons(organization_id, id);

ALTER TABLE equipment_requests
  ADD CONSTRAINT equipment_requests_team_org_fkey
  FOREIGN KEY (organization_id, team_id) REFERENCES teams(organization_id, id),
  ADD CONSTRAINT equipment_requests_requester_org_fkey
  FOREIGN KEY (organization_id, requester_staff_id) REFERENCES staff(organization_id, id),
  ADD CONSTRAINT equipment_requests_decider_org_fkey
  FOREIGN KEY (organization_id, decided_by_staff_id) REFERENCES staff(organization_id, id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE equipment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_equipment_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE equipment_types FORCE ROW LEVEL SECURITY;
ALTER TABLE team_equipment_requirements FORCE ROW LEVEL SECURITY;
ALTER TABLE athlete_equipment FORCE ROW LEVEL SECURITY;
ALTER TABLE team_equipment FORCE ROW LEVEL SECURITY;
ALTER TABLE equipment_requests FORCE ROW LEVEL SECURITY;

-- Equipment types and team requirements are configuration managed by users
-- with equipment.manage; all equipment viewers can read them.
CREATE POLICY "equipment_types_select" ON equipment_types
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.view')
  );

CREATE POLICY "equipment_types_insert" ON equipment_types
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
  );

CREATE POLICY "equipment_types_update" ON equipment_types
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
  );

CREATE POLICY "equipment_types_delete" ON equipment_types
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
  );

CREATE POLICY "team_equipment_requirements_select" ON team_equipment_requirements
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.view')
  );

CREATE POLICY "team_equipment_requirements_write" ON team_equipment_requirements
  FOR ALL TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
  );

CREATE POLICY "athlete_equipment_select" ON athlete_equipment
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.view')
  );

CREATE POLICY "athlete_equipment_report" ON athlete_equipment
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.report')
  );

CREATE POLICY "athlete_equipment_update" ON athlete_equipment
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('equipment.report') OR public.authorize('equipment.manage'))
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('equipment.report') OR public.authorize('equipment.manage'))
  );

CREATE POLICY "athlete_equipment_delete" ON athlete_equipment
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
  );

CREATE POLICY "team_equipment_select" ON team_equipment
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.view')
  );

CREATE POLICY "team_equipment_write" ON team_equipment
  FOR ALL TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
  );

CREATE POLICY "equipment_requests_select" ON equipment_requests
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.view')
  );

CREATE POLICY "equipment_requests_insert" ON equipment_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.report')
  );

CREATE POLICY "equipment_requests_update" ON equipment_requests
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
  );

CREATE POLICY "equipment_requests_delete" ON equipment_requests
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
  );

-- ============================================================
-- DEFAULT TYPES + TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION seed_equipment_types()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO equipment_types (organization_id, name, size_model, is_club_property, sort_order)
  VALUES
    (NEW.id, 'Match Kit', 'upper_lower', true, 10),
    (NEW.id, 'Tracksuit', 'upper_lower', true, 20),
    (NEW.id, 'Training Kit', 'upper_lower', true, 30)
  ON CONFLICT (organization_id, name) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

INSERT INTO equipment_types (organization_id, name, size_model, is_club_property, sort_order)
SELECT organizations.id, defaults.name, defaults.size_model::text, defaults.is_club_property, defaults.sort_order
FROM organizations
CROSS JOIN (VALUES
  ('Match Kit', 'upper_lower', true, 10),
  ('Tracksuit', 'upper_lower', true, 20),
  ('Training Kit', 'upper_lower', true, 30)
) AS defaults(name, size_model, is_club_property, sort_order)
ON CONFLICT (organization_id, name) DO NOTHING;

CREATE TRIGGER organizations_seed_equipment_types
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION seed_equipment_types();

CREATE TRIGGER equipment_types_updated_at
  BEFORE UPDATE ON equipment_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER athlete_equipment_updated_at
  BEFORE UPDATE ON athlete_equipment
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER team_equipment_updated_at
  BEFORE UPDATE ON team_equipment
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER equipment_requests_updated_at
  BEFORE UPDATE ON equipment_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
