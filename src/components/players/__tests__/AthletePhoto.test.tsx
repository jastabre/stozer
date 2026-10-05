import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";
import { AthletePhoto, type AthletePhotoLabels } from "../AthletePhoto";

afterEach(cleanup);

const LABELS: AthletePhotoLabels = {
  add: "Dodaj fotografiju",
  change: "Promeni fotografiju",
  remove: "Ukloni fotografiju",
  uploading: "Otpremanje...",
  removing: "Uklanjanje...",
  uploaded: "Fotografija je sačuvana",
  removed: "Fotografija je uklonjena",
  uploadFailed: "Greška pri otpremanju",
  removeFailed: "Greška pri uklanjanju",
  removeTitle: "Ukloniti fotografiju?",
  removeBody: "Fotografija će biti uklonjena.",
  removeConfirm: "Ukloni",
  cancel: "Otkaži",
  aria: "Fotografija igrača",
};

function renderPhoto(over: Partial<ComponentProps<typeof AthletePhoto>> = {}) {
  render(
    <ToastProvider dismissLabel="Zatvori">
      <AthletePhoto
        athleteId="a1"
        photoUrl={null}
        initials="MK"
        canEdit={false}
        uploadAction={vi.fn(async () => ({ ok: true }))}
        removeAction={vi.fn(async () => ({ ok: true }))}
        labels={LABELS}
        {...over}
      />
    </ToastProvider>
  );
}

describe("AthletePhoto", () => {
  it("falls back to the initials when there is no photo", () => {
    renderPhoto({ photoUrl: null });
    expect(screen.getByText("MK")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows the photo image when a photo exists", () => {
    renderPhoto({ photoUrl: "https://example.test/signed/photo.jpg" });
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.test/signed/photo.jpg");
    expect(screen.queryByText("MK")).toBeNull();
  });
});
