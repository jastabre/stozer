-- 00047_role_permission_seed.sql
--
-- Permission seeds for the six scheduling permissions added in 00046.
-- NON-DESTRUCTIVE: only role_permissions reference rows are written; no user,
-- membership, staff or domain data moves. attendance.manage (seeded in 00001)
-- is left untouched — it remains the coach's write permission for the
-- training + attendance workflow.
--
-- The existing <module>.<action> convention applies; these are six new read /
-- venue / match surfaces. Coach receives the view permissions only; team scope
-- is enforced by RLS in 00048/00049 (via has_team_scope / has_athlete_scope),
-- not by these grants.
--
--   club_president, youth_director -> all six
--   coach -> calendar.view, venue.view, match.view, attendance.view
--   admin_finance -> none (no scheduling permissions)

BEGIN;

INSERT INTO role_permissions (role, permission) VALUES
  ('club_president', 'calendar.view'),
  ('club_president', 'venue.view'),
  ('club_president', 'venue.manage'),
  ('club_president', 'match.view'),
  ('club_president', 'match.manage'),
  ('club_president', 'attendance.view'),
  ('youth_director', 'calendar.view'),
  ('youth_director', 'venue.view'),
  ('youth_director', 'venue.manage'),
  ('youth_director', 'match.view'),
  ('youth_director', 'match.manage'),
  ('youth_director', 'attendance.view'),
  ('coach', 'calendar.view'),
  ('coach', 'venue.view'),
  ('coach', 'match.view'),
  ('coach', 'attendance.view')
ON CONFLICT (role, permission) DO NOTHING;

COMMIT;
