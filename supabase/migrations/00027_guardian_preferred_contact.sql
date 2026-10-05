-- STOŽER — Guardians: the V1 UI only offers phone/email as preferred contact.
-- The DB CHECK previously allowed 'sms'/'other'; those were never surfaced in the
-- intended UX. This migration is NON-DESTRUCTIVE: any legacy 'sms'/'other' value
-- is first folded onto a contact the guardian actually has (phone if present,
-- else email), otherwise cleared — never dropped blindly. Then the CHECK is
-- tightened to the phone/email pair the application enforces.

-- 1) Normalize legacy preferred_contact values onto a real contact channel.
UPDATE guardians
SET preferred_contact = CASE
      WHEN phone IS NOT NULL THEN 'phone'
      WHEN email IS NOT NULL THEN 'email'
      ELSE NULL
    END
WHERE preferred_contact IN ('sms', 'other');

-- 2) Replace the CHECK with one restricted to phone/email.
ALTER TABLE guardians
  DROP CONSTRAINT IF EXISTS guardians_preferred_contact_check;

ALTER TABLE guardians
  ADD CONSTRAINT guardians_preferred_contact_check
  CHECK (preferred_contact IS NULL OR preferred_contact IN ('phone', 'email'));
