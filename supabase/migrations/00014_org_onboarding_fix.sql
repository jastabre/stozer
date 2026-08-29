-- STOZER Org Onboarding Fix (UAT G-02-1R2)
-- 1) Circular RLS bootstrap: membership_insert (00001) requires the inserting
--    user to ALREADY be a club_president of the target org, so a brand-new
--    user could never create their own first membership row. Fix: a single
--    SECURITY DEFINER RPC that atomically creates org + first membership
--    (club_president) + subscription for the CALLER only, guarded by
--    auth.uid() and a single-org-per-user check. Tenant isolation stays
--    strict: no broad grants, RLS still forced on every table.
-- 2) authorize() read the top-level JWT claim 'user_role', which GoTrue only
--    emits via a custom_access_token_hook that was never registered. It now
--    falls back to the nested app_metadata claim, then to the membership
--    table (SECURITY DEFINER, scoped to auth.uid()).

-- NOTE on search_path: the RPC uses `SET search_path = public` (not '') because
-- inserting into organizations fires AFTER INSERT triggers
-- (seed_org_settings 00005, seed_equipment_types 00009) whose functions
-- reference unqualified public tables. Those would break under an empty
-- search_path. The RPC body itself fully qualifies every relation, and
-- authenticated/anon cannot CREATE objects in public, so no hijacking surface.

-- ============================================================
-- RPC: create organization + first membership + subscription
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_organization_onboarding(
  p_name text,
  p_sport text,
  p_country text,
  p_language text,
  p_currency text,
  p_timezone text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id  uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Single-club bootstrap: a user may only create their FIRST org this way.
  -- Prevents escalating into (or becoming president of) an existing tenant.
  IF EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'User already belongs to an organization';
  END IF;

  INSERT INTO public.organizations (name, sport, country, language, currency, timezone)
  VALUES (p_name, p_sport, p_country, p_language, p_currency, p_timezone)
  RETURNING id INTO v_org_id;

  -- First membership: the caller becomes club_president of the new org.
  INSERT INTO public.organization_memberships (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'club_president');

  -- Free-trial subscription on the CLUB plan.
  INSERT INTO public.subscriptions (organization_id, plan_id, status, trial_starts_at, trial_ends_at)
  VALUES (
    v_org_id,
    'a0000000-0000-0000-0000-000000000002',
    'active',
    now(),
    now() + interval '14 days'
  );

  RETURN v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization_onboarding(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization_onboarding(text, text, text, text, text, text) TO authenticated;

-- ============================================================
-- authorize(): resilient role resolution
-- ============================================================

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
      AND rp.role = COALESCE(
        -- 1) top-level custom claim (custom_access_token_hook)
        NULLIF(current_setting('request.jwt.claims', true)::json->>'user_role', ''),
        -- 2) nested app_metadata claim (set via service-role admin update)
        NULLIF(current_setting('request.jwt.claims', true)::json->'app_metadata'->>'user_role', ''),
        -- 3) membership table (source of truth; scoped to the caller)
        (SELECT om.role::text
         FROM public.organization_memberships om
         WHERE om.user_id = auth.uid()
         ORDER BY om.created_at
         LIMIT 1),
        ''
      )::public.app_role
  );
$$;