-- 00023_first_team_finance_permissions.sql
--
-- Seed first_team_finance.view / first_team_finance.manage for the roles that
-- actually manage first-team payments.
--
--   club_president -> view + manage (owns the club)
--   admin_finance  -> view + manage (the dedicated finance role)
--   youth_director -> view only (sees first-team cost totals, does not record)
--
-- Coach intentionally has NO first-team finance access: a coach sees only
-- their own team and first-team salary data is not part of the coach workflow.
--
-- NOTE: role_permissions is a GLOBAL (org-agnostic) table with columns
-- (role, permission) and UNIQUE(role, permission) — see 00001. The original
-- seed referenced a nonexistent organization_id column and could not apply.
-- 00001 already grants the club_president/admin_finance pairs, so ON CONFLICT
-- makes this idempotent; only the youth_director grant is genuinely new here.

BEGIN;

INSERT INTO role_permissions (role, permission)
VALUES
  ('club_president', 'first_team_finance.view'),
  ('club_president', 'first_team_finance.manage'),
  ('admin_finance', 'first_team_finance.view'),
  ('admin_finance', 'first_team_finance.manage'),
  ('youth_director', 'first_team_finance.view')
ON CONFLICT (role, permission) DO NOTHING;

COMMIT;