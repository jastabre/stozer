-- STOZER Import Jobs Migration (Phase 2, 02-06)
-- The plan originally reserved 00007, but 02-05 owns that number after the
-- registration/medical migration consumed 00005. Keep this migration at 00008
-- so the sequential migration history cannot collide with its prerequisites.

-- import_jobs is the durable progress ledger for the server-side CSV/XLSX
-- import wizard. Parsed rows and the user's mapping/duplicate choices stay on
-- the job so another batch request does not depend on process memory.
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID,
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'parsed', 'validated', 'importing', 'done', 'failed')),
  total_rows INTEGER NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  valid_rows INTEGER NOT NULL DEFAULT 0 CHECK (valid_rows >= 0),
  error_rows INTEGER NOT NULL DEFAULT 0 CHECK (error_rows >= 0),
  duplicated_rows INTEGER NOT NULL DEFAULT 0 CHECK (duplicated_rows >= 0),
  error_message TEXT,
  parsed_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  column_mapping JSONB NOT NULL DEFAULT '[]'::jsonb,
  duplicate_decisions JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_rows INTEGER NOT NULL DEFAULT 0 CHECK (processed_rows >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_import_jobs_org_created
  ON import_jobs(organization_id, created_at DESC);
CREATE INDEX idx_import_jobs_org_status
  ON import_jobs(organization_id, status);

-- Import creates athletes, so the job ledger uses the roster create
-- permission. Every action repeats the auth/org checks; these policies are the
-- database-side backstop for direct action requests and cross-org IDs.
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs FORCE ROW LEVEL SECURITY;

CREATE POLICY "import_jobs_select" ON import_jobs
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.create')
  );

CREATE POLICY "import_jobs_insert" ON import_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.create')
  );

CREATE POLICY "import_jobs_update" ON import_jobs
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.create')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.create')
  );

CREATE TRIGGER import_jobs_updated_at
  BEFORE UPDATE ON import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
