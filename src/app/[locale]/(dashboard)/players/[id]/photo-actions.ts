"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import {
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  buildAvatarPath,
  deleteAvatarFile,
} from "@/lib/storage";

export type PhotoActionState = { ok?: boolean; error?: string };

/**
 * Player photo upload. The athlete id comes from the client but is only ever
 * used to scope a query that ALSO filters by the server-derived organization id
 * — the photo can never be written to another org's athlete. MIME, size and the
 * storage path are validated server-side; the private club-avatars bucket is the
 * real cross-org backstop (RLS, migration 00042).
 *
 * Ordering: upload the new object first, then point athletes.photo_url at it,
 * then best-effort remove the previous object. If the DB update fails the new
 * object is removed, so no broken avatar state is left behind.
 */
export async function uploadAthletePhoto(formData: FormData): Promise<PhotoActionState> {
  const org = await requireOrganization();
  if (!(await hasPermission("athletes.edit"))) {
    return { error: "Nemate dozvolu za izmenu igrača" };
  }

  const athleteId = z.string().uuid().safeParse(formData.get("athlete_id"));
  if (!athleteId.success) return { error: "Nedostaje igrač" };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Izaberite fotografiju" };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { error: "Fotografija ne sme biti veća od 5 MB" };
  }
  if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { error: "Dozvoljeni su JPG, PNG i WebP" };
  }

  const supabase = await createServerClient();
  const { data: athlete } = await supabase
    .from("athletes")
    .select("id, photo_url")
    .eq("id", athleteId.data)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!athlete) return { error: "Igrač nije pronađen u organizaciji" };

  const path = buildAvatarPath(org.organizationId, athleteId.data, file.name);
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { error: "Greška pri otpremanju fotografije" };

  const { error: updateError } = await supabase
    .from("athletes")
    .update({ photo_url: path })
    .eq("id", athleteId.data)
    .eq("organization_id", org.organizationId);
  if (updateError) {
    // Compensate: the new object is not referenced by any row.
    await deleteAvatarFile(supabase, org.organizationId, path).catch(() => undefined);
    return { error: "Greška pri čuvanju fotografije" };
  }

  // New photo is safely persisted — now drop the previous object (best effort).
  const previous = athlete.photo_url;
  if (previous && previous !== path) {
    await deleteAvatarFile(supabase, org.organizationId, previous).catch(() => undefined);
  }

  revalidatePath(`/players/${athleteId.data}`, "layout");
  return { ok: true };
}

/** Remove the player photo (photo_url -> null, initials return), best-effort file delete. */
export async function removeAthletePhoto(formData: FormData): Promise<PhotoActionState> {
  const org = await requireOrganization();
  if (!(await hasPermission("athletes.edit"))) {
    return { error: "Nemate dozvolu za izmenu igrača" };
  }

  const athleteId = z.string().uuid().safeParse(formData.get("athlete_id"));
  if (!athleteId.success) return { error: "Nedostaje igrač" };

  const supabase = await createServerClient();
  const { data: athlete } = await supabase
    .from("athletes")
    .select("id, photo_url")
    .eq("id", athleteId.data)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!athlete) return { error: "Igrač nije pronađen u organizaciji" };

  const { error } = await supabase
    .from("athletes")
    .update({ photo_url: null })
    .eq("id", athleteId.data)
    .eq("organization_id", org.organizationId);
  if (error) return { error: "Greška pri uklanjanju fotografije" };

  if (athlete.photo_url) {
    await deleteAvatarFile(supabase, org.organizationId, athlete.photo_url).catch(
      () => undefined
    );
  }

  revalidatePath(`/players/${athleteId.data}`, "layout");
  return { ok: true };
}
