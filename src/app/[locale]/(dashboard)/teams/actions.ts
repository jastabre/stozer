"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { getActiveSeason } from "@/lib/club-data";
import {
  isJerseyNumberUniqueViolation,
  jerseyNumberTaken,
  jerseyNumberTakenMessage,
} from "@/lib/jersey-number";

const teamSchema = z.object({
  name: z.string().min(1, "Naziv je obavezan").max(100, "Naziv je predugačak"),
  category: z.enum(["first_team", "youth", "academy", "other"]),
});

/** Shared state shape for team mutations driven by useActionState. */
type TeamActionState = { error?: string; ok?: boolean } | null;

/**
 * Create a team. Requires teams.create (org scope from requireOrganization).
 * Sport defaults to the org's sport (declared via the DB default).
 */
export async function createTeam(formData: FormData) {
  const org = await requireOrganization();
  const allowed = await hasPermission("teams.create");
  if (!allowed) throw new Error("Nemate dozvolu za kreiranje timova");

  const parsed = teamSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error("Nevalidan unos: " + parsed.error.issues[0]?.message);
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("teams").insert({
    organization_id: org.organizationId,
    name: parsed.data.name,
    category: parsed.data.category,
  });

  if (error) throw new Error("Greška pri kreiranju tima: " + error.message);

  revalidatePath("/teams");
  redirect("/teams");
}

/**
 * Update a team (name/category). Requires teams.edit. State action so the
 * manage dialog can surface a friendly message instead of a raw DB error.
 */
export async function updateTeam(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const org = await requireOrganization();
  const allowed = await hasPermission("teams.edit");
  if (!allowed) return { error: "Nemate dozvolu za izmenu timova" };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Nedostaje id tima" };

  const parsed = teamSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
  });
  if (!parsed.success) {
    return { error: "Nevalidan unos: " + (parsed.error.issues[0]?.message ?? "") };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("teams")
    .update({ name: parsed.data.name, category: parsed.data.category })
    .eq("id", id)
    .eq("organization_id", org.organizationId);

  if (error) return { error: "Greška pri izmeni tima. Pokušajte ponovo." };

  revalidatePath("/teams");
  redirect("/teams");
}

/**
 * Delete a team. Requires teams.delete. A team that ever had a roster, staff
 * assignment or equipment requirement carries real history and is NEVER
 * deleted through this action — those references cascade on delete, so we abort
 * with a clear message instead of silently wiping seasonal data.
 */
export async function deleteTeam(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const org = await requireOrganization();
  const allowed = await hasPermission("teams.delete");
  if (!allowed) return { error: "Nemate dozvolu za brisanje timova" };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Nedostaje id tima" };

  const supabase = await createServerClient();

  const [memberships, staff, requirements, itemRequirements] = await Promise.all([
    supabase
      .from("seasonal_memberships")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.organizationId)
      .eq("team_id", id),
    supabase
      .from("staff_teams")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.organizationId)
      .eq("team_id", id),
    supabase
      .from("team_equipment_requirements")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.organizationId)
      .eq("team_id", id),
    supabase
      .from("team_equipment_item_requirements")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.organizationId)
      .eq("team_id", id),
  ]);

  const history =
    (memberships.count ?? 0) +
    (staff.count ?? 0) +
    (requirements.count ?? 0) +
    (itemRequirements.count ?? 0);
  if (history > 0) {
    return {
      error:
        "Ovaj tim ima sačuvanu istoriju (igrače, osoblje ili opremu) i ne može se obrisati.",
    };
  }

  const { error } = await supabase
    .from("teams")
    .delete()
    .eq("id", id)
    .eq("organization_id", org.organizationId);

  if (error) return { error: "Greška pri brisanju tima. Pokušajte ponovo." };

  revalidatePath("/teams");
  redirect("/teams");
}

/**
 * Assign an existing organization player to this team for the ACTIVE season.
 * A player is organization-level; membership is seasonal, so this only creates
 * a seasonal_memberships row (never a duplicate athlete). Rejects a jersey
 * number already used by another member of the same team in the same season.
 */
export async function addPlayerToTeam(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const org = await requireOrganization();
  const canEditTeams = await hasPermission("teams.edit");
  const canEditAthletes = await hasPermission("athletes.edit");
  if (!canEditTeams && !canEditAthletes) {
    return { error: "Nemate dozvolu za izmenu timova" };
  }

  const teamId = formData.get("team_id");
  const athleteId = formData.get("athlete_id");
  const jerseyRaw = formData.get("jersey_number");
  if (typeof teamId !== "string" || typeof athleteId !== "string" || !athleteId) {
    return { error: "Izaberite igrača." };
  }

  let jersey: number | null = null;
  if (typeof jerseyRaw === "string" && jerseyRaw.trim() !== "") {
    const parsed = Number(jerseyRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 99) {
      return { error: "Broj dresa mora biti između 1 i 99." };
    }
    jersey = parsed;
  }

  const supabase = await createServerClient();
  const active = await getActiveSeason(supabase, org.organizationId);
  if (!active) {
    return {
      error:
        "Nema aktivne sezone — kreirajte ili aktivirajte sezonu pre dodavanja igrača u tim.",
    };
  }

  const [team, athlete, existing] = await Promise.all([
    supabase
      .from("teams")
      .select("id")
      .eq("id", teamId)
      .eq("organization_id", org.organizationId)
      .maybeSingle(),
    supabase
      .from("athletes")
      .select("id")
      .eq("id", athleteId)
      .eq("organization_id", org.organizationId)
      .maybeSingle(),
    supabase
      .from("seasonal_memberships")
      .select("id")
      .eq("organization_id", org.organizationId)
      .eq("season_id", active.id)
      .eq("athlete_id", athleteId)
      .maybeSingle(),
  ]);

  if (!team.data || !athlete.data) {
    return { error: "Tim ili igrač nije pronađen u organizaciji." };
  }
  if (existing.data) {
    return { error: "Igrač je već u sastavu za ovu sezonu." };
  }

  if (jersey !== null) {
    const taken = await jerseyNumberTaken(supabase, {
      organizationId: org.organizationId,
      seasonId: active.id,
      teamId,
      jerseyNumber: jersey,
    });
    if (taken) {
      return { error: jerseyNumberTakenMessage(jersey) };
    }
  }

  const { error } = await supabase.from("seasonal_memberships").insert({
    organization_id: org.organizationId,
    athlete_id: athleteId,
    season_id: active.id,
    team_id: teamId,
    jersey_number: jersey,
    status: "active",
  });
  if (error) {
    if (isJerseyNumberUniqueViolation(error)) {
      return { error: jerseyNumberTakenMessage(jersey ?? 0) };
    }
    return { error: "Greška pri dodavanju igrača. Pokušajte ponovo." };
  }

  revalidatePath(`/teams/${teamId}/registrations`);
  return { ok: true };
}

/**
 * Remove a player from this team for the ACTIVE season. Deletes the seasonal
 * membership row only — the athlete's permanent identity is untouched.
 */
export async function removePlayerFromTeam(formData: FormData) {
  const org = await requireOrganization();
  const canEditTeams = await hasPermission("teams.edit");
  const canEditAthletes = await hasPermission("athletes.edit");
  if (!canEditTeams && !canEditAthletes) {
    throw new Error("Nemate dozvolu za izmenu timova");
  }

  const teamId = formData.get("team_id");
  const athleteId = formData.get("athlete_id");
  if (typeof teamId !== "string" || typeof athleteId !== "string") {
    throw new Error("Nedostaju podaci o timu ili igraču");
  }

  const supabase = await createServerClient();
  const active = await getActiveSeason(supabase, org.organizationId);
  if (!active) {
    throw new Error("Nema aktivne sezone");
  }

  const { error } = await supabase
    .from("seasonal_memberships")
    .delete()
    .eq("organization_id", org.organizationId)
    .eq("season_id", active.id)
    .eq("team_id", teamId)
    .eq("athlete_id", athleteId);

  if (error) {
    throw new Error("Greška pri uklanjanju igrača: " + error.message);
  }

  revalidatePath(`/teams/${teamId}/registrations`);
}
