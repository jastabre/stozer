-- STOZER inherit_team_sport hardening (WR-07 fix)
-- teams.sport is NOT NULL and createTeam never sends it, relying entirely on
-- the teams_inherit_sport BEFORE INSERT trigger authored in 00003. Two failure
-- modes: if organizations.sport is NULL the SELECT sport::sport_type cast
-- yields NULL and the insert dies with an opaque NOT NULL violation; if the
-- org's sport is any value outside the enum (a future sport) the cast throws
-- `invalid input value for enum sport_type`. Every team creation for such orgs
-- is permanently broken with a confusing error.
--
-- Fix 1: replace the trigger body so it fails loudly with a clear message.
-- Fix 2: constrain organizations.sport at the source. CHECK accepts NULL (no
-- sport declared yet — the trigger then raises the clear exception above) but
-- rejects any value outside the sport_type enum, so an un-migrated future
-- sport value fails fast at the org level instead of on every team insert.

CREATE OR REPLACE FUNCTION inherit_team_sport()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sport IS NULL THEN
    SELECT sport::sport_type INTO NEW.sport FROM organizations WHERE id = NEW.organization_id;
    IF NEW.sport IS NULL THEN
      RAISE EXCEPTION 'Organization % has no valid sport configured', NEW.organization_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_sport_check
  CHECK (sport IS NULL OR sport IN ('football', 'basketball'));