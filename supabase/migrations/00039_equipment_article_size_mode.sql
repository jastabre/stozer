-- STOŽER Phase 2 equipment: article size MODE.
--
-- The everyday article setup no longer asks which internal part/size-source an
-- article maps to. An article simply declares HOW MANY size values it uses:
--   none   -> no size
--   single -> one size
--   split  -> upper + lower sizes
-- The ACTUAL clothing sizes (XS..XXXL / custom) are chosen when the article is
-- issued and stored on the assignment (athlete_item_assignments.size_top /
-- size_bottom already hold real size strings).
--
-- Non-destructive and additive. Existing articles are backfilled
-- deterministically from the piece links they already carry (their own
-- composition): both pieces -> split, exactly one -> single, none -> none.
-- The legacy top_piece_type_id / bottom_piece_type_id columns are kept
-- untouched for compatibility; no rows are deleted, and no assignment sizes
-- are rewritten.

ALTER TABLE equipment_items
  ADD COLUMN size_mode TEXT NOT NULL DEFAULT 'none'
  CHECK (size_mode IN ('none', 'single', 'split'));

UPDATE equipment_items
SET size_mode = CASE
  WHEN top_piece_type_id IS NOT NULL AND bottom_piece_type_id IS NOT NULL THEN 'split'
  WHEN top_piece_type_id IS NOT NULL OR bottom_piece_type_id IS NOT NULL THEN 'single'
  ELSE 'none'
END;
