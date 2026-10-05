import { describe, expect, it } from "vitest";
import { isRawBackendError, safeFeedbackMessage } from "../feedback";

describe("safeFeedbackMessage", () => {
  it("keeps short user-facing messages", () => {
    expect(safeFeedbackMessage("Igrač je već u sastavu.", "fallback")).toBe(
      "Igrač je već u sastavu."
    );
  });

  it("falls back for raw Postgres text", () => {
    expect(
      safeFeedbackMessage(
        'duplicate key value violates unique constraint "athletes_email_key"',
        "fallback"
      )
    ).toBe("fallback");
  });

  it("keeps the human prefix of prefixed backend errors", () => {
    expect(
      safeFeedbackMessage(
        "Greška pri čuvanju valute: duplicate key value violates unique constraint",
        "fallback"
      )
    ).toBe("Greška pri čuvanju valute.");
  });

  it("falls back for sanitized production server errors and stacks", () => {
    expect(
      safeFeedbackMessage(
        "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details.",
        "fallback"
      )
    ).toBe("fallback");
    expect(safeFeedbackMessage("Error: boom\n    at foo (bar.ts:1:1)", "fallback")).toBe(
      "fallback"
    );
  });

  it("falls back for empty, oversized and non-string values", () => {
    expect(safeFeedbackMessage("", "fallback")).toBe("fallback");
    expect(safeFeedbackMessage(undefined, "fallback")).toBe("fallback");
    expect(safeFeedbackMessage({ message: "x" }, "fallback")).toBe("fallback");
    expect(safeFeedbackMessage("x".repeat(200), "fallback")).toBe("fallback");
  });

  it("detects raw backend markers", () => {
    expect(isRawBackendError("PGRST116")).toBe(true);
    expect(isRawBackendError("Nema aktivne sezone")).toBe(false);
  });
});
