-- 00041_document_storage_owner_scope_fix.sql
--
-- ROOT CAUSE
--   The storage.objects policies (00035) passed the raw path folder segment to
--   public.can_access_document_owner(owner_type, owner_id):
--
--       can_access_document_owner((storage.foldername(name))[2], ...)
--
--   The athlete folder is spelled 'athletes' (plural), but the function only
--   matched 'athlete' — the singular value documents.owner_type uses. So for a
--   team-scoped coach the CASE fell through to ELSE false: the metadata row was
--   visible (documents_select matches owner_type = 'athlete') while
--   createSignedUrl on the object was denied.
--
-- FIX
--   Teach public.can_access_document_owner() to accept BOTH 'athlete' and
--   'athletes' (the documents table keeps using 'athlete'; the storage path
--   keeps using 'athletes'). Nothing else changes:
--     - the 'staff' rule stays byte-for-byte identical
--     - organization isolation stays in the policies (org column / folder[1])
--     - the coach team scope is neither widened nor weakened
--
-- NON-DESTRUCTIVE
--   Replaces one function body (ownership and existing GRANTs are preserved by
--   CREATE OR REPLACE). No table, row, policy or data is touched. The 00035
--   migration is left untouched.

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
    WHEN p_owner_type IN ('athlete', 'athletes')
      THEN public.has_athlete_scope_text(p_owner_id)
    WHEN p_owner_type = 'staff'
      THEN p_owner_id = (
        SELECT s.id::text FROM public.staff s WHERE s.user_id = auth.uid() LIMIT 1
      )
    ELSE false
  END;
$$;
