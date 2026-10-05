"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { hasContactChannel, removeGuardian, resolvePreferredContact, setGuardian, type GuardianInput } from "@/lib/guardian";

const uuid = z.string().uuid();

// V1 keeps only phone/email as contact channels and requires at least one.
const guardianSchema = z
  .object({
    full_name: z.string().trim().min(1).max(160),
    relationship: z.string().trim().min(1).max(80),
    phone: z.string().trim().max(50).optional(),
    email: z
      .string()
      .trim()
      .max(255)
      .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Email nije validan")
      .optional(),
    preferred_contact: z.enum(["phone", "email"]).nullable().optional(),
    is_primary: z.boolean().optional(),
  })
  .refine((v) => hasContactChannel(v.phone, v.email), {
    message: "Unesite telefon ili email.",
    path: ["phone"],
  });

function athleteFrom(formData: FormData): string {
  const athleteId = formData.get("athlete_id");
  if (typeof athleteId !== "string" || !uuid.safeParse(athleteId).success) {
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

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectTo(athleteId: string) {
  revalidatePath(`/players/${athleteId}`);
  revalidatePath(`/players/${athleteId}/guardians`);
  redirect(`/players/${athleteId}/guardians`);
}

/**
 * Resolve the preferred contact so the stored value always matches an existing
 * channel (see resolvePreferredContact).
 */
function buildInput(formData: FormData, id?: string): GuardianInput {
  const parsed = guardianSchema.safeParse({
    full_name: text(formData, "full_name"),
    relationship: text(formData, "relationship"),
    phone: text(formData, "phone") || undefined,
    email: text(formData, "email") || undefined,
    preferred_contact: text(formData, "preferred_contact") || null,
    is_primary: formData.get("is_primary") === "true",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Podaci o staratelju nisu validni");
  }
  const phone = parsed.data.phone ?? "";
  const email = parsed.data.email ?? "";
  return {
    id,
    athlete_id: athleteFrom(formData),
    full_name: parsed.data.full_name,
    relationship: parsed.data.relationship,
    phone: phone || null,
    email: email || null,
    preferred_contact: resolvePreferredContact(
      parsed.data.preferred_contact ?? null,
      !!phone,
      !!email
    ),
    is_primary: parsed.data.is_primary ?? false,
  };
}

export async function addGuardianAction(formData: FormData) {
  const org = await requireGuardianEdit();
  const athleteId = athleteFrom(formData);
  const input = buildInput(formData);
  const supabase = await createServerClient();
  const result = await setGuardian(supabase, org.organizationId, athleteId, input);
  if ("error" in result) throw new Error("Staratelj nije sačuvan: " + result.error);
  redirectTo(athleteId);
}

export async function editGuardianAction(formData: FormData) {
  const org = await requireGuardianEdit();
  const athleteId = athleteFrom(formData);
  const rawId = formData.get("guardian_id");
  if (typeof rawId !== "string" || !uuid.safeParse(rawId).success) {
    throw new Error("Nedostaje staratelj");
  }
  const input = buildInput(formData, rawId);
  const supabase = await createServerClient();
  const result = await setGuardian(supabase, org.organizationId, athleteId, input);
  if ("error" in result) throw new Error("Staratelj nije sačuvan: " + result.error);
  redirectTo(athleteId);
}

export async function deleteGuardianAction(formData: FormData) {
  const org = await requireGuardianEdit();
  const athleteId = athleteFrom(formData);
  const guardianId = formData.get("guardian_id") ?? formData.get("delete_guardian_id");
  if (typeof guardianId !== "string" || !uuid.safeParse(guardianId).success) {
    throw new Error("Nedostaje staratelj");
  }
  const supabase = await createServerClient();
  const result = await removeGuardian(supabase, org.organizationId, athleteId, guardianId);
  if ("error" in result) throw new Error("Staratelj nije obrisan: " + result.error);
  redirectTo(athleteId);
}
