-- STOZER Restore standard Supabase base privileges (UAT G-02-1R2, root cause)
--
-- The database was provisioned/migrated WITHOUT Supabase's default base
-- grants: anon, authenticated and service_role have no privileges on any
-- public table. RLS is FORCE'd on every table, but row-level policies cannot
-- even be evaluated without base privileges — every query surfaced as
-- "permission denied for table X". This was the true cause of the onboarding
-- failure ("permission denied for table organization_memberships" — the org
-- INSERT's RETURNING evaluated the org_select_members policy subquery).
--
-- This migration restores the platform's STANDARD base privileges. It does
-- NOT weaken tenant isolation: RLS remains enabled and FORCE'd on every table
-- and the org-scoping/role policies are unchanged. Grants only allow RLS to
-- run; the policies still decide which rows are visible/writable.
-- The first-membership bootstrap is still only possible through the
-- SECURITY DEFINER RPC create_organization_onboarding (00014/00015).

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TYPES TO anon, authenticated, service_role;

-- Re-lock the onboarding bootstrap RPC: the blanket function grant above would
-- re-expose EXECUTE to anon/PUBLIC. Only authenticated may call it, and its
-- own auth.uid()/single-org guards still gate the operation.
REVOKE ALL ON FUNCTION public.create_organization_onboarding(text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization_onboarding(text, text, text, text, text, text) TO authenticated;