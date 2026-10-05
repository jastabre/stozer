-- 00045_staff_finance.sql
--
-- Staff engagement finance. This is the SAME V1 model as first-team finance
-- (contracts -> salary_obligations -> contract_payments), simplified: staff
-- compensation has NO pay schedule, no custom months and no adjustments — just
-- a monthly amount with a validity window and recorded (partial) payments.
--
-- Model:
--   staff_compensations      -> one row per staff member with the engagement
--                               terms (monthly amount, club currency, window,
--                               note). monthly_amount NULL = "Bez naknade".
--   staff_salary_obligations -> generated monthly obligation per compensation
--                               (what SHOULD be paid)
--   staff_payments           -> recorded payments (what WAS actually paid),
--                               partial payments supported, reversible
--
-- Status is DERIVED (never stored) from expected vs paid sums, exactly like
-- first-team finance (paid / partial / due / late).
--
-- Money is stored in MAJOR currency units (same convention as 00028). RLS +
-- FORCE on every table; org composite FKs follow the established cross-org
-- pattern. `staff_finance.*` permissions come from 00044.
--
-- NON-DESTRUCTIVE: three new tables + their RLS + role seeds. No existing
-- table, column or row is altered, nothing is backfilled.

BEGIN;

-- ---------------------------------------------------------------
-- staff_compensations: engagement terms (one per staff member)
-- ---------------------------------------------------------------
CREATE TABLE staff_compensations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  -- NULL = "Bez naknade" (no financial obligation).
  monthly_amount INTEGER CHECK (monthly_amount IS NULL OR monthly_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'RSD',
  valid_from DATE NOT NULL,
  valid_until DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id),
  CONSTRAINT staff_compensations_window_check CHECK (
    valid_until IS NULL OR valid_until >= valid_from
  )
);

-- Parent-side unique pair required by the cross-org FKs below.
ALTER TABLE staff_compensations
  ADD CONSTRAINT staff_compensations_id_organization_unique UNIQUE (id, organization_id);

-- Cross-org hardening: the staff profile must belong to the same organization.
ALTER TABLE staff_compensations
  ADD CONSTRAINT staff_compensations_org_staff_fk
    FOREIGN KEY (organization_id, staff_id) REFERENCES staff(organization_id, id);

CREATE INDEX idx_staff_compensations_org
  ON staff_compensations(organization_id);

ALTER TABLE staff_compensations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_compensations FORCE ROW LEVEL SECURITY;

CREATE POLICY staff_compensations_select ON staff_compensations
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff_finance.view')
  );

CREATE POLICY staff_compensations_insert ON staff_compensations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff_finance.manage')
  );

CREATE POLICY staff_compensations_update ON staff_compensations
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff_finance.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff_finance.manage')
  );

CREATE POLICY staff_compensations_delete ON staff_compensations
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff_finance.manage')
  );

-- ---------------------------------------------------------------
-- staff_salary_obligations: generated monthly obligations
-- ---------------------------------------------------------------
CREATE TABLE staff_salary_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  compensation_id UUID NOT NULL REFERENCES staff_compensations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  period TEXT NOT NULL,              -- '2026-09' (ISO year-month)
  period_start DATE NOT NULL,        -- first day of the period month
  expected_amount INTEGER NOT NULL CHECK (expected_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'RSD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (compensation_id, period)
);

ALTER TABLE staff_salary_obligations
  ADD CONSTRAINT staff_salary_obligations_id_organization_unique UNIQUE (id, organization_id);

ALTER TABLE staff_salary_obligations
  ADD CONSTRAINT staff_salary_obligations_org_compensation_fk
    FOREIGN KEY (organization_id, compensation_id) REFERENCES staff_compensations(organization_id, id),
  ADD CONSTRAINT staff_salary_obligations_org_staff_fk
    FOREIGN KEY (organization_id, staff_id) REFERENCES staff(organization_id, id);

CREATE INDEX idx_staff_salary_obligations_org_period
  ON staff_salary_obligations(organization_id, period);
CREATE INDEX idx_staff_salary_obligations_staff
  ON staff_salary_obligations(organization_id, staff_id);

ALTER TABLE staff_salary_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_salary_obligations FORCE ROW LEVEL SECURITY;

CREATE POLICY staff_salary_obligations_select ON staff_salary_obligations
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff_finance.view')
  );

CREATE POLICY staff_salary_obligations_insert ON staff_salary_obligations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff_finance.manage')
  );

CREATE POLICY staff_salary_obligations_update ON staff_salary_obligations
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff_finance.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff_finance.manage')
  );

CREATE POLICY staff_salary_obligations_delete ON staff_salary_obligations
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff_finance.manage')
  );

-- ---------------------------------------------------------------
-- staff_payments: what was actually paid (reversible)
-- ---------------------------------------------------------------
CREATE TABLE staff_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  obligation_id UUID NOT NULL REFERENCES staff_salary_obligations(id) ON DELETE CASCADE,
  compensation_id UUID NOT NULL REFERENCES staff_compensations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'RSD',
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  method payment_method NOT NULL DEFAULT 'cash',
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reversed_at TIMESTAMPTZ,
  reversed_by UUID,
  reversal_note TEXT,
  CONSTRAINT staff_payments_reversal_consistency_check CHECK (
    reversed_at IS NOT NULL OR (reversed_by IS NULL AND reversal_note IS NULL)
  )
);

ALTER TABLE staff_payments
  ADD CONSTRAINT staff_payments_org_obligation_fk
    FOREIGN KEY (organization_id, obligation_id) REFERENCES staff_salary_obligations(organization_id, id),
  ADD CONSTRAINT staff_payments_org_compensation_fk
    FOREIGN KEY (organization_id, compensation_id) REFERENCES staff_compensations(organization_id, id),
  ADD CONSTRAINT staff_payments_org_staff_fk
    FOREIGN KEY (organization_id, staff_id) REFERENCES staff(organization_id, id);

CREATE INDEX idx_staff_payments_org_obligation
  ON staff_payments(organization_id, obligation_id);
CREATE INDEX idx_staff_payments_org_period
  ON staff_payments(organization_id, paid_on);

ALTER TABLE staff_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_payments FORCE ROW LEVEL SECURITY;

CREATE POLICY staff_payments_select ON staff_payments
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff_finance.view')
  );

CREATE POLICY staff_payments_insert ON staff_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff_finance.manage')
  );

CREATE POLICY staff_payments_update ON staff_payments
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff_finance.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff_finance.manage')
  );

CREATE POLICY staff_payments_delete ON staff_payments
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff_finance.manage')
  );

-- ---------------------------------------------------------------
-- Triggers for updated_at
-- ---------------------------------------------------------------
DROP TRIGGER IF EXISTS update_staff_compensations_updated_at ON staff_compensations;
CREATE TRIGGER update_staff_compensations_updated_at
  BEFORE UPDATE ON staff_compensations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_staff_salary_obligations_updated_at ON staff_salary_obligations;
CREATE TRIGGER update_staff_salary_obligations_updated_at
  BEFORE UPDATE ON staff_salary_obligations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_staff_payments_updated_at ON staff_payments;
CREATE TRIGGER update_staff_payments_updated_at
  BEFORE UPDATE ON staff_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------
-- Permissions: view/manage staff finance (mirrors 00023 first-team)
-- ---------------------------------------------------------------
INSERT INTO role_permissions (role, permission)
VALUES
  ('club_president', 'staff_finance.view'),
  ('club_president', 'staff_finance.manage'),
  ('admin_finance', 'staff_finance.view'),
  ('admin_finance', 'staff_finance.manage'),
  ('youth_director', 'staff_finance.view')
ON CONFLICT (role, permission) DO NOTHING;

-- Money unit documentation (V1 convention = MAJOR currency units).
COMMENT ON COLUMN staff_compensations.monthly_amount IS
  'Monthly compensation in MAJOR currency units (e.g. 150000 = 150000 RSD). NULL = "Bez naknade" (no obligation).';
COMMENT ON COLUMN staff_salary_obligations.expected_amount IS
  'Expected monthly amount in MAJOR currency units (same convention as staff_compensations.monthly_amount).';
COMMENT ON COLUMN staff_payments.amount IS
  'Recorded payment in MAJOR currency units (same convention as staff_salary_obligations.expected_amount).';

COMMIT;
