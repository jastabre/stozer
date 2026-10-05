import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ExportButton } from "../ExportButton";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderButton() {
  return render(
    <ToastProvider dismissLabel="Zatvori">
      <ExportButton
        href="/sr/equipment/export?team_id=team-1"
        label="Izvezi"
        pendingLabel="Kreiranje fajla..."
      />
    </ToastProvider>
  );
}

function stubDownloadEnvironment() {
  const createObjectURL = vi.fn(() => "blob:mock");
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  });
}

describe("ExportButton", () => {
  it("shows the pending state, then the file-ready toast after a successful export", async () => {
    stubDownloadEnvironment();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["xlsx"]),
      headers: new Headers({
        "Content-Disposition": 'attachment; filename="oprema.xlsx"',
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Izvezi" }));

    expect(
      await screen.findByRole("status")
    ).toHaveTextContent("fileReady");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Izvezi" })).toBeEnabled();
  });

  it("shows an error toast and no success when generation fails", async () => {
    stubDownloadEnvironment();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 422 }))
    );

    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Izvezi" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("exportFailed");
    expect(screen.queryByRole("status")).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Izvezi" })).toBeEnabled()
    );
  });
});
