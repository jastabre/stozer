-- 00030_first_team_payment_reversal.sql
--
-- V1 "Poništi isplatu": a mistakenly recorded payment can be reversed WITHOUT
-- deleting the financial evidence. The row stays in contract_payments forever;
-- reversal markers simply exclude it from every active paid sum, and the
-- obligation's status is re-derived from the remaining active payments.
--
-- Model (no negative/compensating payments, no status table, no workflow):
--   reversed_at   timestamp when the payment was reversed (NULL = active)
--   reversed_by   user who reversed it (nullable, no FK — same convention as
--                 created_by in 00022; there is no auth.users FK pattern here)
--   reversal_note optional free-text context (nullable, mirrors `note`)
--
-- NON-DESTRUCTIVE: adds three NULLABLE columns only. No existing row is
-- touched (every pre-existing payment keeps reversed_at NULL = active), no
-- amounts change, nothing is auto-reversed, nothing is dropped.
--
-- RLS needs no new policy: 00028 already gates UPDATE on contract_payments
-- behind first_team_finance.manage + org isolation, which is exactly what a
-- reversal write requires. Double reversal is prevented in the application via
-- a conditional UPDATE (SET ... WHERE reversed_at IS NULL); the CHECK below
-- additionally guarantees the metadata trio can never be half-set.

BEGIN;

ALTER TABLE contract_payments
  ADD COLUMN reversed_at TIMESTAMPTZ,
  ADD COLUMN reversed_by UUID,
  ADD COLUMN reversal_note TEXT;

-- Reversal attribution/annotation only exist alongside the reversal stamp.
-- All existing rows have every column NULL, so the constraint holds trivially.
ALTER TABLE contract_payments
  ADD CONSTRAINT contract_payments_reversal_consistency_check CHECK (
    reversed_at IS NOT NULL OR (reversed_by IS NULL AND reversal_note IS NULL)
  );

COMMENT ON COLUMN contract_payments.reversed_at IS
  'Set when the payment was reversed ("Poništi isplatu"). NULL = active payment. Reversed rows are excluded from all paid sums and obligation statuses but remain in history.';
COMMENT ON COLUMN contract_payments.reversed_by IS
  'User id that reversed the payment (nullable, no FK — same convention as created_by).';
COMMENT ON COLUMN contract_payments.reversal_note IS
  'Optional free-text note recorded with the reversal (mirrors note).';

COMMIT;
