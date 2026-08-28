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

export interface StaffSummary {
  id: string;
  organization_id: string;
  user_id: string | null;
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
  | "photo_url"
  | "phone"
  | "email"
  | "title"
  | "start_date"
  | "end_date"
  | "notes"
>;

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
  if (role === "coach" && viewer.userId) {
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
  const [assignmentResult, licenseResult] = await Promise.all([
    activeSeason && staffIds.length > 0
      ? supabase
          .from("staff_teams")
          .select("staff_id, team_id, season_id, teams(name)")
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

  return staffRows.map((row) => ({
    ...(row as Omit<StaffSummary, "teams" | "licenses">),
    teams: assignmentsByStaff.get(row.id) ?? [],
    licenses: licensesByStaff.get(row.id) ?? [],
  }));
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

export async function createStaff(
  supabase: Supabase,
  orgId: string,
  input: StaffProfileInput
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from("staff")
    .insert({ organization_id: orgId, ...input })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Staff profile could not be created" };
  return { id: data.id };
}

export async function updateStaff(
  supabase: Supabase,
  orgId: string,
  staffId: string,
  input: StaffProfileInput
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("staff")
    .update(input)
    .eq("id", staffId)
    .eq("organization_id", orgId);
  return error ? { error: error.message } : { ok: true };
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
