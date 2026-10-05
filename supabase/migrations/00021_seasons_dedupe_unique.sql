-- 00021_seasons_dedupe_unique.sql
--
-- Prevent duplicate seasons for the same organization/period and safely clean
-- up any that already exist.
--
-- Manual UAT showed several identical entries (e.g. three "2026/27" rows).
-- Root cause: `seasons` had no uniqueness protection on (organization_id, name)
-- and both createSeason and startNewSeason inserted a fresh row each time, so
-- repeated submissions with the same name created duplicate seasons.
--
-- Strategy (non-destructive):
--   1. For each (organization_id, name) group, pick ONE canonical season:
--      the active season first, otherwise the earliest created (tie: lowest id).
--   2. Repoint every referencing row to the canonical season:
--        seasonal_memberships (conflict -> keep canonical, drop duplicate)
--        staff_teams         (conflict -> keep canonical, drop duplicate)
--        registrations       (simple update)
--        team_equipment      (simple update)
--   3. Delete the now-unreferenced duplicate seasons.
--   4. Add a partial-unique index per org+name so future duplicates are
--      rejected at the database level (inactive-only, so the single-active
--      rollover pattern keeps working).
--
-- Referenced data (memberships, staff assignments, registrations, equipment
-- rows) is preserved and pointed at the surviving season; no referenced row is
-- deleted blindly — only memberships/staff-teams that would CONFLICT with a
-- row already present on the canonical season are removed (the duplicate).

BEGIN;

-- Step 1+2+3: merge duplicates per org+name.
DO $$
DECLARE
  r RECORD;
  canonical_id UUID;
BEGIN
  FOR r IN
    SELECT organization_id, name
    FROM seasons
    GROUP BY organization_id, name
    HAVING COUNT(*) > 1
  LOOP
    -- Canonical = active if present, else earliest created_at, else lowest id.
    SELECT id INTO canonical_id
    FROM seasons
    WHERE organization_id = r.organization_id AND name = r.name
    ORDER BY (is_active) DESC, created_at ASC, id ASC
    LIMIT 1;

    -- Repoint registrations (no unique constraint) to the canonical season.
    UPDATE registrations
    SET season_id = canonical_id
    WHERE organization_id = r.organization_id
      AND season_id IN (
        SELECT id FROM seasons
        WHERE organization_id = r.organization_id AND name = r.name
      )
      AND season_id <> canonical_id;

    -- Repoint team_equipment rows.
    UPDATE team_equipment
    SET season_id = canonical_id
    WHERE organization_id = r.organization_id
      AND season_id IN (
        SELECT id FROM seasons
        WHERE organization_id = r.organization_id AND name = r.name
      )
      AND season_id <> canonical_id;

    -- seasonal_memberships: unique (season_id, athlete_id). For each duplicate
    -- season's membership, if the athlete already has a membership on the
    -- canonical season, keep that one and drop the duplicate; otherwise repoint.
    UPDATE seasonal_memberships m
    SET season_id = canonical_id
    WHERE m.organization_id = r.organization_id
      AND m.season_id IN (
        SELECT id FROM seasons
        WHERE organization_id = r.organization_id AND name = r.name
      )
      AND m.season_id <> canonical_id
      AND NOT EXISTS (
        SELECT 1 FROM seasonal_memberships existing
        WHERE existing.organization_id = m.organization_id
          AND existing.season_id = canonical_id
          AND existing.athlete_id = m.athlete_id
      );

    DELETE FROM seasonal_memberships m
    WHERE m.organization_id = r.organization_id
      AND m.season_id IN (
        SELECT id FROM seasons
        WHERE organization_id = r.organization_id AND name = r.name
      )
      AND m.season_id <> canonical_id;

    -- staff_teams: unique (staff_id, team_id, season_id) — same pattern.
    UPDATE staff_teams st
    SET season_id = canonical_id
    WHERE st.organization_id = r.organization_id
      AND st.season_id IN (
        SELECT id FROM seasons
        WHERE organization_id = r.organization_id AND name = r.name
      )
      AND st.season_id <> canonical_id
      AND NOT EXISTS (
        SELECT 1 FROM staff_teams existing
        WHERE existing.organization_id = st.organization_id
          AND existing.season_id = canonical_id
          AND existing.staff_id = st.staff_id
          AND existing.team_id = st.team_id
      );

    DELETE FROM staff_teams st
    WHERE st.organization_id = r.organization_id
      AND st.season_id IN (
        SELECT id FROM seasons
        WHERE organization_id = r.organization_id AND name = r.name
      )
      AND st.season_id <> canonical_id;

    -- Now delete the unreferenced duplicate season rows.
    DELETE FROM seasons
    WHERE organization_id = r.organization_id
      AND name = r.name
      AND id <> canonical_id;
  END LOOP;
END $$;

-- Step 4: uniqueness protection. A season name is the period (e.g. "2026/27")
-- and must be unique per organization, active or not. The single-active
-- invariant stays enforced by the existing one_active_season_per_org partial
-- index; this index blocks duplicate names (the root cause of the duplicate
-- "2026/27" rows seen in manual UAT).
CREATE UNIQUE INDEX seasons_org_name_unique
  ON seasons(organization_id, name);

COMMIT;