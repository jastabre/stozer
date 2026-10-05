-- 00029_first_team_finance_remove_youth_director_view.sql
--
-- Product decision: the youth academy director must NOT see first-team finance.
-- 00023 granted `youth_director` the `first_team_finance.view` permission; this
-- migration removes ONLY that single grant.
--
-- Final first-team finance V1 access:
--   club_president -> view + manage
--   admin_finance  -> view + manage
--   youth_director -> none
--   coach          -> none
--
-- NON-DESTRUCTIVE: deletes exactly one role_permissions row. It does not touch
-- users, profiles, memberships, youth_finance permissions, any other role's
-- grants, or any finance data (contracts / obligations / payments).
--
-- After this, 00028's RLS policies (public.authorize('first_team_finance.view'))
-- naturally deny the youth director at the database level too.

BEGIN;

DELETE FROM role_permissions
WHERE role = 'youth_director'
  AND permission = 'first_team_finance.view';

COMMIT;
