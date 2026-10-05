"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  requireOrganization,
  hasPermission,
  getOrganizationCurrency,
} from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { reconcileStaffObligations } from "@/lib/staff-finance-data";
import {
  createStaffWithFunctions,
  deleteStaff,
  getStaffProfile,
  setStaffTeams,
  updateStaffWithFunctions,
  upsertStaffLicenses,
  type StaffFunctionInput,
  type StaffLicenseInput,
  type StaffProfileInput,
} from "@/lib/staff";
import { isPresetFunctionKey, staffFunctionLabel } from "@/lib/staff-functions";

const optionalProfileFields = {
  phone: z.string().trim().max(50).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional(),
};

const updateStaffSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  ...optionalProfileFields,
});

const createStaffSchema = z.object({
  athlete_id: z.string().uuid().optional().or(z.literal("")),
  first_name: z.string().trim().max(100).optional().or(z.literal("")),
  last_name: z.string().trim().max(100).optional().or(z.literal("")),
  ...optionalProfileFields,
});

const licenseSchema = z.object({
  staff_id: z.string().uuid(),
  id: z.string().uuid().optional(),
  license_type: z.string().trim().min(1).max(100),
  license_number: z.string().trim().max(100).optional(),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function profileInput(data: {
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  start_date?: string;
  end_date?: string;
  notes?: string;
}): Omit<StaffProfileInput, "title"> {
  return {
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone || null,
    email: data.email || null,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    notes: data.notes || null,
  };
}

/**
 * Read the repeated function_key/custom_label pairs emitted by the functions
 * editor (first pair = primary function). Unknown keys, empty custom labels
 * and exact duplicates are dropped; the action still requires ≥1 function.
 */
function parseStaffFunctions(formData: FormData): StaffFunctionInput[] {
  const keys = formData.getAll("function_key").map((value) => String(value));
  const labels = formData.getAll("custom_label").map((value) => String(value));
  const seen = new Set<string>();
  const functions: StaffFunctionInput[] = [];
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === "custom") {
      const label = labels[index]?.trim();
      if (!label) continue;
      const dedupe = `custom:${label.toLowerCase()}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      functions.push({ function_key: "custom", custom_label: label });
    } else if (isPresetFunctionKey(key)) {
      if (seen.has(key)) continue;
      seen.add(key);
      functions.push({ function_key: key, custom_label: null });
    }
  }
  return functions;
}

function requestLocale(formData: FormData): "sr" | "en" {
  const parsed = z.enum(["sr", "en"]).safeParse(formData.get("locale"));
  return parsed.success ? parsed.data : "sr";
}

/**
 * Internal compatibility only: the legacy `staff.title` column mirrors the
 * first function of the submitted list. The UI has no "primary function"
 * concept — all functions are equal — but existing code still reads `title`.
 */
function legacyStaffTitle(
  functions: StaffFunctionInput[],
  locale: "sr" | "en"
): string {
  const leading = functions[0];
  return staffFunctionLabel(
    leading.function_key,
    locale,
    leading.custom_label
  );
}

function throwIfError(result: { error: string } | { ok: true }, message: string) {
  if ("error" in result) throw new Error(`${message}: ${result.error}`);
}

async function requireStaffManager() {
  const org = await requireOrganization();
  if (!(await hasPermission("staff.manage"))) {
    throw new Error("Nemate dozvolu za upravljanje osobljem");
  }
  return org;
}

export type StaffCreateState = { error?: string } | null;

/**
 * Create a staff record only — never a Stožer account. Role and access are
 * assigned exclusively in Klub → Korisnici i pristup; the profile card links
 * there. The profile always carries at least one club function; "Postojeći
 * igrač" mode links it to an existing athlete instead of retyping the name.
 */
export async function createStaffMemberAction(
  _prev: StaffCreateState,
  formData: FormData
): Promise<StaffCreateState> {
  const org = await requireStaffManager();
  const parsed = createStaffSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { error: "Popunite obavezna polja." };
  }

  const athleteId = parsed.data.athlete_id || null;
  if (!athleteId && (!parsed.data.first_name || !parsed.data.last_name)) {
    return { error: "Unesite ime i prezime osobe." };
  }

  const functions = parseStaffFunctions(formData);
  if (functions.length === 0) {
    return { error: "Izaberite funkciju u klubu." };
  }

  const supabase = await createServerClient();
  const result = await createStaffWithFunctions(supabase, org.organizationId, {
    ...profileInput({
      ...parsed.data,
      first_name: parsed.data.first_name ?? "",
      last_name: parsed.data.last_name ?? "",
    }),
    title: legacyStaffTitle(functions, requestLocale(formData)),
    athlete_id: athleteId,
    functions,
  });
  if ("error" in result) {
    return { error: result.error };
  }
  revalidatePath("/people");
  redirect(`/people/${result.id}`);
}

export async function updateStaffAction(formData: FormData) {
  const org = await requireStaffManager();
  const staffId = formData.get("staff_id");
  if (typeof staffId !== "string") throw new Error("Nedostaje profil osoblja");
  const parsed = updateStaffSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) throw new Error("Nevalidan unos osoblja");

  const functions = parseStaffFunctions(formData);
  if (functions.length === 0) throw new Error("Izaberite funkciju u klubu.");

  const supabase = await createServerClient();
  throwIfError(
    await updateStaffWithFunctions(supabase, org.organizationId, staffId, {
      ...profileInput(parsed.data),
      title: legacyStaffTitle(functions, requestLocale(formData)),
      functions,
    }),
    "Greška pri čuvanju profila"
  );
  revalidatePath("/people");
  revalidatePath("/people/[id]", "layout");
  redirect(`/people/${staffId}`);
}

export async function deleteStaffAction(formData: FormData) {
  const org = await requireStaffManager();
  const staffId = formData.get("staff_id");
  if (typeof staffId !== "string") throw new Error("Nedostaje profil osoblja");
  const supabase = await createServerClient();
  throwIfError(
    await deleteStaff(supabase, org.organizationId, staffId),
    "Greška pri brisanju profila"
  );
  revalidatePath("/people");
  redirect("/people");
}

export async function saveStaffTeamsAction(formData: FormData) {
  const org = await requireStaffManager();
  const staffId = formData.get("staff_id");
  const seasonId = formData.get("season_id");
  if (typeof staffId !== "string" || typeof seasonId !== "string") {
    throw new Error("Nedostaje profil ili sezona");
  }
  const teamIds = formData
    .getAll("team_id")
    .filter((value): value is string => typeof value === "string");
  const supabase = await createServerClient();
  throwIfError(
    await setStaffTeams(supabase, org.organizationId, staffId, seasonId, teamIds),
    "Greška pri čuvanju timova osoblja"
  );
  revalidatePath("/people");
  revalidatePath("/people/[id]", "layout");
  redirect(`/people/${staffId}`);
}

export async function saveStaffLicenseAction(formData: FormData) {
  const org = await requireStaffManager();
  const parsed = licenseSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error("Nevalidan unos licence");

  const supabase = await createServerClient();
  const current = await getStaffProfile(supabase, org.organizationId, parsed.data.staff_id);
  if (!current) throw new Error("Profil osoblja nije pronađen");
  const nextRows: StaffLicenseInput[] = current.licenses
    .filter((license) => license.id !== parsed.data.id)
    .map((license) => ({
      license_type: license.license_type,
      license_number: license.license_number,
      valid_until: license.valid_until,
    }));
  nextRows.push({
    license_type: parsed.data.license_type,
    license_number: parsed.data.license_number || null,
    valid_until: parsed.data.valid_until,
  });
  throwIfError(
    await upsertStaffLicenses(supabase, org.organizationId, parsed.data.staff_id, nextRows),
    "Greška pri čuvanju licence"
  );
  revalidatePath("/people");
  revalidatePath("/people/[id]", "layout");
  redirect(`/people/${parsed.data.staff_id}/licenses`);
}

export async function deleteStaffLicenseAction(formData: FormData) {
  const org = await requireStaffManager();
  const staffId = formData.get("staff_id");
  const licenseId = formData.get("license_id");
  if (typeof staffId !== "string" || typeof licenseId !== "string") {
    throw new Error("Nedostaje licenca");
  }
  const supabase = await createServerClient();
  const current = await getStaffProfile(supabase, org.organizationId, staffId);
  if (!current) throw new Error("Profil osoblja nije pronađen");
  const nextRows = current.licenses
    .filter((license) => license.id !== licenseId)
    .map((license) => ({
      license_type: license.license_type,
      license_number: license.license_number,
      valid_until: license.valid_until,
    }));
  throwIfError(
    await upsertStaffLicenses(supabase, org.organizationId, staffId, nextRows),
    "Greška pri brisanju licence"
  );
  revalidatePath("/people");
  revalidatePath("/people/[id]", "layout");
  redirect(`/people/${staffId}/licenses`);
}

const staffCompensationSchema = z.object({
  staff_id: z.string().uuid(),
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valid_until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

/**
 * Save (upsert) a staff member's engagement compensation and reconcile its
 * monthly obligations. "Bez naknade" (no_compensation=on) stores
 * monthly_amount = NULL and removes every unpaid obligation; a positive amount
 * regenerates them from valid_from. The currency is the club's single currency
 * (never chosen per person). Requires staff_finance.manage.
 */
export async function saveStaffCompensationAction(formData: FormData) {
  const org = await requireOrganization();
  if (!(await hasPermission("staff_finance.manage"))) {
    throw new Error("Nemate dozvolu za upravljanje naknadama");
  }

  const parsed = staffCompensationSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    throw new Error("Unesite početak važenja naknade.");
  }

  const noCompensation = formData.get("no_compensation") === "on";
  let monthlyAmount: number | null = null;
  if (!noCompensation) {
    const amount = z
      .number({ coerce: true })
      .int()
      .positive()
      .max(100_000_000)
      .safeParse(formData.get("monthly_amount"));
    if (!amount.success) {
      throw new Error("Unesite mesečni iznos naknade veći od 0.");
    }
    monthlyAmount = amount.data;
  }

  const noteRaw = parsed.data.note;
  const note = noteRaw && noteRaw.trim() ? noteRaw.trim() : null;
  const validUntil = parsed.data.valid_until || null;

  const supabase = await createServerClient();
  const currency = await getOrganizationCurrency(org.organizationId);

  const { data, error } = await supabase
    .from("staff_compensations")
    .upsert(
      {
        organization_id: org.organizationId,
        staff_id: parsed.data.staff_id,
        monthly_amount: monthlyAmount,
        currency,
        valid_from: parsed.data.valid_from,
        valid_until: validUntil,
        note,
      },
      { onConflict: "staff_id" }
    )
    .select("id, staff_id, monthly_amount, currency, valid_from, valid_until")
    .single();

  if (error || !data) {
    throw new Error("Greška pri čuvanju naknade. Pokušajte ponovo.");
  }

  await reconcileStaffObligations(supabase, org.organizationId, {
    id: data.id,
    staff_id: data.staff_id,
    monthly_amount: data.monthly_amount,
    currency: data.currency ?? "RSD",
    valid_from: data.valid_from,
    valid_until: data.valid_until,
  });

  revalidatePath("/people");
  revalidatePath("/people/[id]", "layout");
  revalidatePath("/finance");
  revalidatePath("/finance/staff");
}
