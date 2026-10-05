import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";
import {
  PaymentHistory,
  type PaymentHistoryLabels,
  type PaymentHistoryRow,
} from "../PaymentHistory";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

afterEach(cleanup);

const labels: PaymentHistoryLabels = {
  title: "Istorija isplata · Septembar 2026",
  summary: "1 aktivna · 1 poništena · Isplaćeno 150.000 RSD",
  columns: {
    player: "Igrač",
    date: "Datum",
    method: "Način",
    note: "Napomena",
    amount: "Iznos",
  },
  empty: "Nema evidentiranih isplata za izabrani mesec.",
  reverse: {
    action: "Poništi isplatu",
    title: "Poništiti ovu evidentiranu isplatu od {amount}?",
    body: "Isplata više neće biti uračunata u plaćeni iznos.",
    cancel: "Otkaži",
    pending: "Poništavanje...",
    reversed: "Poništeno",
    methods: { cash: "Keš", bank: "Banka", other: "Ostalo" },
  },
};

function row(over: Partial<PaymentHistoryRow> = {}): PaymentHistoryRow {
  return {
    id: "p1",
    athleteId: "a1",
    name: "Marković Marko",
    jersey: 10,
    amount: 150000,
    currency: "RSD",
    paidOn: "2026-09-16",
    method: "cash",
    note: null,
    reversed: false,
    ...over,
  };
}

function renderHistory(rows: PaymentHistoryRow[], canReverse = true) {
  return render(
    <ToastProvider dismissLabel="Zatvori">
      <PaymentHistory
        rows={rows}
        labels={labels}
        canReverse={canReverse}
        reverseAction={async () => {}}
      />
    </ToastProvider>
  );
}

describe("PaymentHistory", () => {
  it("shows the month in the title, not as a per-row column", () => {
    renderHistory([row()]);
    expect(screen.getByText("Istorija isplata · Septembar 2026")).toBeInTheDocument();
    expect(screen.queryByText("Za mesec")).toBeNull();
  });

  it("shows the empty state when the month has no recorded payments", () => {
    renderHistory([]);
    expect(
      screen.getByText("Nema evidentiranih isplata za izabrani mesec.")
    ).toBeInTheDocument();
  });

  it("shows player, amount, Serbian-format date, method and note", () => {
    renderHistory([
      row({ note: "avans za septembar" }),
      row({
        id: "p2",
        name: "Petrović Petar",
        jersey: null,
        amount: 20000,
        paidOn: "2026-09-01",
        method: "bank",
        reversed: true,
      }),
    ]);

    // One row per payment on desktop + mobile: query within the table only.
    const table = screen.getAllByRole("table")[0];
    const items = within(table).getAllByRole("row").slice(1);
    expect(items).toHaveLength(2);

    // Newest first.
    expect(within(items[0]).getByText("Marković Marko")).toBeInTheDocument();
    expect(within(items[0]).getByText("16.09.2026.")).toBeInTheDocument();
    expect(within(items[0]).getByText("Keš")).toBeInTheDocument();
    expect(within(items[0]).getByText("avans za septembar")).toBeInTheDocument();
    expect(within(items[0]).getByText("150.000 RSD")).toBeInTheDocument();

    // Reversed rows stay visible, flagged and without a reverse action.
    expect(within(items[1]).getByText("Banka")).toBeInTheDocument();
    expect(within(items[1]).getByText("Poništeno")).toBeInTheDocument();
    expect(within(table).getAllByRole("button", { name: "Poništi isplatu" })).toHaveLength(1);
  });

  it("view-only users see the ledger without any reverse action", () => {
    renderHistory([row(), row({ id: "p2", reversed: true })], false);
    expect(screen.queryByRole("button", { name: "Poništi isplatu" })).toBeNull();
    // Desktop table + mobile list both render the badge.
    expect(screen.getAllByText("Poništeno")).toHaveLength(2);
  });
});
