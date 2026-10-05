import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";
import {
  PaymentsDisclosure,
  type PaymentsDisclosureLabels,
  type RecordedPaymentData,
} from "../PaymentsDisclosure";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

afterEach(cleanup);

const labels: PaymentsDisclosureLabels = {
  action: "Poništi isplatu",
  title: "Poništiti ovu evidentiranu isplatu od {amount}?",
  body: "Isplata više neće biti uračunata u plaćeni iznos. Zapis će ostati sačuvan kao poništen.",
  cancel: "Otkaži",
  pending: "Poništavanje...",
  reversed: "Poništeno",
  methods: { cash: "Keš", bank: "Banka", other: "Ostalo" },
};

function payment(over: Partial<RecordedPaymentData> = {}): RecordedPaymentData {
  return {
    id: "p1",
    amount: 20000,
    currency: "RSD",
    paidOn: "2026-09-11",
    method: "cash",
    note: null,
    reversed: false,
    ...over,
  };
}

function renderDisclosure(
  payments: RecordedPaymentData[],
  canReverse = true,
  historyAction = `${payments.length} isplata · Istorija`,
  expandAll = false
) {
  return render(
    <ToastProvider dismissLabel="Zatvori">
      <PaymentsDisclosure
        payments={payments}
        athleteId="a1"
        canReverse={canReverse}
        reverseAction={async () => {}}
        historyAction={historyAction}
        labels={labels}
        expandAll={expandAll}
      />
    </ToastProvider>
  );
}

describe("PaymentsDisclosure", () => {
  it("renders nothing when there are no payments", () => {
    const { container } = renderDisclosure([]);
    // ToastProvider always renders its own (empty) viewport container as a
    // sibling of the children, so assert the component itself added nothing
    // rather than that the whole wrapper tree is empty.
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toBeEmptyDOMElement();
  });

  it("single active payment: localized date + method and a direct reverse action", () => {
    renderDisclosure([payment()]);
    expect(screen.getByText("11.09.2026 · Keš")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Poništi isplatu" })).toBeInTheDocument();
    // No extra expandable step for the single-payment case.
    expect(screen.queryByText(/Istorija/)).toBeNull();
  });

  it("uses the obligation currency, never a hardcoded RSD", () => {
    renderDisclosure([payment({ currency: "EUR" })]);
    fireEvent.click(
      screen.queryByRole("button", { name: "Poništi isplatu" })!
    );
    const dialog = screen.getByRole("dialog");
    // Query matchers see the normalized (regular-space) text; the NBSP contract
    // is pinned by the formatAmount unit test.
    expect(dialog).toHaveTextContent("20.000 EUR");
  });

  it("single reversed payment: shown as audit history with no reverse action", () => {
    renderDisclosure([payment({ reversed: true })]);
    expect(screen.getByText("Poništeno")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Poništi isplatu" })).toBeNull();
  });

  it("multiple payments: one secondary action expands a scannable list of all rows", () => {
    renderDisclosure([
      payment({ id: "p1", paidOn: "2026-09-11", method: "cash" }),
      payment({
        id: "p2",
        amount: 50000,
        paidOn: "2026-09-01",
        method: "bank",
        note: "avans",
      }),
      payment({
        id: "p3",
        amount: 10000,
        paidOn: "2026-08-30",
        method: "other",
        reversed: true,
      }),
    ]);

    // The history action is tied to the paid amount; count comes from the label.
    const toggle = screen.getByText("3 isplata · Istorija");
    expect(toggle).toBeInTheDocument();
    expect(screen.queryByText(/Evidentirane isplate/)).toBeNull();

    fireEvent.click(toggle);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    // Newest first: date · method visible, amount right-aligned, note below,
    // reversed badge without action.
    expect(within(items[0]).getByText("11.09.2026 · Keš")).toBeInTheDocument();
    expect(within(items[0]).getByText("20.000 RSD")).toBeInTheDocument();
    expect(within(items[1]).getByText("01.09.2026 · Banka")).toBeInTheDocument();
    expect(within(items[1]).getByText("avans")).toBeInTheDocument();
    expect(within(items[2]).getByText("Poništeno")).toBeInTheDocument();
    // Two active rows offer reversal; the reversed one does not.
    expect(screen.getAllByRole("button", { name: "Poništi isplatu" })).toHaveLength(2);
  });

  it("view-only (no management) sees history but no reverse actions", () => {
    renderDisclosure(
      [
        payment({ id: "p1" }),
        payment({ id: "p2", reversed: true }),
      ],
      false
    );
    fireEvent.click(screen.getByText("2 isplata · Istorija"));
    expect(screen.queryByRole("button", { name: "Poništi isplatu" })).toBeNull();
    expect(screen.getByText("Poništeno")).toBeInTheDocument();
  });

  it("expandAll renders the full list directly, without the toggle step", () => {
    renderDisclosure(
      [
        payment({ id: "p1", paidOn: "2026-09-11" }),
        payment({ id: "p2", amount: 50000, paidOn: "2026-09-01" }),
      ],
      true,
      "2 isplata · Istorija",
      true
    );
    // Drawer mode: the list is already open, so the toggle label is gone.
    expect(screen.queryByText(/Istorija/)).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("11.09.2026 · Keš")).toBeInTheDocument();
    expect(screen.getByText("20.000 RSD")).toBeInTheDocument();
  });
});
