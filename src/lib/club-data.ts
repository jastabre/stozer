import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { buildClubAthleteNumber } from "@/lib/athlete-id";
import { deriveStatus, type StatusTone } from "@/lib/status";
import { sortTeamsByCategory } from "@/lib/team-order";
import {
  isJerseyNumberUniqueViolation,
  jerseyNumberTaken,
  jerseyNumberTakenMessage,
} from "@/lib/jersey-number";

export type Supabase = SupabaseClient<Database>;

export interface Season {
  id: string;
  organization_id: string;
  name: string;
  starts_on: string;
  ends_on: string | null;
  is_active: boolean;
  competition_months?: number[] | null;
}

export interface Registration {
  id: string;
  organization_id: string;
  athlete_id: string;
  season_id: string | null;
  federation: string | null;
  identifier: string | null;
  note: string | null;
  status: string;
  valid_from: string;
  valid_until: string;
  document_id: string | null;
  // 02-08: aligned to the generated type — the DB column is nullable
  // (TIMESTAMPTZ DEFAULT now(), no NOT NULL).
  created_at: string | null;
  season_name?: string | null;
}

export interface MedicalExamination {
  id: string;
  organization_id: string;
  athlete_id: string;
  examined_on: string;
  valid_until: string;
  exam_type: string | null;
  institution: string | null;
  note: string | null;
  document_id: string | null;
  created_at: string;
}

export type DocumentOwnerType = "athlete" | "staff";
export type DocumentTone = StatusTone | "none";

export interface ClubDocument {
  id: string;
  organization_id: string;
  owner_type: DocumentOwnerType;
  owner_id: string;
  doc_type: Database["public"]["Enums"]["document_type"];
  custom_type: string | null;
  filename: string;
  storage_path: string;
  issued_at: string | null;
  expires_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  organization_id: string;
  athlete_id: string;
  contract_type: string;
  status: Database["public"]["Enums"]["contract_status"];
  valid_from: string | null;
  valid_until: string | null;
  document_id: string | null;
  notes: string | null;
  monthly_salary?: number | null;
  currency?: string | null;
  pay_schedule?: string | null;
  custom_months?: number[] | null;
  created_at: string;
  updated_at: string;
}

export function documentTone(
  expiresAt: string | null,
  thresholdDays: number
): DocumentTone {
  return expiresAt
    ? deriveStatus(new Date(`${expiresAt}T00:00:00`), thresholdDays)
    : "none";
}

export async function listDocuments(
  supabase: Supabase,
  orgId: string,
  ownerType?: DocumentOwnerType,
  ownerId?: string
): Promise<ClubDocument[]> {
  let query = supabase
    .from("documents")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (ownerType) query = query.eq("owner_type", ownerType);
  if (ownerId) query = query.eq("owner_id", ownerId);

  const { data, error } = await query;
  if (error) return [];
  return (data as unknown as ClubDocument[]) ?? [];
}

export async function listContracts(
  supabase: Supabase,
  orgId: string,
  athleteId: string
): Promise<Contract[]> {
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("organization_id", orgId)
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data as unknown as Contract[]) ?? [];
}

export interface OrganizationSettings {
  id: string;
  organization_id: string;
  warning_threshold_days: number;
}

export interface StaffTeamAssignment {
  staff_id: string;
  team_id: string;
}

/**
 * Read staff assignments for one org season. Keeping this query org- and
 * season-scoped gives rollover a small, explicit input and avoids carrying
 * assignments from an archived season into the next one accidentally.
 */
export async function listStaffTeamsForSeason(
  supabase: Supabase,
  orgId: string,
  seasonId: string
): Promise<StaffTeamAssignment[]> {
  const { data, error } = await supabase
    .from("staff_teams")
    .select("staff_id, team_id")
    .eq("organization_id", orgId)
    .eq("season_id", seasonId);

  if (error) return [];
  return (data ?? []) as StaffTeamAssignment[];
}

/**
 * One athlete's row in the team-level registration/medical overview (D-38).
 * registration/medical are NEVER merged (D-40) — each carries its own derived
 * tone. valid_until values are the latest records by valid_until DESC (first
 * wins); the page derives the green/yellow/red + medical tones with the org
 * threshold and applies the filters.
 */
export interface TeamStatusOverviewRow {
  athleteId: string;
  first_name: string;
  last_name: string;
  position: string | null;
  club_athlete_number: number;
  jersey_number: number | null;
  latestRegistrationValidUntil: string | null;
  latestMedicalValidUntil: string | null;
}

/**
 * List every athlete with a current membership in `teamId` for `seasonId`, each
 * carrying their latest registration and latest medical valid_until (D-38/D-40).
 * The current/latest row is chosen by created_at DESC, first wins (the plan's
 * explicit resolution — may differ from an "earliest expiry" reading). A missing
 * registration/medical row must be read as null (the page maps null -> red /
 * not_recorded, never a false Valid).
 */
export async function listTeamStatusOverview(
  supabase: Supabase,
  orgId: string,
  teamId: string,
  seasonId: string
): Promise<TeamStatusOverviewRow[]> {
  const { data: memberships, error: mError } = await supabase
    .from("seasonal_memberships")
    .select(
      "athlete_id, jersey_number, athletes!seasonal_memberships_athlete_id_fkey(id, organization_id, first_name, last_name, position, club_athlete_number)"
    )
    .eq("organization_id", orgId)
    .eq("team_id", teamId)
    .eq("season_id", seasonId);

  if (mError || !memberships) return [];

  const rows: TeamStatusOverviewRow[] = [];

  for (const m of memberships) {
    const athlete = (m.athletes as unknown as {
      id: string;
      organization_id: string;
      first_name: string;
      last_name: string;
      position: string | null;
      club_athlete_number: number;
    }) ?? null;
    if (!athlete || athlete.organization_id !== orgId) continue;

    // Latest registration by valid_until DESC (first wins).
    const { data: regs } = await supabase
      .from("registrations")
      .select("valid_until")
      .eq("organization_id", orgId)
      .eq("athlete_id", athlete.id)
      .order("created_at", { ascending: false })
      .limit(1);

    // Latest medical examination by created_at DESC (first wins, per plan D-38).
    const { data: meds } = await supabase
      .from("medical_examinations")
      .select("valid_until")
      .eq("organization_id", orgId)
      .eq("athlete_id", athlete.id)
      .order("created_at", { ascending: false })
      .limit(1);

    rows.push({
      athleteId: athlete.id,
      first_name: athlete.first_name,
      last_name: athlete.last_name,
      position: athlete.position,
      club_athlete_number: athlete.club_athlete_number,
      jersey_number: m.jersey_number,
      latestRegistrationValidUntil: regs?.[0]?.valid_until ?? null,
      latestMedicalValidUntil: meds?.[0]?.valid_until ?? null,
    });
  }

  return rows;
}

/**
 * List an athlete's registration records, most recently entered first (D-10:
 * the current/latest record is the primary status source; past records
 * secondary). Ordering matches the team-overview join: created_at DESC, first
 * wins, so both views agree on which record is "current".
 */
export async function listRegistrations(
  supabase: Supabase,
  orgId: string,
  athleteId: string
): Promise<Registration[]> {
  const { data, error } = await supabase
    .from("registrations")
    .select(
      "id, organization_id, athlete_id, season_id, federation, identifier, note, status, valid_from, valid_until, document_id, created_at, seasons!registrations_season_id_fkey(name)"
    )
    .eq("organization_id", orgId)
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false });

  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    athlete_id: row.athlete_id,
    season_id: row.season_id,
    federation: row.federation,
    identifier: row.identifier,
    note: row.note,
    status: row.status,
    valid_from: row.valid_from,
    valid_until: row.valid_until,
    document_id: row.document_id,
    created_at: row.created_at,
    season_name: (row.seasons as unknown as { name: string } | null)?.name ??
      null,
  }));
}

/**
 * List an athlete's medical examinations, most recently entered first
 * (D-33/D-37: latest examination is the status source; older records in the
 * background). Ordering matches the team-overview join (created_at DESC, first
 * wins).
 */
export async function listMedicalExaminations(
  supabase: Supabase,
  orgId: string,
  athleteId: string
): Promise<MedicalExamination[]> {
  const { data, error } = await supabase
    .from("medical_examinations")
    .select("*")
    .eq("organization_id", orgId)
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data as unknown as MedicalExamination[]) ?? [];
}

/**
 * Read the org's settings (warning_threshold_days, D-12). Every status
 * renderer in the app consumes this single knob.
 */
export async function getOrganizationSettings(
  supabase: Supabase,
  orgId: string
): Promise<OrganizationSettings | null> {
  const { data, error } = await supabase
    .from("organization_settings")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as OrganizationSettings;
}

/**
 * Update the org's expiry-warning threshold. Called only from club settings
 * (guard: club_settings.manage). A null/negative guard keeps the DB CHECK
 * happy; returns an error on DB failure.
 */
export async function updateOrganizationSettings(
  supabase: Supabase,
  orgId: string,
  thresholdDays: number
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("organization_settings")
    .update({ warning_threshold_days: thresholdDays })
    .eq("organization_id", orgId);

  if (error) return { error: error.message };
  return { ok: true };
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
  const [active, result] = await Promise.all([
    getActiveSeason(supabase, orgId),
    supabase
      .from("teams")
      .select("*")
      .eq("organization_id", orgId)
      .order("name"),
  ]);

  if (result.error) return [];

  // "Igrača" is the roster size for the ACTIVE season only. Historical
  // memberships are never summed here; with no active season the count is 0.
  const counts = new Map<string, number>();
  if (active) {
    const { data: memberships } = await supabase
      .from("seasonal_memberships")
      .select("team_id")
      .eq("organization_id", orgId)
      .eq("season_id", active.id);
    for (const m of memberships ?? []) {
      counts.set(m.team_id, (counts.get(m.team_id) ?? 0) + 1);
    }
  }

  // Business display order: first team first, then youth / reserve / other,
  // each group alphabetical by name (see sortTeamsByCategory).
  return sortTeamsByCategory(
    (result.data ?? []).map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      name: row.name,
      category: row.category,
      sport: row.sport,
      athlete_count: counts.get(row.id) ?? 0,
    }))
  );
}

/**
 * Count the members of one team for a given season. Used by the team screen
 * header (and by the payments tab) so the roster size is always the active
 * season's membership, never the all-time history.
 */
export async function countTeamMembers(
  supabase: Supabase,
  orgId: string,
  teamId: string,
  seasonId: string
): Promise<number> {
  const { count } = await supabase
    .from("seasonal_memberships")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("team_id", teamId)
    .eq("season_id", seasonId);
  return count ?? 0;
}

/**
 * Athlete ids that already hold a membership in the given season (any team).
 * Used to compute who is still eligible to be added to a team — the "already in
 * this season" check must look at the active season only, not at whether the
 * athlete has any membership history.
 */
export async function listSeasonMemberAthleteIds(
  supabase: Supabase,
  orgId: string,
  seasonId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("seasonal_memberships")
    .select("athlete_id")
    .eq("organization_id", orgId)
    .eq("season_id", seasonId);
  return (data ?? []).map((row) => row.athlete_id);
}

/**
 * List ALL athletes in the organization, regardless of season or membership.
 * Players are organization-level (D-01); team membership is seasonal. The
 * current-season team/jersey is attached when an active season exists.
 */
export async function listAthletes(
  supabase: Supabase,
  orgId: string
): Promise<AthleteMembership[]> {
  const [active, result] = await Promise.all([
    getActiveSeason(supabase, orgId),
    supabase
      .from("athletes")
      .select(
        "id, organization_id, first_name, last_name, birth_date, gender, nationality, position, photo_url, club_athlete_number, seasonal_memberships!seasonal_memberships_athlete_id_fkey(season_id, team_id, jersey_number, teams!seasonal_memberships_team_id_fkey(name))"
      )
      .eq("organization_id", orgId)
      .order("last_name")
      .order("first_name"),
  ]);

  if (result.error) return [];

  const activeId = active?.id ?? null;
  return (result.data ?? []).map((row) => {
    const memberships = row.seasonal_memberships as unknown as Array<{
      season_id: string;
      team_id: string;
      jersey_number: number | null;
      teams: { name: string } | null;
    }>;
    const current =
      memberships?.find((m) => m.season_id === activeId) ??
      memberships?.[0] ??
      null;
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
      "id, organization_id, first_name, last_name, birth_date, gender, nationality, position, photo_url, club_athlete_number, seasonal_memberships!seasonal_memberships_athlete_id_fkey!inner(team_id, jersey_number, teams!seasonal_memberships_team_id_fkey(name))"
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
  preferred_jersey_number: number | null;
  club_athlete_number: number;
  memberships: {
    seasonId: string;
    seasonName: string;
    isActive: boolean;
    teamId: string;
    teamName: string;
    jerseyNumber: number | null;
    jerseyName: string | null;
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
      "id, organization_id, first_name, last_name, birth_date, gender, nationality, position, photo_url, federation_id, preferred_jersey_number, club_athlete_number, seasonal_memberships!seasonal_memberships_athlete_id_fkey(season_id, team_id, jersey_number, jersey_name, status, seasons!seasonal_memberships_season_id_fkey(name, is_active), teams!seasonal_memberships_team_id_fkey(name))"
    )
    .eq("id", athleteId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error || !data) return null;

  const memberships = (data.seasonal_memberships as unknown as Array<{
    season_id: string;
    team_id: string;
    jersey_number: number | null;
    jersey_name: string | null;
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
    preferred_jersey_number: data.preferred_jersey_number ?? null,
    club_athlete_number: data.club_athlete_number,
    memberships: memberships.map((m) => ({
      seasonId: m.season_id,
      seasonName: m.seasons?.name ?? "",
      isActive: m.seasons?.is_active ?? false,
      teamId: m.team_id,
      teamName: m.teams?.name ?? "",
      jerseyNumber: m.jersey_number,
      jerseyName: m.jersey_name ?? null,
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
  // WR-05: verify a team assignment belongs to this org BEFORE claiming a
  // counter value. Otherwise the membership insert would reference a foreign
  // parent (now rejected by the composite org FK) after the athlete insert
  // had already committed.
  if (input.team_id) {
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id")
      .eq("id", input.team_id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (teamError || !team) {
      return { error: "Tim nije pronađen u organizaciji" };
    }
  }

  // WR-06: a jersey number must be unique within the team for the season.
  // Check BEFORE claiming a counter value so a conflict neither burns a number
  // nor leaves an orphan athlete behind. The DB index (00040) is the race-proof
  // backstop; this is only the friendly pre-check.
  if (input.team_id && input.seasonId && input.jersey_number != null) {
    const taken = await jerseyNumberTaken(supabase, {
      organizationId: orgId,
      seasonId: input.seasonId,
      teamId: input.team_id,
      jerseyNumber: input.jersey_number,
    });
    if (taken) {
      return { error: jerseyNumberTakenMessage(input.jersey_number) };
    }
  }

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
    if (!input.seasonId) {
      // CR-01: a team assignment requires an active season. Compensate the
      // already-committed athlete insert so no orphan athlete (invisible in
      // the roster's inner join) or burned club-athlete counter value remains.
      await supabase.from("athletes").delete().eq("id", athlete.id);
      return { error: "Aktivna sezona je obavezna za dodelu tima" };
    }

    const { error: membershipError } = await supabase
      .from("seasonal_memberships")
      .insert({
        organization_id: orgId,
        athlete_id: athlete.id,
        season_id: input.seasonId,
        team_id: input.team_id,
        jersey_number: input.jersey_number ?? null,
      });

    if (membershipError) {
      // CR-01: the athlete row is already committed at this point. Compensate
      // by removing it so a retry cannot mint a second athlete (and burn
      // another counter value) for a membership that never materialized.
      await supabase.from("athletes").delete().eq("id", athlete.id);
      return {
        error: isJerseyNumberUniqueViolation(membershipError)
          ? jerseyNumberTakenMessage(input.jersey_number ?? 0)
          : membershipError.message,
      };
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
