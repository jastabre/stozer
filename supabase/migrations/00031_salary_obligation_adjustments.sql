-- 00031_salary_obligation_adjustments.sql
--
-- V1 monthly finance adjustments: + Bonus / - Odbitak tied to ONE salary
-- obligation. The contracted monthly salary (contracts.monthly_salary and
-- salary_obligations.expected_amount) is NEVER modified by an adjustment.
--
-- Formula (all in MAJOR currency units, same convention as 00028):
--   adjusted_amount = expected_amount + active bonuses - active deductions
--   remaining       = adjusted_amount - active payments
--
-- Statuses stay DERIVED from expected/paid sums; no new statuses, no
-- accounting system, no negative amounts, no compensating entries.
--
-- Reversal pattern mirrors 00030 (contract_payments):
--   reversed_at / reversed_by / reversal_note  (NULL = active)
-- and one obligation can hold many adjustments, active or reversed.
--
-- NON-DESTRUCTIVE: creates one new table + its RLS. No existing table, column
-- or row is altered, no data is migrated, nothing is backfilled.
--
-- RLS follows the 00028 first-team-finance pattern exactly:
--   SELECT  -> first_team_finance.view
--   INSERT/UPDATE/DELETE -> first_team_finance.manage
-- (DELETE is part of the standard per-command policy set; the app never
-- issues it — corrections are reversed, never hard-deleted.)

BEGIN;

CREATE TABLE salary_obligation_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  obligation_id UUID NOT NULL REFERENCES salary_obligations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('bonus', 'deduction')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reversed_at TIMESTAMPTZ,
  reversed_by UUID,
  reversal_note TEXT,
  -- Attribution/annotation only exist alongside the reversal stamp (00030
  -- pattern; all fresh rows satisfy this trivially).
  CONSTRAINT salary_obligation_adjustments_reversal_consistency_check CHECK (
    reversed_at IS NOT NULL OR (reversed_by IS NULL AND reversal_note IS NULL)
  )
);

-- Cross-org hardening: the obligation must belong to the same organization.
-- salary_obligations already carries UNIQUE (id, organization_id) from 00022.
ALTER TABLE salary_obligation_adjustments
  ADD CONSTRAINT salary_obligation_adjustments_org_obligation_fk
    FOREIGN KEY (organization_id, obligation_id)
    REFERENCES salary_obligations(organization_id, id);

CREATE INDEX idx_salary_obligation_adjustments_org_obligation
  ON salary_obligation_adjustments(organization_id, obligation_id);

ALTER TABLE salary_obligation_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_obligation_adjustments FORCE ROW LEVEL SECURITY;

CREATE POLICY salary_obligation_adjustments_select ON salary_obligation_adjustments
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('first_team_finance.view')
  );

CREATE POLICY salary_obligation_adjustments_insert ON salary_obligation_adjustments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('first_team_finance.manage')
  );

CREATE POLICY salary_obligation_adjustments_update ON salary_obligation_adjustments
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('first_team_finance.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('first_team_finance.manage')
  );

CREATE POLICY salary_obligation_adjustments_delete ON salary_obligation_adjustments
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('first_team_finance.manage')
  );

DROP TRIGGER IF EXISTS update_salary_obligation_adjustments_updated_at ON salary_obligation_adjustments;
CREATE TRIGGER update_salary_obligation_adjustments_updated_at
  BEFORE UPDATE ON salary_obligation_adjustments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE salary_obligation_adjustments IS
  'Monthly per-obligation finance adjustments (+bonus / -deduction). Never changes contracts.monthly_salary or salary_obligations.expected_amount. Reversed rows stay as history and are excluded from active totals.';
COMMENT ON COLUMN salary_obligation_adjustments.amount IS
  'Adjustment amount in MAJOR currency units (e.g. 20000 = 20.000 RSD), always positive; the type carries the sign.';
COMMENT ON COLUMN salary_obligation_adjustments.reversed_at IS
  'Set when the adjustment was reversed ("Poništi korekciju"). NULL = active. Reversed rows are excluded from adjusted totals but remain visible in history.';

COMMIT;
