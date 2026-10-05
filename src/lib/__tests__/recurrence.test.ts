import { describe, expect, it } from "vitest";
import { expandRecurrence } from "@/lib/recurrence";

describe("expandRecurrence", () => {
  it("expands Mon/Wed/Fri between two dates (inclusive)", () => {
    // 2026-09-01 is a Tuesday. Mondays(1), Wednesdays(3), Fridays(5).
    const dates = expandRecurrence(
      { weekdays: [1, 3, 5], until: "2026-09-11" },
      "2026-09-01"
    );
    expect(dates).toEqual([
      "2026-09-02", // Wednesday
      "2026-09-04", // Friday
      "2026-09-07", // Monday
      "2026-09-09", // Wednesday
      "2026-09-11", // Friday (inclusive until)
    ]);
  });

  it("includes the start date when it matches a weekday", () => {
    // 2026-09-04 is a Friday.
    const dates = expandRecurrence({ weekdays: [5], until: "2026-09-04" }, "2026-09-04");
    expect(dates).toEqual(["2026-09-04"]);
  });

  it("returns an empty array when start is after until", () => {
    const dates = expandRecurrence({ weekdays: [1], until: "2026-09-01" }, "2026-09-10");
    expect(dates).toEqual([]);
  });
});
