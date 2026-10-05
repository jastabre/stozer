import { describe, expect, it } from "vitest";
import { deriveAccountStatus } from "@/lib/account-status";

const now = new Date("2026-09-21T12:00:00.000Z");

describe("deriveAccountStatus", () => {
  it("returns none without an account", () => {
    expect(deriveAccountStatus(null, now)).toBe("none");
  });

  it("treats an unconfirmed invited account as invited", () => {
    expect(
      deriveAccountStatus(
        { invited_at: "2026-09-20T10:00:00.000Z", email_confirmed_at: null },
        now
      )
    ).toBe("invited");
  });

  it("treats an unconfirmed self-registered account as invited (never signed in)", () => {
    expect(deriveAccountStatus({ invited_at: null }, now)).toBe("invited");
  });

  it("treats a confirmed or previously signed-in account as active", () => {
    expect(
      deriveAccountStatus({ email_confirmed_at: "2026-09-01T10:00:00.000Z" }, now)
    ).toBe("active");
    expect(
      deriveAccountStatus({ last_sign_in_at: "2026-09-19T10:00:00.000Z" }, now)
    ).toBe("active");
  });

  it("treats a future ban as disabled and a past ban as active", () => {
    expect(
      deriveAccountStatus({ banned_until: "2030-01-01T00:00:00.000Z" }, now)
    ).toBe("disabled");
    expect(
      deriveAccountStatus(
        {
          banned_until: "2026-01-01T00:00:00.000Z",
          email_confirmed_at: "2025-01-01T00:00:00.000Z",
        },
        now
      )
    ).toBe("active");
  });
});
