"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasPermission, getOrganizationCurrency, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveSeason } from "@/lib/club-data";
import { reconcileContractObligations } from "@/lib/first-team-data";
import type { ContractFinance } from "@/lib/first-team";

const optionalDate = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
);
const optionalDocument = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().uuid().nullable().optional()
);
const optionalSalary = z.preprocess(
  (value) => (value === "" || value === null ? null : value),
  z.number({ coerce: true }).int().min(0).max(100_000_000).nullable().optional()
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
  monthly_salary: optionalSalary,
  pay_schedule: z.enum(["all_year", "competition_months", "custom_months"]).optional(),
  custom_months: z.preprocess(
    (value) => (value === "" ? null : value),
    z.string().nullable().optional()
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

  // V1: contracts never carry a user-chosen currency; every write uses the
  // club's single currency (existing amounts are never converted).
  const clubCurrency = await getOrganizationCurrency(org.organizationId);

  const values = {
    contract_type: parsed.data.contract_type,
    status: parsed.data.status,
    valid_from: parsed.data.valid_from ?? null,
    valid_until: parsed.data.valid_until ?? null,
    notes: parsed.data.notes ?? null,
    monthly_salary: parsed.data.monthly_salary ?? null,
    currency: clubCurrency,
    pay_schedule: parsed.data.pay_schedule ?? "all_year",
    custom_months: parsed.data.pay_schedule === "custom_months"
      ? (parsed.data.custom_months
          ? parsed.data.custom_months
              .split(",")
              .map((s) => Number(s.trim()))
              .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12)
              .reduce<number[]>((acc, n) => (acc.includes(n) ? acc : [...acc, n]), [])
          : null)
      : null,
  };
  // Certificates are attachments managed in the Documents tab, so `document_id`
  // is not part of this form: it is set only on create and never touched on
  // update, so an existing link is preserved.
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
        document_id: parsed.data.document_id ?? null,
        ...values,
      });
  if (result.error) throw new Error("Greška pri čuvanju ugovora: " + result.error.message);

  // Regenerate monthly salary obligations for any active contract that has a
  // monthly salary, scoped by the active season's competition months.
  if (parsed.data.status === "active" && parsed.data.monthly_salary != null) {
    const { data: contract } = await supabase
      .from("contracts")
      .select("id, athlete_id, valid_from, valid_until, monthly_salary, currency, pay_schedule, custom_months")
      .eq("organization_id", org.organizationId)
      .eq("athlete_id", parsed.data.athlete_id)
      .eq("status", "active")
      .maybeSingle();
    if (contract) {
      const season = await getActiveSeason(supabase, org.organizationId);
      await reconcileContractObligations(
        supabase,
        org.organizationId,
        {
          id: contract.id,
          athlete_id: contract.athlete_id,
          valid_from: contract.valid_from,
          valid_until: contract.valid_until,
          monthly_salary: contract.monthly_salary as number,
          currency: (contract.currency as string) ?? "RSD",
          pay_schedule:
            (contract.pay_schedule as ContractFinance["pay_schedule"]) ??
            "all_year",
          custom_months: (contract.custom_months as number[] | null) ?? null,
        },
        season?.competition_months ?? null
      );
    }
  }

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
