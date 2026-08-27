"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";

const optionalDate = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
);
const optionalDocument = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().uuid().nullable().optional()
);

const contractSchema = z.object({
  id: z.string().uuid().optional(),
  athlete_id: z.string().uuid(),
  contract_type: z.string().trim().min(1).max(100),
  status: z.enum(["draft", "active", "terminated", "expired"]),
  valid_from: optionalDate,
  valid_until: optionalDate,
  document_id: optionalDocument,
  notes: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(2000).nullable().optional()
  ),
});

async function requireContractManager() {
  const org = await requireOrganization();
  if (!(await hasPermission("contracts.manage"))) {
    throw new Error("Nemate dozvolu za upravljanje ugovorima");
  }
  return org;
}

async function validateAthlete(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  organizationId: string,
  athleteId: string
) {
  const { data, error } = await supabase
    .from("athletes")
    .select("id")
    .eq("id", athleteId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !data) throw new Error("Igrač nije pronađen");
}

async function validateLinkedDocument(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  organizationId: string,
  athleteId: string,
  documentId: string | null | undefined
) {
  if (!documentId) return;
  const { data, error } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .eq("owner_type", "athlete")
    .eq("owner_id", athleteId)
    .eq("doc_type", "contract")
    .maybeSingle();
  if (error || !data) throw new Error("Povezani dokument ugovora nije pronađen");
}

export async function saveContract(formData: FormData) {
  const org = await requireContractManager();
  const parsed = contractSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error("Nevalidan unos ugovora");
  if (
    parsed.data.valid_from &&
    parsed.data.valid_until &&
    parsed.data.valid_until < parsed.data.valid_from
  ) {
    throw new Error("Datum isteka ne može biti pre datuma početka");
  }

  const supabase = await createServerClient();
  await validateAthlete(supabase, org.organizationId, parsed.data.athlete_id);
  await validateLinkedDocument(
    supabase,
    org.organizationId,
    parsed.data.athlete_id,
    parsed.data.document_id
  );

  const values = {
    contract_type: parsed.data.contract_type,
    status: parsed.data.status,
    valid_from: parsed.data.valid_from ?? null,
    valid_until: parsed.data.valid_until ?? null,
    document_id: parsed.data.document_id ?? null,
    notes: parsed.data.notes ?? null,
  };
  const result = parsed.data.id
    ? await supabase
        .from("contracts")
        .update(values)
        .eq("id", parsed.data.id)
        .eq("organization_id", org.organizationId)
        .eq("athlete_id", parsed.data.athlete_id)
    : await supabase.from("contracts").insert({
        organization_id: org.organizationId,
        athlete_id: parsed.data.athlete_id,
        ...values,
      });
  if (result.error) throw new Error("Greška pri čuvanju ugovora: " + result.error.message);

  revalidatePath(`/players/${parsed.data.athlete_id}/contracts`);
  redirect(`/players/${parsed.data.athlete_id}/contracts`);
}

export async function deleteContract(formData: FormData) {
  const org = await requireContractManager();
  const id = z.string().uuid().safeParse(formData.get("id"));
  const athleteId = z.string().uuid().safeParse(formData.get("athlete_id"));
  if (!id.success || !athleteId.success) throw new Error("Nedostaje ugovor");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("contracts")
    .delete()
    .eq("id", id.data)
    .eq("organization_id", org.organizationId)
    .eq("athlete_id", athleteId.data);
  if (error) throw new Error("Greška pri brisanju ugovora: " + error.message);

  revalidatePath(`/players/${athleteId.data}/contracts`);
  redirect(`/players/${athleteId.data}/contracts`);
}
