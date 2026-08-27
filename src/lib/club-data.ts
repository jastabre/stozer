import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { buildClubAthleteNumber } from "@/lib/athlete-id";

type Supabase = SupabaseClient<Database>;

export interface Season {
  id: string;
  organization_id: string;
  name: string;
  starts_on: string;
  ends_on: string | null;
  is_active: boolean;
}

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  sport: "football" | "basketball";
}

export interface AthleteMembership {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  gender: string | null;
  nationality: string | null;
  position: string | null;
  photo_url: string | null;
  club_athlete_number: number;
  membership: {
    team_id: string;
    jersey_number: number | null;
    team_name: string | null;
  } | null;
}

export interface CreateAthleteInput {
  first_name: string;
  last_name: string;
  birth_date: string;
  gender?: string | null;
  nationality?: string | null;
  position?: string | null;
  federation_id?: string | null;
  /** Active season to attach the membership to (required when team_id is set). */
  seasonId?: string;
  team_id?: string;
  jersey_number?: number;
}

/**
 * Get the org's active season (single active per org, D-02).
 * `maybeSingle` tolerates no active season yet.
 */
export async function getActiveSeason(
  supabase: Supabase,
  orgId: string
): Promise<Season | null> {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return null;
  return (data as Season) ?? null;
}

/**
 * List teams in the org, ordered by name.
 */
export async function listTeams(
  supabase: Supabase,
  orgId: string
): Promise<(Team & { athlete_count: number })[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("*, seasonal_memberships(count)")
    .eq("organization_id", orgId)
    .order("name");

  if (error) return [];

  return (data ?? []).map((row) => {
    const memberships = row.seasonal_memberships as unknown as
      | { count: number }[]
      | null;
    return {
      id: row.id,
      organization_id: row.organization_id,
      name: row.name,
      category: row.category,
      sport: row.sport,
      athlete_count: memberships?.[0]?.count ?? 0,
    };
  });
}

/**
 * List athletes with their current-season membership (jersey + team name).
 * Empty roster is valid — athletes with no membership this season are excluded
 * (only active-season members are shown on the roster page).
 */
export async function listAthletesWithCurrentMembership(
  supabase: Supabase,
  orgId: string,
  seasonId: string
): Promise<AthleteMembership[]> {
  const { data, error } = await supabase
    .from("athletes")
    .select(
      "id, organization_id, first_name, last_name, birth_date, gender, nationality, position, photo_url, club_athlete_number, seasonal_memberships!inner(team_id, jersey_number, teams(name))"
    )
    .eq("organization_id", orgId)
    .eq("seasonal_memberships.season_id", seasonId)
    .order("last_name");

  if (error) return [];

  return (data ?? []).map((row) => {
    const memberships = row.seasonal_memberships as unknown as Array<{
      team_id: string;
      jersey_number: number | null;
      teams: { name: string } | null;
    }>;
    const current = memberships?.[0];
    return {
      id: row.id,
      organization_id: row.organization_id,
      first_name: row.first_name,
      last_name: row.last_name,
      birth_date: row.birth_date,
      gender: row.gender,
      nationality: row.nationality,
      position: row.position,
      photo_url: row.photo_url,
      club_athlete_number: row.club_athlete_number,
      membership: current
        ? {
            team_id: current.team_id,
            jersey_number: current.jersey_number,
            team_name: current.teams?.name ?? null,
          }
        : null,
    };
  });
}

/**
 * A single athlete with their full membership history (all seasons), used by
 * the profile page (D-04: current season primary, past seasons collapsed).
 */
export interface AthleteDetail {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  gender: string | null;
  nationality: string | null;
  position: string | null;
  photo_url: string | null;
  federation_id: string | null;
  club_athlete_number: number;
  memberships: {
    seasonId: string;
    seasonName: string;
    isActive: boolean;
    teamId: string;
    teamName: string;
    jerseyNumber: number | null;
    status: string;
  }[];
}

/**
 * Fetch one athlete scoped to the org, with memberships across all seasons
 * (each carrying its season + team). Returns null when missing or not in org.
 */
export async function getAthleteWithMemberships(
  supabase: Supabase,
  orgId: string,
  athleteId: string
): Promise<AthleteDetail | null> {
  const { data, error } = await supabase
    .from("athletes")
    .select(
      "id, organization_id, first_name, last_name, birth_date, gender, nationality, position, photo_url, federation_id, club_athlete_number, seasonal_memberships(season_id, team_id, jersey_number, status, seasons(name, is_active), teams(name))"
    )
    .eq("id", athleteId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error || !data) return null;

  const memberships = (data.seasonal_memberships as unknown as Array<{
    season_id: string;
    team_id: string;
    jersey_number: number | null;
    status: string;
    seasons: { name: string; is_active: boolean } | null;
    teams: { name: string } | null;
  }>) || [];

  return {
    id: data.id,
    organization_id: data.organization_id,
    first_name: data.first_name,
    last_name: data.last_name,
    birth_date: data.birth_date,
    gender: data.gender,
    nationality: data.nationality,
    position: data.position,
    photo_url: data.photo_url,
    federation_id: data.federation_id,
    club_athlete_number: data.club_athlete_number,
    memberships: memberships.map((m) => ({
      seasonId: m.season_id,
      seasonName: m.seasons?.name ?? "",
      isActive: m.seasons?.is_active ?? false,
      teamId: m.team_id,
      teamName: m.teams?.name ?? "",
      jerseyNumber: m.jersey_number,
      status: m.status,
    })),
  };
}

/**
 * Update an athlete's free-text Federation / Registration ID (D-06). The value
 * is reference-only: never validated or interpreted here.
 */
export async function updateAthleteFederationId(
  supabase: Supabase,
  orgId: string,
  athleteId: string,
  federationId: string | null
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("athletes")
    .update({ federation_id: federationId })
    .eq("id", athleteId)
    .eq("organization_id", orgId);

  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Create an athlete with an auto-assigned club athlete ID.
 * 1. Claim the next counter value atomically in the DB (Pattern 3, D-05).
 * 2. Insert the athlete with that number.
 * 3. Optionally insert the current-season membership (team + jersey).
 */
export async function createAthlete(
  supabase: Supabase,
  orgId: string,
  input: CreateAthleteInput
): Promise<{ id: string; club_athlete_number: number } | { error: string }> {
  // (1) Claim the next number via atomic UPDATE..RETURNING (no MAX(id)+1, no nextval).
  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_club_athlete_number",
    { p_org_id: orgId }
  );

  if (claimError || typeof claimed !== "number") {
    return { error: claimError?.message || "Nužne za dodelu broja igrača" };
  }

  const clubAthleteNumber =
    claimed ??
    buildClubAthleteNumber({ club_athlete_counter: 0 });

  // (2) Insert the athlete with the claimed number.
  const { data: athlete, error: insertError } = await supabase
    .from("athletes")
    .insert({
      organization_id: orgId,
      first_name: input.first_name,
      last_name: input.last_name,
      birth_date: input.birth_date,
      gender: input.gender ?? null,
      nationality: input.nationality ?? null,
      position: input.position ?? null,
      federation_id: input.federation_id ?? null,
      club_athlete_number: clubAthleteNumber,
    })
    .select("id, club_athlete_number")
    .single();

  if (insertError || !athlete) {
    return { error: insertError?.message || "Greška pri upisu igrača" };
  }

  // (3) Optionally insert the current-season membership (team + jersey).
  if (input.team_id) {
    const { error: membershipError } = await supabase
      .from("seasonal_memberships")
      .insert({
        organization_id: orgId,
        athlete_id: athlete.id,
        season_id: input.seasonId ?? "",
        team_id: input.team_id,
        jersey_number: input.jersey_number ?? null,
      });

    if (membershipError) {
      return { error: membershipError.message };
    }
  }

  return { id: athlete.id, club_athlete_number: athlete.club_athlete_number };
}

/**
 * Count athletes in the org (for entitlement gates).
 */
export async function countAthletes(
  supabase: Supabase,
  orgId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("athletes")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);

  if (error) return 0;
  return count ?? 0;
}

/**
 * List the org's seasons, most recent first (active season first). Used by the
 * seasons page (D-04: past seasons hidden behind a toggle).
 */
export async function listSeasons(
  supabase: Supabase,
  orgId: string
): Promise<Season[]> {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("organization_id", orgId)
    .order("is_active", { ascending: false })
    .order("starts_on", { ascending: false });

  if (error) return [];
  return (data as unknown as Season[]) ?? [];
}
