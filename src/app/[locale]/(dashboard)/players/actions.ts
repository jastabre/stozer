"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
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
} from "@/lib/club-data";
import { createPlayerSchema } from "@/schemas/player";
import {
  isJerseyNumberUniqueViolation,
  jerseyNumberTaken,
  jerseyNumberTakenMessage,
} from "@/lib/jersey-number";

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

const playerEditSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  birth_date: z.string().min(1),
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
  nationality: z.string().trim().max(100).nullable().optional(),
  position: z.string().trim().max(100).nullable().optional(),
federation_id: z.string().trim().max(100).nullable().optional(),
  team_id: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.string().uuid().nullable().optional()
  ),
  jersey_number: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(1).max(99).nullable().optional()
  ),
  jersey_name: z.string().trim().max(60).nullable().optional(),
});

/**
 * Save the full player profile edit in one action: identity + federation ID +
 * current-season membership (team / jersey / jersey name). Guards: athletes.edit,
 * org scope. Keeps the profile a view-first screen - one "Izmeni" panel, one save.
 */
export async function savePlayerEdit(formData: FormData) {
  const org = await requireOrganization();
if (!(await hasPermission("athletes.edit"))) {
    throw new Error("Nemate dozvolu za izmenu igrača");
  }

  const parsed = playerEditSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    throw new Error("Nevalidan unos: " + parsed.error.issues[0]?.message);
  }
  const { id } = parsed.data;

  const supabase = await createServerClient();

  // Org-scoped athlete check before any write.
  const { data: athlete } = await supabase
    .from("athletes")
    .select("id")
    .eq("id", id)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!athlete) throw new Error("Igrač nije pronađen u organizaciji");

  // Identity + federation ID.
  const { error: updateError } = await supabase
    .from("athletes")
    .update({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      birth_date: parsed.data.birth_date,
      gender: parsed.data.gender ?? null,
      nationality: parsed.data.nationality || null,
      position: parsed.data.position || null,
      federation_id: parsed.data.federation_id || null,
    })
    .eq("id", id)
    .eq("organization_id", org.organizationId);
  if (updateError) {
    throw new Error("Greška pri čuvanju igrača: " + updateError.message);
  }

  // Current-season membership (optional; requires an active season).
  const canEditMembership =
    (await hasPermission("athletes.edit")) || (await hasPermission("teams.edit"));
  if (canEditMembership) {
    const active = await getActiveSeason(supabase, org.organizationId);
    if (active) {
      const teamId = parsed.data.team_id ?? null;
      if (teamId) {
        const { data: team } = await supabase
          .from("teams")
          .select("id")
          .eq("id", teamId)
          .eq("organization_id", org.organizationId)
          .maybeSingle();
        if (!team) throw new Error("Tim nije pronađen u organizaciji");
      }

      // A jersey number must be unique within the team for the season. Exclude
      // this athlete so saving unrelated profile changes never conflicts with
      // its own current number. The DB index (00040) is the race-proof backstop.
      if (teamId && parsed.data.jersey_number != null) {
        const taken = await jerseyNumberTaken(supabase, {
          organizationId: org.organizationId,
          seasonId: active.id,
          teamId,
          jerseyNumber: parsed.data.jersey_number,
          excludeAthleteId: id,
        });
        if (taken) {
          throw new Error(jerseyNumberTakenMessage(parsed.data.jersey_number));
        }
      }

      await supabase
        .from("seasonal_memberships")
        .delete()
        .eq("organization_id", org.organizationId)
        .eq("season_id", active.id)
        .eq("athlete_id", id);

      if (teamId) {
        const { error: membershipError } = await supabase
          .from("seasonal_memberships")
          .insert({
            organization_id: org.organizationId,
            athlete_id: id,
            season_id: active.id,
            team_id: teamId,
            jersey_number: parsed.data.jersey_number ?? null,
            jersey_name: parsed.data.jersey_name || null,
            status: "active",
          });
        if (membershipError) {
          if (isJerseyNumberUniqueViolation(membershipError)) {
            throw new Error(jerseyNumberTakenMessage(parsed.data.jersey_number ?? 0));
          }
          throw new Error("Greška pri dodeljivanju tima: " + membershipError.message);
        }
      }
    }
  }

  revalidatePath(`/players/${id}`);
  revalidatePath("/players");
  redirect(`/players/${id}`);
}
