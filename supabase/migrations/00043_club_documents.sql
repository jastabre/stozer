-- 00043_club_documents.sql
--
-- "Dokumenti kluba" — a simple, organization-wide file library.
--
-- WHY A SEPARATE TABLE
--   The existing `documents` table is strictly an ATTACHMENT store for athletes
--   and staff: owner_type/owner_id are NOT NULL and documents are never more
--   than an attachment to a person (they must not drive registration/medical/
--   contract status). A club library item (memorandum, blank form, pravilnik,
--   blank contract) belongs to the CLUB, not a person, and has its own metadata
--   (name, category, note). Reusing `documents` would mean loosening its owner
--   constraints and mixing two different concepts — so the club library gets
--   its own table and the athlete/staff document model stays untouched.
--
-- STORAGE
--   The private `club-documents` bucket is reused (one private bucket per
--   tenant, rooted at the organization id). Club files live under
--   {organization_id}/club/{uuid}-{filename}. The existing `club_documents_*`
--   storage.objects policies already scope the whole bucket to
--   (storage.foldername(name))[1] = the caller's organization_id and gate on
--   documents.view/manage, so no new storage policy is needed and no object of
--   another club is ever reachable. This migration only WIDENS the bucket's
--   allowed MIME types to the business formats the library must accept.
--
-- NON-DESTRUCTIVE: new enum, new table, new policies and an additive bucket
-- metadata UPDATE. No existing table/column/row/policy is dropped or changed,
-- and `documents`/`contracts` keep working exactly as before.

BEGIN;

-- ============================================================
-- ENUM
-- ============================================================

CREATE TYPE club_document_category AS ENUM (
  'form',
  'memorandum',
  'regulation',
  'contract',
  'other'
);

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE club_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category club_document_category NOT NULL DEFAULT 'other',
  notes TEXT,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT club_documents_name_check CHECK (length(trim(name)) > 0),
  CONSTRAINT club_documents_storage_path_check CHECK (length(trim(storage_path)) > 0)
);

CREATE INDEX idx_club_documents_org ON club_documents(organization_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (organization-scoped; no team scope — a club-wide
-- library is not narrowed by staff_teams)
-- ============================================================

ALTER TABLE club_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_documents FORCE ROW LEVEL SECURITY;

CREATE POLICY "club_documents_select" ON club_documents
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('documents.view')
  );

CREATE POLICY "club_documents_insert" ON club_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('documents.manage')
  );

CREATE POLICY "club_documents_update" ON club_documents
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('documents.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('documents.manage')
  );

CREATE POLICY "club_documents_delete" ON club_documents
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('documents.manage')
  );

CREATE TRIGGER club_documents_updated_at
  BEFORE UPDATE ON club_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- STORAGE BUCKET — accept the business office formats (additive).
-- The bucket stays private; only the MIME allow-list and the size cap move.
-- ============================================================

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ],
  file_size_limit = 10485760
WHERE id = 'club-documents';

COMMIT;
