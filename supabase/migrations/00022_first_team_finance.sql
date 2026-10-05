-- 00022_first_team_finance.sql
--
-- NEWLY APPROVED V1 requirement: simple first-team contract / payment
-- tracking. This is operational club cost tracking, NOT tax/payroll/accounting.
--
-- Model:
--   contracts              -> extended with salary fields (monthly amount,
--                             currency, payment schedule, custom months)
--   seasons.competition_months -> months (1-12) in which competition is active
--   salary_obligations     -> generated monthly obligation per active contract
--                             (what SHOULD be paid)
--   contract_payments      -> recorded payments (what WAS actually paid),
--                             partial payments supported
--
-- Status is DERIVED (never stored) from expected vs paid sums:
--   paid when paid >= expected
--   partial when 0 < paid < expected
--   due when nothing paid and period not overdue
--   late when nothing paid and period in the past
--
-- Money is stored in integer minor units (para for RSD) per D-07; RLS + FORCE
-- on every table; org composite FKs follow the established cross-org pattern.
--
-- PostgreSQL-validity notes (fixes so the migration applies):
--   * A CHECK expression cannot contain a subquery (SQLSTATE 0A000). The
--     month-array rules (1-12, non-empty, no duplicates) are enforced through
--     an IMMUTABLE helper function (public.months_are_valid) instead.
--   * Composite FKs that reference (organization_id, id) require a matching
--     UNIQUE constraint on the parent. contracts and salary_obligations had
--     none (00009/00011 covered the other tables), so the unique pairs are
--     added here before the cross-org FKs are created. id is already PRIMARY
--     KEY, so these constraints cannot fail on existing data.

BEGIN;

-- ============================================================
-- IMMUTABLE month-array validator (usable inside CHECK constraints)
-- ============================================================
-- Enforces: non-NULL array, at least one month, values 1-12, no duplicates.
-- Returns FALSE for NULL input, so callers decide whether NULL is allowed.
CREATE OR REPLACE FUNCTION public.months_are_valid(p_months smallint[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT p_months IS NOT NULL
    AND pg_catalog.array_length(p_months, 1) > 0
    AND p_months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]
    AND (SELECT pg_catalog.count(DISTINCT m) FROM pg_catalog.unnest(p_months) m)
        = pg_catalog.array_length(p_months, 1);
$$;

-- ---------------------------------------------------------------
-- Extend contracts with salary fields
-- ---------------------------------------------------------------
ALTER TABLE contracts
  ADD COLUMN monthly_salary INTEGER CHECK (monthly_salary IS NULL OR monthly_salary >= 0),
  ADD COLUMN currency TEXT NOT NULL DEFAULT 'RSD',
  ADD COLUMN pay_schedule TEXT NOT NULL DEFAULT 'all_year'
    CHECK (pay_schedule IN ('all_year', 'competition_months', 'custom_months')),
  ADD COLUMN custom_months SMALLINT[] DEFAULT NULL;

-- Sanity: custom_months only valid for the custom schedule, values 1-12, unique.
ALTER TABLE contracts
  ADD CONSTRAINT contracts_custom_months_check CHECK (
    (pay_schedule <> 'custom_months' AND custom_months IS NULL)
    OR (
      pay_schedule = 'custom_months'
      AND public.months_are_valid(custom_months)
    )
  );

-- Parent-side unique pair required by the cross-org FKs below (pattern from
-- 00009). id is already unique, so this constraint is guaranteed to hold.
ALTER TABLE contracts
  ADD CONSTRAINT contracts_id_organization_unique UNIQUE (id, organization_id);

-- ---------------------------------------------------------------
-- Season-level competition months (used by 'competition_months' schedule)
-- ---------------------------------------------------------------
ALTER TABLE seasons
  ADD COLUMN competition_months SMALLINT[] DEFAULT NULL;

ALTER TABLE seasons
  ADD CONSTRAINT seasons_competition_months_check CHECK (
    competition_months IS NULL
    OR public.months_are_valid(competition_months)
  );

-- ---------------------------------------------------------------
-- Payment method enum
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM ('cash', 'bank', 'other');
  END IF;
END $$;

-- ---------------------------------------------------------------
-- salary_obligations: generated monthly obligations
-- ---------------------------------------------------------------
CREATE TABLE salary_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  period TEXT NOT NULL,              -- '2026-09' (ISO year-month)
  period_start DATE NOT NULL,        -- first day of the period month
  expected_amount INTEGER NOT NULL CHECK (expected_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'RSD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contract_id, period)
);

-- Parent-side unique pair for the obligation/contract-payment cross-org FKs.
ALTER TABLE salary_obligations
  ADD CONSTRAINT salary_obligations_id_organization_unique UNIQUE (id, organization_id);

-- Cross-org hardening: contract/athlete must belong to the same organization.
ALTER TABLE salary_obligations
  ADD CONSTRAINT salary_obligations_org_contract_fk
    FOREIGN KEY (organization_id, contract_id) REFERENCES contracts(organization_id, id),
  ADD CONSTRAINT salary_obligations_org_athlete_fk
    FOREIGN KEY (organization_id, athlete_id) REFERENCES athletes(organization_id, id);

CREATE INDEX idx_salary_obligations_org_period
  ON salary_obligations(organization_id, period);
CREATE INDEX idx_salary_obligations_athlete
  ON salary_obligations(organization_id, athlete_id);

ALTER TABLE salary_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_obligations FORCE ROW LEVEL SECURITY;

CREATE POLICY salary_obligations_org_isolation ON salary_obligations
  USING (organization_id = current_organization_id());

-- ---------------------------------------------------------------
-- contract_payments: what was actually paid
-- ---------------------------------------------------------------
CREATE TABLE contract_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  obligation_id UUID NOT NULL REFERENCES salary_obligations(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'RSD',
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  method payment_method NOT NULL DEFAULT 'cash',
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE contract_payments
  ADD CONSTRAINT contract_payments_org_obligation_fk
    FOREIGN KEY (organization_id, obligation_id) REFERENCES salary_obligations(organization_id, id),
  ADD CONSTRAINT contract_payments_org_contract_fk
    FOREIGN KEY (organization_id, contract_id) REFERENCES contracts(organization_id, id),
  ADD CONSTRAINT contract_payments_org_athlete_fk
    FOREIGN KEY (organization_id, athlete_id) REFERENCES athletes(organization_id, id);

CREATE INDEX idx_contract_payments_org_obligation
  ON contract_payments(organization_id, obligation_id);
CREATE INDEX idx_contract_payments_org_period
  ON contract_payments(organization_id, paid_on);

ALTER TABLE contract_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_payments FORCE ROW LEVEL SECURITY;

CREATE POLICY contract_payments_org_isolation ON contract_payments
  USING (organization_id = current_organization_id());

-- ---------------------------------------------------------------
-- Permissions: view/manage first-team finance
--
-- first_team_finance.view / first_team_finance.manage already exist in the
-- app_permission enum (00001_foundation). Role seeds land in 00023.
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- Triggers for updated_at
-- ---------------------------------------------------------------
DROP TRIGGER IF EXISTS update_salary_obligations_updated_at ON salary_obligations;
CREATE TRIGGER update_salary_obligations_updated_at
  BEFORE UPDATE ON salary_obligations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_contract_payments_updated_at ON contract_payments;
CREATE TRIGGER update_contract_payments_updated_at
  BEFORE UPDATE ON contract_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;