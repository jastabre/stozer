import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/organization";
import {
  getActiveSeason,
  getAthleteWithMemberships,
  listTeams,
} from "@/lib/club-data";
import { listGuardians } from "@/lib/guardian";

/**
 * Per-request cache of the shared player-profile shell data (organization,
 * Supabase client, athlete with memberships, all teams, active season).
 *
 * Both `players/[id]/layout.tsx` and the tab pages call this; React's `cache`
 * dedupes the work within a single request, so navigating between tabs reads
 * the athlete once instead of re-querying in the shell and in the page.
 */
export const loadPlayerShell = cache(async (athleteId: string) => {
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const [athlete, teams, activeSeason] = await Promise.all([
    getAthleteWithMemberships(supabase, org.organizationId, athleteId),
    listTeams(supabase, org.organizationId),
    getActiveSeason(supabase, org.organizationId),
  ]);
  return { org, supabase, athlete, teams, activeSeason };
});

/**
 * Guardian list for an athlete, cached per request. Shared by the profile shell
 * (to decide the "Staratelji" tab visibility) and the guardians page, so tab
 * navigation and the page don't each issue their own query.
 */
export const loadGuardians = cache(async (athleteId: string) => {
  const { org, supabase } = await loadPlayerShell(athleteId);
  return listGuardians(supabase, org.organizationId, athleteId);
});

/**
 * Guardian count for an athlete (tab visibility: a minor, or any existing record)
 * without a full second query.
 */
export const loadGuardianCount = cache(
  async (athleteId: string): Promise<number> => (await loadGuardians(athleteId)).length
);

export interface LinkedStaffSummary {
  id: string;
  functions: {
    id: string;
    function_key: string;
    custom_label: string | null;
    is_primary: boolean;
  }[];
}

/**
 * The staff profile linked to an athlete (same physical person), when one
 * exists. Read-only and best-effort: a player without a linked staff profile
 * simply renders without the "Osoblje" badge.
 */
export const loadLinkedStaff = cache(
  async (athleteId: string): Promise<LinkedStaffSummary | null> => {
    const { org, supabase } = await loadPlayerShell(athleteId);
    const { data: staff } = await supabase
      .from("staff")
      .select("id")
      .eq("organization_id", org.organizationId)
      .eq("athlete_id", athleteId)
      .maybeSingle();
    if (!staff) return null;

    const { data: functions } = await supabase
      .from("staff_functions")
      .select("id, function_key, custom_label, is_primary")
      .eq("organization_id", org.organizationId)
      .eq("staff_id", staff.id)
      .order("created_at");

    return {
      id: staff.id,
      functions: (functions ?? []).sort(
        (a, b) => Number(b.is_primary) - Number(a.is_primary)
      ),
    };
  }
);
