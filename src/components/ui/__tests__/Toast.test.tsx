import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider, useToast } from "../Toast";

afterEach(cleanup);

function Harness() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success("Promene su sačuvane")}>ok</button>
      <button onClick={() => toast.error("Nije moguće sačuvati promene.")}>
        fail
      </button>
    </div>
  );
}

function renderHarness() {
  return render(
    <ToastProvider dismissLabel="Zatvori">
      <Harness />
    </ToastProvider>
  );
}

describe("ToastProvider", () => {
  it("shows a success toast with status semantics", () => {
    renderHarness();
    fireEvent.click(screen.getByRole("button", { name: "ok" }));

    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("Promene su sačuvane");
  });

  it("shows an error toast as an alert", () => {
    renderHarness();
    fireEvent.click(screen.getByRole("button", { name: "fail" }));

    const toast = screen.getByRole("alert");
    expect(toast).toHaveTextContent("Nije moguće sačuvati promene.");
  });

  it("dismisses manually via the close button", () => {
    renderHarness();
    fireEvent.click(screen.getByRole("button", { name: "ok" }));
    expect(screen.getByRole("status")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Zatvori" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("auto-dismisses success after ~4s", () => {
    vi.useFakeTimers();
    try {
      renderHarness();
      fireEvent.click(screen.getByRole("button", { name: "ok" }));
      expect(screen.getByRole("status")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.queryByRole("status")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
