import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";
import {
  PlayerDetailDrawer,
  type PlayerDetailActions,
  type PlayerDetailLabels,
} from "../PlayerDetailDrawer";
import type { PaymentPlayerData } from "../MonthPayments";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

afterEach(cleanup);

const paymentReverse = {
  action: "Poništi isplatu",
  title: "Poništiti ovu evidentiranu isplatu od {amount}?",
  body: "Isplata više neće biti uračunata u plaćeni iznos.",
  cancel: "Otkaži",
  pending: "Poništavanje...",
  reversed: "Poništeno",
  methods: { cash: "Keš", bank: "Banka", other: "Ostalo" },
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

const actions: PlayerDetailActions = {
  period: "2026-09",
  canManageAdjustments: true,
  addAdjustmentAction: (async () => ({ ok: true })) as never,
  reverseAdjustmentAction: async () => {},
  canReversePayments: true,
  reversePaymentAction: async () => {},
};

const labels: PlayerDetailLabels = {
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
};

function player(over: Partial<PaymentPlayerData> = {}): PaymentPlayerData {
  return {
    athleteId: "a1",
    name: "Marković Marko",
    jersey: 10,
    base: 150000,
    bonus: 20000,
    deduction: 0,
    adjusted: 170000,
    paid: 50000,
    remaining: 120000,
    currency: "RSD",
    statusLabel: "Delimično plaćeno",
    statusTone: "yellow",
    detailAria: "Detalji za Marković Marko",
    recordedPayments: [
      {
        id: "p1",
        amount: 50000,
        currency: "RSD",
        paidOn: "2026-09-11",
        method: "cash",
        note: null,
        reversed: false,
      },
    ],
    adjustments: [
      {
        id: "adj1",
        type: "bonus",
        amount: 20000,
        reason: "Bonus za pobedu",
        note: null,
        created_at: "2026-09-01T10:00:00Z",
        reversed_at: null,
        reversal_note: null,
      },
    ],
    ...over,
  };
}

function renderDrawer(p: PaymentPlayerData = player(), onClose = vi.fn()) {
  render(
    <ToastProvider dismissLabel="Zatvori">
      <PlayerDetailDrawer player={p} actions={actions} labels={labels} onClose={onClose} />
    </ToastProvider>
  );
  return {
    onClose,
    drawer: screen.getByRole("dialog", { name: `Detalji igrača: ${p.name}` }),
  };
}

describe("PlayerDetailDrawer", () => {
  it("shows the month calculation: base, bonus, total due, paid and remaining", () => {
    const { drawer } = renderDrawer();

    expect(within(drawer).getByText("Obračun za mesec")).toBeInTheDocument();
    expect(within(drawer).getAllByText("Osnovna").length).toBeGreaterThan(0);
    expect(within(drawer).getAllByText("+20.000 RSD").length).toBeGreaterThan(0);
    expect(within(drawer).getAllByText("170.000 RSD").length).toBeGreaterThan(0);
    expect(within(drawer).getAllByText("50.000 RSD").length).toBeGreaterThan(0);
    expect(within(drawer).getAllByText("120.000 RSD").length).toBeGreaterThan(0);
  });

  it("shows the correction history, the add action and the player's payments", () => {
    const { drawer } = renderDrawer();

    expect(within(drawer).getByRole("button", { name: "Dodaj bonus" })).toBeInTheDocument();
    expect(within(drawer).getByText("Bonus · Bonus za pobedu")).toBeInTheDocument();
    expect(within(drawer).getByText("11.09.2026 · Keš")).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", { name: "Poništi isplatu" })
    ).toBeInTheDocument();
  });

  it("shows empty hints when the player has no corrections and no payments", () => {
    const { drawer } = renderDrawer(
      player({
        adjusted: 150000,
        paid: 0,
        remaining: 150000,
        adjustments: [],
        recordedPayments: [],
      })
    );

    expect(within(drawer).getByText("Nema korekcija za ovaj mesec.")).toBeInTheDocument();
    expect(
      within(drawer).getByText("Nema evidentiranih isplata za ovaj mesec.")
    ).toBeInTheDocument();
  });

  it("closes via the close button and via Escape", () => {
    const { onClose } = renderDrawer();

    fireEvent.click(screen.getByRole("button", { name: "Zatvori" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
