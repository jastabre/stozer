-- 00036_staff_functions_and_athlete_link.sql
--
-- Minimal additive model approved for Phase 2:
--
--   * staff_functions — a staff profile can hold MULTIPLE club functions
--     (exactly one primary). Functions are the club's real functions and stay
--     completely separate from the Stožer app role (staff.role /
--     organization_memberships.role).
--
--   * staff.athlete_id — optional link from a staff profile to an existing
--     athlete row, so the same physical person can be player AND staff without
--     two unrelated identities. Existing athletes are linked manually through
--     the UI; this migration never guesses by name/email.
--
-- NON-DESTRUCTIVE: one new table + two new columns/indexes. No existing table
-- is recreated, no existing column is altered, no row is deleted or rewritten
-- (the only write is the additive backfill of staff_functions from staff.title,
-- which leaves staff.title untouched).
--
-- PostgreSQL 15 (supabase/config.toml): column-list SET NULL on the composite
-- FK is supported, so deleting an athlete clears ONLY staff.athlete_id and
-- never deletes the staff profile or nulls organization_id.

BEGIN;

-- ============================================================
-- STAFF FUNCTIONS
-- ============================================================

CREATE TABLE staff_functions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  -- Preset key from src/lib/staff-functions.ts, or 'custom' with a free label.
  -- No enum/check list of preset keys here: the preset catalogue stays in one
  -- place (TypeScript) and the DB only enforces structural consistency.
  function_key TEXT NOT NULL,
  custom_label TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT staff_functions_function_key_check CHECK (
    length(btrim(function_key)) > 0
  ),
  CONSTRAINT staff_functions_custom_label_check CHECK (
    (function_key = 'custom' AND custom_label IS NOT NULL AND length(btrim(custom_label)) > 0)
    OR (function_key <> 'custom' AND custom_label IS NULL)
  )
);

-- Cross-org hardening (00011 pattern): the staff profile must belong to the
-- same organization. staff already carries UNIQUE (id, organization_id) from
-- 00009_equipment.sql, which this composite FK references.
ALTER TABLE staff_functions
  ADD CONSTRAINT staff_functions_staff_org_fkey
    FOREIGN KEY (organization_id, staff_id) REFERENCES staff(organization_id, id)
    ON DELETE CASCADE;

-- At most ONE primary function per staff profile.
CREATE UNIQUE INDEX staff_functions_one_primary
  ON staff_functions(staff_id) WHERE is_primary;

-- A preset function appears at most once per staff profile. 'custom' rows are
-- intentionally excluded so multiple different custom functions are allowed.
CREATE UNIQUE INDEX staff_functions_unique_preset
  ON staff_functions(staff_id, function_key) WHERE function_key <> 'custom';

CREATE INDEX idx_staff_functions_staff
  ON staff_functions(organization_id, staff_id);

ALTER TABLE staff_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_functions FORCE ROW LEVEL SECURITY;

-- Same permission boundary as the staff table itself: no new permission
-- concepts, no team-scope narrowing beyond what staff already applies in the
-- app layer (staff.ts coach self-scope).
CREATE POLICY "staff_functions_select" ON staff_functions
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.view')
  );

CREATE POLICY "staff_functions_insert" ON staff_functions
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
  );

CREATE POLICY "staff_functions_update" ON staff_functions
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
  );

CREATE POLICY "staff_functions_delete" ON staff_functions
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
  );

CREATE TRIGGER staff_functions_updated_at
  BEFORE UPDATE ON staff_functions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------
-- Backfill: one primary function per existing staff.title.
--
-- Labels match STAFF_FUNCTION_LABELS (src/lib/staff-functions.ts) in both
-- locales; anything else becomes a custom function with the original title as
-- the label. staff.title is NOT modified.
-- ---------------------------------------------------------------
INSERT INTO staff_functions (
  organization_id,
  staff_id,
  function_key,
  custom_label,
  is_primary
)
SELECT
  s.organization_id,
  s.id,
  COALESCE(m.function_key, 'custom'),
  CASE WHEN m.function_key IS NULL THEN s.title ELSE NULL END,
  true
FROM staff s
LEFT JOIN (VALUES
  ('Predsednik', 'president'),
  ('President', 'president'),
  ('Sportski direktor', 'sport_director'),
  ('Sport director', 'sport_director'),
  ('Direktor omladinske škole', 'youth_director'),
  ('Youth school director', 'youth_director'),
  ('Trener', 'coach'),
  ('Coach', 'coach'),
  ('Pomoćni trener', 'assistant_coach'),
  ('Assistant coach', 'assistant_coach'),
  ('Trener golmana', 'goalkeeper_coach'),
  ('Goalkeeper coach', 'goalkeeper_coach'),
  ('Kondicioni trener', 'fitness_coach'),
  ('Fitness coach', 'fitness_coach'),
  ('Ekonom', 'econom'),
  ('Kit manager', 'econom'),
  ('Doktor', 'doctor'),
  ('Doctor', 'doctor'),
  ('Fizioterapeut', 'physiotherapist'),
  ('Physiotherapist', 'physiotherapist'),
  ('Sekretar', 'secretary'),
  ('Secretary', 'secretary')
) AS m(label, function_key) ON m.label = s.title
WHERE s.title IS NOT NULL AND btrim(s.title) <> '';

-- ============================================================
-- STAFF -> ATHLETE LINK (same physical person)
-- ============================================================

ALTER TABLE staff ADD COLUMN athlete_id UUID;

-- Cross-org protection + delete safety in one composite FK:
--   * organization_id + athlete_id must reference an athlete of the same org;
--   * deleting the athlete clears ONLY athlete_id (PG15 column-list SET NULL),
--     so the staff profile is never deleted and organization_id stays intact.
ALTER TABLE staff
  ADD CONSTRAINT staff_athlete_org_fkey
    FOREIGN KEY (organization_id, athlete_id)
    REFERENCES athletes(organization_id, id)
    ON DELETE SET NULL (athlete_id);

-- One athlete links to at most one staff profile per organization.
CREATE UNIQUE INDEX staff_athlete_unique
  ON staff(organization_id, athlete_id) WHERE athlete_id IS NOT NULL;

COMMIT;
