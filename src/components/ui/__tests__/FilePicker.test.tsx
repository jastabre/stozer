import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FilePicker } from "../FilePicker";

afterEach(cleanup);

const LABELS = {
  choose: "Izaberi fajl",
  change: "Promeni",
  hint: "PDF, JPG ili PNG • do 10 MB",
};

describe("FilePicker", () => {
  it("shows the custom UI and never the native file-input copy", () => {
    const { container } = render(
      <FilePicker
        name="file"
        accept="application/pdf,image/jpeg,image/png"
        required
        labels={LABELS}
      />
    );

    expect(screen.getByText("Izaberi fajl")).toBeInTheDocument();
    expect(screen.getByText("PDF, JPG ili PNG • do 10 MB")).toBeInTheDocument();

    // No raw browser copy ever reaches the UI.
    expect(screen.queryByText(/choose file/i)).toBeNull();
    expect(screen.queryByText(/no file chosen/i)).toBeNull();

    // The real input stays in the DOM (inside the form) but is visually hidden.
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.name).toBe("file");
    expect(input).toHaveClass("sr-only");
  });

  it("shows the chosen filename, size and the change affordance", () => {
    const { container } = render(
      <FilePicker
        name="file"
        accept="application/pdf,image/jpeg,image/png"
        required
        labels={LABELS}
      />
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array(1536)], "ugovor-marko.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("ugovor-marko.pdf")).toBeInTheDocument();
    expect(screen.getByText("1.5 KB")).toBeInTheDocument();
    expect(screen.getByText("Promeni")).toBeInTheDocument();
    expect(screen.queryByText("Izaberi fajl")).toBeNull();
  });
});
