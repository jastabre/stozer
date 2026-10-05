import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { listOrgUsers } from "@/lib/club-users";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

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

vi.mock("next/navigation", () => ({
  usePathname: () => "/sr/club/users",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/organization", () => ({
  requirePermission: vi.fn(async () => undefined),
  requireOrganization: vi.fn(async () => ({
    organizationId: "org-1",
    userId: "user-1",
  })),
  // The Club tab bar now resolves each area's permission independently.
  hasPermission: vi.fn(async () => true),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({})),
}));

vi.mock("@/lib/club-data", () => ({
  listTeams: vi.fn(async () => []),
  getActiveSeason: vi.fn(async () => ({ id: "season-1" })),
}));

vi.mock("@/lib/club-users", () => ({
  isClubPresident: vi.fn(async () => true),
  listLinkableStaff: vi.fn(async () => []),
  listOrgUsers: vi.fn(async () => []),
}));

vi.mock("@/lib/staff-profile", async () => {
  const sr = (await import("../../../../../../messages/sr.json")).default as {
    people: {
      roles: Record<string, string>;
      roleMeta: Record<string, { description: string }>;
      access: { scopeClub: string; scopeTeams: string; summary: Record<string, string> };
    };
  };
  const keys = [
    "club_president",
    "youth_director",
    "coach",
    "admin_finance",
    "equipment_manager",
    "medical_staff",
  ];
  return {
    loadRoleMetadata: async () =>
      Object.fromEntries(
        keys.map((key) => [
          key,
          {
            key,
            label: sr.people.roles[key],
            description: sr.people.roleMeta[key].description,
            teamScoped: key === "coach",
            scopeLabel:
              key === "coach"
                ? sr.people.access.scopeTeams
                : sr.people.access.scopeClub,
            summary: [sr.people.access.summary.playersTeams],
            denied: [sr.people.access.summary.finance],
            details: [],
          },
        ])
      ),
  };
});

vi.mock("../actions", () => ({
  addUserAction: vi.fn(async () => null),
  updateUserAccessAction: vi.fn(async () => null),
  resendInviteAction: vi.fn(async () => null),
  setAccountDisabledAction: vi.fn(async () => null),
}));

afterEach(cleanup);

async function renderPage() {
  const { default: ClubUsersPage } = await import("../users/page");
  render(
    <ToastProvider dismissLabel="Zatvori">
      {await ClubUsersPage({
        params: Promise.resolve({ locale: "sr" }),
        searchParams: Promise.resolve({}),
      })}
    </ToastProvider>
  );
}

/**
 * Acceptance: /club/users shows the inline "Uloge i dozvole" section right
 * away. There is no "Registar uloga" trigger and no drawer/overlay for roles.
 */
describe("Club users page role registry", () => {
  it("renders Uloge i dozvole inline without a registry trigger or drawer", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Uloge i dozvole" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Svaki korisnik dobija jednu unapred definisanu Stožer ulogu.")
    ).toBeInTheDocument();

    const registry = screen.getByRole("tablist", { name: "Izbor uloge" });
    expect(within(registry).getAllByRole("tab")).toHaveLength(6);
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);

    expect(
      screen.queryByRole("button", { name: "Registar uloga" })
    ).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Zatvori" })).toBeNull();
  });

  it("shows only the selected role in the detail panel", async () => {
    await renderPage();

    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("Predsednik kluba")).toBeInTheDocument();
    expect(
      within(panel).getByText("Pun pristup upravljanju klubom.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Trener" }));

    const updated = screen.getByRole("tabpanel");
    expect(
      within(updated).getByText("Rad sa dodeljenim timovima i njihovim igračima.")
    ).toBeInTheDocument();
    expect(within(updated).getByText("Dodeljeni timovi")).toBeInTheDocument();
    expect(
      within(updated).queryByText("Pun pristup upravljanju klubom.")
    ).toBeNull();
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
  });
});

/**
 * The "Korisnik" column leads with the linked staff name and keeps the email
 * as the secondary line; without a staff link the email is the fallback.
 * Raw ids are never rendered.
 */
describe("Club users page identity column", () => {
  it("shows the staff name with the email below, email-only otherwise", async () => {
    vi.mocked(listOrgUsers).mockResolvedValueOnce([
      {
        userId: "user-linked",
        email: "genta@gmail.com",
        role: "coach",
        staffId: "staff-1",
        staffName: "Gentić Genta",
        teamIds: [],
        teamNames: [],
        status: "active",
        isSelf: false,
      },
      {
        userId: "user-email-only",
        email: "diplodokus16@gmail.com",
        role: "club_president",
        staffId: null,
        staffName: null,
        teamIds: [],
        teamNames: [],
        status: "active",
        isSelf: false,
      },
    ]);

    await renderPage();

    const table = screen.getByRole("table");
    expect(within(table).getByText("Gentić Genta")).toBeInTheDocument();
    expect(within(table).getByText("genta@gmail.com")).toBeInTheDocument();
    expect(
      within(table).getByText("diplodokus16@gmail.com")
    ).toBeInTheDocument();

    expect(within(table).queryByText("user-linked")).toBeNull();
    expect(within(table).queryByText("user-email-only")).toBeNull();
    expect(within(table).queryByText("staff-1")).toBeNull();
  });
});
