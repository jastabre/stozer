-- 00042_athlete_photo_avatar_bucket.sql
--
-- PLAYER PHOTO (avatar) storage for `athletes.photo_url`.
--
-- The column already exists (00003: photo_url TEXT, nullable) and stays the
-- single source of truth for the photo. This migration only adds the storage
-- side: a PRIVATE, organization-scoped bucket for athlete photos.
--
-- A photo is NOT a document: it lives in its own bucket, never in
-- club-documents, and its access follows the athlete permissions
-- (athletes.view / athletes.edit), not documents.*.
--
-- Path convention: {organization_id}/athletes/{athlete_id}/{uuid}-{filename}
--   foldername(name)[1] = organization_id (org isolation, same as 00007/00035)
--   foldername(name)[2] = 'athletes'
--   foldername(name)[3] = athlete_id (coach team-scope boundary)
--
-- Reads are further narrowed for the team-scoped coach via
-- public.has_athlete_scope_text() (00035): a coach only sees photos of athletes
-- in their assigned teams for the active season. Every other role keeps its
-- organization-wide scope, exactly like the rest of the athletes RLS.
--
-- NON-DESTRUCTIVE: adds one bucket + its policies. No table, column, row or
-- existing bucket/policy is touched.

INSERT INTO storage.buckets (id, name, file_size_limit, allowed_mime_types, public)
VALUES (
  'club-avatars',
  'club-avatars',
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp'],
  false
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "club_avatars_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'club-avatars'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    AND public.authorize('athletes.view')
    AND (
      NOT public.is_team_scoped()
      OR public.has_athlete_scope_text((storage.foldername(name))[3])
    )
  );

CREATE POLICY "club_avatars_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'club-avatars'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    AND public.authorize('athletes.edit')
    AND (
      NOT public.is_team_scoped()
      OR public.has_athlete_scope_text((storage.foldername(name))[3])
    )
  );

CREATE POLICY "club_avatars_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'club-avatars'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    AND public.authorize('athletes.edit')
    AND (
      NOT public.is_team_scoped()
      OR public.has_athlete_scope_text((storage.foldername(name))[3])
    )
  )
  WITH CHECK (
    bucket_id = 'club-avatars'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    AND public.authorize('athletes.edit')
    AND (
      NOT public.is_team_scoped()
      OR public.has_athlete_scope_text((storage.foldername(name))[3])
    )
  );

CREATE POLICY "club_avatars_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'club-avatars'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    AND public.authorize('athletes.edit')
    AND (
      NOT public.is_team_scoped()
      OR public.has_athlete_scope_text((storage.foldername(name))[3])
    )
  );
