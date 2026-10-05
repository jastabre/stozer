import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { PlayerEquipmentTable } from "../PlayerEquipmentTable";
import { ToastProvider } from "@/components/ui/Toast";
import type { EquipmentDrawerPlayer } from "../PlayerEquipmentDrawer";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

afterEach(cleanup);

const ITEMS = [
  { id: "i1", name: "Domaći dres", size_mode: "split", has_number: true },
  { id: "i2", name: "Jakna", size_mode: "single", has_number: false },
  { id: "i3", name: "Sportska torba", size_mode: "none", has_number: false },
  { id: "i4", name: "Trening majica", size_mode: "single", has_number: true },
];

function makePlayer(
  overrides: Partial<EquipmentDrawerPlayer> = {}
): EquipmentDrawerPlayer {
  return {
    athlete_id: "a1",
    first_name: "Marko",
    last_name: "Krasić",
    club_athlete_number: 12,
    jersey_number: 10,
    team_name: "Prvi tim",
    sizes: [
      { label: "match-top", value: "L" },
      { label: "match-bottom", value: "M" },
    ],
    sizesCompact: "Dres L/M",
    assignments: [
      {
        item_id: "i2",
        state: "issued",
        size_top: "L",
        size_bottom: null,
        number: null,
        issued_at: "2026-01-01T00:00:00Z",
        note: null,
      },
    ],
    summary: {
      hasRequirements: true,
      missingLabels: ["Šorc"],
      issuedCount: 1,
      missingCount: 1,
      lostDamagedCount: 0,
      complete: false,
    },
    ...overrides,
  };
}

function deferred() {
  let resolve!: (value?: unknown) => void;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderTable({
  players = [makePlayer()],
  canReport = true,
  canManage = true,
  transitionAction = vi.fn(async () => ({ ok: true })),
  issueAction = vi.fn(async () => ({ ok: true })),
}: {
  players?: EquipmentDrawerPlayer[];
  canReport?: boolean;
  canManage?: boolean;
  transitionAction?: (formData: FormData) => Promise<unknown>;
  issueAction?: (formData: FormData) => Promise<unknown>;
} = {}) {
  render(
    <ToastProvider dismissLabel="Zatvori">
      <PlayerEquipmentTable
        players={players}
        items={ITEMS}
        canReport={canReport}
        canManage={canManage}
        issueAction={issueAction}
        transitionAction={transitionAction}
        deleteAction={vi.fn(async () => ({ ok: true }))}
      />
    </ToastProvider>
  );
  return { transitionAction, issueAction };
}

async function openDrawer() {
  const viewButtons = screen.getAllByRole("button", { name: "view" });
  fireEvent.click(viewButtons[0]);
  return screen.findByRole("dialog");
}

describe("PlayerEquipmentTable", () => {
  it("searches players by name", () => {
    renderTable({
      players: [
        makePlayer(),
        makePlayer({
          athlete_id: "a2",
          first_name: "Nikola",
          last_name: "Jokić",
          club_athlete_number: 23,
        }),
      ],
    });

    expect(screen.getAllByText("Krasić Marko").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Jokić Nikola").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText("searchPlaceholder"), {
      target: { value: "jokić" },
    });

    expect(screen.queryAllByText("Krasić Marko")).toHaveLength(0);
    expect(screen.getAllByText("Jokić Nikola").length).toBeGreaterThan(0);
  });

  it("opens the player drawer with sizes and current assignments", async () => {
    renderTable();
    const dialog = await openDrawer();

    expect(within(dialog).getByText("Krasić Marko")).toBeInTheDocument();
    expect(within(dialog).getByText("match-top")).toBeInTheDocument();
    expect(within(dialog).getByText("Jakna")).toBeInTheDocument();
    expect(within(dialog).getByText("Šorc")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "actions.returned" })
    ).toBeInTheDocument();
  });

  it("shows upper and lower size fields for a split-size article", async () => {
    renderTable();
    const dialog = await openDrawer();
    fireEvent.click(within(dialog).getByRole("button", { name: "issue" }));
    fireEvent.change(within(dialog).getByLabelText("itemLabel"), {
      target: { value: "i1" },
    });

    expect(within(dialog).getByLabelText("topLabel")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("bottomLabel")).toBeInTheDocument();
  });

  it("shows one size field for a single-size article", async () => {
    renderTable();
    const dialog = await openDrawer();
    fireEvent.click(within(dialog).getByRole("button", { name: "issue" }));
    fireEvent.change(within(dialog).getByLabelText("itemLabel"), {
      target: { value: "i4" },
    });

    expect(within(dialog).getByLabelText("sizes.size")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("topLabel")).toBeNull();
    expect(within(dialog).queryByLabelText("bottomLabel")).toBeNull();
  });

  it("shows no size field for a no-size article", async () => {
    renderTable();
    const dialog = await openDrawer();
    fireEvent.click(within(dialog).getByRole("button", { name: "issue" }));
    fireEvent.change(within(dialog).getByLabelText("itemLabel"), {
      target: { value: "i3" },
    });

    expect(within(dialog).queryByLabelText("sizes.size")).toBeNull();
    expect(within(dialog).queryByLabelText("topLabel")).toBeNull();
    expect(within(dialog).queryByLabelText("bottomLabel")).toBeNull();
  });

  it("prefills the Broj input with the player's current jersey number", async () => {
    renderTable();
    const dialog = await openDrawer();
    fireEvent.click(within(dialog).getByRole("button", { name: "issue" }));
    fireEvent.change(within(dialog).getByLabelText("itemLabel"), {
      target: { value: "i1" },
    });

    expect(
      (within(dialog).getByLabelText("numberLabel") as HTMLInputElement).value
    ).toBe("10");
  });

  it("shows an empty Broj input when the player has no jersey number", async () => {
    renderTable({ players: [makePlayer({ jersey_number: null })] });
    const dialog = await openDrawer();
    fireEvent.click(within(dialog).getByRole("button", { name: "issue" }));
    fireEvent.change(within(dialog).getByLabelText("itemLabel"), {
      target: { value: "i1" },
    });

    expect(
      (within(dialog).getByLabelText("numberLabel") as HTMLInputElement).value
    ).toBe("");
    expect(within(dialog).getByText("jerseyNumberMissing")).toBeInTheDocument();
  });

  it("shows no Broj input for an article without a number", async () => {
    renderTable();
    const dialog = await openDrawer();
    fireEvent.click(within(dialog).getByRole("button", { name: "issue" }));
    fireEvent.change(within(dialog).getByLabelText("itemLabel"), {
      target: { value: "i3" },
    });

    expect(within(dialog).queryByLabelText("numberLabel")).toBeNull();
  });

  it("shows the recorded number on an issued article", async () => {
    renderTable({
      players: [
        makePlayer({
          assignments: [
            {
              item_id: "i1",
              state: "issued",
              size_top: "L",
              size_bottom: "M",
              number: "10",
              issued_at: "2026-01-01T00:00:00Z",
              note: null,
            },
          ],
        }),
      ],
    });
    const dialog = await openDrawer();

    expect(within(dialog).getByText(/numberLabel 10/)).toBeInTheDocument();
  });

  it("keeps the drawer open after a successful issue", async () => {
    renderTable();
    const dialog = await openDrawer();
    fireEvent.click(within(dialog).getByRole("button", { name: "issue" }));
    fireEvent.change(within(dialog).getByLabelText("itemLabel"), {
      target: { value: "i1" },
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "issue" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "equipmentAssigned"
    );
  });

  it("returns an item through the transition action", async () => {
    const transitionAction = vi.fn(async (formData: FormData) => {
      void formData;
      return { ok: true };
    });
    renderTable({ transitionAction });
    const dialog = await openDrawer();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "actions.returned" })
    );

    await waitFor(() => expect(transitionAction).toHaveBeenCalledTimes(1));
    const formData = transitionAction.mock.calls[0][0] as FormData;
    expect(formData.get("athlete_id")).toBe("a1");
    expect(formData.get("item_id")).toBe("i2");
    expect(formData.get("state")).toBe("returned");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "equipmentReturned"
    );
  });

  it("blocks double submit while the transition is pending", async () => {
    const { promise, resolve } = deferred();
    const transitionAction = vi.fn(() => promise);
    renderTable({ transitionAction });
    const dialog = await openDrawer();

    const button = within(dialog).getByRole("button", {
      name: "actions.returned",
    });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveTextContent("saving");
    expect(transitionAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve();
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "equipmentReturned"
    );
  });
});
