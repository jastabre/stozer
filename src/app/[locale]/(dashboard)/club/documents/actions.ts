"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import {
  CLUB_DOCUMENT_CATEGORIES,
  clubDocumentMimeFor,
  type ClubDocumentCategory,
} from "@/lib/club-documents";
import {
  buildClubDocumentPath,
  deleteStoredFile,
  getSignedUrl,
  CLUB_DOCUMENT_MAX_BYTES,
  DOCUMENT_BUCKET,
} from "@/lib/storage";

export type ClubDocumentState = { ok?: true; error?: string } | null;

const categories = CLUB_DOCUMENT_CATEGORIES as [
  ClubDocumentCategory,
  ...ClubDocumentCategory[],
];

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(max).nullable().optional()
  );

const metadataSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.enum(categories),
  notes: optionalText(2000),
});

async function canManage(): Promise<boolean> {
  await requireOrganization();
  return hasPermission("documents.manage");
}

/** Upload a file plus its metadata into the club library. */
export async function createClubDocument(
  formData: FormData
): Promise<ClubDocumentState> {
  const org = await requireOrganization();
  if (!(await canManage())) {
    return { error: "Nemate dozvolu za upravljanje dokumentima" };
  }

  const parsed = metadataSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: "Nevalidni podaci dokumenta" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Izaberite dokument za otpremanje" };
  }
  if (file.size > CLUB_DOCUMENT_MAX_BYTES) {
    return { error: "Dokument ne sme biti veći od 10 MB" };
  }
  const contentType = clubDocumentMimeFor(file.name);
  if (!contentType) {
    return { error: "Dozvoljeni su PDF, DOC, DOCX, XLS i XLSX dokumenti" };
  }

  const supabase = await createServerClient();
  const storagePath = buildClubDocumentPath(org.organizationId, file.name);
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, file, { contentType, upsert: false });
  if (uploadError) {
    return { error: "Greška pri otpremanju: " + uploadError.message };
  }

  const { error: insertError } = await supabase.from("club_documents").insert({
    organization_id: org.organizationId,
    name: parsed.data.name,
    category: parsed.data.category,
    notes: parsed.data.notes ?? null,
    filename: file.name,
    storage_path: storagePath,
    mime_type: contentType,
    file_size: file.size,
    created_by: org.userId,
  });
  if (insertError) {
    // No dangling metadata row: remove the object we just uploaded.
    await deleteStoredFile(supabase, org.organizationId, storagePath).catch(
      () => undefined
    );
    return { error: "Greška pri čuvanju dokumenta: " + insertError.message };
  }

  revalidatePath("/club/documents");
  return { ok: true };
}

/** Edit a library item's metadata. The uploaded file never changes. */
export async function updateClubDocument(
  formData: FormData
): Promise<ClubDocumentState> {
  const org = await requireOrganization();
  if (!(await canManage())) {
    return { error: "Nemate dozvolu za upravljanje dokumentima" };
  }

  const documentId = z.string().uuid().safeParse(formData.get("document_id"));
  if (!documentId.success) return { error: "Nedostaje dokument" };

  const parsed = metadataSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: "Nevalidni podaci dokumenta" };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("club_documents")
    .update({
      name: parsed.data.name,
      category: parsed.data.category,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", documentId.data)
    .eq("organization_id", org.organizationId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Dokument nije pronađen" };

  revalidatePath("/club/documents");
  return { ok: true };
}

/** Delete a library item: DB row first, then the storage object (best effort). */
export async function deleteClubDocument(
  formData: FormData
): Promise<ClubDocumentState> {
  const org = await requireOrganization();
  if (!(await canManage())) {
    return { error: "Nemate dozvolu za upravljanje dokumentima" };
  }

  const documentId = z.string().uuid().safeParse(formData.get("document_id"));
  if (!documentId.success) return { error: "Nedostaje dokument" };

  const supabase = await createServerClient();
  const { data: document, error: readError } = await supabase
    .from("club_documents")
    .select("storage_path")
    .eq("id", documentId.data)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (readError || !document) return { error: "Dokument nije pronađen" };

  // Delete the row FIRST: a failed row delete leaves the document fully usable;
  // a failed object delete afterwards only leaves an orphaned storage object.
  const { error } = await supabase
    .from("club_documents")
    .delete()
    .eq("id", documentId.data)
    .eq("organization_id", org.organizationId);
  if (error) return { error: "Greška pri brisanju dokumenta: " + error.message };

  await deleteStoredFile(supabase, org.organizationId, document.storage_path).catch(
    () => {
      console.warn(
        `Orphaned storage object after club document delete: ${document.storage_path}`
      );
    }
  );

  revalidatePath("/club/documents");
  return { ok: true };
}

/** Time-limited signed URL for a library item. */
export async function getClubDocumentDownloadUrl(
  documentId: string
): Promise<{ url: string }> {
  const org = await requireOrganization();
  if (!(await hasPermission("documents.view"))) {
    throw new Error("Nemate dozvolu za pregled dokumenata");
  }
  const id = z.string().uuid().parse(documentId);
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("club_documents")
    .select("storage_path")
    .eq("id", id)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (error || !data) throw new Error("Dokument nije pronađen");
  return { url: await getSignedUrl(supabase, org.organizationId, data.storage_path) };
}
