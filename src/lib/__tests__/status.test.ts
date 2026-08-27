import { describe, expect, it } from "vitest";
import { addDays, subDays } from "date-fns";
import { deriveStatus, medicalStatus } from "@/lib/status";

// Fixed `now` makes both functions deterministic across date boundaries
// (Test 4). All expected statuses are exactly the calendar-day boundary cases
// from the D-12/D-34 status model.
const NOW = new Date("2026-08-27T12:00:00Z");

describe("deriveStatus", () => {
  it("is red when there is no record or expired (null value)", () => {
    // Test 1 — null -> red (no record or expired, D-12)
    expect(deriveStatus(null, 30, NOW)).toBe("red");
  });

  it("is green/yellow/red by calendar-day threshold boundary (inclusive at threshold)", () => {
    // Test 2 — D-12: green beyond threshold, yellow at/within threshold, red expired.
    expect(deriveStatus(addDays(NOW, 45), 30, NOW)).toBe("green");
    expect(deriveStatus(addDays(NOW, 30), 30, NOW)).toBe("yellow"); // == threshold -> yellow
    expect(deriveStatus(addDays(NOW, 0), 30, NOW)).toBe("yellow"); // today -> yellow
    expect(deriveStatus(subDays(NOW, 1), 30, NOW)).toBe("red"); // yesterday -> red
  });

  it("handles a future date far beyond the threshold as green", () => {
    expect(deriveStatus(addDays(NOW, 90), 30, NOW)).toBe("green");
  });

  it("handles a record expiring exactly tomorrow within the threshold", () => {
    expect(deriveStatus(addDays(NOW, 1), 30, NOW)).toBe("yellow");
  });
});

describe("medicalStatus", () => {
  it("is not_recorded when there is no examination", () => {
    // Test 3 — null -> not_recorded (D-34)
    expect(medicalStatus(null, 30, NOW)).toBe("not_recorded");
  });

  it("maps far-future / near-future / expired dates to the medical tones", () => {
    // Test 3 — D-34: Valid / Expiring soon / Expired (+ not_recorded above).
    expect(medicalStatus(addDays(NOW, 45), 30, NOW)).toBe("valid");
    expect(medicalStatus(addDays(NOW, 10), 30, NOW)).toBe("expiring_soon");
    expect(medicalStatus(subDays(NOW, 1), 30, NOW)).toBe("expired");
  });

  it("is expiring_soon at exactly the threshold boundary", () => {
    expect(medicalStatus(addDays(NOW, 30), 30, NOW)).toBe("expiring_soon");
  });
});

describe("determinism", () => {
  it("a fixed now param makes deriveStatus deterministic", () => {
    // Test 4 — same inputs + fixed now => same output across calls.
    const a = deriveStatus("2026-09-01T00:00:00Z" as unknown as Date, 30, NOW);
    const b = deriveStatus("2026-09-01T00:00:00Z" as unknown as Date, 30, NOW);
    expect(a).toBe(b);
  });

  it("a fixed now param makes medicalStatus deterministic", () => {
    const a = medicalStatus("2026-09-01T00:00:00Z" as unknown as Date, 30, NOW);
    const b = medicalStatus("2026-09-01T00:00:00Z" as unknown as Date, 30, NOW);
    expect(a).toBe(b);
  });
});
