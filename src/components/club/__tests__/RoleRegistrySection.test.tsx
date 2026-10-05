import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RoleRegistrySection } from "../RoleRegistrySection";
import type { RoleMetadataView } from "@/lib/staff-profile";

afterEach(cleanup);

function makeRole(
  key: RoleMetadataView["key"],
  label: string,
  overrides: Partial<RoleMetadataView> = {}
): RoleMetadataView {
  return {
    key,
    label,
    description: `Opis uloge ${label}.`,
    teamScoped: false,
    scopeLabel: "Ceo klub",
    summary: [`Može ${label}`],
    denied: [`Ne može ${label}`],
    details: [
      {
        key: "playersTeams",
        label: "Igrači i timovi",
        items: [{ area: "Igrači", actions: ["Pregled"], denied: false }],
      },
    ],
    ...overrides,
  };
}

const ROLES = [
  makeRole("club_president", "Predsednik kluba"),
  makeRole("coach", "Trener", {
    teamScoped: true,
    scopeLabel: "Dodeljeni timovi",
  }),
  makeRole("admin_finance", "Finansije"),
];

const LABELS = {
  title: "Uloge i dozvole",
  description: "Svaki korisnik dobija jednu unapred definisanu Stožer ulogu.",
  selectorLabel: "Izbor uloge",
  scope: "Obuhvat",
  canTitle: "Može da radi",
  deniedTitle: "Nema pristup",
  detailsToggle: "Prikaži detaljne dozvole",
  noAccess: "Nema pristup",
};

describe("RoleRegistrySection", () => {
  it("renders inline with one detail panel and no drawer trigger", () => {
    render(<RoleRegistrySection roles={ROLES} labels={LABELS} />);

    expect(screen.getByText("Uloge i dozvole")).toBeInTheDocument();
    expect(
      screen.getByText("Svaki korisnik dobija jednu unapred definisanu Stožer ulogu.")
    ).toBeInTheDocument();

    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);

    expect(screen.getByText("Opis uloge Predsednik kluba.")).toBeInTheDocument();
    expect(screen.queryByText("Opis uloge Trener.")).toBeNull();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: /registar uloga/i })).toBeNull();
  });

  it("shows only the selected role in the detail panel", () => {
    render(<RoleRegistrySection roles={ROLES} labels={LABELS} />);

    fireEvent.click(screen.getByRole("tab", { name: "Trener" }));

    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("Opis uloge Trener.")).toBeInTheDocument();
    expect(within(panel).getByText("Dodeljeni timovi")).toBeInTheDocument();
    expect(within(panel).getByText("Može Trener")).toBeInTheDocument();
    expect(within(panel).getByText("Ne može Trener")).toBeInTheDocument();
    expect(
      within(panel).getByText("Prikaži detaljne dozvole")
    ).toBeInTheDocument();
    expect(screen.queryByText("Opis uloge Predsednik kluba.")).toBeNull();
    expect(screen.getByRole("tab", { name: "Trener" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});
