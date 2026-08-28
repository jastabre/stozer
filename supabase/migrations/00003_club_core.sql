-- STOZER Club Core Migration (Phase 2)
-- Seasons, teams, athletes, seasonal memberships + club_athlete_counter.
-- Same RLS discipline as 00001_foundation.sql: ENABLE + FORCE ROW LEVEL SECURITY
-- on every table, policies via public.authorize() + org scoping via JWT claim.

-- ============================================================
-- ENUMS
-- ============================================================

-- Sport abstraction (STRC-08), extensible
CREATE TYPE sport_type AS ENUM ('football', 'basketball');

-- ============================================================
-- TABLES
-- ============================================================

-- Seasons: single active per org (D-02)
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Partial unique index backstops the single-active-season rule (Pattern 1, D-02)
CREATE UNIQUE INDEX one_active_season_per_org ON seasons(organization_id) WHERE is_active;

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('first_team', 'youth', 'academy', 'other')),
  -- 02-08 fix: PostgreSQL forbids subqueries in DEFAULT expressions
  -- (SQLSTATE 0A000), so the org-sport inheritance moved to the
  -- teams_inherit_sport BEFORE INSERT trigger below.
  sport sport_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE athletes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  nationality TEXT,
  position TEXT,
  photo_url TEXT,
  federation_id TEXT,
  club_athlete_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Club athlete number is unique per org (D-05 counter backstop, Pitfall 5)
CREATE UNIQUE INDEX athletes_org_number_unique ON athletes(organization_id, club_athlete_number);

-- Common athlete listing index
CREATE INDEX idx_athletes_org_name ON athletes(organization_id, last_name, first_name);

-- Seasonal membership: athlete <-> team for a season with jersey number (D-01/D-07)
CREATE TABLE seasonal_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  jersey_number SMALLINT CHECK (jersey_number BETWEEN 1 AND 99),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'moved', 'left')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season_id, athlete_id)
);

CREATE INDEX idx_memberships_team_season ON seasonal_memberships(team_id, season_id);

-- ============================================================
-- COLUMN EXTENSIONS
-- ============================================================

-- Per-org transactional counter for club athlete IDs (Pattern 3, D-05)
ALTER TABLE organizations ADD COLUMN club_athlete_counter INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonal_memberships ENABLE ROW LEVEL SECURITY;

ALTER TABLE seasons FORCE ROW LEVEL SECURITY;
ALTER TABLE teams FORCE ROW LEVEL SECURITY;
ALTER TABLE athletes FORCE ROW LEVEL SECURITY;
ALTER TABLE seasonal_memberships FORCE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Helper: org claim from JWT
-- seasons.org matches app_metadata.organization_id
CREATE POLICY "seasons_select" ON seasons
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('seasons.view')
  );

CREATE POLICY "seasons_insert" ON seasons
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('seasons.manage')
  );

CREATE POLICY "seasons_update" ON seasons
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('seasons.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('seasons.manage')
  );

CREATE POLICY "seasons_delete" ON seasons
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('seasons.manage')
  );

-- teams
CREATE POLICY "teams_select" ON teams
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('teams.view')
  );

CREATE POLICY "teams_insert" ON teams
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('teams.create')
  );

CREATE POLICY "teams_update" ON teams
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('teams.edit')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('teams.edit')
  );

CREATE POLICY "teams_delete" ON teams
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('teams.delete')
  );

-- athletes
CREATE POLICY "athletes_select" ON athletes
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.view')
  );

CREATE POLICY "athletes_insert" ON athletes
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.create')
  );

CREATE POLICY "athletes_update" ON athletes
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.edit')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.edit')
  );

CREATE POLICY "athletes_delete" ON athletes
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.delete')
  );

-- seasonal_memberships: readable by teams.view / athletes.view; writable by teams.edit + athletes.edit
CREATE POLICY "memberships_select" ON seasonal_memberships
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('teams.view') OR public.authorize('athletes.view'))
  );

CREATE POLICY "memberships_insert" ON seasonal_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('teams.edit') OR public.authorize('athletes.edit'))
  );

CREATE POLICY "memberships_update" ON seasonal_memberships
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('teams.edit') OR public.authorize('athletes.edit'))
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('teams.edit') OR public.authorize('athletes.edit'))
  );

CREATE POLICY "memberships_delete" ON seasonal_memberships
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('teams.edit') OR public.authorize('athletes.edit'))
  );

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER seasons_updated_at
  BEFORE UPDATE ON seasons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER athletes_updated_at
  BEFORE UPDATE ON athletes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 02-08 fix: inherit the org's sport on team insert, replacing the original
-- subquery DEFAULT (not allowed in PostgreSQL). Insert without sport gets the
-- org's sport (organizations.sport is TEXT; the org's own DEFAULT 'sr' does
-- not apply here); an explicit sport is preserved. The organizations SELECT
-- policy (org_select_members) lets any org member read their own org, so the
-- plain (SECURITY INVOKER) trigger function is sufficient.
CREATE OR REPLACE FUNCTION inherit_team_sport()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sport IS NULL THEN
    NEW.sport := (SELECT sport::sport_type FROM organizations WHERE id = NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teams_inherit_sport
  BEFORE INSERT ON teams
  FOR EACH ROW
  EXECUTE FUNCTION inherit_team_sport();
