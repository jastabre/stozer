-- 00032_org_currency_rsd_eur.sql
--
-- V1 club currency: one currency per organization, stored on the existing
-- organizations.currency column (00001_foundation.sql). No column is added or
-- dropped, and no amount is converted (there is no FX logic).
--
-- Default rule for NEW clubs (derived in the onboarding action):
--   country = 'RS' -> RSD, every other country -> EUR.
-- Existing V1 clubs keep whatever is stored; only a missing value is filled
-- with the safe Serbia-first default RSD.

BEGIN;

UPDATE public.organizations
SET currency = 'RSD'
WHERE currency IS NULL OR btrim(currency) = '';

COMMIT;
