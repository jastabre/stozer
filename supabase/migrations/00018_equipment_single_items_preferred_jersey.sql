-- STOŽER Phase 2 equipment model correction + preferred jersey number.
--
-- 1) Player clothing becomes SEPARATE single-size items (not upper/lower
--    pairs): each piece has its own size. The three old default types
--    (Match Kit / Tracksuit / Training Kit, size_model = upper_lower) are
--    replaced by six single-size types, existing athlete_equipment rows are
--    carried into the split items (top size -> top item, bottom size -> bottom
--    item), and the old types are disabled (not deleted — keeps history).
--
-- 2) athletes.preferred_jersey_number: player-level jersey PREFERENCE,
--    distinct from the seasonal-membership jersey number.

ALTER TABLE athletes
  ADD COLUMN preferred_jersey_number SMALLINT
  CHECK (preferred_jersey_number BETWEEN 1 AND 99);

-- Seed the six single-size default types for NEW organizations (replaces the
-- old upper/lower trio in the org-onboarding trigger).
CREATE OR REPLACE FUNCTION seed_equipment_types()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO equipment_types (organization_id, name, size_model, is_club_property, sort_order)
  VALUES
    (NEW.id, 'Match Shirt', 'single', true, 10),
    (NEW.id, 'Match Shorts', 'single', true, 11),
    (NEW.id, 'Tracksuit Top', 'single', true, 20),
    (NEW.id, 'Tracksuit Bottom', 'single', true, 21),
    (NEW.id, 'Training Shirt', 'single', true, 30),
    (NEW.id, 'Training Shorts', 'single', true, 31)
  ON CONFLICT (organization_id, name) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Insert the six types for every existing organization.
INSERT INTO equipment_types (organization_id, name, size_model, is_club_property, sort_order)
SELECT organizations.id, defaults.name, defaults.size_model::text, defaults.is_club_property, defaults.sort_order
FROM organizations
CROSS JOIN (VALUES
  ('Match Shirt', 'single', true, 10),
  ('Match Shorts', 'single', true, 11),
  ('Tracksuit Top', 'single', true, 20),
  ('Tracksuit Bottom', 'single', true, 21),
  ('Training Shirt', 'single', true, 30),
  ('Training Shorts', 'single', true, 31)
) AS defaults(name, size_model, is_club_property, sort_order)
ON CONFLICT (organization_id, name) DO NOTHING;

-- Carry existing per-athlete data from the old upper_lower types into the new
-- single items (size_value -> top piece, size_value_upper -> bottom piece),
-- preserving state, timestamps and note.
DO $$
DECLARE
  org_rec RECORD;
  old_type uuid;
  new_top uuid;
  new_bottom uuid;
  top_name text;
  bottom_name text;
BEGIN
  FOR org_rec IN SELECT id FROM organizations LOOP
    FOREACH top_name IN ARRAY ARRAY['Match Shirt', 'Tracksuit Top', 'Training Shirt'] LOOP
      bottom_name := CASE top_name
        WHEN 'Match Shirt' THEN 'Match Shorts'
        WHEN 'Tracksuit Top' THEN 'Tracksuit Bottom'
        ELSE 'Training Shorts'
      END;
      SELECT id INTO old_type FROM equipment_types
        WHERE organization_id = org_rec.id AND name = CASE top_name
          WHEN 'Match Shirt' THEN 'Match Kit'
          WHEN 'Tracksuit Top' THEN 'Tracksuit'
          ELSE 'Training Kit'
        END;
      SELECT id INTO new_top FROM equipment_types
        WHERE organization_id = org_rec.id AND name = top_name;
      SELECT id INTO new_bottom FROM equipment_types
        WHERE organization_id = org_rec.id AND name = bottom_name;
      IF old_type IS NULL OR new_top IS NULL OR new_bottom IS NULL THEN
        CONTINUE;
      END IF;

      INSERT INTO athlete_equipment
        (organization_id, athlete_id, equipment_type_id, size_value, size_value_upper, state, issued_at, returned_at, note)
      SELECT organization_id, athlete_id, new_top, size_value, NULL, state, issued_at, returned_at, note
        FROM athlete_equipment
        WHERE organization_id = org_rec.id AND equipment_type_id = old_type AND size_value IS NOT NULL
      ON CONFLICT (athlete_id, equipment_type_id) DO NOTHING;

      INSERT INTO athlete_equipment
        (organization_id, athlete_id, equipment_type_id, size_value, size_value_upper, state, issued_at, returned_at, note)
      SELECT organization_id, athlete_id, new_bottom, size_value_upper, NULL, state, issued_at, returned_at, note
        FROM athlete_equipment
        WHERE organization_id = org_rec.id AND equipment_type_id = old_type AND size_value_upper IS NOT NULL
      ON CONFLICT (athlete_id, equipment_type_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Disable the old upper/lower default types (history preserved; no longer used
-- for new assignments).
UPDATE equipment_types SET enabled = false
  WHERE name IN ('Match Kit', 'Tracksuit', 'Training Kit');