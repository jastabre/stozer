-- STOZER Registration & Medical Examination Migration (Phase 2, 02-03)
-- organization_settings (org warning-threshold knob, D-12), registrations
-- (REG-01/02/03, D-09/D-10/D-11), medical_examinations (D-33..D-42).
-- Same RLS discipline as 00001/00003: ENABLE + FORCE ROW LEVEL SECURITY,
-- policies via public.authorize() + org scoping via the JWT app_metadata
-- organization_id claim.
--
-- No app_permission enum additions here — 00002 owns app_permission values.
-- medical.view, registrations.view, registrations.manage, club_settings.manage
-- all already exist.

-- ============================================================
-- TABLES
-- ============================================================

-- Organization settings (one row per org) — D-12 knob: the org-level
-- expiry-warning threshold (default 30 days) applied to registrations,
-- medical, documents and licenses. One knob, many consumers.
CREATE TABLE organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  warning_threshold_days INTEGER NOT NULL DEFAULT 30 CHECK (warning_threshold_days >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Registrations (REG-01/02, D-09/D-10/D-11). Each athlete can hold multiple
-- time-based records: federation/system name + optional identifier (REG-01),
-- valid_from/valid_until (REG-02), an optional season association (D-09) and
-- an optional record-level document link (D-09, mirrors contracts.document_id;
-- no FK — the polymorphic documents table lands in 00006, integrity enforced in lib).
-- status is stored for REG-01 ('valid'/'expired'); the derived green/yellow/red
-- tone (deriveStatus) remains the display source of truth (REG-03, D-10/D-12).
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  season_id UUID NULL REFERENCES seasons(id) ON DELETE SET NULL,
  federation TEXT,
  identifier TEXT,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'expired')),
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  document_id UUID NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_registrations_athlete_valid_until
  ON registrations(organization_id, athlete_id, valid_until);
CREATE INDEX idx_registrations_org_valid_until
  ON registrations(organization_id, valid_until);

-- Medical examinations (D-33..D-42). Structured per-athlete sports-clearance
-- record, separate from federation registration. Stores the ACTUAL valid_until
-- (D-35 — no global validity duration), examined_on date, an administrative
-- note only (D-42 forbids diagnoses/findings/history/test results), and an
-- optional certificate link (D-41 — no FK, the documents table lands in 00006).
-- The derived medical status (Not recorded/Valid/Expiring soon/Expired, D-34)
-- uses the same org warning threshold as registrations (D-36).
CREATE TABLE medical_examinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  examined_on DATE NOT NULL,
  valid_until DATE NOT NULL,
  note TEXT,
  document_id UUID NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_medical_examinations_athlete
  ON medical_examinations(organization_id, athlete_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_examinations ENABLE ROW LEVEL SECURITY;

ALTER TABLE organization_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE registrations FORCE ROW LEVEL SECURITY;
ALTER TABLE medical_examinations FORCE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- organization_settings: readable/writable by club settings managers.
CREATE POLICY "org_settings_select" ON organization_settings
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('club_settings.manage')
  );

CREATE POLICY "org_settings_update" ON organization_settings
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('club_settings.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('club_settings.manage')
  );

-- registrations: readable by registrations.view, writable by registrations.manage.
CREATE POLICY "registrations_select" ON registrations
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('registrations.view')
  );

CREATE POLICY "registrations_insert" ON registrations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('registrations.manage')
  );

CREATE POLICY "registrations_update" ON registrations
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('registrations.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('registrations.manage')
  );

CREATE POLICY "registrations_delete" ON registrations
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('registrations.manage')
  );

-- medical_examinations: readable by registrations.view OR medical.view (coaches
-- hold medical.view per the 00002 seeds — D-38 needs coach visibility);
-- writable only by registrations.manage (record entry rides the existing
-- registrations.manage; no separate medical.manage per RESEARCH.md).
CREATE POLICY "medical_examinations_select" ON medical_examinations
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('registrations.view') OR public.authorize('medical.view'))
  );

CREATE POLICY "medical_examinations_insert" ON medical_examinations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('registrations.manage')
  );

CREATE POLICY "medical_examinations_update" ON medical_examinations
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('registrations.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('registrations.manage')
  );

CREATE POLICY "medical_examinations_delete" ON medical_examinations
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('registrations.manage')
  );

-- ============================================================
-- BACKFILL + TRIGGER for organization_settings (D-12)
-- ============================================================

-- Backfill a settings row for every existing org at the default 30-day threshold.
INSERT INTO organization_settings (organization_id, warning_threshold_days)
SELECT id, 30 FROM organizations
ON CONFLICT (organization_id) DO NOTHING;

-- Future orgs automatically get a settings row (replicates the research
-- "seed on org creation" pattern).
CREATE OR REPLACE FUNCTION seed_org_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO organization_settings (organization_id, warning_threshold_days)
  VALUES (NEW.id, 30)
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_seed_settings
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION seed_org_settings();

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER organization_settings_updated_at
  BEFORE UPDATE ON organization_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER registrations_updated_at
  BEFORE UPDATE ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER medical_examinations_updated_at
  BEFORE UPDATE ON medical_examinations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
