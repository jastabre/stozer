-- 00028_first_team_finance_rls.sql
--
-- SECURITY / CORRECTNESS fix for the two first-team finance tables.
--
-- Problem (found in audit):
--   00022 created ONE `FOR ALL` policy per table that used only
--   `organization_id = current_organization_id()`.
--     * `current_organization_id()` reads the TOP-LEVEL JWT claim
--       `organization_id`, but this app stores the org in
--       `app_metadata.organization_id` (set via the service-role client in
--       onboarding / club-users). The top-level claim is never emitted, so the
--       policy evaluated to false and the app could neither read nor write
--       salary_obligations / contract_payments.
--     * No permission check was applied, so even if it matched, every org
--       member could write money data.
--
-- Fix (NON-DESTRUCTIVE — policies only, no data touched):
--   Replace the single isolation policy with explicit per-command policies that
--   use the same org claim as every other table
--   ((auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid) and the
--   existing permission registry:
--     first_team_finance.view   -> SELECT
--     first_team_finance.manage -> INSERT / UPDATE / DELETE
--
--   club_president + admin_finance hold view+manage; youth_director holds view
--   (see 00023). Coach has neither, so a coach never sees first-team salaries.
--
-- Also corrects the money-unit documentation that 00022 stated incorrectly
-- (minor units / para). The application consistently stores and displays MAJOR
-- currency units (e.g. 150000 = 150000 RSD). No data is converted here.

BEGIN;

-- ---------------------------------------------------------------
-- salary_obligations
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS salary_obligations_org_isolation ON salary_obligations;

CREATE POLICY salary_obligations_select ON salary_obligations
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('first_team_finance.view')
  );

CREATE POLICY salary_obligations_insert ON salary_obligations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('first_team_finance.manage')
  );

CREATE POLICY salary_obligations_update ON salary_obligations
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('first_team_finance.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('first_team_finance.manage')
  );

CREATE POLICY salary_obligations_delete ON salary_obligations
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('first_team_finance.manage')
  );

-- ---------------------------------------------------------------
-- contract_payments
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS contract_payments_org_isolation ON contract_payments;

CREATE POLICY contract_payments_select ON contract_payments
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('first_team_finance.view')
  );

CREATE POLICY contract_payments_insert ON contract_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('first_team_finance.manage')
  );

CREATE POLICY contract_payments_update ON contract_payments
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('first_team_finance.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('first_team_finance.manage')
  );

CREATE POLICY contract_payments_delete ON contract_payments
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('first_team_finance.manage')
  );

-- ---------------------------------------------------------------
-- Money unit documentation (V1 convention = MAJOR currency units).
-- ---------------------------------------------------------------
COMMENT ON COLUMN contracts.monthly_salary IS
  'Monthly salary in MAJOR currency units (e.g. 150000 = 150000 RSD). Matches the UI/formatting; not minor units.';
COMMENT ON COLUMN salary_obligations.expected_amount IS
  'Expected monthly amount in MAJOR currency units (same convention as contracts.monthly_salary).';
COMMENT ON COLUMN contract_payments.amount IS
  'Recorded payment in MAJOR currency units (same convention as salary_obligations.expected_amount).';

COMMIT;
