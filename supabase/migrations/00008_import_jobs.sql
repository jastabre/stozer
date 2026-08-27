-- STOZER Import Jobs Migration (Phase 2, 02-06)
-- import_jobs: the progress ledger the CSV/XLSX import wizard (D-13, REG-08)
-- polls while a server-side batch import runs. Each uploaded file gets one job
-- row; the wizard reads it to render counts and terminate on done/failed.
--
-- Same RLS discipline as 00001/00003/00005: ENABLE + FORCE ROW LEVEL SECURITY,
-- policies via public.authorize() + org scoping via the JWT app_metadata
-- organization_id claim.
--
-- No app_permission enum additions here — 00002 owns app_permission values.
-- This table rides the existing athletes.create permission (a roster workflow:
-- import creates athletes, exactly like the roster's create-player action).

-- ============================================================
-- TABLE
-- ============================================================

-- import_jobs stores the lifecycle of one import file. status is the wizard's
-- progress state machine the client polls: uploaded (row stored) ->
-- parsed/validated (preview ready) -> importing (batch commit in progress) ->
-- done/failed (terminal, polling converges here — never spins forever).
-- total_rows/valid_rows/error_rows/duplicated_rows are the counters the wizard
-- renders; error_message captures a fatal parse/commit failure.
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID,
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded','parsed','validated','importing','done','failed')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  duplicated_rows INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Wizard progress polling is always org-scoped and often filtered by status
-- (find the latest 'importing' job), so index the common lookups.
CREATE INDEX idx_import_jobs_org_created
  ON import_jobs(organization_id, created_at DESC);
CREATE INDEX idx_import_jobs_org_status
  ON import_jobs(organization_id, status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs FORCE ROW LEVEL SECURITY;

-- Import creates athletes, so the job ledger rides the SAME permission set as
-- the roster workflow: athletes.create. Every action (parse, batch import,
-- progress poll) re-checks this permission AND the org scope on every call —
-- the RLS below is the DB backstop (T-02-06-03: elevation via mass creation).

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

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER import_jobs_updated_at
  BEFORE UPDATE ON import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
