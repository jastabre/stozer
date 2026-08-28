"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import {
  requireOrganization,
  hasPermission,
} from "@/lib/organization";
import { checkEntitlement } from "@/lib/entitlements";
import {
  createAthlete,
  countAthletes,
  getActiveSeason,
  updateAthleteFederationId,
} from "@/lib/club-data";
import { createPlayerSchema } from "@/schemas/player";

/**
 * Create a player with a stable auto-assigned club athlete ID (D-05).
 * Guards: athletes.create permission, entitlement player-count limit,
 * org id always from requireOrganization() (never the client).
 */
export async function createPlayer(formData: FormData) {
  const org = await requireOrganization();

  // Authorization gate (T-02-02-01): must hold athletes.create.
  const allowed = await hasPermission("athletes.create");
  if (!allowed) {
    throw new Error("Nemate dozvolu za dodavanje igrača");
  }

  // Whitelist + validate input (zod) — unknown fields are stripped.
  const parsed = createPlayerSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    throw new Error("Nevalidan unos: " + parsed.error.issues[0]?.message);
  }

  const supabase = await createServerClient();

  // Entitlement gate: player-count limit (e.g. 20 on FREE).
  const limit = await checkEntitlement(org.organizationId, "max_players");
  if (limit != null) {
    const count = await countAthletes(supabase, org.organizationId);
    if (count >= limit) {
      throw new Error(
        "Dostigli ste limit broja igrača za vaš plan. Nadogradite plan."
      );
    }
  }

  // Resolve the active season so a roster membership can be attached.
  const active = await getActiveSeason(supabase, org.organizationId);
  const teamId = parsed.data.team_id;

  // CR-01: a team assignment requires an active season. Reject BEFORE the
  // athlete is inserted — otherwise createAthlete's membership insert fails
  // after the athlete (and its claimed club-athlete number) is already
  // committed, and a retry burns another counter value.
  if (teamId && !active) {
    throw new Error("Nema aktivne sezone — dodajte sezonu pre nego što dodelite tim");
  }

  const result = await createAthlete(supabase, org.organizationId, {
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name,
    birth_date: parsed.data.birth_date,
    gender: parsed.data.gender ?? null,
    nationality: parsed.data.nationality ?? null,
    position: parsed.data.position ?? null,
    federation_id: parsed.data.federation_id ?? null,
    seasonId: teamId ? active?.id ?? undefined : undefined,
    team_id: teamId,
    jersey_number: parsed.data.jersey_number,
  });

  if ("error" in result) {
    throw new Error(result.error);
  }

  revalidatePath("/players");
  redirect("/players");
}

/**
 * Update an athlete's free-text Federation / Registration ID (D-06).
 * Requires athletes.edit. The value is reference-only — never validated or
 * interpreted, and never related to the club athlete ID (REG-05).
 */
export async function updatePlayerFederationId(formData: FormData) {
  const org = await requireOrganization();
  const allowed = await hasPermission("athletes.edit");
  if (!allowed) {
    throw new Error("Nemate dozvolu za izmenu igrača");
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) throw new Error("Nedostaje id igrača");

  const raw = formData.get("federation_id");
  const federationId =
    typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;

  const supabase = await createServerClient();
  const result = await updateAthleteFederationId(
    supabase,
    org.organizationId,
    id,
    federationId
  );

  if ("error" in result) {
    throw new Error("Greška pri čuvanju identifikacionog ID: " + result.error);
  }

  revalidatePath(`/players/${id}`);
  redirect(`/players/${id}`);
}
