-- STOZER Club Core: counter claim function
-- Pattern 3 (D-05): per-org transactional counter for club athlete IDs.
-- supabase-js cannot express an atomic `SET club_athlete_counter = club_athlete_counter + 1
-- ... RETURNING`; this SECURITY DEFINER function runs it atomically so concurrent
-- create calls never mint duplicate numbers (Pitfall 5). The unique index
-- athletes_org_number_unique backstops any residual race.

CREATE OR REPLACE FUNCTION public.claim_club_athlete_number(p_org_id uuid)
RETURNS integer
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE organizations
  SET club_athlete_counter = club_athlete_counter + 1
  WHERE id = p_org_id
    -- Org isolation: a caller may only claim a number for their OWN org
    -- (T-02-02-05). The JWT app_metadata.organization_id claim is validated
    -- against the target so a privilege-escalation via the SECURITY DEFINER
    -- context can't increment another org's counter.
    AND id = COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid,
      NULL
    )
  RETURNING club_athlete_counter;
$$;

-- Grant execution to authenticated users. The caller is org-scoped inside the
-- function via the JWT claim, so the application layer's requireOrganization()
-- and the RLS policies both remain the outer gate (defense in depth).
GRANT EXECUTE ON FUNCTION public.claim_club_athlete_number(uuid) TO authenticated;
