import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";
import {
  BulkAdjustmentDialog,
  type AdjustmentActionState,
  type BulkAdjustmentLabels,
} from "../BulkAdjustmentDialog";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

afterEach(cleanup);

const labels: BulkAdjustmentLabels = {
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

const ATHLETES = ["a1", "a2", "a3"];

function renderDialog(
  action: (state: AdjustmentActionState, formData: FormData) => Promise<AdjustmentActionState>
) {
  return render(
    <ToastProvider dismissLabel="Zatvori">
      <BulkAdjustmentDialog
        action={action}
        athleteIds={ATHLETES}
        period="2026-09"
        type="bonus"
        labels={labels}
      />
    </ToastProvider>
  );
}

async function openAndFill(amount = "10000") {
  fireEvent.click(screen.getByRole("button", { name: "Dodaj bonus" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Iznos po igraču"), {
    target: { value: amount },
  });
  fireEvent.change(within(dialog).getByLabelText("Razlog"), {
    target: { value: "Bonus za pobedu" },
  });
  return dialog;
}

describe("BulkAdjustmentDialog", () => {
  it("shows the selected count and the per-player note", async () => {
    renderDialog(async () => null);
    const dialog = await openAndFill();

    expect(within(dialog).getByText("Odabrano igrača: 3")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Iznos se primenjuje na svakog izabranog igrača.")
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Iznos po igraču")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Razlog")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Napomena")).toBeInTheDocument();
  });

  it("submits every selected athlete with ONE per-player amount, blocks double submit", async () => {
    let release!: (state: AdjustmentActionState) => void;
    const captured: FormData[] = [];
    const action = vi.fn(
      (_state: AdjustmentActionState, formData: FormData) =>
        new Promise<AdjustmentActionState>((resolve) => {
          captured.push(formData);
          release = resolve;
        })
    );
    renderDialog(action);
    const dialog = await openAndFill();

    fireEvent.submit(dialog.querySelector("form")!);
    const submit = await within(dialog).findByRole("button", { name: "Dodavanje..." });
    expect(submit).toBeDisabled();

    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(action).toHaveBeenCalledTimes(1);

    // Same amount for EACH selected player (never split across players).
    expect(captured[0].getAll("athlete_ids")).toEqual(ATHLETES);
    expect(captured[0].get("amount")).toBe("10000");
    expect(captured[0].get("period")).toBe("2026-09");
    expect(captured[0].get("type")).toBe("bonus");
    expect(captured[0].get("reason")).toBe("Bonus za pobedu");

    release({ ok: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes on Otkaži without submitting", async () => {
    const action = vi.fn(async () => null);
    renderDialog(action);
    const dialog = await openAndFill();

    fireEvent.click(within(dialog).getByRole("button", { name: "Otkaži" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(action).not.toHaveBeenCalled();
  });

  it("stays open and shows the blocking player's server error", async () => {
    const action = vi.fn(async () => ({
      error: "Petrović Petar: Odbitak ne može da spusti ukupnu obavezu ispod 0.",
    }));
    renderDialog(action);
    const dialog = await openAndFill();

    fireEvent.submit(dialog.querySelector("form")!);
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("Petrović Petar");
    expect(alert).toHaveTextContent("ispod 0");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
