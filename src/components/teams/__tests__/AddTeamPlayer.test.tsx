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
import { AddTeamPlayer } from "../AddTeamPlayer";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

afterEach(cleanup);

const labels = {
  addToTeam: "Dodaj u tim",
  addTitle: "Dodaj igrača u tim",
  player: "Igrač",
  choosePlayer: "Izaberi igrača iz kluba",
  jerseyNumber: "Broj dresa",
  add: "Dodaj u tim",
  adding: "Dodavanje...",
  cancel: "Otkaži",
  noPlayersInClub: "Još nema igrača u klubu.",
  noPlayersInClubHint: "Prvo dodajte igrača u sekciji Igrači.",
  goToPlayers: "Idi na Igrače",
  noEligiblePlayers: "Nema dostupnih igrača za dodavanje u tim.",
  noEligiblePlayersHint:
    "Svi postojeći igrači su već raspoređeni u timove za aktivnu sezonu.",
};

const athletes = [
  { id: "a1", name: "Marković Marko" },
  { id: "a2", name: "Petrović Petar" },
];

function renderPlayer(overrides?: {
  athletes?: { id: string; name: string }[];
  totalPlayers?: number;
  action?: (state: unknown, formData: FormData) => Promise<unknown>;
}) {
  const action = overrides?.action ?? vi.fn().mockResolvedValue({ ok: true });
  const athletesList = overrides?.athletes ?? athletes;
  render(
    <ToastProvider dismissLabel="Zatvori">
      <AddTeamPlayer
        teamId="t1"
        athletes={athletesList}
        totalPlayers={overrides?.totalPlayers ?? athletesList.length}
        playersHref="/sr/players"
        action={action as never}
        labels={labels}
      />
    </ToastProvider>
  );
  return { action };
}

describe("AddTeamPlayer", () => {
  it("opens the dialog when the CTA is clicked", () => {
    renderPlayer();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Dodaj u tim/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Dodaj igrača u tim")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows the 'no eligible players' state when the club has players", () => {
    renderPlayer({ athletes: [], totalPlayers: 5 });

    const trigger = screen.getByRole("button", { name: /Dodaj u tim/i });
    expect(trigger).not.toBeDisabled();
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText("Nema dostupnih igrača za dodavanje u tim.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Svi postojeći igrači su već raspoređeni u timove za aktivnu sezonu."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("Idi na Igrače")).toBeNull();
    // No extra submit button when there is nothing to add (only the CTA remains).
    expect(screen.getAllByRole("button", { name: "Dodaj u tim" })).toHaveLength(1);
  });

  it("shows the 'no players in the club' state with a Players link", () => {
    renderPlayer({ athletes: [], totalPlayers: 0 });

    fireEvent.click(screen.getByRole("button", { name: /Dodaj u tim/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Još nema igrača u klubu.")).toBeInTheDocument();
    expect(
      screen.getByText("Prvo dodajte igrača u sekciji Igrači.")
    ).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Idi na Igrače" });
    expect(link).toHaveAttribute("href", "/sr/players");
  });

  it("closes the dialog on Otkaži", () => {
    renderPlayer();
    fireEvent.click(screen.getByRole("button", { name: /Dodaj u tim/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Otkaži" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the dialog after a successful add", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    renderPlayer({ action });
    fireEvent.click(screen.getByRole("button", { name: /Dodaj u tim/i }));

    const form = screen.getByRole("dialog").querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(action).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("memberAdded")).toBeInTheDocument();
  });

  it("keeps the dialog open, shows the server error and an error toast", async () => {
    const action = vi
      .fn()
      .mockResolvedValue({ error: "Broj dresa 10 je već dodeljen igraču u ovom timu." });
    renderPlayer({ action });
    fireEvent.click(screen.getByRole("button", { name: /Dodaj u tim/i }));

    const dialog = screen.getByRole("dialog");
    fireEvent.submit(dialog.querySelector("form")!);

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("Broj dresa 10 je već dodeljen igraču u ovom timu.");
    expect(await screen.findByText("addFailed")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
