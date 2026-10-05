import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("next/navigation", () => ({
  usePathname: () => "/sr/club/documents",
  unstable_rethrow: () => undefined,
}));

vi.mock("next-intl/server", async () => {
  const sr = (await import("../../../../../../../messages/sr.json"))
    .default as Record<string, unknown>;
  const lookup = (namespace: string, key: string): string => {
    const value = key.split(".").reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[part]
          : undefined,
      sr[namespace]
    );
    return typeof value === "string" ? value : `${namespace}.${key}`;
  };
  return {
    getTranslations: async (namespace: string) => (key: string) =>
      lookup(namespace, key),
  };
});

vi.mock("next-intl", async () => {
  const sr = (await import("../../../../../../../messages/sr.json"))
    .default as Record<string, unknown>;
  const lookup = (namespace: string, key: string): string => {
    const value = key.split(".").reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[part]
          : undefined,
      sr[namespace]
    );
    return typeof value === "string" ? value : `${namespace}.${key}`;
  };
  return {
    useTranslations: (namespace: string) => (key: string) =>
      lookup(namespace, key),
  };
});

vi.mock("@/lib/organization", () => ({
  requireOrganization: vi.fn(async () => ({
    organizationId: "org-1",
    userId: "user-1",
  })),
  hasPermission: vi.fn(async () => true),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({}) as never),
}));

vi.mock("@/lib/club-documents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/club-documents")>();
  return {
    ...actual,
    listClubDocuments: vi.fn(async () => [
      {
        id: "11111111-1111-1111-1111-111111111111",
        organization_id: "org-1",
        name: "Pristupnica",
        category: "form",
        notes: null,
        filename: "pristupnica.pdf",
        storage_path: "org-1/club/x-pristupnica.pdf",
        mime_type: "application/pdf",
        file_size: 1024,
        created_by: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]),
  };
});

vi.mock("../actions", () => ({
  createClubDocument: vi.fn(async () => ({ ok: true })),
  updateClubDocument: vi.fn(async () => ({ ok: true })),
  deleteClubDocument: vi.fn(async () => ({ ok: true })),
  getClubDocumentDownloadUrl: vi.fn(async () => ({
    url: "https://example.test/signed",
  })),
}));

import { deleteClubDocument } from "../actions";

afterEach(() => {
  cleanup();
  vi.mocked(deleteClubDocument).mockClear();
});

// Rendering the full async server page under the parallel suite needs more than
// the default 5s budget (same as the equipment/club page tests).
vi.setConfig({ testTimeout: 20000 });

async function renderPage() {
  const { default: ClubDocumentsPage } = await import("../page");
  render(
    <ToastProvider dismissLabel="Zatvori">
      {await ClubDocumentsPage({ params: Promise.resolve({ locale: "sr" }) })}
    </ToastProvider>
  );
}

describe("club documents delete", () => {
  it("requires confirmation before running the delete mutation", async () => {
    await renderPage();

    const trigger = screen.getByRole("button", { name: "Obriši" });
    expect(deleteClubDocument).not.toHaveBeenCalled();

    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    expect(deleteClubDocument).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Obriši" }));
    await waitFor(() => expect(deleteClubDocument).toHaveBeenCalledTimes(1));
  });
});
