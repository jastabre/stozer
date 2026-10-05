import { describe, expect, it } from "vitest";
import {
  hasContactChannel,
  relationshipOptionsFor,
  resolvePreferredContact,
  shouldShowGuardiansTab,
} from "@/lib/guardian";

const standard = [
  { value: "Otac", label: "Otac" },
  { value: "Majka", label: "Majka" },
  { value: "Staratelj", label: "Staratelj" },
];

describe("resolvePreferredContact", () => {
  it("keeps an explicit preference when its channel exists", () => {
    expect(resolvePreferredContact("email", true, true)).toBe("email");
    expect(resolvePreferredContact("phone", true, true)).toBe("phone");
  });

  it("falls back to the surviving channel when the preferred one is cleared", () => {
    // Email deleted, preferred was email, phone present -> phone.
    expect(resolvePreferredContact("email", true, false)).toBe("phone");
    // Phone deleted, preferred was phone, email present -> email.
    expect(resolvePreferredContact("phone", false, true)).toBe("email");
  });

  it("derives the preference automatically when only one channel exists", () => {
    expect(resolvePreferredContact(null, true, false)).toBe("phone");
    expect(resolvePreferredContact(null, false, true)).toBe("email");
  });

  it("returns null when there is no channel at all", () => {
    expect(resolvePreferredContact("email", false, false)).toBeNull();
    expect(resolvePreferredContact(null, false, false)).toBeNull();
  });
});

describe("hasContactChannel", () => {
  it("requires at least one non-blank channel", () => {
    expect(hasContactChannel("064 123", null)).toBe(true);
    expect(hasContactChannel("", "a@b.com")).toBe(true);
    expect(hasContactChannel("   ", "")).toBe(false);
    expect(hasContactChannel(null, null)).toBe(false);
  });
});

describe("relationshipOptionsFor", () => {
  it("returns only the standard options for a new guardian", () => {
    expect(relationshipOptionsFor(standard)).toEqual(standard);
    expect(relationshipOptionsFor(standard, "")).toEqual(standard);
    expect(relationshipOptionsFor(standard, null)).toEqual(standard);
  });

  it("returns the standard options unchanged for a known value", () => {
    expect(relationshipOptionsFor(standard, "Majka")).toEqual(standard);
  });

  it("appends a legacy value so it can be preserved on edit", () => {
    const result = relationshipOptionsFor(standard, "baka");
    expect(result).toHaveLength(standard.length + 1);
    expect(result.at(-1)).toEqual({ value: "baka", label: "baka" });
  });

  it("trims the legacy value and matches it against the options", () => {
    expect(relationshipOptionsFor(standard, "  baka  ").at(-1)).toEqual({
      value: "baka",
      label: "baka",
    });
  });
});

describe("shouldShowGuardiansTab", () => {
  it("shows for a minor even with no records", () => {
    expect(shouldShowGuardiansTab({ canView: true, isMinor: true, guardianCount: 0 })).toBe(true);
  });

  it("shows for an adult that already has records (historical data)", () => {
    expect(shouldShowGuardiansTab({ canView: true, isMinor: false, guardianCount: 2 })).toBe(true);
  });

  it("hides for an adult with no records", () => {
    expect(shouldShowGuardiansTab({ canView: true, isMinor: false, guardianCount: 0 })).toBe(false);
  });

  it("hides without permission regardless of age", () => {
    expect(shouldShowGuardiansTab({ canView: false, isMinor: true, guardianCount: 5 })).toBe(false);
  });
});
