import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
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
  return { useTranslations: (namespace: string) => (key: string) => lookup(namespace, key) };
});

vi.mock("@/lib/organization", () => ({
  requireOrganization: vi.fn(async () => ({
    organizationId: "org-1",
    userId: "user-1",
  })),
  hasPermission: vi.fn(async () => true),
}));

const supabase = {
  from: vi.fn(() => ({
    select: () => ({
      eq: () => ({
        order: async () => ({ data: [] }),
        in: async () => ({ data: [] }),
      }),
    }),
  })),
};
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => supabase),
}));

vi.mock("@/lib/club-data", () => ({
  listTeams: vi.fn(async () => [
    { id: "team-a", name: "Prvi tim", category: "first_team" },
    { id: "team-b", name: "Kadeti", category: "youth" },
  ]),
  getActiveSeason: vi.fn(async () => ({ id: "season-1", name: "2025/26" })),
}));

vi.mock("@/lib/equipment", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/equipment")>();
  return {
    ...actual,
    getPlayerEquipmentByTeam: vi.fn(),
    listEquipmentItems: vi.fn(),
    listEquipmentTypes: vi.fn(),
    listTeamEquipment: vi.fn(async () => []),
    listEquipmentRequests: vi.fn(async () => []),
    listTeamEquipmentRequirements: vi.fn(),
  };
});

vi.mock("../actions", () => ({
  createEquipmentItemAction: vi.fn(),
  createEquipmentRequestAction: vi.fn(),
  createTeamEquipmentAction: vi.fn(),
  decideEquipmentRequestAction: vi.fn(),
  deleteEquipmentItemAction: vi.fn(),
  deleteItemAssignmentAction: vi.fn(),
  deleteTeamEquipmentAction: vi.fn(),
  issueItemAction: vi.fn(),
  savePlayerSizesAction: vi.fn(),
  saveTeamRequirementsAction: vi.fn(),
  toggleEquipmentTypeAction: vi.fn(),
  transitionItemAction: vi.fn(),
  updateTeamEquipmentAction: vi.fn(),
}));

import {
  getPlayerEquipmentByTeam,
  listEquipmentItems,
  listEquipmentTypes,
  listTeamEquipmentRequirements,
} from "@/lib/equipment";
import { getActiveSeason, listTeams } from "@/lib/club-data";

// The page renders the full operational screen (table + drawers + client
// components); under the parallel full-suite run it needs more than the
// default 5s budget.
vi.setConfig({ testTimeout: 20000 });

afterEach(cleanup);

const TYPES = [
  { id: "t1", organization_id: "org-1", name: "Match Shirt", size_model: "single", enabled: true, is_club_property: true, sort_order: 1, created_at: "", updated_at: "" },
  { id: "t2", organization_id: "org-1", name: "Match Shorts", size_model: "single", enabled: true, is_club_property: true, sort_order: 2, created_at: "", updated_at: "" },
];

const ITEMS = [
  { id: "i1", organization_id: "org-1", name: "Domaći dres", size_mode: "split", has_number: true, sort_order: 1, created_at: "", updated_at: "" },
  { id: "i2", organization_id: "org-1", name: "Trening majica", size_mode: "single", has_number: false, sort_order: 2, created_at: "", updated_at: "" },
];

function playerRow(assignmentState: string) {
  return {
    athlete_id: "a1",
    first_name: "Marko",
    last_name: "Krasić",
    club_athlete_number: 12,
    jersey_number: 10,
    jersey_name: null,
    assignments: [
      {
        item: ITEMS[1],
        assignment: {
          id: "a1-i2",
          organization_id: "org-1",
          athlete_id: "a1",
          item_id: "i2",
          state: assignmentState,
          size_top: "L",
          size_bottom: null,
          number: null,
          issued_at: "2026-01-01T00:00:00Z",
          returned_at: null,
          note: null,
          created_at: "",
          updated_at: "",
        },
      },
      { item: ITEMS[0], assignment: null },
    ],
    issuedCount: assignmentState === "issued" ? 1 : 0,
    missingCount: assignmentState === "issued" ? 1 : 2,
    lostDamagedCount: 0,
  };
}

async function renderPage(team: string) {
  vi.mocked(listTeams).mockResolvedValue([
    { id: "team-a", name: "Prvi tim", category: "first_team" },
    { id: "team-b", name: "Kadeti", category: "youth" },
  ] as never);
  vi.mocked(getActiveSeason).mockResolvedValue({ id: "season-1", name: "2025/26" } as never);
  vi.mocked(listEquipmentItems).mockResolvedValue(ITEMS as never);
  vi.mocked(listEquipmentTypes).mockResolvedValue(TYPES as never);
  void team;
  vi.mocked(getPlayerEquipmentByTeam).mockImplementation(async (_s, _o, teamId) =>
    teamId === "team-a" ? ([playerRow("issued")] as never) : ([] as never)
  );
  const { default: EquipmentPage } = await import("../page");
  render(
    <ToastProvider dismissLabel="Zatvori">
      {await EquipmentPage({
        params: Promise.resolve({ locale: "sr" }),
        searchParams: Promise.resolve({ tab: "players", team }),
      })}
    </ToastProvider>
  );
}

describe("Equipment players tab", () => {
  it("switches the roster immediately with the selected team", async () => {
    vi.mocked(listTeamEquipmentRequirements).mockResolvedValue([] as never);
    await renderPage("team-a");
    expect(screen.getAllByText("Krasić Marko").length).toBeGreaterThan(0);
    // The team selector is a labelled, softer filter below the main tabs.
    expect(screen.getAllByText("Tim").length).toBeGreaterThan(0);
    const activeTeam = screen.getByRole("link", { name: "Prvi tim" });
    expect(activeTeam).toHaveClass("bg-primary/10");
    cleanup();

    await renderPage("team-b");
    expect(screen.queryAllByText("Krasić Marko")).toHaveLength(0);
  });

  function kpiValue(label: string): string {
    return screen.getAllByText(label)[0].previousElementSibling?.textContent ?? "";
  }

  it("computes complete/missing from the team's required equipment", async () => {
    // Required: the issued training shirt (i2) → complete.
    vi.mocked(listTeamEquipmentRequirements).mockResolvedValue([
      { id: "r1", team_id: "team-a", item_id: "i2" },
    ] as never);
    await renderPage("team-a");

    expect(kpiValue("Kompletno")).toBe("1");
    expect(kpiValue("Nedostaje oprema")).toBe("0");
    expect(screen.queryByText("Nedostaje (1)")).toBeNull();
  });

  it("marks a player missing when a required piece is not covered", async () => {
    // Required: Domaći dres (i1), which is NOT issued → missing.
    vi.mocked(listTeamEquipmentRequirements).mockResolvedValue([
      { id: "r2", team_id: "team-a", item_id: "i1" },
    ] as never);
    await renderPage("team-a");

    expect(kpiValue("Nedostaje oprema")).toBe("1");
    expect(screen.getAllByText("Nedostaje (1)").length).toBeGreaterThan(0);
  });

  it("shows a neutral state when the team has no required equipment", async () => {
    vi.mocked(listTeamEquipmentRequirements).mockResolvedValue([] as never);
    await renderPage("team-a");

    const neutralNotice = screen
      .getByText(/Obavezna oprema za tim još nije definisana/)
      .closest("p");
    expect(neutralNotice).not.toBeNull();
    expect(
      within(neutralNotice as HTMLElement).getByRole("link", {
        name: "Podešavanja opreme",
      })
    ).toHaveAttribute("href", "/sr/equipment/settings?tab=requirements");
    expect(kpiValue("Kompletno")).toBe("—");
    expect(screen.queryByText("Nedostaje (1)")).toBeNull();
  });
});
