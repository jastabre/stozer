-- 00040_team_jersey_number_unique.sql
--
-- "Broj dresa mora biti jedinstven u timu."
--
-- Within the same team and the same season, two ACTIVE memberships must not
-- share a jersey number. This is the race-proof database backstop behind the
-- application-level pre-check in src/lib/jersey-number.ts.
--
--   - same season + same team + same number  -> blocked
--   - same season + different team           -> allowed
--   - different season + same team           -> allowed (season_id is only the
--     historical boundary so an archived roster never blocks the current one)
--   - NULL jersey number                     -> allowed (repeats freely)
--   - moved/left (non-active) memberships    -> do not block reuse
--
-- Non-destructive: no rows are read, rewritten, or removed.

CREATE UNIQUE INDEX seasonal_memberships_active_team_jersey_unique
  ON seasonal_memberships (season_id, team_id, jersey_number)
  WHERE status = 'active' AND jersey_number IS NOT NULL;
