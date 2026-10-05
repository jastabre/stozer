import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole, Database } from "@/types/database";
import { getActiveSeason, listStaffTeamsForSeason } from "@/lib/club-data";
import { deriveStatus, daysUntil, type StatusTone } from "@/lib/status";

type Supabase = SupabaseClient<Database>;

export interface StaffLicense {
  id: string;
  organization_id: string;
  staff_id: string;
  license_type: string;
  license_number: string | null;
  valid_until: string;
  created_at: string;
  updated_at: string;
  status?: StatusTone;
  days_left?: number;
}

export interface StaffTeam {
  team_id: string;
  team_name: string;
  season_id: string;
}

/**
 * One club function row (staff_functions). All functions are equal in the UI;
 * `is_primary` is an internal compatibility flag (legacy staff.title sync).
 */
export interface StaffFunction {
  id: string;
  function_key: string;
  custom_label: string | null;
  is_primary: boolean;
}

/** Identity of the athlete linked to a staff profile (same physical person). */
export interface StaffAthleteLink {
  id: string;
  first_name: string;
  last_name: string;
  club_athlete_number: number;
  team_name: string | null;
}

export interface StaffSummary {
  id: string;
  organization_id: string;
  user_id: string | null;
  athlete_id: string | null;
  role: AppRole | null;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  phone: string | null;
  email: string | null;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  teams: StaffTeam[];
  licenses: StaffLicense[];
  /** All club functions, equal from the user's point of view. Never empty in new data. */
  functions: StaffFunction[];
  /** Linked athlete, when this person is also a player. */
  athlete: StaffAthleteLink | null;
}

export type StaffViewer = {
  role?: AppRole;
  /** OrganizationContext calls this property userRole (organization.ts). */
  userRole?: AppRole;
  userId?: string;
};

export type StaffProfileInput = Pick<
  Database["public"]["Tables"]["staff"]["Insert"],
  | "first_name"
  | "last_name"
  | "phone"
  | "email"
  | "title"
  | "start_date"
  | "end_date"
  | "notes"
>;

/** One function to store (first entry becomes the primary function). */
export interface StaffFunctionInput {
  function_key: string;
  custom_label: string | null;
}

export type StaffCreateInput = StaffProfileInput & {
  /** Optional link to an existing athlete (same physical person). */
  athlete_id?: string | null;
  /** At least one function; the first is the primary. */
  functions: StaffFunctionInput[];
};

export type StaffUpdateInput = StaffProfileInput & {
  /** Replacement set; the first entry becomes the primary. */
  functions: StaffFunctionInput[];
};

export type StaffLicenseInput = Pick<
  Database["public"]["Tables"]["staff_licenses"]["Insert"],
  "license_type" | "license_number" | "valid_until"
>;

function applyViewerScope(
  query: ReturnType<Supabase["from"]>,
  viewer?: StaffViewer
) {
  // WR-03: both call sites pass the OrganizationContext object, whose role
  // property is `userRole`. Accept either shape so the coach self-scope is not
  // dead code (viewer.role was always undefined before this fix).
  const role = viewer?.role ?? viewer?.userRole;
  if (viewer && role === "coach" && viewer.userId) {
    return query.eq("user_id", viewer.userId);
  }
  return query;
}

/**
 * List staff profiles in the current organization with active-season teams and
 * all licenses. A coach receives only their linked profile; everyone else with
 * staff.view receives the organization's profiles (RLS is the final boundary).
 */
export async function listStaff(
  supabase: Supabase,
  orgId: string,
  viewer?: StaffViewer,
  thresholdDays = 30
): Promise<StaffSummary[]> {
  const activeSeasonPromise = getActiveSeason(supabase, orgId);
  let staffQuery = supabase
    .from("staff")
    .select("*")
    .eq("organization_id", orgId)
    .order("last_name")
    .order("first_name");
  staffQuery = applyViewerScope(staffQuery, viewer);

  const [{ data: staffRows, error: staffError }, activeSeason] =
    await Promise.all([staffQuery, activeSeasonPromise]);
  if (staffError || !staffRows) return [];

  const staffIds = staffRows.map((row) => row.id);
  const athleteIds = staffRows
    .map((row) => row.athlete_id)
    .filter((value): value is string => Boolean(value));
  const [assignmentResult, licenseResult, functionResult, athleteResult, athleteTeamResult] =
    await Promise.all([
      activeSeason && staffIds.length > 0
        ? supabase
            .from("staff_teams")
            .select("staff_id, team_id, season_id, teams!staff_teams_team_id_fkey(name)")
            .eq("organization_id", orgId)
            .eq("season_id", activeSeason.id)
            .in("staff_id", staffIds)
        : Promise.resolve({ data: [], error: null }),
      staffIds.length > 0
        ? supabase
            .from("staff_licenses")
            .select("*")
            .eq("organization_id", orgId)
            .in("staff_id", staffIds)
            .order("valid_until")
        : Promise.resolve({ data: [], error: null }),
      staffIds.length > 0
        ? supabase
            .from("staff_functions")
            .select("id, staff_id, function_key, custom_label, is_primary")
            .eq("organization_id", orgId)
            .in("staff_id", staffIds)
            .order("created_at")
        : Promise.resolve({ data: [], error: null }),
      athleteIds.length > 0
        ? supabase
            .from("athletes")
            .select("id, first_name, last_name, club_athlete_number")
            .eq("organization_id", orgId)
            .in("id", athleteIds)
        : Promise.resolve({ data: [], error: null }),
      athleteIds.length > 0 && activeSeason
        ? supabase
            .from("seasonal_memberships")
            .select(
              "athlete_id, teams!seasonal_memberships_team_id_fkey(name)"
            )
            .eq("organization_id", orgId)
            .eq("season_id", activeSeason.id)
            .in("athlete_id", athleteIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  const assignmentsByStaff = new Map<string, StaffTeam[]>();
  for (const row of assignmentResult.data ?? []) {
    const team = row.teams as unknown as { name: string } | null;
    const current = assignmentsByStaff.get(row.staff_id) ?? [];
    current.push({
      team_id: row.team_id,
      team_name: team?.name ?? "",
      season_id: row.season_id,
    });
    assignmentsByStaff.set(row.staff_id, current);
  }

  const licensesByStaff = new Map<string, StaffLicense[]>();
  for (const row of licenseResult.data ?? []) {
    const license: StaffLicense = {
      ...(row as StaffLicense),
      status: deriveStatus(new Date(`${row.valid_until}T00:00:00`), thresholdDays),
      days_left: daysUntil(new Date(`${row.valid_until}T00:00:00`)),
    };
    const current = licensesByStaff.get(row.staff_id) ?? [];
    current.push(license);
    licensesByStaff.set(row.staff_id, current);
  }

  const functionsByStaff = new Map<string, StaffFunction[]>();
  for (const row of functionResult.data ?? []) {
    const current = functionsByStaff.get(row.staff_id) ?? [];
    current.push({
      id: row.id,
      function_key: row.function_key,
      custom_label: row.custom_label,
      is_primary: row.is_primary,
    });
    functionsByStaff.set(row.staff_id, current);
  }
  for (const list of functionsByStaff.values()) {
    // Display order only: the legacy primary flag is kept first so existing
    // rows render in the same order they did before the multi-function model.
    list.sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  }

  const teamNameByAthlete = new Map<string, string>();
  for (const row of athleteTeamResult.data ?? []) {
    const team = row.teams as unknown as { name: string } | null;
    if (team?.name) teamNameByAthlete.set(row.athlete_id, team.name);
  }
  const athleteById = new Map(
    (athleteResult.data ?? []).map((row) => [row.id, row])
  );

  return staffRows.map((row) => {
    const athleteRow = row.athlete_id ? athleteById.get(row.athlete_id) : undefined;
    return {
      ...(row as Omit<StaffSummary, "teams" | "licenses" | "functions" | "athlete">),
      teams: assignmentsByStaff.get(row.id) ?? [],
      licenses: licensesByStaff.get(row.id) ?? [],
      functions: functionsByStaff.get(row.id) ?? [],
      athlete: athleteRow
        ? {
            id: athleteRow.id,
            first_name: athleteRow.first_name,
            last_name: athleteRow.last_name,
            club_athlete_number: athleteRow.club_athlete_number,
            team_name: teamNameByAthlete.get(athleteRow.id) ?? null,
          }
        : null,
    };
  });
}

export async function getStaffProfile(
  supabase: Supabase,
  orgId: string,
  staffId: string,
  viewer?: StaffViewer,
  thresholdDays = 30
): Promise<StaffSummary | null> {
  const staff = await listStaff(supabase, orgId, viewer, thresholdDays);
  return staff.find((person) => person.id === staffId) ?? null;
}

/**
 * Create a staff profile together with its club functions. When `athlete_id`
 * is provided the profile is linked to that existing athlete (same physical
 * person) and the name is taken from the athlete row — never retyped by the
 * caller. The staff row is compensated (deleted) if the function insert fails,
 * so no profile is left without its primary function.
 */
export async function createStaffWithFunctions(
  supabase: Supabase,
  orgId: string,
  input: StaffCreateInput
): Promise<{ id: string } | { error: string }> {
  const { functions, athlete_id, ...profile } = input;
  let firstName = profile.first_name;
  let lastName = profile.last_name;

  if (athlete_id) {
    const { data: athlete, error: athleteError } = await supabase
      .from("athletes")
      .select("id, first_name, last_name")
      .eq("id", athlete_id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (athleteError || !athlete) {
      return { error: "Igrač nije pronađen u organizaciji" };
    }
    const { data: existing } = await supabase
      .from("staff")
      .select("id")
      .eq("organization_id", orgId)
      .eq("athlete_id", athlete_id)
      .maybeSingle();
    if (existing) {
      return { error: "Ovaj igrač je već povezan sa profilom osoblja." };
    }
    firstName = athlete.first_name;
    lastName = athlete.last_name;
  }

  const { data, error } = await supabase
    .from("staff")
    .insert({
      ...profile,
      organization_id: orgId,
      first_name: firstName,
      last_name: lastName,
      athlete_id: athlete_id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") {
      return { error: "Ovaj igrač je već povezan sa profilom osoblja." };
    }
    return { error: error?.message ?? "Staff profile could not be created" };
  }

  const functionsResult = await insertStaffFunctions(
    supabase,
    orgId,
    data.id,
    functions
  );
  if ("error" in functionsResult) {
    await supabase
      .from("staff")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", orgId);
    return { error: "Greška pri čuvanju funkcija. Pokušajte ponovo." };
  }
  return { id: data.id };
}

/** Update a profile and replace its function set (first entry = primary). */
export async function updateStaffWithFunctions(
  supabase: Supabase,
  orgId: string,
  staffId: string,
  input: StaffUpdateInput
): Promise<{ ok: true } | { error: string }> {
  const { functions, ...profile } = input;
  const { error } = await supabase
    .from("staff")
    .update(profile)
    .eq("id", staffId)
    .eq("organization_id", orgId);
  if (error) return { error: error.message };

  const { error: deleteError } = await supabase
    .from("staff_functions")
    .delete()
    .eq("organization_id", orgId)
    .eq("staff_id", staffId);
  if (deleteError) return { error: deleteError.message };

  return insertStaffFunctions(supabase, orgId, staffId, functions);
}

async function insertStaffFunctions(
  supabase: Supabase,
  orgId: string,
  staffId: string,
  functions: StaffFunctionInput[]
): Promise<{ ok: true } | { error: string }> {
  if (functions.length === 0) return { ok: true };
  const { error } = await supabase.from("staff_functions").insert(
    functions.map((fn, index) => ({
      organization_id: orgId,
      staff_id: staffId,
      function_key: fn.function_key,
      custom_label: fn.custom_label,
      is_primary: index === 0,
    }))
  );
  return error ? { error: error.message } : { ok: true };
}

export interface LinkableAthlete {
  id: string;
  name: string;
  club_athlete_number: number;
  team_name: string | null;
}

/**
 * Athletes that can still be linked to a staff profile (not linked yet),
 * with their active-season team when available. Used by the "Postojeći igrač"
 * mode of the add-staff flow; no automatic matching is ever performed.
 */
export async function listLinkableAthletes(
  supabase: Supabase,
  orgId: string
): Promise<LinkableAthlete[]> {
  const [athletesResult, linkedResult, activeSeason] = await Promise.all([
    supabase
      .from("athletes")
      .select("id, first_name, last_name, club_athlete_number")
      .eq("organization_id", orgId)
      .order("last_name")
      .order("first_name"),
    supabase
      .from("staff")
      .select("athlete_id")
      .eq("organization_id", orgId)
      .not("athlete_id", "is", null),
    getActiveSeason(supabase, orgId),
  ]);
  if (athletesResult.error || !athletesResult.data) return [];

  const linkedIds = new Set(
    (linkedResult.data ?? [])
      .map((row) => row.athlete_id)
      .filter((value): value is string => Boolean(value))
  );
  const candidates = athletesResult.data.filter(
    (athlete) => !linkedIds.has(athlete.id)
  );

  const teamNameByAthlete = new Map<string, string>();
  if (activeSeason && candidates.length > 0) {
    const { data: memberships } = await supabase
      .from("seasonal_memberships")
      .select("athlete_id, teams!seasonal_memberships_team_id_fkey(name)")
      .eq("organization_id", orgId)
      .eq("season_id", activeSeason.id)
      .in(
        "athlete_id",
        candidates.map((athlete) => athlete.id)
      );
    for (const row of memberships ?? []) {
      const team = row.teams as unknown as { name: string } | null;
      if (team?.name) teamNameByAthlete.set(row.athlete_id, team.name);
    }
  }

  return candidates.map((athlete) => ({
    id: athlete.id,
    name: `${athlete.last_name} ${athlete.first_name}`.trim(),
    club_athlete_number: athlete.club_athlete_number,
    team_name: teamNameByAthlete.get(athlete.id) ?? null,
  }));
}

export async function deleteStaff(
  supabase: Supabase,
  orgId: string,
  staffId: string
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("staff")
    .delete()
    .eq("id", staffId)
    .eq("organization_id", orgId);
  return error ? { error: error.message } : { ok: true };
}

/** Replace all license rows for a profile. License ids are not user-facing. */
export async function upsertStaffLicenses(
  supabase: Supabase,
  orgId: string,
  staffId: string,
  rows: StaffLicenseInput[]
): Promise<{ ok: true } | { error: string }> {
  // WR-05: verify the profile belongs to this org before replacing licenses —
  // cross-org references are rejected by the composite org FK (00011).
  const { data: profile, error: profileError } = await supabase
    .from("staff")
    .select("id")
    .eq("id", staffId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (profileError || !profile) {
    return { error: "Profil osoblja nije pronađen u organizaciji" };
  }

  const { error: deleteError } = await supabase
    .from("staff_licenses")
    .delete()
    .eq("organization_id", orgId)
    .eq("staff_id", staffId);
  if (deleteError) return { error: deleteError.message };

  if (rows.length === 0) return { ok: true };
  const { error: insertError } = await supabase.from("staff_licenses").insert(
    rows.map((row) => ({
      organization_id: orgId,
      staff_id: staffId,
      license_type: row.license_type,
      license_number: row.license_number ?? null,
      valid_until: row.valid_until,
    }))
  );
  return insertError ? { error: insertError.message } : { ok: true };
}

/** Replace active-season team assignments for a profile. */
export async function setStaffTeams(
  supabase: Supabase,
  orgId: string,
  staffId: string,
  seasonId: string,
  teamIds: string[]
): Promise<{ ok: true } | { error: string }> {
  // WR-05: verify the profile, season and every team belong to this org
  // before replacing assignments — cross-org references are rejected by the
  // composite org FKs (00011).
  const { data: profile, error: profileError } = await supabase
    .from("staff")
    .select("id")
    .eq("id", staffId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (profileError || !profile) {
    return { error: "Profil osoblja nije pronađen u organizaciji" };
  }

  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .select("id")
    .eq("id", seasonId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (seasonError || !season) {
    return { error: "Sezona nije pronađena u organizaciji" };
  }

  const uniqueTeamIds = [...new Set(teamIds)];
  if (uniqueTeamIds.length > 0) {
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id")
      .eq("organization_id", orgId)
      .in("id", uniqueTeamIds);
    if (teamsError || !teams || teams.length !== uniqueTeamIds.length) {
      return { error: "Jedan od timova nije pronađen u organizaciji" };
    }
  }

  const { error: deleteError } = await supabase
    .from("staff_teams")
    .delete()
    .eq("organization_id", orgId)
    .eq("staff_id", staffId)
    .eq("season_id", seasonId);
  if (deleteError) return { error: deleteError.message };

  if (uniqueTeamIds.length === 0) return { ok: true };
  const { error: insertError } = await supabase.from("staff_teams").insert(
    uniqueTeamIds.map((teamId) => ({
      organization_id: orgId,
      staff_id: staffId,
      team_id: teamId,
      season_id: seasonId,
    }))
  );
  return insertError ? { error: insertError.message } : { ok: true };
}

/**
 * Link a profile to an existing auth account and grant its organization role.
 * The caller resolves the account through the server-only Auth Admin API.
 */
export async function linkStaffToUser(
  supabase: Supabase,
  orgId: string,
  staffId: string,
  userId: string,
  role: AppRole
): Promise<{ ok: true } | { error: string }> {
  // WR-04: the membership upsert can fail independently of the staff update
  // (RLS on organization_memberships only allows the club_president, plus
  // transient errors). Read the current values first so a failed upsert can
  // be compensated instead of leaving a half-linked profile (staff linked,
  // membership row absent).
  const { data: current, error: readError } = await supabase
    .from("staff")
    .select("user_id, role")
    .eq("id", staffId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (readError || !current) {
    return { error: readError?.message ?? "Profil osoblja nije pronađen" };
  }

  const { error: staffError } = await supabase
    .from("staff")
    .update({ user_id: userId, role })
    .eq("id", staffId)
    .eq("organization_id", orgId);
  if (staffError) return { error: staffError.message };

  const { error: membershipError } = await supabase
    .from("organization_memberships")
    .upsert(
      { organization_id: orgId, user_id: userId, role },
      { onConflict: "organization_id,user_id" }
    );
  if (membershipError) {
    // Compensate the already-committed staff update so the profile is not left
    // linked to an account that has no membership row.
    await supabase
      .from("staff")
      .update({ user_id: current.user_id, role: current.role })
      .eq("id", staffId)
      .eq("organization_id", orgId);
    return { error: membershipError.message };
  }
  return { ok: true };
}

export { listStaffTeamsForSeason };
