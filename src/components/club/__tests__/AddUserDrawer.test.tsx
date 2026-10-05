import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { AddUserDrawer, type ClubAccountStateShape } from "../AddUserDrawer";
import { ToastProvider } from "@/components/ui/Toast";
import type { LinkableStaff } from "@/lib/club-users";
import type { RoleMetadataView } from "@/lib/staff-profile";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

afterEach(cleanup);

const LABELS = {
  trigger: "Dodaj korisnika",
  title: "Dodaj korisnika",
  staff: "Osoba iz evidencije",
  staffPlaceholder: "Izaberite osobu",
  staffFunction: "Funkcija u klubu",
  noStaff: "Sve osobe već imaju Stožer nalog",
  email: "Email",
  emailHint: "Na ovu adresu ćemo povezati postojeći nalog ili poslati poziv.",
  role: "Stožer uloga",
  rolePlaceholder: "Izaberite ulogu",
  roleHint:
    "Određuje šta korisnik može da vidi i radi u Stožeru. Ne mora biti ista kao funkcija u klubu.",
  teams: "Dodeljeni timovi",
  teamsHint: "U klubu još nema timova.",
  chooseTeams: "Izaberi timove",
  removeTeam: "Ukloni",
  noSeason: "Nema aktivne sezone za dodelu timova.",
  scope: "Obuhvat",
  canTitle: "Može da radi",
  deniedTitle: "Nema pristup",
  detailsToggle: "Prikaži detaljne dozvole",
  noAccess: "Nema pristup",
  submit: "Dodaj korisnika",
  submitting: "Dodavanje...",
  close: "Zatvori",
};

const ROLE: RoleMetadataView = {
  key: "coach",
  label: "Trener",
  description: "Vodi dodeljene timove.",
  teamScoped: false,
  scopeLabel: "Ceo klub",
  summary: ["Igrači i timovi"],
  denied: [],
  details: [],
};

const STAFF: LinkableStaff[] = [
  {
    id: "staff-1",
    name: "Popić Denis",
    title: "Sportski direktor",
    email: "denis@example.com",
    functions: [
      { function_key: "sport_director", custom_label: null },
      { function_key: "assistant_coach", custom_label: null },
    ],
  },
];

function renderDrawer({
  action = vi.fn(async () => null),
  roles = [] as RoleMetadataView[],
}: {
  action?: (
    state: ClubAccountStateShape | null,
    formData: FormData
  ) => Promise<ClubAccountStateShape | null>;
  roles?: RoleMetadataView[];
} = {}) {
  return render(
    <ToastProvider dismissLabel="Zatvori">
      <AddUserDrawer
        action={action}
        staffOptions={STAFF}
        locale="sr"
        teams={[]}
        seasonId={null}
        roles={roles}
        labels={LABELS}
        triggerClassName="trigger"
      />
    </ToastProvider>
  );
}

describe("AddUserDrawer", () => {
  it("keeps focus in the email field while typing a full address", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: LABELS.trigger }));

    const emailInput = screen.getByLabelText(
      LABELS.email
    ) as HTMLInputElement;
    emailInput.focus();

    const address = "test@example.com";
    for (const char of address) {
      fireEvent.change(emailInput, {
        target: { value: emailInput.value + char },
      });
      // Regression: the drawer panel used to steal focus on every parent
      // re-render, so typing required a new click for each character.
      expect(document.activeElement).toBe(emailInput);
    }
    expect(emailInput).toHaveValue(address);
  });

  it("shows the club function as information, never as a Stožer role", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: LABELS.trigger }));

    fireEvent.change(screen.getByLabelText(LABELS.staff), {
      target: { value: "staff-1" },
    });

    expect(
      screen.getByText("Popić Denis", { selector: "p" })
    ).toBeInTheDocument();
    expect(screen.getByText(`${LABELS.staffFunction}:`)).toBeInTheDocument();
    expect(
      screen.getByText("Sportski direktor · Pomoćni trener")
    ).toBeInTheDocument();
    expect(screen.getByText(LABELS.roleHint)).toBeInTheDocument();

    // The picker option carries only the name — no joined "name · function"
    // string that could read as a Stožer role.
    expect(
      screen.queryByRole("option", {
        name: "Popić Denis · Sportski direktor",
      })
    ).toBeNull();
  });

  it("ignores backdrop clicks and Escape; only the X closes it", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: LABELS.trigger }));

    const overlay = screen.getByRole("dialog");
    expect(overlay).toBeInTheDocument();

    // Backdrop / page behind the panel: must NOT close.
    fireEvent.click(overlay);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Escape: must NOT close either.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // The explicit X is the single close action.
    fireEvent.click(screen.getByRole("button", { name: LABELS.close }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("has no Otkaži button in the footer", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: LABELS.trigger }));

    expect(screen.queryByRole("button", { name: "Otkaži" })).toBeNull();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: LABELS.submit,
      })
    ).toBeInTheDocument();
  });

  it("still closes after a successful submit", async () => {
    const action = vi.fn(async () => ({ ok: true }));
    renderDrawer({ action, roles: [ROLE] });
    fireEvent.click(screen.getByRole("button", { name: LABELS.trigger }));

    fireEvent.change(screen.getByLabelText(LABELS.staff), {
      target: { value: "staff-1" },
    });
    fireEvent.change(screen.getByLabelText(LABELS.role), {
      target: { value: ROLE.key },
    });
    fireEvent.change(screen.getByLabelText(LABELS.email), {
      target: { value: "test@example.com" },
    });

    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(action).toHaveBeenCalledTimes(1);
    // The toast lives in the app-level provider, so closing the drawer does
    // not take the success feedback down with it.
    expect(screen.getByRole("status")).toHaveTextContent("userAdded");
  });

  it("does not toast or close while the action is still pending", async () => {
    let resolve!: (value: ClubAccountStateShape) => void;
    const action = vi.fn(
      () => new Promise<ClubAccountStateShape>((res) => (resolve = res))
    );
    renderDrawer({ action, roles: [ROLE] });
    fireEvent.click(screen.getByRole("button", { name: LABELS.trigger }));

    fireEvent.change(screen.getByLabelText(LABELS.staff), {
      target: { value: "staff-1" },
    });
    fireEvent.change(screen.getByLabelText(LABELS.role), {
      target: { value: ROLE.key },
    });
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();

    resolve({ ok: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("status")).toHaveTextContent("userAdded");
  });
});
