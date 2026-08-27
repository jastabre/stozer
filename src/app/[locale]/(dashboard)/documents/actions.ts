"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasPermission, requireOrganization } from "@/lib/organization";
import {
  deleteStoredFile,
  buildStoragePath,
  getSignedUrl,
  DOCUMENT_BUCKET,
} from "@/lib/storage";
import { createServerClient } from "@/lib/supabase/server";

const documentTypes = [
  "registration",
  "contract",
  "medical",
  "insurance",
  "identity",
  "federation",
  "custom",
] as const;

const optionalDate = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
);

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(max).nullable().optional()
  );

const uploadSchema = z.object({
  owner_type: z.enum(["athlete", "staff"]),
  owner_id: z.string().uuid(),
  doc_type: z.enum(documentTypes),
  custom_type: optionalText(100),
  issued_at: optionalDate,
  expires_at: optionalDate,
  notes: optionalText(2000),
  redirect_path: z.string().optional(),
});

function safeRedirectPath(value: string | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return fallback;
  }
  return value;
}

async function ownerExists(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  organizationId: string,
  ownerType: "athlete" | "staff",
  ownerId: string
): Promise<boolean> {
  const table = ownerType === "athlete" ? "athletes" : "staff";
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", ownerId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return !error && Boolean(data);
}

export async function uploadDocument(formData: FormData) {
  const org = await requireOrganization();
  if (!(await hasPermission("documents.manage"))) {
    throw new Error("Nemate dozvolu za upravljanje dokumentima");
  }

  const parsed = uploadSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error("Nevalidni podaci dokumenta");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Izaberite dokument za otpremanje");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Dokument ne sme biti veći od 10 MB");
  }
  if (!(["application/pdf", "image/jpeg", "image/png"] as string[]).includes(file.type)) {
    throw new Error("Dozvoljeni su samo PDF, JPEG i PNG dokumenti");
  }
  if (parsed.data.doc_type === "custom" && !parsed.data.custom_type) {
    throw new Error("Unesite naziv prilagođenog tipa dokumenta");
  }
  if (
    parsed.data.issued_at &&
    parsed.data.expires_at &&
    parsed.data.expires_at < parsed.data.issued_at
  ) {
    throw new Error("Datum isteka ne može biti pre datuma izdavanja");
  }

  const supabase = await createServerClient();
  if (
    !(await ownerExists(
      supabase,
      org.organizationId,
      parsed.data.owner_type,
      parsed.data.owner_id
    ))
  ) {
    throw new Error("Vlasnik dokumenta nije pronađen u organizaciji");
  }

  const storagePath = buildStoragePath(
    org.organizationId,
    parsed.data.owner_type,
    parsed.data.owner_id,
    file.name
  );
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error("Greška pri otpremanju: " + uploadError.message);

  const { error: insertError } = await supabase.from("documents").insert({
    organization_id: org.organizationId,
    owner_type: parsed.data.owner_type,
    owner_id: parsed.data.owner_id,
    doc_type: parsed.data.doc_type,
    custom_type: parsed.data.doc_type === "custom" ? parsed.data.custom_type : null,
    filename: file.name,
    storage_path: storagePath,
    issued_at: parsed.data.issued_at ?? null,
    expires_at: parsed.data.expires_at ?? null,
    notes: parsed.data.notes ?? null,
    created_by: org.userId,
  });
  if (insertError) {
    await deleteStoredFile(supabase, org.organizationId, storagePath).catch(() => undefined);
    throw new Error("Greška pri čuvanju podataka dokumenta: " + insertError.message);
  }

  const destination = safeRedirectPath(
    parsed.data.redirect_path,
    parsed.data.owner_type === "staff" ? "/people" : "/documents"
  );
  revalidatePath(destination);
  revalidatePath("/documents");
  redirect(destination);
}

export async function getDocumentDownloadUrl(documentId: string) {
  const org = await requireOrganization();
  if (!(await hasPermission("documents.view"))) {
    throw new Error("Nemate dozvolu za pregled dokumenata");
  }
  const id = z.string().uuid().parse(documentId);
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (error || !data) throw new Error("Dokument nije pronađen");
  return { url: await getSignedUrl(supabase, org.organizationId, data.storage_path) };
}

export async function deleteDocument(formData: FormData) {
  const org = await requireOrganization();
  if (!(await hasPermission("documents.manage"))) {
    throw new Error("Nemate dozvolu za upravljanje dokumentima");
  }
  const documentId = z.string().uuid().safeParse(formData.get("document_id"));
  if (!documentId.success) throw new Error("Nedostaje dokument");
  const redirectPath = z.string().optional().parse(formData.get("redirect_path") ?? undefined);
  const supabase = await createServerClient();
  const { data: document, error: readError } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", documentId.data)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (readError || !document) throw new Error("Dokument nije pronađen");

  await deleteStoredFile(supabase, org.organizationId, document.storage_path);
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId.data)
    .eq("organization_id", org.organizationId);
  if (error) throw new Error("Greška pri brisanju dokumenta: " + error.message);

  const destination = safeRedirectPath(redirectPath, "/documents");
  revalidatePath(destination);
  revalidatePath("/documents");
  redirect(destination);
}
