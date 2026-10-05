-- STOŽER — Competition registration: optional free-text note.
--
-- Additive, non-destructive. Adds a nullable `note` column to `registrations`
-- so the simplified "Registracija za takmičenje" form can carry an administrative
-- remark (mirrors medical_examinations.note). Existing rows keep NULL; no data
-- is lost and no existing constraint, default or trigger changes.

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS note TEXT;
