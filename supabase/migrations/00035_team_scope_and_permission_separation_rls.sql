-- 00035_team_scope_and_permission_separation_rls.sql
--
-- 1) COACH TEAM SCOPE AT THE DATABASE BOUNDARY
--    Until now `teams.view` / `athletes.view` were organization-wide, so a
--    coach could read every athlete in the club regardless of `staff_teams`.
--    The model is now explicit:
--
--        permission   = WHAT the role may do
--        staff_teams  = WHICH teams / athletes it may do it on
--
--    Only the coach role is team-scoped (public.is_team_scoped()). Every
--    scoped policy keeps the original permission predicate and adds:
--
--        NOT public.is_team_scoped() OR public.has_team_scope(...)
--
--    The scope is computed live from staff_teams + the ACTIVE season on every
--    statement, so removing/adding an assignment takes effect immediately.
--    Direct object access (a manually typed player URL) is denied by RLS, not
--    by list filtering.
--
-- 2) SEPARATION OF OVERLOADED PERMISSIONS
--      users.manage     -> organization_memberships insert/update/delete
--                          (was a hardcoded club_president subquery + the
--                          self-update loophole, now removed)
--      medical.manage   -> medical_examinations writes (was registrations.manage)
--    Reads keep their existing predicates, now team-scoped where relevant.
--
-- 3) organization_settings SELECT is relaxed to every org member so the
--    club's warning threshold keeps rendering for finance, coaches, etc.
--    Writes stay club_settings.manage.
--
-- NON-DESTRUCTIVE: helpers + policy replacement only. No table, column or row
-- is dropped/changed. FORCE ROW LEVEL SECURITY stays enabled everywhere.

BEGIN;

-- ============================================================
-- HELPERS
-- ============================================================

-- Same claim resolution as authorize() (00014): top-level claim, then nested
-- app_metadata claim, then the membership table as the source of truth.
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::json->>'user_role', ''),
    NULLIF(current_setting('request.jwt.claims', true)::json->'app_metadata'->>'user_role', ''),
    (SELECT om.role::text
       FROM public.organization_memberships om
      WHERE om.user_id = auth.uid()
      ORDER BY om.created_at
      LIMIT 1),
    ''
  )::public.app_role;
$$;

-- The only role whose access is organized around staff_teams assignments.
CREATE OR REPLACE FUNCTION public.is_team_scoped()
RETURNS boolean
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_app_role() = 'coach';
$$;

-- True when the caller's linked staff profile is assigned to the team in the
-- ACTIVE season. Reads staff_teams live: reassignment takes effect at once.
CREATE OR REPLACE FUNCTION public.has_team_scope(p_team_id uuid)
RETURNS boolean
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_teams st
    JOIN public.staff s ON s.id = st.staff_id
    JOIN public.seasons se ON se.id = st.season_id
    WHERE st.team_id = p_team_id
      AND s.user_id = auth.uid()
      AND s.organization_id = st.organization_id
      AND se.organization_id = st.organization_id
      AND se.is_active
  );
$$;

-- Text variant for storage paths (avoids casting arbitrary path segments).
CREATE OR REPLACE FUNCTION public.has_athlete_scope_text(p_athlete_id text)
RETURNS boolean
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.seasonal_memberships m
    JOIN public.seasons se ON se.id = m.season_id
    WHERE m.athlete_id::text = p_athlete_id
      AND m.status = 'active'
      AND se.is_active
      AND public.has_team_scope(m.team_id)
  );
$$;

-- True when the athlete has an ACTIVE roster membership in one of the
-- caller's assigned teams for the active season.
CREATE OR REPLACE FUNCTION public.has_athlete_scope(p_athlete_id uuid)
RETURNS boolean
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.has_athlete_scope_text(p_athlete_id::text);
$$;

-- The caller's linked staff profile (single-club V1: staff.user_id is UNIQUE).
CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS uuid
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid() LIMIT 1;
$$;

-- Team-scoped document access: athlete documents of the caller's athletes,
-- and the caller's own staff documents.
CREATE OR REPLACE FUNCTION public.can_access_document_owner(
  p_owner_type text,
  p_owner_id text
)
RETURNS boolean
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_owner_type = 'athlete' THEN public.has_athlete_scope_text(p_owner_id)
    WHEN p_owner_type = 'staff' THEN p_owner_id = (
      SELECT s.id::text FROM public.staff s WHERE s.user_id = auth.uid() LIMIT 1
    )
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_team_scoped() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_team_scope(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_athlete_scope_text(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_athlete_scope(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_staff_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_document_owner(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_scoped() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_team_scope(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_athlete_scope_text(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_athlete_scope(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_staff_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_document_owner(text, text) TO authenticated;

-- authorize() keeps its contract; it now shares the role resolution above.
CREATE OR REPLACE FUNCTION public.authorize(p public.app_permission)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    WHERE rp.permission = p
      AND rp.role = public.current_app_role()
  );
$$;

-- ============================================================
-- ORGANIZATION MEMBERSHIPS -> users.manage (no self-escalation)
-- ============================================================

DROP POLICY IF EXISTS "membership_insert" ON organization_memberships;
CREATE POLICY "membership_insert" ON organization_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('users.manage')
  );

DROP POLICY IF EXISTS "membership_update" ON organization_memberships;
CREATE POLICY "membership_update" ON organization_memberships
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('users.manage')
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('users.manage')
  );

DROP POLICY IF EXISTS "membership_delete" ON organization_memberships;
CREATE POLICY "membership_delete" ON organization_memberships
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('users.manage')
  );

-- ============================================================
-- ORGANIZATION SETTINGS -> readable by every org member
-- (writes keep club_settings.manage, unchanged)
-- ============================================================

DROP POLICY IF EXISTS "org_settings_select" ON organization_settings;
CREATE POLICY "org_settings_select" ON organization_settings
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
  );

-- ============================================================
-- TEAMS
-- ============================================================

DROP POLICY IF EXISTS "teams_select" ON teams;
CREATE POLICY "teams_select" ON teams
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('teams.view')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(id))
  );

DROP POLICY IF EXISTS "teams_insert" ON teams;
CREATE POLICY "teams_insert" ON teams
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('teams.create')
    AND NOT public.is_team_scoped()
  );

DROP POLICY IF EXISTS "teams_update" ON teams;
CREATE POLICY "teams_update" ON teams
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('teams.edit')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(id))
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('teams.edit')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(id))
  );

DROP POLICY IF EXISTS "teams_delete" ON teams;
CREATE POLICY "teams_delete" ON teams
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('teams.delete')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(id))
  );

-- ============================================================
-- ATHLETES (organization-level entity; coach sees only rostered athletes)
-- ============================================================

DROP POLICY IF EXISTS "athletes_select" ON athletes;
CREATE POLICY "athletes_select" ON athletes
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.view')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(id))
  );

DROP POLICY IF EXISTS "athletes_insert" ON athletes;
CREATE POLICY "athletes_insert" ON athletes
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.create')
    AND NOT public.is_team_scoped()
  );

DROP POLICY IF EXISTS "athletes_update" ON athletes;
CREATE POLICY "athletes_update" ON athletes
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.edit')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(id))
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.edit')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(id))
  );

DROP POLICY IF EXISTS "athletes_delete" ON athletes;
CREATE POLICY "athletes_delete" ON athletes
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.delete')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(id))
  );

-- ============================================================
-- SEASONAL MEMBERSHIPS (roster rows follow their team)
-- ============================================================

DROP POLICY IF EXISTS "memberships_select" ON seasonal_memberships;
CREATE POLICY "memberships_select" ON seasonal_memberships
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('teams.view') OR public.authorize('athletes.view'))
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  );

DROP POLICY IF EXISTS "memberships_insert" ON seasonal_memberships;
CREATE POLICY "memberships_insert" ON seasonal_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('teams.edit') OR public.authorize('athletes.edit'))
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  );

DROP POLICY IF EXISTS "memberships_update" ON seasonal_memberships;
CREATE POLICY "memberships_update" ON seasonal_memberships
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('teams.edit') OR public.authorize('athletes.edit'))
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('teams.edit') OR public.authorize('athletes.edit'))
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  );

DROP POLICY IF EXISTS "memberships_delete" ON seasonal_memberships;
CREATE POLICY "memberships_delete" ON seasonal_memberships
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('teams.edit') OR public.authorize('athletes.edit'))
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  );

-- ============================================================
-- REGISTRATIONS (coach has no registrations permission; scope added for
-- defense in depth if a team-scoped role is ever granted one)
-- ============================================================

DROP POLICY IF EXISTS "registrations_select" ON registrations;
CREATE POLICY "registrations_select" ON registrations
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('registrations.view')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

DROP POLICY IF EXISTS "registrations_insert" ON registrations;
CREATE POLICY "registrations_insert" ON registrations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('registrations.manage')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

DROP POLICY IF EXISTS "registrations_update" ON registrations;
CREATE POLICY "registrations_update" ON registrations
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('registrations.manage')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('registrations.manage')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

DROP POLICY IF EXISTS "registrations_delete" ON registrations;
CREATE POLICY "registrations_delete" ON registrations
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('registrations.manage')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

-- ============================================================
-- MEDICAL EXAMINATIONS (writes now require medical.manage)
-- ============================================================

DROP POLICY IF EXISTS "medical_examinations_select" ON medical_examinations;
CREATE POLICY "medical_examinations_select" ON medical_examinations
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('registrations.view') OR public.authorize('medical.view'))
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

DROP POLICY IF EXISTS "medical_examinations_insert" ON medical_examinations;
CREATE POLICY "medical_examinations_insert" ON medical_examinations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('medical.manage')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

DROP POLICY IF EXISTS "medical_examinations_update" ON medical_examinations;
CREATE POLICY "medical_examinations_update" ON medical_examinations
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('medical.manage')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('medical.manage')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

DROP POLICY IF EXISTS "medical_examinations_delete" ON medical_examinations;
CREATE POLICY "medical_examinations_delete" ON medical_examinations
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('medical.manage')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

-- ============================================================
-- GUARDIANS
-- ============================================================

DROP POLICY IF EXISTS "guardians_select" ON guardians;
CREATE POLICY "guardians_select" ON guardians
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('athletes.view') OR public.authorize('staff.view'))
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

DROP POLICY IF EXISTS "guardians_insert" ON guardians;
CREATE POLICY "guardians_insert" ON guardians
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.edit')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

DROP POLICY IF EXISTS "guardians_update" ON guardians;
CREATE POLICY "guardians_update" ON guardians
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.edit')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.edit')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

DROP POLICY IF EXISTS "guardians_delete" ON guardians;
CREATE POLICY "guardians_delete" ON guardians
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.edit')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

-- ============================================================
-- DOCUMENTS + storage objects
-- ============================================================

DROP POLICY IF EXISTS "documents_select" ON documents;
CREATE POLICY "documents_select" ON documents
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('documents.view')
    AND (
      NOT public.is_team_scoped()
      OR public.can_access_document_owner(owner_type, owner_id::text)
    )
  );

DROP POLICY IF EXISTS "documents_insert" ON documents;
CREATE POLICY "documents_insert" ON documents
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('documents.manage')
    AND (
      NOT public.is_team_scoped()
      OR public.can_access_document_owner(owner_type, owner_id::text)
    )
  );

DROP POLICY IF EXISTS "documents_update" ON documents;
CREATE POLICY "documents_update" ON documents
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('documents.manage')
    AND (
      NOT public.is_team_scoped()
      OR public.can_access_document_owner(owner_type, owner_id::text)
    )
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('documents.manage')
    AND (
      NOT public.is_team_scoped()
      OR public.can_access_document_owner(owner_type, owner_id::text)
    )
  );

DROP POLICY IF EXISTS "documents_delete" ON documents;
CREATE POLICY "documents_delete" ON documents
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('documents.manage')
    AND (
      NOT public.is_team_scoped()
      OR public.can_access_document_owner(owner_type, owner_id::text)
    )
  );

-- Storage path convention: {organization_id}/athletes|staff/{owner_id}/...
DROP POLICY IF EXISTS "club_documents_select" ON storage.objects;
CREATE POLICY "club_documents_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'club-documents'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    AND public.authorize('documents.view')
    AND (
      NOT public.is_team_scoped()
      OR public.can_access_document_owner(
        (storage.foldername(name))[2],
        (storage.foldername(name))[3]
      )
    )
  );

DROP POLICY IF EXISTS "club_documents_insert" ON storage.objects;
CREATE POLICY "club_documents_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'club-documents'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    AND public.authorize('documents.manage')
    AND (
      NOT public.is_team_scoped()
      OR public.can_access_document_owner(
        (storage.foldername(name))[2],
        (storage.foldername(name))[3]
      )
    )
  );

DROP POLICY IF EXISTS "club_documents_update" ON storage.objects;
CREATE POLICY "club_documents_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'club-documents'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    AND public.authorize('documents.manage')
    AND (
      NOT public.is_team_scoped()
      OR public.can_access_document_owner(
        (storage.foldername(name))[2],
        (storage.foldername(name))[3]
      )
    )
  )
  WITH CHECK (
    bucket_id = 'club-documents'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    AND public.authorize('documents.manage')
    AND (
      NOT public.is_team_scoped()
      OR public.can_access_document_owner(
        (storage.foldername(name))[2],
        (storage.foldername(name))[3]
      )
    )
  );

DROP POLICY IF EXISTS "club_documents_delete" ON storage.objects;
CREATE POLICY "club_documents_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'club-documents'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    AND public.authorize('documents.manage')
    AND (
      NOT public.is_team_scoped()
      OR public.can_access_document_owner(
        (storage.foldername(name))[2],
        (storage.foldername(name))[3]
      )
    )
  );

-- ============================================================
-- CONTRACTS (coach has no contracts permission; scope added for defense)
-- ============================================================

DROP POLICY IF EXISTS "contracts_select" ON contracts;
CREATE POLICY "contracts_select" ON contracts
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('contracts.view')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

DROP POLICY IF EXISTS "contracts_insert" ON contracts;
CREATE POLICY "contracts_insert" ON contracts
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('contracts.manage')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

DROP POLICY IF EXISTS "contracts_update" ON contracts;
CREATE POLICY "contracts_update" ON contracts
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('contracts.manage')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('contracts.manage')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

DROP POLICY IF EXISTS "contracts_delete" ON contracts;
CREATE POLICY "contracts_delete" ON contracts
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('contracts.manage')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

-- ============================================================
-- EQUIPMENT
-- ============================================================

DROP POLICY IF EXISTS "team_equipment_requirements_select" ON team_equipment_requirements;
CREATE POLICY "team_equipment_requirements_select" ON team_equipment_requirements
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.view')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  );

DROP POLICY IF EXISTS "team_equipment_requirements_write" ON team_equipment_requirements;
CREATE POLICY "team_equipment_requirements_write" ON team_equipment_requirements
  FOR ALL TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  );

DROP POLICY IF EXISTS "athlete_equipment_select" ON athlete_equipment;
CREATE POLICY "athlete_equipment_select" ON athlete_equipment
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.view')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

DROP POLICY IF EXISTS "athlete_equipment_report" ON athlete_equipment;
CREATE POLICY "athlete_equipment_report" ON athlete_equipment
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.report')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

DROP POLICY IF EXISTS "athlete_equipment_update" ON athlete_equipment;
CREATE POLICY "athlete_equipment_update" ON athlete_equipment
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('equipment.report') OR public.authorize('equipment.manage'))
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('equipment.report') OR public.authorize('equipment.manage'))
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

DROP POLICY IF EXISTS "athlete_equipment_delete" ON athlete_equipment;
CREATE POLICY "athlete_equipment_delete" ON athlete_equipment
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

DROP POLICY IF EXISTS "team_equipment_select" ON team_equipment;
CREATE POLICY "team_equipment_select" ON team_equipment
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.view')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  );

DROP POLICY IF EXISTS "team_equipment_write" ON team_equipment;
CREATE POLICY "team_equipment_write" ON team_equipment
  FOR ALL TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  );

DROP POLICY IF EXISTS "equipment_requests_select" ON equipment_requests;
CREATE POLICY "equipment_requests_select" ON equipment_requests
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.view')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  );

DROP POLICY IF EXISTS "equipment_requests_insert" ON equipment_requests;
CREATE POLICY "equipment_requests_insert" ON equipment_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.report')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  );

DROP POLICY IF EXISTS "equipment_requests_update" ON equipment_requests;
CREATE POLICY "equipment_requests_update" ON equipment_requests
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  );

DROP POLICY IF EXISTS "equipment_requests_delete" ON equipment_requests;
CREATE POLICY "equipment_requests_delete" ON equipment_requests
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  );

DROP POLICY IF EXISTS "aia_select" ON athlete_item_assignments;
CREATE POLICY "aia_select" ON athlete_item_assignments
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.view')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

DROP POLICY IF EXISTS "aia_insert" ON athlete_item_assignments;
CREATE POLICY "aia_insert" ON athlete_item_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.report')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

DROP POLICY IF EXISTS "aia_update" ON athlete_item_assignments;
CREATE POLICY "aia_update" ON athlete_item_assignments
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('equipment.report') OR public.authorize('equipment.manage'))
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (public.authorize('equipment.report') OR public.authorize('equipment.manage'))
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

DROP POLICY IF EXISTS "aia_delete" ON athlete_item_assignments;
CREATE POLICY "aia_delete" ON athlete_item_assignments
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('equipment.manage')
    AND (NOT public.is_team_scoped() OR public.has_athlete_scope(athlete_id))
  );

-- ============================================================
-- STAFF (a coach only ever sees their own profile / assignments / licenses)
-- ============================================================

DROP POLICY IF EXISTS "staff_select" ON staff;
CREATE POLICY "staff_select" ON staff
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.view')
    AND (NOT public.is_team_scoped() OR user_id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_insert" ON staff;
CREATE POLICY "staff_insert" ON staff
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
    AND NOT public.is_team_scoped()
  );

DROP POLICY IF EXISTS "staff_update" ON staff;
CREATE POLICY "staff_update" ON staff
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
    AND NOT public.is_team_scoped()
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
    AND NOT public.is_team_scoped()
  );

DROP POLICY IF EXISTS "staff_delete" ON staff;
CREATE POLICY "staff_delete" ON staff
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
    AND NOT public.is_team_scoped()
  );

DROP POLICY IF EXISTS "staff_teams_select" ON staff_teams;
CREATE POLICY "staff_teams_select" ON staff_teams
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.view')
    AND (NOT public.is_team_scoped() OR public.has_team_scope(team_id))
  );

DROP POLICY IF EXISTS "staff_teams_insert" ON staff_teams;
CREATE POLICY "staff_teams_insert" ON staff_teams
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
    AND NOT public.is_team_scoped()
  );

DROP POLICY IF EXISTS "staff_teams_update" ON staff_teams;
CREATE POLICY "staff_teams_update" ON staff_teams
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
    AND NOT public.is_team_scoped()
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
    AND NOT public.is_team_scoped()
  );

DROP POLICY IF EXISTS "staff_teams_delete" ON staff_teams;
CREATE POLICY "staff_teams_delete" ON staff_teams
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
    AND NOT public.is_team_scoped()
  );

DROP POLICY IF EXISTS "staff_licenses_select" ON staff_licenses;
CREATE POLICY "staff_licenses_select" ON staff_licenses
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.view')
    AND (NOT public.is_team_scoped() OR staff_id = public.current_staff_id())
  );

DROP POLICY IF EXISTS "staff_licenses_insert" ON staff_licenses;
CREATE POLICY "staff_licenses_insert" ON staff_licenses
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
    AND NOT public.is_team_scoped()
  );

DROP POLICY IF EXISTS "staff_licenses_update" ON staff_licenses;
CREATE POLICY "staff_licenses_update" ON staff_licenses
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
    AND NOT public.is_team_scoped()
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
    AND NOT public.is_team_scoped()
  );

DROP POLICY IF EXISTS "staff_licenses_delete" ON staff_licenses;
CREATE POLICY "staff_licenses_delete" ON staff_licenses
  FOR DELETE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('staff.manage')
    AND NOT public.is_team_scoped()
  );

-- ============================================================
-- IMPORT JOBS (roster import is organization-wide)
-- ============================================================

DROP POLICY IF EXISTS "import_jobs_select" ON import_jobs;
CREATE POLICY "import_jobs_select" ON import_jobs
  FOR SELECT TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.create')
    AND NOT public.is_team_scoped()
  );

DROP POLICY IF EXISTS "import_jobs_insert" ON import_jobs;
CREATE POLICY "import_jobs_insert" ON import_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.create')
    AND NOT public.is_team_scoped()
  );

DROP POLICY IF EXISTS "import_jobs_update" ON import_jobs;
CREATE POLICY "import_jobs_update" ON import_jobs
  FOR UPDATE TO authenticated
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.create')
    AND NOT public.is_team_scoped()
  )
  WITH CHECK (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('athletes.create')
    AND NOT public.is_team_scoped()
  );

COMMIT;
