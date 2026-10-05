-- STOŽER Phase 2 equipment domain correction.
--
-- Separates three concepts that were previously conflated:
--   1) PLAYER SIZE PROFILE  -> sizes for the six standard clothing pieces,
--      stored on athlete_equipment for the six piece types (00018).
--   2) EQUIPMENT CATALOG    -> the club's actual items (Domaći dres, Trenerka,
--      Jakna, ...), multi-part aware via piece-type links. NEW: equipment_items.
--   3) ASSIGNMENTS          -> a catalog item issued to a specific player with
--      a state + the actual issued sizes (prefilled from the size profile).
--      NEW: athlete_item_assignments.
--
-- Also adds jersey_name ("Natpis na dresu") to the seasonal membership.

ALTER TABLE seasonal_memberships ADD COLUMN jersey_name TEXT;

-- ============================================================
-- EQUIPMENT CATALOG ITEMS
-- ============================================================
CREATE TABLE equipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  top_piece_type_id UUID REFERENCES equipment_types(id) ON DELETE SET NULL,
  bottom_piece_type_id UUID REFERENCES equipment_types(id) ON DELETE SET NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, name)
);
CREATE INDEX idx_equipment_items_org ON equipment_items(organization_id, sort_order);

-- Parent-side unique pair required by the composite org FK below (athletes
-- already has athletes_id_organization_unique from 00009).
ALTER TABLE equipment_items ADD CONSTRAINT equipment_items_id_organization_unique UNIQUE (id, organization_id);

ALTER TABLE equipment_items
  ADD CONSTRAINT equipment_items_top_org_fkey
  FOREIGN KEY (organization_id, top_piece_type_id) REFERENCES equipment_types(organization_id, id),
  ADD CONSTRAINT equipment_items_bottom_org_fkey
  FOREIGN KEY (organization_id, bottom_piece_type_id) REFERENCES equipment_types(organization_id, id);

-- ============================================================
-- PLAYER EQUIPMENT ASSIGNMENTS
-- ============================================================
CREATE TABLE athlete_item_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES equipment_items(id) ON DELETE CASCADE,
  state equipment_item_state NOT NULL DEFAULT 'missing',
  size_top TEXT,
  size_bottom TEXT,
  issued_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(athlete_id, item_id)
);
CREATE INDEX idx_aia_lookup ON athlete_item_assignments(organization_id, athlete_id, item_id);

ALTER TABLE athlete_item_assignments
  ADD CONSTRAINT aia_athlete_org_fkey
  FOREIGN KEY (organization_id, athlete_id) REFERENCES athletes(organization_id, id),
  ADD CONSTRAINT aia_item_org_fkey
  FOREIGN KEY (organization_id, item_id) REFERENCES equipment_items(organization_id, id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE equipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_items FORCE ROW LEVEL SECURITY;
ALTER TABLE athlete_item_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_item_assignments FORCE ROW LEVEL SECURITY;

CREATE POLICY "equipment_items_select" ON equipment_items
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.view')
  );
CREATE POLICY "equipment_items_write" ON equipment_items
  FOR ALL TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
  );

CREATE POLICY "aia_select" ON athlete_item_assignments
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.view')
  );
CREATE POLICY "aia_insert" ON athlete_item_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.report')
  );
CREATE POLICY "aia_update" ON athlete_item_assignments
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('equipment.report') OR public.authorize('equipment.manage'))
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('equipment.report') OR public.authorize('equipment.manage'))
  );
CREATE POLICY "aia_delete" ON athlete_item_assignments
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
  );

-- ============================================================
-- DEFAULT CATALOG SEED (multi-part items link the 6 piece types)
-- ============================================================
INSERT INTO equipment_items (organization_id, name, top_piece_type_id, bottom_piece_type_id, sort_order)
SELECT o.id, defaults.name, top.id, bottom.id, defaults.sort
FROM organizations o
CROSS JOIN (VALUES
  ('Domaći dres', 'Match Shirt', 'Match Shorts', 10),
  ('Gostujući dres', 'Match Shirt', 'Match Shorts', 11),
  ('Treći dres', 'Match Shirt', 'Match Shorts', 12),
  ('Trenerka', 'Tracksuit Top', 'Tracksuit Bottom', 20),
  ('Trening majica', 'Training Shirt', NULL, 30),
  ('Trening šorc', 'Training Shorts', NULL, 31),
  ('Jakna', NULL, NULL, 40)
) AS defaults(name, top, bottom, sort)
JOIN equipment_types top ON top.organization_id = o.id AND top.name = defaults.top
LEFT JOIN equipment_types bottom ON bottom.organization_id = o.id AND bottom.name = defaults.bottom
ON CONFLICT (organization_id, name) DO NOTHING;

CREATE TRIGGER equipment_items_updated_at
  BEFORE UPDATE ON equipment_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER athlete_item_assignments_updated_at
  BEFORE UPDATE ON athlete_item_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();