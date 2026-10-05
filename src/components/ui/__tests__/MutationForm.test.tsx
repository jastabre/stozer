import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MutationForm } from "../MutationForm";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { ToastProvider } from "../Toast";

afterEach(cleanup);

const SUCCESS = "Promene su sačuvane";
const ERROR = "Nije moguće sačuvati promene. Pokušajte ponovo.";

function Harness({
  action,
  resetOnSuccess,
}: {
  action: (formData: FormData) => Promise<unknown>;
  resetOnSuccess?: boolean;
}) {
  return (
    <ToastProvider dismissLabel="Zatvori">
      <MutationForm
        action={action}
        successMessage={SUCCESS}
        errorMessage={ERROR}
        resetOnSuccess={resetOnSuccess}
      >
        <input name="title" aria-label="title" defaultValue="hello" />
        <FormSubmitButton idleLabel="Sačuvaj" pendingLabel="Čuvanje..." />
      </MutationForm>
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

describe("MutationForm", () => {
  it("shows real pending state and no toast until the server confirms", async () => {
    const { promise, resolve } = deferred();
    const action = vi.fn(() => promise);
    render(<Harness action={action} />);

    fireEvent.change(screen.getByLabelText("title"), {
      target: { value: "typed" },
    });
    fireEvent.submit(document.querySelector("form")!);

    const button = screen.getByRole("button", { name: "Čuvanje..." });
    expect(button).toBeDisabled();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();

    await act(async () => {
      resolve();
    });

    expect(screen.getByRole("status")).toHaveTextContent(SUCCESS);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("title")).toHaveValue("hello");
  });

  it("blocks double submits while pending", async () => {
    const { promise, resolve } = deferred();
    const action = vi.fn(() => promise);
    render(<Harness action={action} />);

    const form = document.querySelector("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve();
    });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("keeps values and shows an error toast on failure", async () => {
    const action = vi.fn(async () => {
      throw new Error("duplicate key value violates unique constraint");
    });
    render(<Harness action={action} />);

    fireEvent.change(screen.getByLabelText("title"), {
      target: { value: "typed" },
    });
    fireEvent.submit(document.querySelector("form")!);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(ERROR);
    expect(alert).not.toHaveTextContent("duplicate key");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByLabelText("title")).toHaveValue("typed");
  });

  it("shows a specific returned error and sanitizes raw backend text", async () => {
    const specific = vi.fn(async () => ({ error: "Igrač je već u sastavu." }));
    const { unmount } = render(<Harness action={specific} />);
    fireEvent.submit(document.querySelector("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Igrač je već u sastavu."
    );
    unmount();

    const raw = vi.fn(async () => ({
      error: "Greška pri čuvanju: duplicate key value violates unique constraint",
    }));
    render(<Harness action={raw} />);
    fireEvent.submit(document.querySelector("form")!);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Greška pri čuvanju.");
    expect(alert).not.toHaveTextContent("duplicate key");
  });

  it("surfaces a friendly thrown message (e.g. a jersey conflict)", async () => {
    const action = vi.fn(async () => {
      throw new Error("Broj 10 je već dodeljen drugom igraču u ovom timu.");
    });
    render(<Harness action={action} />);

    fireEvent.submit(document.querySelector("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Broj 10 je već dodeljen drugom igraču u ovom timu."
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("treats a redirect rejection as success", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;push;/players;307;",
    });
    const action = vi.fn(async () => {
      throw redirectError;
    });
    render(<Harness action={action} />);

    fireEvent.submit(document.querySelector("form")!);

    expect(await screen.findByRole("status")).toHaveTextContent(SUCCESS);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
