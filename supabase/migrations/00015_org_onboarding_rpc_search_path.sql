-- STOZER Org Onboarding RPC search_path convergence (UAT G-02-1R2)
-- 00014 originally shipped the RPC with `SET search_path = ''`. That broke the
-- AFTER INSERT triggers on organizations (seed_org_settings 00005,
-- seed_equipment_types 00009), which reference unqualified public tables.
-- Re-define the function with `SET search_path = public` so the triggers
-- resolve. The RPC body fully qualifies every relation; authenticated/anon
-- cannot CREATE objects in public, so the search_path is still safe.

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