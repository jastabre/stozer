import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SettingsCurrency } from "../SettingsCurrency";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

afterEach(cleanup);

type ActionState = { ok?: boolean; error?: string } | null;

function renderCurrency(
  action: (state: ActionState, formData: FormData) => Promise<ActionState>,
  canManage = true
) {
  return render(
    <ToastProvider dismissLabel="Zatvori">
      <SettingsCurrency
        action={action}
        current="RSD"
        canManage={canManage}
        title="Valuta"
        description="Jedna valuta za ceo klub. Promena ne konvertuje postojeće iznose."
        rsdLabel="Srpski dinar (RSD)"
        eurLabel="Evro (EUR)"
        saveLabel="Sačuvaj"
        savingLabel="Čuvanje..."
      />
    </ToastProvider>
  );
}

describe("SettingsCurrency", () => {
  it("saves the selected currency once with a real pending state (no double submit)", async () => {
    let release!: (state: ActionState) => void;
    const action = vi.fn<
      (state: ActionState, formData: FormData) => Promise<ActionState>
    >(
      () =>
        new Promise<ActionState>((resolve) => {
          release = resolve;
        })
    );
    renderCurrency(action);

    fireEvent.change(screen.getByRole("combobox", { name: "Valuta" }), {
      target: { value: "EUR" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sačuvaj" }));

    const pending = await screen.findByRole("button", { name: "Čuvanje..." });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    fireEvent.click(pending);
    expect(action).toHaveBeenCalledTimes(1);
    expect((action.mock.calls[0][1] as FormData).get("currency")).toBe("EUR");

    release({ ok: true });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sačuvaj" })).toBeEnabled()
    );
  });

  it("shows the two human-readable options without raw enum labels", () => {
    renderCurrency(vi.fn(async () => null));

    const select = screen.getByRole("combobox", { name: "Valuta" });
    expect(select).toHaveValue("RSD");
    expect(within(select).getByRole("option", { name: "Srpski dinar (RSD)" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Evro (EUR)" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "RSD" })).toBeNull();
    expect(
      screen.getByText("Jedna valuta za ceo klub. Promena ne konvertuje postojeće iznose.")
    ).toBeInTheDocument();
  });

  it("is read-only without club_settings.manage", () => {
    renderCurrency(vi.fn(async () => null), false);

    expect(screen.queryByRole("button", { name: "Sačuvaj" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Valuta" })).toBeDisabled();
  });
});
