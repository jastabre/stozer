import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";
import {
  MonthPayments,
  type MonthPaymentsLabels,
  type PaymentPlayerData,
} from "../MonthPayments";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

afterEach(cleanup);

const METHOD_LABELS = { cash: "Keš", bank: "Banka", other: "Ostalo" } as const;

const paymentReverse = {
  action: "Poništi isplatu",
  title: "Poništiti ovu evidentiranu isplatu od {amount}?",
  body: "Isplata više neće biti uračunata u plaćeni iznos.",
  cancel: "Otkaži",
  pending: "Poništavanje...",
  reversed: "Poništeno",
  methods: METHOD_LABELS,
};

const bonusDialogLabels = {
  trigger: "Dodaj bonus",
  title: "Dodaj bonus",
  selected: "Odabrano igrača: {count}",
  amount: "Iznos po igraču",
  perPlayerNote: "Iznos se primenjuje na svakog izabranog igrača.",
  reason: "Razlog",
  reasonPlaceholder: "npr. Bonus za pobedu",
  note: "Napomena",
  notePlaceholder: "Opciona napomena",
  submit: "Dodaj bonus",
  pending: "Dodavanje...",
  cancel: "Otkaži",
};

const labels: MonthPaymentsLabels = {
  table: {
    player: "Igrač",
    obligation: "Obaveza",
    paid: "Isplaćeno",
    remaining: "Preostalo",
    status: "Status",
    action: "Akcija",
  },
  record: "Evidentiraj",
  details: "Detalji",
  corrections: "Korekcije",
  selectAll: "Izaberi sve",
  selected: "Izabrano: {count} igrača",
  payoutTotal: "Za isplatu: {amount}",
  confirm: "Evidentiraj isplatu",
  viewOnly: "Možete da pregledate isplate prvog tima.",
  breakdown: { base: "Osnovna", bonus: "Bonus", deduction: "Odbitak" },
  dialog: {
    title: "Evidentiraj isplatu",
    player: "Igrač",
    obligationForMonth: "Plata za mesec",
    baseSalary: "Osnovna plata",
    bonus: "Bonus",
    deduction: "Odbitak",
    obligation: "Obaveza za mesec",
    alreadyPaid: "Već isplaćeno",
    remaining: "Preostalo",
    amount: "Iznos",
    amountFor: "Iznos za {name}",
    selectedCount: "Izabrano: {count} igrača",
    paidOn: "Datum isplate",
    method: "Način",
    methods: METHOD_LABELS,
    note: "Napomena (opciono)",
    notePlaceholder: "Opciona napomena",
    submit: "Evidentiraj isplatu",
    pending: "Evidentiranje...",
    cancel: "Otkaži",
    invalidAmount:
      "Iznos mora biti veći od 0 i ne sme preći preostali iznos mesečne obaveze.",
  },
  adjustmentsDialog: {
    title: "Korekcije",
    baseSalary: "Osnovna plata",
    bonusSection: "Bonus",
    deductionSection: "Odbici",
    none: "nema",
    total: "Ukupna obaveza",
    close: "Zatvori",
    list: {
      bonus: "Bonus",
      deduction: "Odbitak",
      reversed: "Poništeno",
      reverse: "Poništi korekciju",
      reverseTitle: "Poništiti ovu korekciju od {amount}?",
      reverseBody: "Korekcija više neće uticati na iznos za isplatu.",
      cancel: "Otkaži",
      pending: "Poništavanje...",
    },
    addLabels: {
      bonus: bonusDialogLabels,
      deduction: { ...bonusDialogLabels, trigger: "Dodaj odbitak" },
    },
  },
  detail: {
    title: "Detalji igrača",
    close: "Zatvori",
    calcTitle: "Obračun za mesec",
    correctionsTitle: "Korekcije",
    paymentsTitle: "Isplate ovog meseca",
    noCorrections: "Nema korekcija za ovaj mesec.",
    noPayments: "Nema evidentiranih isplata za ovaj mesec.",
    base: "Osnovna",
    bonus: "Bonus",
    deduction: "Odbitak",
    totalDue: "Obaveza",
    paid: "Isplaćeno",
    remaining: "Preostalo",
    overpaid: "Isplaćeno više od ukupne obaveze",
    adjustmentList: {
      bonus: "Bonus",
      deduction: "Odbitak",
      reversed: "Poništeno",
      reverse: "Poništi korekciju",
      reverseTitle: "Poništiti ovu korekciju od {amount}?",
      reverseBody: "Korekcija više neće uticati na iznos za isplatu.",
      cancel: "Otkaži",
      pending: "Poništavanje...",
    },
    paymentReverse,
    addLabels: {
      bonus: bonusDialogLabels,
      deduction: { ...bonusDialogLabels, trigger: "Dodaj odbitak" },
    },
  },
};

function player(over: Partial<PaymentPlayerData> & { athleteId: string; name: string }): PaymentPlayerData {
  return {
    jersey: null,
    base: 100000,
    bonus: 0,
    deduction: 0,
    adjusted: 100000,
    paid: 0,
    remaining: 100000,
    currency: "RSD",
    statusLabel: "Za isplatu",
    statusTone: "neutral",
    detailAria: `Detalji za ${over.name}`,
    recordedPayments: [],
    adjustments: [],
    ...over,
  };
}

const players: PaymentPlayerData[] = [
  player({
    athleteId: "a1",
    name: "Marko Marković",
    jersey: 10,
    adjusted: 150000,
    base: 150000,
    paid: 50000,
    remaining: 100000,
    statusLabel: "Delimično plaćeno",
    statusTone: "yellow",
  }),
  player({ athleteId: "a2", name: "Petar Petrović" }),
  player({
    athleteId: "a3",
    name: "Nikola Nikolić",
    paid: 100000,
    remaining: 0,
    statusLabel: "Plaćeno",
    statusTone: "green",
  }),
];

function renderMonth({
  action,
  canManage = true,
  customPlayers = players,
}: {
  action: (state: unknown, formData: FormData) => Promise<unknown>;
  canManage?: boolean;
  customPlayers?: PaymentPlayerData[];
}) {
  const view = render(
    <ToastProvider dismissLabel="Zatvori">
      <MonthPayments
        action={action as never}
        reversePaymentAction={async () => {}}
        addAdjustmentAction={async () => ({ ok: true }) as never}
        reverseAdjustmentAction={async () => {}}
        period="2026-09"
        monthLabel="Septembar 2026"
        defaultPaidOn="2026-09-11"
        canManage={canManage}
        players={customPlayers}
        labels={labels}
      />
    </ToastProvider>
  );
  const table = view.container.querySelector("table") as HTMLElement;
  return { ...view, table };
}

describe("MonthPayments table", () => {
  it("renders compact rows: no inline money inputs, one action per row", () => {
    const { table } = renderMonth({ action: vi.fn(async () => null) });

    // No amount inputs in the table itself — recording happens in the dialog.
    expect(within(table).queryByRole("textbox")).toBeNull();
    // Payable rows offer Evidentiraj; settled rows offer Detalji.
    expect(within(table).getAllByRole("button", { name: "Evidentiraj" })).toHaveLength(2);
    expect(within(table).getAllByRole("button", { name: "Detalji" })).toHaveLength(1);
    // Managers get the discreet adjustment entry per row.
    expect(within(table).getAllByRole("button", { name: "Korekcije" })).toHaveLength(3);
    // Settled players are not selectable for a new payment.
    expect(within(table).queryByLabelText("Nikola Nikolić")).toBeNull();
    expect(within(table).getByLabelText("Marko Marković")).toBeInTheDocument();
  });

  it("select all picks only players with something left to pay", () => {
    const { table } = renderMonth({ action: vi.fn(async () => null) });

    fireEvent.click(screen.getByLabelText("Izaberi sve"));
    expect(screen.getByText("Izabrano: 2 igrača")).toBeInTheDocument();
    expect(screen.getByText("Za isplatu: 200.000 RSD")).toBeInTheDocument();
    expect(within(table).queryByLabelText("Nikola Nikolić")).toBeNull();
  });

  it("view-only users get the table without selection or recording", () => {
    const { table } = renderMonth({ action: vi.fn(async () => null), canManage: false });

    expect(within(table).queryByRole("checkbox")).toBeNull();
    expect(within(table).queryByRole("button", { name: "Evidentiraj" })).toBeNull();
    expect(within(table).getAllByRole("button", { name: "Detalji" })).toHaveLength(3);
    expect(within(table).queryByRole("button", { name: "Korekcije" })).toBeNull();
    expect(screen.getByText("Možete da pregledate isplate prvog tima.")).toBeInTheDocument();
  });

  it("opens the player detail drawer from the name", () => {
    const { table } = renderMonth({ action: vi.fn(async () => null) });

    fireEvent.click(
      within(table).getByRole("button", { name: "Detalji za Marko Marković" })
    );
    const drawer = screen.getByRole("dialog", {
      name: "Detalji igrača: Marko Marković",
    });
    expect(within(drawer).getByText("Obračun za mesec")).toBeInTheDocument();
  });
});

describe("MonthPayments individual recording", () => {
  it("opens the dialog with the obligation breakdown and defaults to remaining", async () => {
    const action = vi.fn<(state: unknown, formData: FormData) => Promise<unknown>>(
      async () => null
    );
    const { table } = renderMonth({ action });

    fireEvent.click(within(table).getAllByRole("button", { name: "Evidentiraj" })[0]);

    const dialog = await screen.findByRole("dialog", { name: "Evidentiraj isplatu" });
    expect(within(dialog).getByText("Marko Marković")).toBeInTheDocument();
    expect(within(dialog).getByText("Septembar 2026")).toBeInTheDocument();

    // The breakdown: base salary row, both correction types (none here → —),
    // then the month's obligation and the payment math.
    expect(within(dialog).getByText("Osnovna plata")).toBeInTheDocument();
    expect(within(dialog).getByText("Bonus")).toBeInTheDocument();
    expect(within(dialog).getByText("Odbitak")).toBeInTheDocument();
    expect(within(dialog).getAllByText("\u2014")).toHaveLength(2);
    expect(within(dialog).getAllByText("150.000 RSD").length).toBeGreaterThan(0); // osnovna + obaveza
    expect(within(dialog).getByText("50.000 RSD")).toBeInTheDocument(); // već isplaćeno
    expect(within(dialog).getByLabelText("Iznos")).toHaveValue("100.000");

    // Partial payment: lower the amount and submit.
    fireEvent.change(within(dialog).getByLabelText("Iznos"), {
      target: { value: "40.000" },
    });
    fireEvent.submit(dialog.querySelector("form")!);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const fd = action.mock.calls[0][1] as FormData;
    expect(fd.get("period")).toBe("2026-09");
    expect(fd.get("amount_a1")).toBe("40000");
    expect(fd.get("paid_on")).toBe("2026-09-11");
    expect(fd.get("method")).toBe("cash");
  });

  it("shows a bonus and a deduction by name in the row and the payment dialog", async () => {
    const { table } = renderMonth({
      action: vi.fn(async () => null),
      customPlayers: [
        player({
          athleteId: "a9",
          name: "Krasic Marko",
          base: 150000,
          bonus: 20000,
          deduction: 15000,
          adjusted: 155000,
          remaining: 155000,
        }),
      ],
    });

    // The row states WHY the obligation differs — no generic "korekcija".
    expect(
      within(table).getByText("Osnovna 150.000 · Bonus +20.000 · Odbitak \u221215.000")
    ).toBeInTheDocument();
    expect(within(table).queryByText(/korekcija/i)).toBeNull();

    fireEvent.click(within(table).getByRole("button", { name: "Evidentiraj" }));
    const dialog = await screen.findByRole("dialog", { name: "Evidentiraj isplatu" });
    expect(within(dialog).getByText("+20.000 RSD")).toBeInTheDocument();
    expect(within(dialog).getByText("\u221215.000 RSD")).toBeInTheDocument();
    expect(within(dialog).getAllByText("155.000 RSD").length).toBeGreaterThan(0);
  });

  it("blocks amounts above the remaining and 0/empty in the dialog", async () => {
    const { table } = renderMonth({ action: vi.fn(async () => null) });

    fireEvent.click(within(table).getAllByRole("button", { name: "Evidentiraj" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Evidentiraj isplatu" });
    const submit = within(dialog).getByRole("button", { name: "Evidentiraj isplatu" });
    const invalidMessage =
      "Iznos mora biti veći od 0 i ne sme preći preostali iznos mesečne obaveze.";

    expect(submit).toBeEnabled();
    fireEvent.change(within(dialog).getByLabelText("Iznos"), {
      target: { value: "200.000" },
    });
    expect(submit).toBeDisabled();
    expect(within(dialog).getByText(invalidMessage)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Iznos"), { target: { value: "" } });
    expect(submit).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Iznos"), {
      target: { value: "100.000" },
    });
    expect(submit).toBeEnabled();
  });

  it("shows a real pending state and blocks double submit", async () => {
    let release!: () => void;
    const action = vi.fn(
      () =>
        new Promise<{ ok: boolean }>((resolve) => {
          release = () => resolve({ ok: true });
        })
    );
    const { table } = renderMonth({ action });
    fireEvent.click(within(table).getAllByRole("button", { name: "Evidentiraj" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Evidentiraj isplatu" });

    fireEvent.submit(dialog.querySelector("form")!);
    const pending = await within(dialog).findByRole("button", {
      name: "Evidentiranje...",
    });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    fireEvent.click(pending);
    expect(action).toHaveBeenCalledTimes(1);

    release();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("MonthPayments bulk recording", () => {
  it("records the selected players with per-player amounts defaulting to remaining", async () => {
    const action = vi.fn<(state: unknown, formData: FormData) => Promise<unknown>>(
      async () => null
    );
    const { table } = renderMonth({ action });

    fireEvent.click(within(table).getByLabelText("Marko Marković"));
    fireEvent.click(within(table).getByLabelText("Petar Petrović"));
    expect(screen.getByText("Izabrano: 2 igrača")).toBeInTheDocument();
    expect(screen.getByText("Za isplatu: 200.000 RSD")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Evidentiraj isplatu" }));

    const dialog = await screen.findByRole("dialog", { name: "Evidentiraj isplatu" });
    expect(within(dialog).getByText("Izabrano: 2 igrača")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Iznos za Marko Marković")).toHaveValue("100.000");
    expect(within(dialog).getByLabelText("Iznos za Petar Petrović")).toHaveValue("100.000");

    // One player gets a partial amount.
    fireEvent.change(within(dialog).getByLabelText("Iznos za Petar Petrović"), {
      target: { value: "30.000" },
    });
    fireEvent.submit(dialog.querySelector("form")!);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const fd = action.mock.calls[0][1] as FormData;
    expect(fd.get("amount_a1")).toBe("100000");
    expect(fd.get("amount_a2")).toBe("30000");
  });
});

describe("MonthPayments adjustments editor", () => {
  it("opens the compact Korekcije view with grouped bonus/deduction lists", async () => {
    const { table } = renderMonth({
      action: vi.fn(async () => null),
      customPlayers: [
        player({
          athleteId: "a1",
          name: "Krasic Marko",
          base: 150000,
          bonus: 20000,
          deduction: 0,
          adjusted: 170000,
          remaining: 170000,
          adjustments: [
            {
              id: "adj-1",
              type: "bonus",
              amount: 20000,
              reason: "Bonus za pobedu",
              note: null,
              created_at: "2026-09-01T10:00:00Z",
              reversed_at: null,
              reversal_note: null,
            },
          ],
        }),
      ],
    });

    fireEvent.click(within(table).getByRole("button", { name: "Korekcije" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Korekcije: Krasic Marko",
    });
    expect(within(dialog).getByText(/Septembar 2026/)).toBeInTheDocument();
    expect(within(dialog).getByText("Osnovna plata")).toBeInTheDocument();
    expect(within(dialog).getByText("150.000 RSD")).toBeInTheDocument();

    // Grouped sections: the bonus is shown with its reason, deductions "nema".
    expect(within(dialog).getByText("Bonus")).toBeInTheDocument();
    expect(within(dialog).getByText("Odbici")).toBeInTheDocument();
    expect(within(dialog).getByText("nema")).toBeInTheDocument();
    expect(within(dialog).getByText("+20.000 RSD")).toBeInTheDocument();
    expect(within(dialog).getByText("Bonus · Bonus za pobedu")).toBeInTheDocument();

    // Total under the line + the add actions (no big editor).
    expect(within(dialog).getByText("Ukupna obaveza")).toBeInTheDocument();
    expect(within(dialog).getByText("170.000 RSD")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Dodaj bonus" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Dodaj odbitak" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Evidentiraj isplatu" })).toBeNull();
  });
});
