import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { ToastProvider } from "@/components/ui/Toast";

afterEach(cleanup);

const SUCCESS = "Zapis je obrisan";
const ERROR = "Nije moguće obrisati zapis. Pokušajte ponovo.";

function Harness({
  action,
  pendingLabel,
}: {
  action: (formData: FormData) => Promise<unknown>;
  pendingLabel?: string;
}) {
  return (
    <ToastProvider dismissLabel="Zatvori">
      <ConfirmDeleteButton
        action={action}
        hiddenFields={{ id: "1" }}
        triggerLabel="Obriši"
        title="Obriši zapis"
        body="Da li ste sigurni?"
        confirmLabel="Potvrdi brisanje"
        cancelLabel="Otkaži"
        successMessage={SUCCESS}
        errorMessage={ERROR}
        pendingLabel={pendingLabel}
      />
    </ToastProvider>
  );
}

function deferred() {
  let resolve!: (value?: unknown) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("ConfirmDeleteButton", () => {
  it("closes only after the server confirms and shows the success toast", async () => {
    const action = vi.fn(async () => undefined);
    render(<Harness action={action} />);

    fireEvent.click(screen.getByRole("button", { name: "Obriši" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Potvrdi brisanje" })
    );

    expect(await screen.findByRole("status")).toHaveTextContent(SUCCESS);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("keeps the dialog open and shows the error toast on failure", async () => {
    const action = vi.fn(async () => {
      throw new Error("row-level security policy violated");
    });
    render(<Harness action={action} />);

    fireEvent.click(screen.getByRole("button", { name: "Obriši" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Potvrdi brisanje",
      })
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(ERROR);
    expect(alert).not.toHaveTextContent("row-level security");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("disables the confirm button and blocks double submit while pending", async () => {
    const { promise, resolve } = deferred();
    const action = vi.fn(() => promise);
    render(<Harness action={action} pendingLabel="Brisanje..." />);

    fireEvent.click(screen.getByRole("button", { name: "Obriši" }));
    const confirm = within(screen.getByRole("dialog")).getByRole("button", {
      name: "Potvrdi brisanje",
    });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(confirm).toBeDisabled());
    expect(confirm).toHaveTextContent("Brisanje...");
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).toBeNull();

    await act(async () => {
      resolve();
    });
    expect(await screen.findByRole("status")).toHaveTextContent(SUCCESS);
  });
});
