-- STOZER Documents & Contracts Migration (Phase 2, 02-05)
-- One typed, organization-scoped document metadata table serves athletes and
-- staff. Files live in one private bucket and are only exposed through signed
-- URLs (D-21/D-22).

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE document_type AS ENUM (
  'registration',
  'contract',
  'medical',
  'insurance',
  'identity',
  'federation',
  'custom'
);

CREATE TYPE contract_status AS ENUM ('draft', 'active', 'terminated', 'expired');

-- ============================================================
-- TABLES
-- ============================================================

-- Polymorphic owner_id is intentional: the same table serves athletes and
-- staff, while the lib layer validates that an owner belongs to the org.
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('athlete', 'staff')),
  owner_id UUID NOT NULL,
  doc_type document_type NOT NULL,
  custom_type TEXT,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  issued_at DATE,
  expires_at DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT documents_custom_type_check CHECK (
    (doc_type = 'custom' AND custom_type IS NOT NULL AND length(trim(custom_type)) > 0)
    OR (doc_type <> 'custom' AND custom_type IS NULL)
  ),
  CONSTRAINT documents_date_order_check CHECK (
    expires_at IS NULL OR issued_at IS NULL OR expires_at >= issued_at
  )
);

CREATE INDEX idx_documents_owner ON documents(organization_id, owner_type, owner_id);
CREATE INDEX idx_documents_expiry ON documents(organization_id, expires_at);

CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  contract_type TEXT NOT NULL,
  status contract_status NOT NULL DEFAULT 'draft',
  valid_from DATE,
  valid_until DATE,
  document_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contracts_date_order_check CHECK (
    valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from
  )
);

CREATE INDEX idx_contracts_athlete ON contracts(organization_id, athlete_id);
CREATE INDEX idx_contracts_expiry ON contracts(organization_id, valid_until);

-- One private bucket for all organization-rooted athlete/staff documents.
INSERT INTO storage.buckets (
  id,
  name,
  file_size_limit,
  allowed_mime_types,
  public
)
VALUES (
  'club-documents',
  'club-documents',
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png'],
  false
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts FORCE ROW LEVEL SECURITY;

CREATE POLICY "documents_select" ON documents
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('documents.view')
  );

CREATE POLICY "documents_insert" ON documents
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('documents.manage')
  );

CREATE POLICY "documents_update" ON documents
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('documents.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('documents.manage')
  );

CREATE POLICY "documents_delete" ON documents
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('documents.manage')
  );

CREATE POLICY "contracts_select" ON contracts
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('contracts.view')
  );

CREATE POLICY "contracts_insert" ON contracts
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('contracts.manage')
  );

CREATE POLICY "contracts_update" ON contracts
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('contracts.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('contracts.manage')
  );

CREATE POLICY "contracts_delete" ON contracts
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('contracts.manage')
  );

-- Storage isolation follows the path convention:
-- {organization_id}/athletes|staff/{owner_id}/{uuid}-{filename}
CREATE POLICY "club_documents_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'club-documents'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    AND public.authorize('documents.view')
  );

CREATE POLICY "club_documents_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'club-documents'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    AND public.authorize('documents.manage')
  );

CREATE POLICY "club_documents_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'club-documents'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    AND public.authorize('documents.manage')
  )
  WITH CHECK (
    bucket_id = 'club-documents'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    AND public.authorize('documents.manage')
  );

CREATE POLICY "club_documents_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'club-documents'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    AND public.authorize('documents.manage')
  );

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
