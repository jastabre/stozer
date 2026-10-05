import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;
export type StorageOwnerType = "athlete" | "staff";

export const DOCUMENT_BUCKET = "club-documents";
export const SIGNED_URL_EXPIRES_IN = 604800;

const CONTROL_OR_SEPARATOR = /[\\/\u0000-\u001f\u007f]/g;

/** Keep the original filename recognizable without allowing path traversal. */
export function sanitizeFilename(filename: string): string {
  const sanitized = filename
    .replace(CONTROL_OR_SEPARATOR, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return sanitized || "document";
}

/**
 * All private document objects are rooted at the organization id. This exact
 * shape is also the storage.objects RLS boundary in migration 00007.
 */
export function buildStoragePath(
  organizationId: string,
  ownerType: StorageOwnerType,
  ownerId: string,
  filename: string
): string {
  const folder = ownerType === "athlete" ? "athletes" : "staff";
  return `${organizationId}/${folder}/${ownerId}/${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
}

function assertOrganizationPath(organizationId: string, storagePath: string): void {
  if (!storagePath.startsWith(`${organizationId}/`)) {
    throw new Error("Dokument ne pripada izabranoj organizaciji");
  }
}

/** Create a private, time-limited URL for the private document bucket. */
export async function getSignedUrl(
  supabase: Supabase,
  organizationId: string,
  storagePath: string
): Promise<string> {
  assertOrganizationPath(organizationId, storagePath);
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Nije moguće napraviti link za preuzimanje");
  }
  return data.signedUrl;
}

export async function deleteStoredFile(
  supabase: Supabase,
  organizationId: string,
  storagePath: string
): Promise<void> {
  assertOrganizationPath(organizationId, storagePath);
  const { error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .remove([storagePath]);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Club library ("Dokumenti kluba"). A club file belongs to the organization,
// not a person. Same private bucket as person documents, different folder.
// Path convention (mirrors the club-documents storage RLS boundary in 00043):
//   {organization_id}/club/{uuid}-{filename}
// ---------------------------------------------------------------------------

export const CLUB_LIBRARY_FOLDER = "club";
export const CLUB_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export function buildClubDocumentPath(
  organizationId: string,
  filename: string
): string {
  return `${organizationId}/${CLUB_LIBRARY_FOLDER}/${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
}

// ---------------------------------------------------------------------------
// Athlete photo (avatar). A separate private bucket — a photo is NOT a document.
// Path convention (mirrors the club-avatars RLS boundary in migration 00042):
//   {organization_id}/athletes/{athlete_id}/{uuid}-{filename}
// ---------------------------------------------------------------------------

export const AVATAR_BUCKET = "club-avatars";
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const AVATAR_MIME_ACCEPT = AVATAR_MIME_TYPES.join(",");

export function buildAvatarPath(
  organizationId: string,
  athleteId: string,
  filename: string
): string {
  return `${organizationId}/athletes/${athleteId}/${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
}

/** Create a private, time-limited URL for an athlete photo object. */
export async function getAvatarSignedUrl(
  supabase: Supabase,
  organizationId: string,
  storagePath: string
): Promise<string> {
  assertOrganizationPath(organizationId, storagePath);
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Nije moguće napraviti link za fotografiju");
  }
  return data.signedUrl;
}

export async function deleteAvatarFile(
  supabase: Supabase,
  organizationId: string,
  storagePath: string
): Promise<void> {
  assertOrganizationPath(organizationId, storagePath);
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([storagePath]);
  if (error) throw new Error(error.message);
}
