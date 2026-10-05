-- 00025: org branding writes + club logo storage.
--
-- Root cause of "branding not working": organizations only had SELECT
-- (org_select_members) and INSERT (org_insert_auth) policies. With RLS FORCE'd,
-- any UPDATE on organizations from a member session was denied, so saving the
-- club logo / accent colors silently failed. Add an org-scoped UPDATE policy
-- gated on club_settings.manage (the president / finance admin).
--
-- Also adds a public, org-scoped storage bucket for club logos so the logo can
-- be uploaded through a normal file picker instead of a raw URL field.

BEGIN;

-- ============================================================
-- organizations: UPDATE policy (branding + identity fields)
-- ============================================================
CREATE POLICY "org_update_settings" ON organizations
  FOR UPDATE TO authenticated
  USING (
    id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('club_settings.manage')
  )
  WITH CHECK (
    id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND public.authorize('club_settings.manage')
  );

-- ============================================================
-- Public bucket for club logos
-- ============================================================
INSERT INTO storage.buckets (id, name, file_size_limit, allowed_mime_types, public)
VALUES (
  'club-logos',
  'club-logos',
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml'],
  true
)
ON CONFLICT (id) DO NOTHING;

-- Public read: the logo renders on the sidebar for anyone who can see the page.
CREATE POLICY "club_logos_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'club-logos');

-- Writes are scoped to the caller's org folder and club_settings.manage.
-- Path convention: {organization_id}/{filename}
CREATE POLICY "club_logos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'club-logos'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    AND public.authorize('club_settings.manage')
  );

CREATE POLICY "club_logos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'club-logos'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    AND public.authorize('club_settings.manage')
  )
  WITH CHECK (
    bucket_id = 'club-logos'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    AND public.authorize('club_settings.manage')
  );

CREATE POLICY "club_logos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'club-logos'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    AND public.authorize('club_settings.manage')
  );

COMMIT;