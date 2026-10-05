"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requireOrganization,
  hasPermission,
  getOrganizationCurrency,
} from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import {
  listStaffCompensations,
  listStaffFinanceMonth,
  reconcileStaffObligations,
  recordStaffPayment,
  reverseStaffPaymentRecord,
} from "@/lib/staff-finance-data";
import { hasStaffCompensation } from "@/lib/staff-finance";
import { validatePaymentAmount } from "@/lib/first-team";

export type StaffPaymentActionState = { error?: string; ok?: boolean } | null;

/**
 * Record staff payments for one month. Every payment is tied to a concrete
 * monthly obligation, re-derived server-side (never trusted from the client).
 * Partial payments are first-class: lower the amount below the remaining and
 * the obligation stays open. This RECORDS payments — Stožer never transfers
 * money.
 */
export async function recordStaffPayments(
  _prev: StaffPaymentActionState,
  formData: FormData
): Promise<StaffPaymentActionState> {
  const org = await requireOrganization();
  const allowed = await hasPermission("staff_finance.manage");
  if (!allowed) return { error: "Nemate dozvolu za evidentiranje isplata" };

  const period = z.string().regex(/^\d{4}-\d{2}$/).safeParse(formData.get("period"));
  const paidOn = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .safeParse(formData.get("paid_on"));
  const method = z.enum(["cash", "bank", "other"]).safeParse(formData.get("method"));
  if (!period.success || !paidOn.success || !method.success) {
    return { error: "Nevalidan unos isplate." };
  }
  const noteRaw = formData.get("note");
  const note = typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim() : null;

  const rawAmounts = new Map<string, string>();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("amount_")) continue;
    rawAmounts.set(
      key.slice("amount_".length),
      typeof value === "string" ? value : ""
    );
  }
  if (rawAmounts.size === 0) {
    return { error: "Izaberite najmanje jednu osobu za isplatu." };
  }

  const supabase = await createServerClient();

  // Ensure this month's obligations exist before recording against them.
  const compensations = await listStaffCompensations(supabase, org.organizationId);
  for (const compensation of compensations) {
    if (!hasStaffCompensation(compensation)) continue;
    await reconcileStaffObligations(supabase, org.organizationId, compensation);
  }

  const eligible = await listStaffFinanceMonth(
    supabase,
    org.organizationId,
    period.data
  );
  const clubCurrency = await getOrganizationCurrency(org.organizationId);

  const amounts = new Map<string, number>();
  for (const [staffId, raw] of rawAmounts) {
    const row = eligible.find((candidate) => candidate.staff_id === staffId);
    if (!row || !row.obligation_id) {
      return {
        error:
          "Isplata može da se evidentira samo za osobe sa obavezom za izabrani mesec.",
      };
    }
    const amount = Number(raw);
    if (!Number.isInteger(amount) || amount <= 0) {
      return {
        error: `${row.last_name} ${row.first_name}: iznos isplate mora biti veći od 0.`,
      };
    }
    const check = validatePaymentAmount(amount, row.remaining);
    if (!check.ok) {
      return {
        error: `${row.last_name} ${row.first_name}: ${check.error}`,
      };
    }
    amounts.set(row.staff_id, amount);
  }

  let recorded = 0;
  for (const row of eligible) {
    const amount = amounts.get(row.staff_id);
    if (!amount || !row.obligation_id) continue;
    const { error } = await recordStaffPayment(supabase, org.organizationId, {
      obligation_id: row.obligation_id,
      compensation_id: row.compensation_id,
      staff_id: row.staff_id,
      amount,
      currency: clubCurrency,
      paid_on: paidOn.data,
      method: method.data,
      note,
      created_by: org.userId,
    });
    if (error) return { error: "Greška pri evidentiranju isplate. Pokušajte ponovo." };
    recorded += 1;
  }

  if (recorded === 0) {
    return { error: "Nema obaveza za evidentiranje za izabrani mesec." };
  }

  revalidatePath("/finance", "layout");
  revalidatePath("/finance/staff");
  return { ok: true };
}

/** Reverse ONE staff payment ("Poništi isplatu") — stamp, never delete. */
export async function reverseStaffPayment(formData: FormData): Promise<void> {
  const org = await requireOrganization();
  const allowed = await hasPermission("staff_finance.manage");
  if (!allowed) throw new Error("Nemate dozvolu za evidentiranje isplata");

  const paymentId = z.string().uuid().safeParse(formData.get("payment_id"));
  if (!paymentId.success) throw new Error("Nedostaje isplata");

  const supabase = await createServerClient();
  const result = await reverseStaffPaymentRecord(
    supabase,
    org.organizationId,
    paymentId.data,
    org.userId
  );
  if (result === "ok") {
    revalidatePath("/finance", "layout");
  }
  revalidatePath("/finance/staff");
}
