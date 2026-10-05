"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { requireOrganization, hasPermission } from "@/lib/organization";

// Zod validation of untrusted dates/notes (T-02-03-01). D-42 hard boundary:
// ONLY administrative fields — examined_on, valid_until, an exam type, the
// institution/doctor and an administrative note. This schema whitelists exactly
// those; no diagnoses, findings, test results, or history fields can ever reach
// the DB (T-02-03-04). Certificates are attachments managed in the Documents
// tab, so `document_id` is intentionally not part of this form and is preserved
// untouched on edit (never written here).
const medicalSchema = z
  .object({
    id: z.string().uuid().optional(),
    athlete_id: z.string().uuid(),
    examined_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum mora biti YYYY-MM-DD"),
    valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum mora biti YYYY-MM-DD"),
    exam_type: z.string().trim().max(100).optional(),
    institution: z.string().trim().max(200).optional(),
    note: z.string().max(500).optional(),
  })
  .refine((v) => v.valid_until >= v.examined_on, {
    message: "Datum isteka mora biti posle datuma pregleda",
    path: ["valid_until"],
  });

/**
 * Create (or update) a medical examination record. Guards: registrations.manage
 * (record entry rides the existing registrations.manage; no medical.manage),
 * org from requireOrganization. The certificate link is managed in the
 * Documents module, so edits never touch `document_id` (preserved as-is).
 */
export async function saveMedicalExamination(formData: FormData) {
  const org = await requireOrganization();
  const allowed = await hasPermission("registrations.manage");
  if (!allowed) throw new Error("Nemate dozvolu za izmenu lekarskih pregleda");

  const parsed = medicalSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    throw new Error("Nevalidan unos: " + parsed.error.issues[0]?.message);
  }
  const athleteId = parsed.data.athlete_id;
  const { id, ...fields } = parsed.data;

  const supabase = await createServerClient();

  // WR-05: verify the athlete belongs to this org before inserting/updating —
  // cross-org parent references are rejected by the composite org FK (00011).
  const { data: athlete, error: athleteError } = await supabase
    .from("athletes")
    .select("id")
    .eq("id", athleteId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (athleteError || !athlete) throw new Error("Igrač nije pronađen u organizaciji");

  if (id) {
    const { error } = await supabase
      .from("medical_examinations")
      .update({
        examined_on: fields.examined_on,
        valid_until: fields.valid_until,
        exam_type: fields.exam_type?.trim() ? fields.exam_type.trim() : null,
        institution: fields.institution?.trim() ? fields.institution.trim() : null,
        note: fields.note ?? null,
      })
      .eq("id", id)
      .eq("organization_id", org.organizationId)
      .eq("athlete_id", athleteId);
    if (error)
      throw new Error("Greška pri čuvanju pregleda: " + error.message);
  } else {
    const { error } = await supabase.from("medical_examinations").insert({
      organization_id: org.organizationId,
      athlete_id: athleteId,
      examined_on: fields.examined_on,
      valid_until: fields.valid_until,
      exam_type: fields.exam_type?.trim() ? fields.exam_type.trim() : null,
      institution: fields.institution?.trim() ? fields.institution.trim() : null,
      note: fields.note ?? null,
    });
    if (error) throw new Error("Greška pri upisu pregleda: " + error.message);
  }

  revalidatePath(`/players/${athleteId}/medical`);
  redirect(`/players/${athleteId}/medical`);
}

/**
 * Delete a medical examination record. Guards: registrations.manage + org scope.
 */
export async function deleteMedicalExamination(formData: FormData) {
  const org = await requireOrganization();
  const allowed = await hasPermission("registrations.manage");
  if (!allowed) throw new Error("Nemate dozvolu za izmenu lekarskih pregleda");

  const id = formData.get("id");
  const athleteId = formData.get("athlete_id");
  if (typeof id !== "string" || !id) throw new Error("Nedostaje id pregleda");
  if (typeof athleteId !== "string" || !athleteId)
    throw new Error("Nedostaje id igrača");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("medical_examinations")
    .delete()
    .eq("id", id)
    .eq("organization_id", org.organizationId);
  if (error) throw new Error("Greška pri brisanju pregleda: " + error.message);

  revalidatePath(`/players/${athleteId}/medical`);
  redirect(`/players/${athleteId}/medical`);
}
