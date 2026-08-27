"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import {
  listGuardians,
  normalizeGuardianPrimary,
  updateGuardians,
  type GuardianInput,
  type PreferredContact,
} from "@/lib/guardian";

const contactMethods = ["phone", "email", "sms", "other"] as const;
const guardianSchema = z.object({
  full_name: z.string().trim().min(1).max(160),
  relationship: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(50).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  preferred_contact: z.enum(contactMethods).nullable(),
});

function athleteFrom(formData: FormData): string {
  const athleteId = formData.get("athlete_id");
  if (typeof athleteId !== "string" || !z.string().uuid().safeParse(athleteId).success) {
    throw new Error("Nedostaje validan igrač");
  }
  return athleteId;
}

async function requireGuardianEdit() {
  const org = await requireOrganization();
  if (!(await hasPermission("athletes.edit"))) {
    throw new Error("Nemate dozvolu za izmenu staratelja");
  }
  return org;
}

function redirectTo(athleteId: string) {
  revalidatePath(`/players/${athleteId}/guardians`);
  redirect(`/players/${athleteId}/guardians`);
}

export async function saveGuardiansAction(formData: FormData) {
  const org = await requireGuardianEdit();
  const athleteId = athleteFrom(formData);
  const ids = formData.getAll("guardian_id");
  const names = formData.getAll("full_name");
  const relationships = formData.getAll("relationship");
  const phones = formData.getAll("phone");
  const emails = formData.getAll("email");
  const contacts = formData.getAll("preferred_contact");
  const primaryId = formData.get("primary_id");

  const rows: GuardianInput[] = [];
  for (let index = 0; index < names.length; index += 1) {
    const rawId = ids[index];
    const rowId = typeof rawId === "string" ? rawId : undefined;
    const parsed = guardianSchema.safeParse({
      full_name: names[index],
      relationship: relationships[index],
      phone: phones[index] || undefined,
      email: emails[index] || undefined,
      preferred_contact: contacts[index] || null,
    });
    if (!parsed.success) throw new Error("Podaci o staratelju nisu validni");
    rows.push({
      id: rowId || undefined,
      athlete_id: athleteId,
      full_name: parsed.data.full_name,
      relationship: parsed.data.relationship,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      preferred_contact: parsed.data.preferred_contact as PreferredContact | null,
      is_primary: typeof primaryId === "string" && primaryId === rowId,
    });
  }

  const supabase = await createServerClient();
  const result = await updateGuardians(supabase, org.organizationId, athleteId, rows);
  if ("error" in result) throw new Error("Staratelji nisu sačuvani: " + result.error);
  redirectTo(athleteId);
}

export async function addGuardianAction(formData: FormData) {
  const org = await requireGuardianEdit();
  const athleteId = athleteFrom(formData);
  const parsed = guardianSchema.safeParse({
    full_name: formData.get("full_name"),
    relationship: formData.get("relationship"),
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    preferred_contact: formData.get("preferred_contact") || null,
  });
  if (!parsed.success) throw new Error("Podaci o staratelju nisu validni");

  const supabase = await createServerClient();
  const existing = await listGuardians(supabase, org.organizationId, athleteId);
  const newGuardian: GuardianInput = {
    athlete_id: athleteId,
    full_name: parsed.data.full_name,
    relationship: parsed.data.relationship,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    preferred_contact: parsed.data.preferred_contact as PreferredContact | null,
    is_primary: formData.get("is_primary") === "true",
  };
  const result = await updateGuardians(
    supabase,
    org.organizationId,
    athleteId,
    normalizeGuardianPrimary(athleteId, existing, [newGuardian])
  );
  if ("error" in result) throw new Error("Staratelj nije sačuvan: " + result.error);
  redirectTo(athleteId);
}

export async function deleteGuardianAction(formData: FormData) {
  const org = await requireGuardianEdit();
  const athleteId = athleteFrom(formData);
  const guardianId = formData.get("delete_guardian_id") ?? formData.get("guardian_id");
  if (typeof guardianId !== "string") throw new Error("Nedostaje staratelj");
  const supabase = await createServerClient();
  const existing = await listGuardians(supabase, org.organizationId, athleteId);
  const remaining = existing
    .filter((guardian) => guardian.id !== guardianId)
    .map((guardian) => ({
      id: guardian.id,
      athlete_id: athleteId,
      full_name: guardian.full_name,
      relationship: guardian.relationship,
      phone: guardian.phone,
      email: guardian.email,
      preferred_contact: guardian.preferred_contact,
      is_primary: guardian.is_primary,
    }));
  const result = await updateGuardians(supabase, org.organizationId, athleteId, remaining);
  if ("error" in result) throw new Error("Staratelj nije obrisan: " + result.error);
  redirectTo(athleteId);
}
