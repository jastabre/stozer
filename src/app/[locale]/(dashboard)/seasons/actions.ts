"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import {
  requireOrganization,
  hasPermission,
} from "@/lib/organization";
import {
  getActiveSeason,
  listAthletesWithCurrentMembership,
  listStaffTeamsForSeason,
  listTeams,
} from "@/lib/club-data";
import {
  buildCarryForward,
  buildStaffCarryForward,
  validateRollover,
  type PrevMembership,
  type PrevStaffTeam,
} from "@/lib/rollover";

const seasonSchema = z.object({
  name: z.string().min(1).max(100),
  starts_on: z.string().min(1),
});

/**
 * Create a new season. Requires seasons.manage (org scope always from
 * requireOrganization — T-02-02-02). A newly created season is INACTIVE; it
 * becomes active only via startNewSeason (D-02 single-active invariant).
 */
export async function createSeason(formData: FormData) {
  const org = await requireOrganization();
  const allowed = await hasPermission("seasons.manage");
  if (!allowed) {
    throw new Error("Nemate dozvolu za upravljanje sezonama");
  }

  const parsed = seasonSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error("Nevalidan unos: " + parsed.error.issues[0]?.message);
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("seasons").insert({
    organization_id: org.organizationId,
    name: parsed.data.name,
    starts_on: parsed.data.starts_on,
    is_active: false,
  });

  if (error) {
    throw new Error("Greška pri kreiranju sezone: " + error.message);
  }

  revalidatePath("/seasons");
  redirect("/seasons");
}

/**
 * "Start New Season" rollover (D-03/D-04).
 *
 * Sequential steps (supabase-js cannot wrap a multi-statement transaction):
 *   1. read the current active season (the one being replaced)
 *   2. archive the old active season   (UPDATE seasons SET is_active=false ...)
 *   3. insert the new active season    (INSERT ... is_active=true)
 *   4. build the carry-forward from the previous season's memberships + moves
 *   5. validate team references and bulk-insert the new memberships
 *   6. carry staff_teams assignments into the new season (D-03)
 *
 * Atomicity of the single-active invariant is BACKSTOPPED at the DB by the
 * partial unique index one_active_season_per_org (Pattern 1, T-02-02-04) — if
 * archiving were ever skipped the insert would fail rather than double-activate.
 * Staff assignments carry over unchanged; the unique constraint and
 * ignoreDuplicates make retries idempotent.
 */
export async function startNewSeason(formData: FormData) {
  const org = await requireOrganization();
  const allowed = await hasPermission("seasons.manage");
  if (!allowed) {
    throw new Error("Nemate dozvolu za upravljanje sezonama");
  }

  const entries = Object.fromEntries(formData.entries());
  const parsed = seasonSchema.safeParse(entries);
  if (!parsed.success) {
    throw new Error("Nevalidan unos: " + parsed.error.issues[0]?.message);
  }

  const supabase = await createServerClient();
  const orgId = org.organizationId;

  // Collect per-athlete moves from the guided review form
  // (fields named move_<athleteId>=<teamId>).
  const moves: Record<string, string> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (key.startsWith("move_") && typeof value === "string" && value) {
      moves[key.slice("move_".length)] = value;
    }
  }

  // (1) Read the current active season — it becomes "previous" after archive.
  const prevSeason = await getActiveSeason(supabase, orgId);
  const prevAthletes = prevSeason
    ? await listAthletesWithCurrentMembership(supabase, orgId, prevSeason.id)
    : [];
  const prevStaffTeams: PrevStaffTeam[] = prevSeason
    ? (await listStaffTeamsForSeason(supabase, orgId, prevSeason.id)).map(
        (assignment) => ({
          staffId: assignment.staff_id,
          teamId: assignment.team_id,
        })
      )
    : [];

  // (2) Archive the old active season.
  const { error: archiveError } = await supabase
    .from("seasons")
    .update({ is_active: false })
    .eq("organization_id", orgId)
    .eq("is_active", true);
  if (archiveError) {
    throw new Error("Greška pri arhiviranju prethodne sezone: " + archiveError.message);
  }

  // (3) Insert the new active season.
  const { data: newSeason, error: seasonError } = await supabase
    .from("seasons")
    .insert({
      organization_id: orgId,
      name: parsed.data.name,
      starts_on: parsed.data.starts_on,
      is_active: true,
    })
    .select("id")
    .single();

  if (seasonError || !newSeason) {
    throw new Error("Greška pri kreiranju sezone: " + (seasonError?.message ?? "nema id"));
  }

  // (4) Build the carry-forward from the previous season's memberships.
  const memberships: PrevMembership[] = prevAthletes.map((a) => ({
    athleteId: a.id,
    prevTeamId: a.membership?.team_id ?? "",
    jerseyNumber: a.membership?.jersey_number ?? null,
  }));
  const carryForward = buildCarryForward(memberships, newSeason.id, moves);

  // Validate team references before inserting (avoids FK violations mid-flight).
  const teams = await listTeams(supabase, orgId);
  const teamsById: Record<string, unknown> = Object.fromEntries(
    teams.map((t) => [t.id, t])
  );
  const validationErrors = validateRollover(carryForward.memberships, teamsById);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors[0]);
  }

  // (5) Bulk-insert the new memberships.
  if (carryForward.memberships.length > 0) {
    const { error: membershipError } = await supabase
      .from("seasonal_memberships")
      .insert(
        carryForward.memberships.map((m) => ({
          organization_id: orgId,
          athlete_id: m.athleteId,
          season_id: carryForward.seasonId,
          team_id: m.prevTeamId,
          jersey_number: m.jerseyNumber,
          status: "active",
        }))
      );

    if (membershipError) {
      throw new Error("Greška pri prenosu članstava: " + membershipError.message);
    }
  }

  // (6) Staff keep their team assignments after rollover (D-03). The insert
  // is intentionally idempotent so a retried action cannot duplicate rows.
  const staffCarryForward = buildStaffCarryForward(prevStaffTeams, newSeason.id);
  if (staffCarryForward.staffTeams.length > 0) {
    const { error: staffTeamError } = await supabase
      .from("staff_teams")
      .upsert(
        staffCarryForward.staffTeams.map((assignment) => ({
          organization_id: orgId,
          staff_id: assignment.staffId,
          team_id: assignment.teamId,
          season_id: staffCarryForward.seasonId,
        })),
        { onConflict: "staff_id,team_id,season_id", ignoreDuplicates: true }
      );

    if (staffTeamError) {
      throw new Error("Greška pri prenosu timova osoblja: " + staffTeamError.message);
    }
  }

  revalidatePath("/seasons");
  revalidatePath("/players");
  redirect("/seasons");
}
