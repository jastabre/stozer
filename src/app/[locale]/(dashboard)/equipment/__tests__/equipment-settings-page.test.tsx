import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("next-intl/server", async () => {
  const sr = (await import("../../../../../../messages/sr.json")).default as Record<
    string,
    unknown
  >;
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
  const sr = (await import("../../../../../../messages/sr.json")).default as Record<
    string,
    unknown
  >;
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
    useTranslations: (namespace: string) => (key: string) => lookup(namespace, key),
  };
});

vi.mock("@/lib/organization", () => ({
  requirePermission: vi.fn(async () => undefined),
  requireOrganization: vi.fn(async () => ({
    organizationId: "org-1",
    userId: "user-1",
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({})),
}));

vi.mock("@/lib/club-data", () => ({
  listTeams: vi.fn(async () => [
    { id: "team-a", name: "Prvi tim", category: "first_team" },
    { id: "team-b", name: "Kadeti", category: "youth" },
  ]),
}));

vi.mock("@/lib/equipment", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/equipment")>();
  return {
    ...actual,
    listEquipmentItems: vi.fn(),
    listEquipmentTypes: vi.fn(),
    listTeamEquipmentRequirements: vi.fn(),
  };
});

vi.mock("../actions", () => ({
  createEquipmentItemAction: vi.fn(),
  deleteEquipmentItemAction: vi.fn(),
  saveTeamRequirementsAction: vi.fn(),
  updateEquipmentItemAction: vi.fn(),
}));

import {
  listEquipmentItems,
  listEquipmentTypes,
  listTeamEquipmentRequirements,
} from "@/lib/equipment";

afterEach(cleanup);

const TYPES = [
  { id: "t1", organization_id: "org-1", name: "Match Shirt", size_model: "single", enabled: true, is_club_property: true, sort_order: 1, created_at: "", updated_at: "" },
  { id: "t2", organization_id: "org-1", name: "Match Shorts", size_model: "single", enabled: true, is_club_property: true, sort_order: 2, created_at: "", updated_at: "" },
  // Legacy default disabled by migration 00018 — must stay hidden.
  { id: "t0", organization_id: "org-1", name: "Match Kit", size_model: "upper_lower", enabled: false, is_club_property: true, sort_order: 0, created_at: "", updated_at: "" },
];

const ITEMS = [
  { id: "i1", organization_id: "org-1", name: "Domaći dres", size_mode: "split", has_number: false, sort_order: 1, created_at: "", updated_at: "" },
];

async function renderSettings(tab?: string) {
  vi.mocked(listEquipmentItems).mockResolvedValue(ITEMS as never);
  vi.mocked(listEquipmentTypes).mockResolvedValue(TYPES as never);
  vi.mocked(listTeamEquipmentRequirements).mockResolvedValue([
    { id: "r1", team_id: "team-a", item_id: "i1" },
  ] as never);
  const { default: EquipmentSettingsPage } = await import("../settings/page");
  render(
    <ToastProvider dismissLabel="Zatvori">
      {await EquipmentSettingsPage({
        params: Promise.resolve({ locale: "sr" }),
        searchParams: Promise.resolve(tab ? { tab } : {}),
      })}
    </ToastProvider>
  );
}

describe("Equipment settings tabs", () => {
  it("defaults to the Articles tab and renders only that section", async () => {
    await renderSettings();

    expect(screen.getByRole("heading", { name: "Artikli" })).toBeInTheDocument();
    expect(
      screen.getByText("Artikli i obavezna oprema po timu.")
    ).toBeInTheDocument();
    expect(screen.getByText("Domaći dres")).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Delovi i veličine" })
    ).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Obavezna oprema po timu" })
    ).toBeNull();
    expect(screen.getByRole("tab", { name: "Artikli" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("offers article create + edit and no internal piece administration", async () => {
    await renderSettings();

    expect(
      screen.getByRole("button", { name: "Dodaj opremu" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Izmeni" })).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Delovi i veličine" })
    ).toBeNull();
  });

  it("lets article creation choose the size mode and numbering", async () => {
    await renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Dodaj opremu" }));

    expect(screen.getByRole("radio", { name: "Bez veličine" })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Jedna veličina" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Gornji + donji deo" })
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Broj na opremi")
    ).toBeInTheDocument();
    expect(screen.queryByText("Dodatna veličina")).toBeNull();
    expect(screen.queryByText("Koristi veličinu sa profila")).toBeNull();
  });

  it("infers the existing size mode when editing an article", async () => {
    await renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Izmeni" }));

    expect(
      screen.getByRole("radio", { name: "Gornji + donji deo" })
    ).toBeChecked();
  });

  it("renders only required equipment for tab=requirements and keeps the tab in team links", async () => {
    await renderSettings("requirements");

    expect(
      screen.getByRole("heading", { name: "Obavezna oprema po timu" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Artikli" })).toBeNull();
    expect(
      screen.getByRole("tab", { name: "Obavezna oprema" })
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("button", { name: "Sačuvaj obaveznu opremu" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Kadeti" })
    ).toHaveAttribute(
      "href",
      "/sr/equipment/settings?tab=requirements&team=team-b"
    );
  });
});
