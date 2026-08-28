import { describe, expect, it } from "vitest";
import {
  buildStoragePath,
  sanitizeFilename,
  DOCUMENT_BUCKET,
  SIGNED_URL_EXPIRES_IN,
  type StorageOwnerType,
} from "@/lib/storage";

const UUID_SOURCE =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID = new RegExp(`^${UUID_SOURCE}$`);

describe("sanitizeFilename (REG-06)", () => {
  it("strips path separators (forward and back slash) so traversal cannot escape the folder", () => {
    expect(sanitizeFilename("..\\..\\secret.txt")).toBe("....secret.txt");
    expect(sanitizeFilename("/etc/passwd")).toBe("etcpasswd");
    expect(sanitizeFilename("a/b\\c")).toBe("abc");
  });

  it("strips control characters (NUL, unit separator, DEL)", () => {
    expect(sanitizeFilename("a\u0000b\u001fc\u007fd")).toBe("abcd");
  });

  it("collapses whitespace runs and trims leading/trailing whitespace", () => {
    expect(sanitizeFilename("  match   kit   2026  ")).toBe("match kit 2026");
  });

  it("truncates to 180 characters", () => {
    expect(sanitizeFilename("x".repeat(300))).toHaveLength(180);
  });

  it("falls back to 'document' for empty or whitespace-only input", () => {
    expect(sanitizeFilename("")).toBe("document");
    expect(sanitizeFilename("    ")).toBe("document");
    expect(sanitizeFilename("\u0000\u001f")).toBe("document");
  });
});

describe("buildStoragePath (REG-06)", () => {
  const org = "org-abc";
  const owner = "owner-xyz";

  it("roots the path at the organization id (storage RLS foldername(name)[1] boundary)", () => {
    const path = buildStoragePath(org, "athlete", owner, "cv.pdf");
    expect(path.split("/")[0]).toBe(org);
  });

  it("uses the athletes/ folder for athlete owners and staff/ for staff owners", () => {
    expect(buildStoragePath(org, "athlete", owner, "cv.pdf")).toMatch(
      new RegExp(`^${org}/athletes/${owner}/`)
    );
    expect(buildStoragePath(org, "staff", owner, "cv.pdf")).toMatch(
      new RegExp(`^${org}/staff/${owner}/`)
    );
  });

  it("matches the {orgId}/athletes|staff/{ownerId}/{uuid}-{sanitized} convention", () => {
    const path = buildStoragePath(org, "athlete", owner, "  scan / ID.pdf ");
    const segments = path.split("/");
    expect(segments).toHaveLength(4);
    expect(segments[0]).toBe(org);
    expect(segments[1]).toBe("athletes");
    expect(segments[2]).toBe(owner);
    const objectName = segments[3];
    expect(objectName.slice(0, 36)).toMatch(UUID);
    expect(objectName[36]).toBe("-");
    expect(objectName.slice(37)).toBe("scan ID.pdf");
  });

  it("sanitizes the filename inside the object name so no separator survives into the path", () => {
    const path = buildStoragePath(org, "staff", owner, "../evil\\file.txt");
    expect(path.split("/")).toHaveLength(4);
    expect(path).not.toContain("\\");
    expect(path.split("/")[3]).toMatch(
      new RegExp(`^${UUID_SOURCE}-\.\.evilfile\.txt$`)
    );
  });

  it("matches the private bucket and signed-URL cap documented in migration 00007", () => {
    expect(DOCUMENT_BUCKET).toBe("club-documents");
    expect(SIGNED_URL_EXPIRES_IN).toBe(604800);
    expect(SIGNED_URL_EXPIRES_IN).toBeLessThanOrEqual(604800);
  });
});