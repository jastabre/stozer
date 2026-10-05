-- STOŽER Phase 2 equipment: ARTICLE-level team requirements.
--
-- team_equipment_requirements (00009) keys on equipment_types (parts), but the
-- thing a club creates, issues and requires is a catalog ARTICLE
-- (equipment_items). Several articles share the same generic parts — Domaći,
-- Gostujući and Treći dres all use Match Shirt + Match Shorts — so a part-level
-- requirement cannot express "every player must have Domaći dres AND Gostujući
-- dres": both would collapse to the same two part rows.
--
-- This adds a NEW, separate, non-destructive requirements table keyed on the
-- catalog item. The legacy table is left untouched and its rows are NOT
-- migrated: a single part requirement ("Match Shirt") cannot be mapped
-- deterministically to one article (it may be Domaći/Gostujući/Treći dres), so
-- clubs re-select their required articles explicitly.

CREATE TABLE team_equipment_item_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES equipment_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, item_id)
);

CREATE INDEX idx_teir_team ON team_equipment_item_requirements(organization_id, team_id);

-- Tenant consistency at the database boundary (mirrors 00009 / 00019).
ALTER TABLE team_equipment_item_requirements
  ADD CONSTRAINT team_equipment_item_requirements_team_org_fkey
  FOREIGN KEY (organization_id, team_id) REFERENCES teams(organization_id, id),
  ADD CONSTRAINT team_equipment_item_requirements_item_org_fkey
  FOREIGN KEY (organization_id, item_id) REFERENCES equipment_items(organization_id, id);

ALTER TABLE team_equipment_item_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_equipment_item_requirements FORCE ROW LEVEL SECURITY;

CREATE POLICY "team_equipment_item_requirements_select" ON team_equipment_item_requirements
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.view')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  );

CREATE POLICY "team_equipment_item_requirements_write" ON team_equipment_item_requirements
  FOR ALL TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  );

-- Base privileges for the new table (00016 restores them project-wide; keep the
-- new table consistent so RLS can run).
GRANT ALL ON TABLE team_equipment_item_requirements TO anon, authenticated, service_role;
