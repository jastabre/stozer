"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

export type CurrencyActionState = { ok?: boolean; error?: string } | null;

const currencySchema = z.enum(SUPPORTED_CURRENCIES);

/**
 * Save the club's single currency (V1) to `organizations.currency`. Only the
 * two supported codes are accepted; existing amounts are never converted and
 * per-contract/per-payment currency columns stay as historical snapshots.
 */
export async function updateClubCurrencyAction(
  _prev: CurrencyActionState,
  formData: FormData
): Promise<CurrencyActionState> {
  const org = await requireOrganization();
  if (!(await hasPermission("club_settings.manage"))) {
    return { error: "Nemate dozvolu za izmenu podešavanja kluba" };
  }

  const parsed = currencySchema.safeParse(formData.get("currency"));
  if (!parsed.success) return { error: "Izaberite podržanu valutu" };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({ currency: parsed.data })
    .eq("id", org.organizationId);
  if (error) return { error: "Greška pri čuvanju valute: " + error.message };

  // Currency feeds the payments screen (and new finance writes), so refresh the
  // finance routes alongside the settings page.
  revalidatePath("/settings");
  revalidatePath("/teams", "layout");
  revalidatePath("/players");
  return { ok: true };
}
