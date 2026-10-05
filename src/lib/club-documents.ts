import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type ClubDocumentCategory =
  Database["public"]["Enums"]["club_document_category"];

/**
 * The small, fixed set of categories the club library offers. Deliberately not
 * a user-managed taxonomy — no folders, no nesting.
 */
export const CLUB_DOCUMENT_CATEGORIES: ClubDocumentCategory[] = [
  "form",
  "memorandum",
  "regulation",
  "contract",
  "other",
];

export function isClubDocumentCategory(
  value: unknown
): value is ClubDocumentCategory {
  return (
    typeof value === "string" &&
    (CLUB_DOCUMENT_CATEGORIES as string[]).includes(value)
  );
}

export interface ClubDocumentEntry {
  id: string;
  organization_id: string;
  name: string;
  category: ClubDocumentCategory;
  notes: string | null;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Editable metadata of a library item (the file itself is never replaced). */
export interface ClubDocumentInput {
  name: string;
  category: ClubDocumentCategory;
  notes: string | null;
}

/**
 * The business formats the library accepts, keyed by extension. The extension
 * is the source of truth: it drives validation, the picker's accept list and
 * the content type sent to Storage (which enforces the same allow-list).
 */
const CLUB_DOCUMENT_EXTENSION_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const CLUB_DOCUMENT_ALLOWED_EXTENSIONS = Object.keys(
  CLUB_DOCUMENT_EXTENSION_MIME
);

export const CLUB_DOCUMENT_MIME_TYPES = Object.values(
  CLUB_DOCUMENT_EXTENSION_MIME
);

export const CLUB_DOCUMENT_MIME_ACCEPT = CLUB_DOCUMENT_MIME_TYPES.join(",");

function filenameExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0 || dot === filename.length - 1) return "";
  return filename.slice(dot + 1).toLowerCase();
}

/** Content type for an accepted filename, or null when the format is unsupported. */
export function clubDocumentMimeFor(filename: string): string | null {
  return CLUB_DOCUMENT_EXTENSION_MIME[filenameExtension(filename)] ?? null;
}

/** Uppercase extension for the "file type" column (PDF, DOCX, …). */
export function clubDocumentFileType(filename: string): string {
  const extension = filenameExtension(filename);
  return extension ? extension.toUpperCase() : "—";
}

export async function listClubDocuments(
  supabase: Supabase,
  orgId: string
): Promise<ClubDocumentEntry[]> {
  const { data, error } = await supabase
    .from("club_documents")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data as ClubDocumentEntry[]) ?? [];
}
