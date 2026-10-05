import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { AdjustmentList, type AdjustmentListLabels } from "../AdjustmentList";
import type { ObligationAdjustmentRecord } from "@/lib/first-team-data";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

afterEach(cleanup);

function renderList(ui: ReactNode) {
  return render(<ToastProvider dismissLabel="Zatvori">{ui}</ToastProvider>);
}

const labels: AdjustmentListLabels = {
  bonus: "Bonus",
  deduction: "Odbitak",
  reversed: "Poništeno",
  reverse: "Poništi korekciju",
  reverseTitle: "Poništiti ovu korekciju od {amount}?",
  reverseBody:
    "Korekcija više neće uticati na iznos za isplatu. Zapis ostaje sačuvan u istoriji kao poništen.",
  cancel: "Otkaži",
  pending: "Poništavanje...",
};

function adjustment(
  over: Partial<ObligationAdjustmentRecord> = {}
): ObligationAdjustmentRecord {
  return {
    id: "adj-1",
    type: "bonus",
    amount: 20000,
    reason: "Bonus za pobedu",
    note: null,
    created_at: "2026-09-01T10:00:00Z",
    reversed_at: null,
    reversal_note: null,
    ...over,
  };
}

describe("AdjustmentList", () => {
  it("renders signed amounts with type and reason", () => {
    renderList(
      <AdjustmentList
        adjustments={[
          adjustment(),
          adjustment({ id: "adj-2", type: "deduction", amount: 10000, reason: "Oprema" }),
        ]}
        currency="RSD"
        athleteId="a1"
        canReverse={false}
        labels={labels}
      />
    );
    // String matchers see the whitespace-normalized text; the formatAmount
    // unit test pins the non-breaking amount/currency separator.
    expect(screen.getByText("+20.000 RSD")).toBeInTheDocument();
    expect(screen.getByText("Bonus · Bonus za pobedu")).toBeInTheDocument();
    expect(screen.getByText("−10.000 RSD")).toBeInTheDocument();
    expect(screen.getByText("Odbitak · Oprema")).toBeInTheDocument();
  });

  it("view-only users see no reverse action (neither active nor reversed)", () => {
    renderList(
      <AdjustmentList
        adjustments={[
          adjustment(),
          adjustment({ id: "adj-2", reversed_at: "2026-09-10T10:00:00Z" }),
        ]}
        currency="RSD"
        athleteId="a1"
        canReverse={false}
        reverseAction={async () => {}}
        labels={labels}
      />
    );
    expect(screen.queryByRole("button", { name: "Poništi korekciju" })).toBeNull();
    expect(screen.getAllByText("Poništeno")).toHaveLength(1);
  });

  it("a reversed adjustment shows the badge and offers no second reversal", () => {
    renderList(
      <AdjustmentList
        adjustments={[adjustment({ reversed_at: "2026-09-10T10:00:00Z" })]}
        currency="RSD"
        athleteId="a1"
        canReverse
        reverseAction={async () => {}}
        labels={labels}
      />
    );
    expect(screen.getByText("Poništeno")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Poništi korekciju" })).toBeNull();
  });

  it("opens the confirmation dialog with the signed amount for an active row", async () => {
    const action = vi.fn(async () => {});
    renderList(
      <AdjustmentList
        adjustments={[adjustment()]}
        currency="RSD"
        athleteId="a1"
        canReverse
        reverseAction={action}
        labels={labels}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Poništi korekciju" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading")).toHaveTextContent("+20.000 RSD");
    expect(within(dialog).getByText(labels.reverseBody)).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });
});
