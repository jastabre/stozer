-- STOŽER Phase 2 completion: optional administrative medical exam fields.
-- Adds an exam type and the examining doctor/institution to medical_examinations.
-- Administrative metadata only — the D-42 privacy boundary is preserved
-- (no diagnoses, findings, test results, or history). Both columns are
-- optional (NULL), so existing rows are unaffected.
ALTER TABLE medical_examinations
  ADD COLUMN exam_type TEXT,
  ADD COLUMN institution TEXT;