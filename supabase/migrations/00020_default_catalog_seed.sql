-- STOŽER 00020: complete the default equipment catalog.
-- The 00019 seed used an INNER JOIN on top_piece_type_id, so single-piece and
-- no-piece items (Trening majica/šorc via NULL bottom were fine, but "Jakna"
-- with no pieces at all was dropped). Re-seed every default item with LEFT
-- joins so nothing is missing on any organization.
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
LEFT JOIN equipment_types top ON top.organization_id = o.id AND top.name = defaults.top
LEFT JOIN equipment_types bottom ON bottom.organization_id = o.id AND bottom.name = defaults.bottom
ON CONFLICT (organization_id, name) DO NOTHING;