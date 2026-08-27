"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import {
  createStaff,
  deleteStaff,
  getStaffProfile,
  linkStaffToUser,
  setStaffTeams,
  updateStaff,
  upsertStaffLicenses,
  type StaffLicenseInput,
  type StaffProfileInput,
} from "@/lib/staff";
import type { AppRole, Database } from "@/types/database";

const roleValues = [
  "club_president",
  "youth_director",
  "coach",
  "admin_finance",
  "super_admin",
] as const satisfies readonly AppRole[];

const profileSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  photo_url: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(50).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  title: z.string().trim().max(100).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional(),
});

const licenseSchema = z.object({
  staff_id: z.string().uuid(),
  id: z.string().uuid().optional(),
  license_type: z.string().trim().min(1).max(100),
  license_number: z.string().trim().max(100).optional(),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function profileInput(data: z.infer<typeof profileSchema>): StaffProfileInput {
  return {
    first_name: data.first_name,
    last_name: data.last_name,
    photo_url: data.photo_url || null,
    phone: data.phone || null,
    email: data.email || null,
    title: data.title || null,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    notes: data.notes || null,
  };
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

export async function createStaffAction(formData: FormData) {
  const org = await requireStaffManager();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error("Nevalidan unos osoblja");

  const supabase = await createServerClient();
  const result = await createStaff(supabase, org.organizationId, profileInput(parsed.data));
  if ("error" in result) throw new Error("Greška pri kreiranju osoblja: " + result.error);
  revalidatePath("/people");
  redirect(`/people/${result.id}`);
}

export async function updateStaffAction(formData: FormData) {
  const org = await requireStaffManager();
  const staffId = formData.get("staff_id");
  if (typeof staffId !== "string") throw new Error("Nedostaje profil osoblja");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error("Nevalidan unos osoblja");

  const supabase = await createServerClient();
  throwIfError(
    await updateStaff(supabase, org.organizationId, staffId, profileInput(parsed.data)),
    "Greška pri čuvanju profila"
  );
  revalidatePath("/people");
  revalidatePath(`/people/${staffId}`);
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
  revalidatePath(`/people/${staffId}`);
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
  revalidatePath(`/people/${parsed.data.staff_id}`);
  redirect(`/people/${parsed.data.staff_id}`);
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
  revalidatePath(`/people/${staffId}`);
  redirect(`/people/${staffId}`);
}

async function findAuthUserIdByEmail(email: string): Promise<string> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    throw new Error("Povezivanje naloga zahteva podešen server-side Supabase admin ključ");
  }
  const admin = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error("Nije moguće pronaći korisnički nalog");
  const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
  if (!user) throw new Error("Korisnički nalog sa tim emailom nije pronađen");
  return user.id;
}

export async function linkStaffAccountAction(formData: FormData) {
  const org = await requireStaffManager();
  const staffId = formData.get("staff_id");
  const email = formData.get("account_email");
  const role = formData.get("role");
  if (typeof staffId !== "string" || typeof email !== "string" || typeof role !== "string") {
    throw new Error("Email i uloga naloga su obavezni");
  }
  const parsedRole = z.enum(roleValues).safeParse(role);
  const parsedEmail = z.string().email().safeParse(email.trim().toLowerCase());
  if (!parsedRole.success || !parsedEmail.success) throw new Error("Email ili uloga nisu validni");

  const userId = await findAuthUserIdByEmail(parsedEmail.data);
  const supabase = await createServerClient();
  throwIfError(
    await linkStaffToUser(
      supabase,
      org.organizationId,
      staffId,
      userId,
      parsedRole.data
    ),
    "Greška pri povezivanju naloga"
  );
  revalidatePath(`/people/${staffId}`);
  revalidatePath("/people");
  redirect(`/people/${staffId}`);
}
