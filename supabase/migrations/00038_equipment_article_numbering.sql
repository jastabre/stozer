-- STOŽER Phase 2 equipment: per-article numbering capability.
--
-- A catalog ARTICLE may optionally carry a number/marking when issued to a
-- player (a jersey number on the kit, a bag number, ...). The catalog item
-- only stores WHETHER a number is supported; the actual value belongs to the
-- player's ASSIGNMENT (different players wear different numbers on the same
-- article). This is distinct from the roster jersey number, which stays on the
-- seasonal membership.
--
-- Non-destructive and additive:
--   * equipment_items.has_number      BOOLEAN NOT NULL DEFAULT false
--   * athlete_item_assignments.number TEXT (nullable)
-- Existing rows stay valid: every existing article defaults to has_number =
-- false and every existing assignment has a NULL number. No data is rewritten,
-- guessed or deleted; the club opts articles into numbering explicitly.

ALTER TABLE equipment_items
  ADD COLUMN has_number BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE athlete_item_assignments
  ADD COLUMN number TEXT;
