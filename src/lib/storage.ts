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

/** Create a private, time-limited URL. Never use getPublicUrl for this bucket. */
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
