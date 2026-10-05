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
import { isValidSeasonRange, SEASON_RANGE_ERROR } from "@/lib/season";

const seasonSchema = z.object({
  name: z.string().min(1).max(100),
  starts_on: z.string().min(1),
  ends_on: z.string().min(1),
});

/** Shared state shape for season mutations driven by useActionState. */
type SeasonActionState = { error?: string } | null;

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

  if (!isValidSeasonRange(parsed.data.starts_on, parsed.data.ends_on)) {
    throw new Error(SEASON_RANGE_ERROR);
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("seasons").insert({
    organization_id: org.organizationId,
    name: parsed.data.name,
    starts_on: parsed.data.starts_on,
    ends_on: parsed.data.ends_on,
    is_active: false,
  });

  if (error) {
    throw new Error("Greška pri kreiranju sezone: " + error.message);
  }

  revalidatePath("/seasons");
  revalidatePath("/teams");
  redirect("/seasons");
}

/**
 * Edit an existing season (name + date range). Requires seasons.manage. State
 * action so the inline form can show a friendly range/permission error. Existing
 * memberships and history are untouched — only the season row changes.
 */
export async function updateSeason(
  _prev: SeasonActionState,
  formData: FormData
): Promise<SeasonActionState> {
  const org = await requireOrganization();
  if (!(await hasPermission("seasons.manage"))) {
    return { error: "Nemate dozvolu za upravljanje sezonama" };
  }

  const id = formData.get("season_id");
  if (typeof id !== "string" || !id) return { error: "Nedostaje sezona" };

  const parsed = seasonSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Nevalidan unos sezone." };
  if (!isValidSeasonRange(parsed.data.starts_on, parsed.data.ends_on)) {
    return { error: SEASON_RANGE_ERROR };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("seasons")
    .update({
      name: parsed.data.name,
      starts_on: parsed.data.starts_on,
      ends_on: parsed.data.ends_on,
    })
    .eq("id", id)
    .eq("organization_id", org.organizationId);

  if (error) return { error: "Greška pri izmeni sezone. Pokušajte ponovo." };

  revalidatePath("/seasons");
  revalidatePath("/teams");
  redirect("/seasons");
}

/**
 * "Start New Season" rollover (D-03/D-04).
 *
 * Sequential steps (supabase-js cannot wrap a multi-statement transaction),
 * in a COMPENSATING order so no failure window can lose the carry-forward:
 *   1. read the current active season (the one being replaced)
 *   2. insert the new season INACTIVE (nothing is active yet)
 *   3. build the carry-forward from the previous season's memberships + moves
 *   4. validate team references and bulk-insert the new memberships
 *   5. carry staff_teams assignments into the new season (D-03)
 *   6. archive the old season, then activate the new one LAST
 *
 * If any step 2-6 write fails, the just-inserted season is deleted (its
 * memberships/staff rows cascade) and the previous season stays active — a
 * retry therefore rebuilds the carry-forward from the real previous data.
 * Atomicity of the single-active invariant is BACKSTOPPED at the DB by the
 * partial unique index one_active_season_per_org (Pattern 1, T-02-02-04) — a
 * second active row cannot be created, so the archive must precede activation.
 * Staff assignments carry over unchanged; the unique constraint and
 * ignoreDuplicates make retries idempotent.
 */
export async function startNewSeason(
  _prev: SeasonActionState,
  formData: FormData
): Promise<SeasonActionState> {
  const org = await requireOrganization();
  const allowed = await hasPermission("seasons.manage");
  if (!allowed) {
    return { error: "Nemate dozvolu za upravljanje sezonama" };
  }

  const entries = Object.fromEntries(formData.entries());
  const parsed = seasonSchema.safeParse(entries);
  if (!parsed.success) {
    return { error: "Nevalidan unos sezone." };
  }
  if (!isValidSeasonRange(parsed.data.starts_on, parsed.data.ends_on)) {
    return { error: SEASON_RANGE_ERROR };
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

  // (2) Insert the new season FIRST but INACTIVE. The carry-forward writes can
  // reference it while the single-active invariant is preserved: if any later
  // step fails only this new (inactive) season is deleted, and the previous
  // season is untouched. WR-01: archiving+activating before the memberships
  // insert meant a mid-flight failure left the old season archived and the new
  // one active with ZERO memberships — and a retry rebuilt the carry-forward
  // from the empty new season, losing the previous data forever.
  const { data: newSeason, error: seasonError } = await supabase
    .from("seasons")
    .insert({
      organization_id: orgId,
      name: parsed.data.name,
      starts_on: parsed.data.starts_on,
      ends_on: parsed.data.ends_on,
      is_active: false,
    })
    .select("id")
    .single();

  if (seasonError || !newSeason) {
    throw new Error("Greška pri kreiranju sezone: " + (seasonError?.message ?? "nema id"));
  }

  // Compensation for any later failure: remove the just-inserted season. Its
  // memberships/staff rows cascade with it, and the previous season is still
  // active, so a retried action rebuilds the carry-forward from real data.
  const compensate = async (message: string): Promise<never> => {
    await supabase
      .from("seasons")
      .delete()
      .eq("id", newSeason.id)
      .eq("organization_id", orgId);
    throw new Error(message);
  };

  // (3) Build the carry-forward from the previous season's memberships.
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
    return compensate(validationErrors[0]);
  }

  // (4) Bulk-insert the new memberships.
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
      return compensate("Greška pri prenosu članstava: " + membershipError.message);
    }
  }

  // (5) Staff keep their team assignments after rollover (D-03). The insert
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
      return compensate("Greška pri prenosu timova osoblja: " + staffTeamError.message);
    }
  }

  // (6) Archive the old season, then activate the new one LAST. The DB
  // backstop (one_active_season_per_org) allows at most one active row, so the
  // archive must precede activation. On activation failure, restore the
  // previous season's active flag before compensating.
  const { error: archiveError } = await supabase
    .from("seasons")
    .update({ is_active: false })
    .eq("organization_id", orgId)
    .eq("is_active", true);
  if (archiveError) {
    return compensate("Greška pri arhiviranju prethodne sezone: " + archiveError.message);
  }

  const { error: activateError } = await supabase
    .from("seasons")
    .update({ is_active: true })
    .eq("id", newSeason.id)
    .eq("organization_id", orgId);
  if (activateError) {
    if (prevSeason) {
      await supabase
        .from("seasons")
        .update({ is_active: true })
        .eq("id", prevSeason.id)
        .eq("organization_id", orgId);
    }
    return compensate("Greška pri aktiviranju nove sezone: " + activateError.message);
  }

  revalidatePath("/seasons");
  revalidatePath("/players");
  redirect("/seasons");
}
