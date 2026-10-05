"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganization, requirePermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import {
  addOrgAccount,
  isClubPresident,
  resendAccountInvite,
  setAccountDisabled,
  updateUserAccess,
} from "@/lib/club-users";
import { ACCESS_ROLES } from "@/lib/roles";
import type { AppRole } from "@/types/database";

const roleValues = ACCESS_ROLES as [AppRole, ...AppRole[]];

export type ClubAccountState = {
  error?: string;
  ok?: boolean;
  invited?: boolean;
} | null;

const accessSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(roleValues),
  season_id: z.string().uuid().nullable().optional(),
});

async function requestOrigin(): Promise<string | undefined> {
  const headerList = await headers();
  const host = headerList.get("host");
  if (!host) return undefined;
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/**
 * Change a member's application role and team scope from the
 * Club → Users & access area. Guarded by users.manage (00034 split this out
 * of club_settings.manage so finance can no longer administer accounts).
 */
export async function updateUserAccessAction(
  _prev: ClubAccountState,
  formData: FormData
): Promise<ClubAccountState> {
  const org = await requireOrganization();
  await requirePermission("users.manage");

  const teamIds = formData
    .getAll("team_id")
    .filter((value): value is string => typeof value === "string");

  const seasonRaw = formData.get("season_id");
  const parsed = accessSchema.safeParse({
    user_id: formData.get("user_id"),
    role: formData.get("role"),
    season_id: typeof seasonRaw === "string" && seasonRaw !== "" ? seasonRaw : null,
  });
  if (!parsed.success) return { error: "Nevalidan unos pristupa" };

  const result = await updateUserAccess(org.organizationId, org.userId, {
    userId: parsed.data.user_id,
    role: parsed.data.role,
    teamIds,
    seasonId: parsed.data.season_id ?? null,
  });
  if ("error" in result) return { error: result.error };

  revalidatePath("/club/users");
  revalidatePath("/people");
  revalidatePath("/people/[id]", "layout");
  return { ok: true };
}

/**
 * Add a Stožer account from the central Users & access screen: pick a staff
 * person without an account, then link or invite by email.
 */
export async function addUserAction(
  _prev: ClubAccountState,
  formData: FormData
): Promise<ClubAccountState> {
  const org = await requireOrganization();
  await requirePermission("users.manage");
  if (!(await isClubPresident(org.organizationId, org.userId))) {
    return { error: "Samo predsednik kluba može da dodaje Stožer naloge." };
  }

  const staffId = formData.get("staff_id");
  const role = formData.get("role");
  if (typeof staffId !== "string" || typeof role !== "string") {
    return { error: "Izaberite osobu i Stožer ulogu." };
  }
  const parsedRole = z.enum(roleValues).safeParse(role);
  const parsedEmail = z
    .string()
    .trim()
    .email()
    .max(255)
    .safeParse(formData.get("email"));
  if (!parsedRole.success || !parsedEmail.success) {
    return { error: "Unesite ispravnu email adresu i izaberite ulogu." };
  }

  const teamIds = formData
    .getAll("team_id")
    .filter((value): value is string => typeof value === "string");
  const seasonRaw = formData.get("season_id");
  const seasonId = typeof seasonRaw === "string" && seasonRaw ? seasonRaw : null;

  const origin = await requestOrigin();
  const result = await addOrgAccount(org.organizationId, {
    staffId,
    email: parsedEmail.data.toLowerCase(),
    role: parsedRole.data,
    teamIds,
    seasonId,
    redirectTo: origin ? `${origin}/verify` : undefined,
  });
  if ("error" in result) return { error: result.error };

  revalidatePath("/club/users");
  revalidatePath("/people");
  revalidatePath("/people/[id]", "layout");
  return { ok: true, invited: result.status === "invited" };
}

/** Resend the invitation email for a user who has not activated yet. */
export async function resendInviteAction(
  _prev: ClubAccountState,
  formData: FormData
): Promise<ClubAccountState> {
  const org = await requireOrganization();
  await requirePermission("users.manage");

  const userId = z.string().uuid().safeParse(formData.get("user_id"));
  if (!userId.success) return { error: "Nedostaje korisnik." };

  const origin = await requestOrigin();
  const result = await resendAccountInvite(
    org.organizationId,
    userId.data,
    origin ? `${origin}/verify` : undefined
  );
  if ("error" in result) return { error: result.error };

  revalidatePath("/club/users");
  return { ok: true };
}

/** Deactivate / reactivate a user account (reversible ban, keeps all data). */
export async function setAccountDisabledAction(
  _prev: ClubAccountState,
  formData: FormData
): Promise<ClubAccountState> {
  const org = await requireOrganization();
  await requirePermission("users.manage");

  const userId = z.string().uuid().safeParse(formData.get("user_id"));
  if (!userId.success) return { error: "Nedostaje korisnik." };

  const disable = formData.get("disabled") === "on";
  const result = await setAccountDisabled(
    org.organizationId,
    org.userId,
    userId.data,
    disable
  );
  if ("error" in result) return { error: result.error };

  revalidatePath("/club/users");
  revalidatePath("/people");
  revalidatePath("/people/[id]", "layout");
  return { ok: true };
}

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .optional();

/** Save club branding: logo URL and the single accent color. */
export async function saveBrandingAction(formData: FormData) {
  const org = await requireOrganization();
  await requirePermission("club_settings.manage");

  const primary = z.string().trim().optional().parse(formData.get("primary_color") || "");
  const logo = z.string().trim().optional().parse(formData.get("logo_url") || "");

  const parsedPrimary = primary ? hexColor.parse(primary) : undefined;

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      primary_color: parsedPrimary ?? null,
      logo_url: logo || null,
    })
    .eq("id", org.organizationId);
  if (error) throw new Error("Greška pri čuvanju brendiranja: " + error.message);

  revalidatePath("/", "layout");
  revalidatePath("/club");
}

const LOGO_BUCKET = "club-logos";
const LOGO_SIZE_LIMIT = 2 * 1024 * 1024;
const LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];

function logoPublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("Nedostaje konfiguracija aplikacije");
  return `${base}/storage/v1/object/public/${LOGO_BUCKET}/${path}`;
}

/** Upload the club logo to the club-logos bucket and store its public URL. */
export async function uploadLogoAction(formData: FormData) {
  const org = await requireOrganization();
  await requirePermission("club_settings.manage");

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Izaberite fajl loga");
  }
  if (file.size > LOGO_SIZE_LIMIT) {
    throw new Error("Logo ne sme biti veći od 2 MB");
  }
  if (!LOGO_MIME_TYPES.includes(file.type)) {
    throw new Error("Dozvoljeni su PNG, JPEG i SVG logo");
  }
  const ext = file.type === "image/svg+xml" ? "svg" : file.type === "image/png" ? "png" : "jpg";
  const path = `${org.organizationId}/logo-${crypto.randomUUID()}.${ext}`;

  const supabase = await createServerClient();
  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    throw new Error("Greška pri otpremanju loga: " + uploadError.message);
  }

  const url = logoPublicUrl(path);
  const { error: updateError } = await supabase
    .from("organizations")
    .update({ logo_url: url })
    .eq("id", org.organizationId);
  if (updateError) {
    await supabase.storage.from(LOGO_BUCKET).remove([path]).catch(() => undefined);
    throw new Error("Greška pri čuvanju loga: " + updateError.message);
  }

  revalidatePath("/", "layout");
  revalidatePath("/club");
}

/** Remove the club logo (organization logo_url -> null, best-effort file delete). */
export async function removeLogoAction() {
  const org = await requireOrganization();
  await requirePermission("club_settings.manage");

  const supabase = await createServerClient();
  const { data: current } = await supabase
    .from("organizations")
    .select("logo_url")
    .eq("id", org.organizationId)
    .maybeSingle();

  const { error } = await supabase
    .from("organizations")
    .update({ logo_url: null })
    .eq("id", org.organizationId);
  if (error) throw new Error("Greška pri uklanjanju loga: " + error.message);

  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${LOGO_BUCKET}/`;
  if (current?.logo_url?.startsWith(prefix)) {
    const path = current.logo_url.slice(prefix.length);
    await supabase.storage.from(LOGO_BUCKET).remove([path]).catch(() => undefined);
  }

  revalidatePath("/", "layout");
  revalidatePath("/club");
}