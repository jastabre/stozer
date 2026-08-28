"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { requireOrganization, hasPermission } from "@/lib/organization";

// Zod validation of untrusted dates/notes (T-02-03-01). D-42 hard boundary:
// ONLY administrative fields — examined_on, valid_until, and an administrative
// note. This schema whitelists exactly those; no diagnoses, findings, test
// results, or history fields can ever reach the DB (T-02-03-04).
const medicalSchema = z
  .object({
    id: z.string().uuid().optional(),
    athlete_id: z.string().uuid(),
    examined_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum mora biti YYYY-MM-DD"),
    valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum mora biti YYYY-MM-DD"),
    note: z.string().max(500).optional(),
    document_id: z.preprocess(
      (value) => (value === "" ? null : value),
      z.string().uuid().nullable().optional()
    ),
  })
  .refine((v) => v.valid_until >= v.examined_on, {
    message: "Datum isteka mora biti posle datuma pregleda",
    path: ["valid_until"],
  });

/**
 * Create (or update) a medical examination record. Guards: registrations.manage
 * (record entry rides the existing registrations.manage; no medical.manage),
 * org from requireOrganization. Certificate attachment lands in 02-05 with the
 * documents module — only the data columns are written here.
 */
export async function saveMedicalExamination(formData: FormData) {
  const org = await requireOrganization();
  const allowed = await hasPermission("registrations.manage");
  if (!allowed) throw new Error("Nemate dozvolu za izmenu medicinskih pregleda");

  const parsed = medicalSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    throw new Error("Nevalidan unos: " + parsed.error.issues[0]?.message);
  }
  const athleteId = parsed.data.athlete_id;
  const { id, ...fields } = parsed.data;

  const supabase = await createServerClient();
  if (fields.document_id) {
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id")
      .eq("id", fields.document_id)
      .eq("organization_id", org.organizationId)
      .eq("owner_type", "athlete")
      .eq("owner_id", athleteId)
      .eq("doc_type", "medical")
      .maybeSingle();
    if (documentError || !document) throw new Error("Medicinski dokument nije pronađen");
  }

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
        note: fields.note ?? null,
        document_id: fields.document_id ?? null,
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
      note: fields.note ?? null,
      document_id: fields.document_id ?? null,
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
  if (!allowed) throw new Error("Nemate dozvolu za izmenu medicinskih pregleda");

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
