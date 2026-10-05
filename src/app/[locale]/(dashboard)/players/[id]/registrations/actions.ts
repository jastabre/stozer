"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { getActiveSeason } from "@/lib/club-data";

// Zod validation of untrusted client dates/ids (T-02-03-01): valid_until must
// be after valid_from, required as YYYY-MM-DD. Unknown fields are stripped.
// The daily form carries only the structured competition-registration facts:
// the federative/registration ID, the note and the two dates. Season is chosen
// automatically (active season) and documents are tracked separately, so neither
// is a form field; `federation`/`season_id`/`document_id` are never sent here and
// are preserved on edit (see saveRegistration).
const registrationSchema = z
  .object({
    id: z.string().uuid().optional(),
    athlete_id: z.string().uuid(),
    identifier: z.string().max(100).optional(),
    note: z.string().max(500).optional(),
    valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum mora biti YYYY-MM-DD"),
    valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum mora biti YYYY-MM-DD"),
  })
  .refine((v) => v.valid_until >= v.valid_from, {
    message: "Datum isteka mora biti posle datuma početka",
    path: ["valid_until"],
  });

/**
 * Create (or update, when an `id` is present) a competition-registration record
 * for an athlete. Guards: registrations.manage permission + org from
 * requireOrganization. A new registration is automatically bound to the club's
 * active season; an edit only touches the fields the form owns (identifier,
 * note, dates) so the season, the legacy federation/system label and any linked
 * document are preserved untouched.
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

  // WR-05: verify the athlete belongs to this org — cross-org parent references
  // are rejected by the composite org FKs (00011); validate for a clear message.
  const { data: athlete, error: athleteError } = await supabase
    .from("athletes")
    .select("id")
    .eq("id", athleteId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (athleteError || !athlete) throw new Error("Igrač nije pronađen u organizaciji");

  if (id) {
    const { error } = await supabase
      .from("registrations")
      .update({
        identifier: fields.identifier ?? null,
        note: fields.note ?? null,
        valid_from: fields.valid_from,
        valid_until: fields.valid_until,
      })
      .eq("id", id)
      .eq("organization_id", org.organizationId)
      .eq("athlete_id", athleteId);
    if (error) throw new Error("Greška pri čuvanju registracije: " + error.message);
  } else {
    // Bind a new registration to the active season automatically (D-09). No
    // active season means the flow shouldn't have offered the form (guarded in
    // the page), but fail clearly rather than writing an orphan.
    const activeSeason = await getActiveSeason(supabase, org.organizationId);
    if (!activeSeason) {
      throw new Error("Nema aktivne sezone. Započnite sezonu pre unosa registracije.");
    }
    const { error } = await supabase.from("registrations").insert({
      organization_id: org.organizationId,
      athlete_id: athleteId,
      season_id: activeSeason.id,
      identifier: fields.identifier ?? null,
      note: fields.note ?? null,
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
