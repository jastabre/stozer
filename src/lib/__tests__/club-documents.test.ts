import { describe, expect, it } from "vitest";
import {
  CLUB_DOCUMENT_ALLOWED_EXTENSIONS,
  CLUB_DOCUMENT_CATEGORIES,
  clubDocumentFileType,
  clubDocumentMimeFor,
  isClubDocumentCategory,
} from "@/lib/club-documents";

describe("club document formats", () => {
  it("accepts the required business formats by extension", () => {
    expect([...CLUB_DOCUMENT_ALLOWED_EXTENSIONS].sort()).toEqual([
      "doc",
      "docx",
      "pdf",
      "xls",
      "xlsx",
    ]);
    expect(clubDocumentMimeFor("formular.pdf")).toBe("application/pdf");
    expect(clubDocumentMimeFor("PRISTUPNICA.DOCX")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(clubDocumentMimeFor("ugovor.doc")).toBe("application/msword");
    expect(clubDocumentMimeFor("obrazac.xls")).toBe("application/vnd.ms-excel");
    expect(clubDocumentMimeFor("spisak.xlsx")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  it("rejects unsupported formats", () => {
    expect(clubDocumentMimeFor("photo.png")).toBeNull();
    expect(clubDocumentMimeFor("archive.zip")).toBeNull();
    expect(clubDocumentMimeFor("bez-ekstenzije")).toBeNull();
  });

  it("labels the file type for the table", () => {
    expect(clubDocumentFileType("pravilnik.PDF")).toBe("PDF");
    expect(clubDocumentFileType("spisak.xlsx")).toBe("XLSX");
    expect(clubDocumentFileType("bez-ekstenzije")).toBe("—");
  });

  it("knows the fixed category set", () => {
    expect(CLUB_DOCUMENT_CATEGORIES).toEqual([
      "form",
      "memorandum",
      "regulation",
      "contract",
      "other",
    ]);
    expect(isClubDocumentCategory("memorandum")).toBe(true);
    expect(isClubDocumentCategory("random")).toBe(false);
  });
});
