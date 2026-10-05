import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";
import { ReversePaymentButton } from "../ReversePaymentButton";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

afterEach(cleanup);

const labels = {
  action: "Poništi isplatu",
  title: "Poništiti ovu evidentiranu isplatu od {amount}?",
  body: "Isplata više neće biti uračunata u plaćeni iznos. Zapis će ostati sačuvan kao poništen.",
  cancel: "Otkaži",
  pending: "Poništavanje...",
};

function renderButton(action: (formData: FormData) => Promise<void>) {
  return render(
    <ToastProvider dismissLabel="Zatvori">
      <ReversePaymentButton
        action={action}
        paymentId="p1"
        athleteId="a1"
        amount={150000}
        currency="RSD"
        labels={labels}
      />
    </ToastProvider>
  );
}

describe("ReversePaymentButton", () => {
  it("is just a discreet trigger until clicked — no action runs without confirmation", async () => {
    const action = vi.fn(async () => {});
    renderButton(action);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Poništi isplatu" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(labels.body)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Otkaži" })).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("interpolates the formatted amount into the confirmation title", async () => {
    renderButton(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Poništi isplatu" }));
    const dialog = await screen.findByRole("dialog");
    // Dialog text is whitespace-normalized here; the formatAmount unit test
    // pins the non-breaking space between amount and currency.
    expect(within(dialog).getByRole("heading")).toHaveTextContent("150.000 RSD");
  });

  it("closes on Otkaži without running the action", async () => {
    const action = vi.fn(async () => {});
    renderButton(action);
    fireEvent.click(screen.getByRole("button", { name: "Poništi isplatu" }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: "Otkaži" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(action).not.toHaveBeenCalled();
  });

  it("submits the payment id once, blocks double-submit while pending, then closes", async () => {
    let release!: () => void;
    const captured: FormData[] = [];
    const action = vi.fn(
      (formData: FormData) =>
        new Promise<void>((resolve) => {
          captured.push(formData);
          release = resolve;
        })
    );
    renderButton(action);
    fireEvent.click(screen.getByRole("button", { name: "Poništi isplatu" }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.submit(dialog.querySelector("form")!);
    const confirm = await within(dialog).findByRole("button", {
      name: "Poništavanje...",
    });
    expect(confirm).toBeDisabled();

    // Double-submit attempt while the action is in flight: the button is
    // disabled (spinner shown), so repeated clicks can't reach the action.
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(action).toHaveBeenCalledTimes(1);
    expect(captured[0].get("payment_id")).toBe("p1");
    expect(captured[0].get("athlete_id")).toBe("a1");

    release();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
