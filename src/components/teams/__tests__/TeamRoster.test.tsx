import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";
import { TeamRoster, type RosterRow, type TeamRosterLabels } from "../TeamRoster";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

afterEach(cleanup);

const rows: RosterRow[] = [
  {
    athleteId: "1",
    firstName: "Marko",
    lastName: "Krasić",
    position: "Golman",
    clubAthleteNumber: 1,
    jerseyNumber: 1,
    regState: "none",
    medTone: "expired",
  },
  {
    athleteId: "2",
    firstName: "Petar",
    lastName: "Petrović",
    position: "Napadač",
    clubAthleteNumber: 2,
    jerseyNumber: 9,
    regState: "green",
    medTone: "valid",
  },
];

const labels: TeamRosterLabels = {
  searchPlaceholder: "Pretraži igrače...",
  filters: "Filteri",
  clearFilters: "Poništi filtere",
  filterPosition: "Pozicija",
  filterReg: "Registracija",
  filterMed: "Lekarski pregled",
  positionOptions: [
    { value: "all", label: "Sve" },
    { value: "Golman", label: "Golman" },
    { value: "Napadač", label: "Napadač" },
  ],
  regOptions: [
    { value: "all", label: "Sve" },
    { value: "green", label: "Važeća" },
    { value: "yellow", label: "Ističe uskoro" },
    { value: "red", label: "Istekla" },
    { value: "none", label: "Bez registracije" },
  ],
  medOptions: [
    { value: "all", label: "Sve" },
    { value: "valid", label: "Važeći" },
    { value: "expiring_soon", label: "Ističe uskoro" },
    { value: "expired", label: "Istekao" },
    { value: "not_recorded", label: "Nema pregleda" },
  ],
  table: {
    clubId: "Klupski ID",
    name: "Ime",
    jersey: "Broj dresa",
    position: "Pozicija",
    registration: "Registracija",
    medical: "Lekarski pregled",
    actions: "Akcije",
  },
  empty: "Nema igrača u sastavu.",
  emptyFiltered: "Nema igrača za izabrane filtere.",
  remove: "Ukloni iz tima",
  removeTitle: "Ukloniti igrača?",
  removeBody: "Igrač ostaje u klubu.",
  removeConfirm: "Ukloni iz tima",
  removing: "Uklanjanje...",
  cancel: "Otkaži",
};

function renderRoster() {
  render(
    <ToastProvider dismissLabel="Zatvori">
      <TeamRoster
        locale="sr"
        teamId="t1"
        rows={rows}
        canAssign={false}
        removeAction={async () => {}}
        labels={labels}
      />
    </ToastProvider>
  );
}

describe("TeamRoster position filter", () => {
  it("keeps the position filter inside the Filteri panel", () => {
    renderRoster();
    // Panel closed by default: no position control, search is visible.
    expect(screen.queryByLabelText("Pozicija")).toBeNull();
    expect(screen.getByPlaceholderText("Pretraži igrače...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Filteri/ })).toBeInTheDocument();
  });

  it("filters by position instantly and counts it as an active filter", () => {
    renderRoster();
    fireEvent.click(screen.getByRole("button", { name: /Filteri/ }));

    fireEvent.change(screen.getByLabelText("Pozicija"), {
      target: { value: "Golman" },
    });

    expect(screen.getAllByText("Krasić Marko").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Petrović Petar")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Filteri (1)" })).toBeInTheDocument();
  });

  it("counts position together with the other filters", () => {
    renderRoster();
    fireEvent.click(screen.getByRole("button", { name: /Filteri/ }));

    fireEvent.change(screen.getByLabelText("Pozicija"), {
      target: { value: "Golman" },
    });
    fireEvent.change(screen.getByLabelText("Registracija"), {
      target: { value: "green" },
    });

    // Golman + Važeća match nothing, but the count reflects two active filters.
    expect(screen.getByRole("button", { name: "Filteri (2)" })).toBeInTheDocument();
    expect(screen.getByText("Nema igrača za izabrane filtere.")).toBeInTheDocument();
  });

  it("clears the position filter with Poništi filtere", () => {
    renderRoster();
    fireEvent.click(screen.getByRole("button", { name: /Filteri/ }));
    fireEvent.change(screen.getByLabelText("Pozicija"), {
      target: { value: "Golman" },
    });
    expect(screen.queryAllByText("Petrović Petar")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Poništi filtere" }));

    expect(screen.getAllByText("Krasić Marko").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Petrović Petar").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Filteri" })).toBeInTheDocument();
  });
});
