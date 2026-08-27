"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { requireOrganization, hasPermission } from "@/lib/organization";

// Zod validation of untrusted client dates/ids (T-02-03-01): valid_until must
// be after valid_from, required as YYYY-MM-DD. Unknown fields are stripped.
const registrationSchema = z
  .object({
    id: z.string().uuid().optional(),
    athlete_id: z.string().uuid(),
    federation: z.string().max(100).optional(),
    identifier: z.string().max(100).optional(),
    season_id: z.string().uuid().nullable().optional(),
    valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum mora biti YYYY-MM-DD"),
    valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum mora biti YYYY-MM-DD"),
  })
  .refine((v) => v.valid_until >= v.valid_from, {
    message: "Datum isteka mora biti posle datuma početka",
    path: ["valid_until"],
  });

/**
 * Create (or update, when an `id` is present) a registration record for an
 * athlete. Guards: registrations.manage permission + org from requireOrganization.
 * document_id linkage is intentionally left writable but not exposed here —
 * the documents dropdown/materializes in 02-05 (W1 cross-plan guard).
 */
export async function saveRegistration(formData: FormData) {
  const org = await requireOrganization();
  const allowed = await hasPermission("registrations.manage");
  if (!allowed) throw new Error("Nemate dozvolu za izmenu registracija");

  const parsed = registrationSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    throw new Error("Nevalidan unos: " + parsed.error.issues[0]?.message);
  }
  const athleteId = parsed.data.athlete_id;
  const { id, ...fields } = parsed.data;

  const supabase = await createServerClient();
  const seasonValue =
    fields.season_id && fields.season_id.trim() !== ""
      ? fields.season_id
      : null;

  if (id) {
    const { error } = await supabase
      .from("registrations")
      .update({
        federation: fields.federation ?? null,
        identifier: fields.identifier ?? null,
        season_id: seasonValue,
        valid_from: fields.valid_from,
        valid_until: fields.valid_until,
      })
      .eq("id", id)
      .eq("organization_id", org.organizationId)
      .eq("athlete_id", athleteId);
    if (error) throw new Error("Greška pri čuvanju registracije: " + error.message);
  } else {
    const { error } = await supabase.from("registrations").insert({
      organization_id: org.organizationId,
      athlete_id: athleteId,
      season_id: seasonValue,
      federation: fields.federation ?? null,
      identifier: fields.identifier ?? null,
      valid_from: fields.valid_from,
      valid_until: fields.valid_until,
    });
    if (error) throw new Error("Greška pri upisu registracije: " + error.message);
  }

  revalidatePath(`/players/${athleteId}/registrations`);
  redirect(`/players/${athleteId}/registrations`);
}

/**
 * Delete a registration record. Guards: registrations.manage + org scoping.
 */
export async function deleteRegistration(formData: FormData) {
  const org = await requireOrganization();
  const allowed = await hasPermission("registrations.manage");
  if (!allowed) throw new Error("Nemate dozvolu za izmenu registracija");

  const id = formData.get("id");
  const athleteId = formData.get("athlete_id");
  if (typeof id !== "string" || !id) throw new Error("Nedostaje id registracije");
  if (typeof athleteId !== "string" || !athleteId)
    throw new Error("Nedostaje id igrača");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("registrations")
    .delete()
    .eq("id", id)
    .eq("organization_id", org.organizationId);
  if (error) throw new Error("Greška pri brisanju registracije: " + error.message);

  revalidatePath(`/players/${athleteId}/registrations`);
  redirect(`/players/${athleteId}/registrations`);
}
