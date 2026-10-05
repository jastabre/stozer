import { describe, expect, it } from "vitest";
import {
  combineDateTime,
  formatTime,
  minutesBetween,
  parseTime,
} from "@/lib/date-time";

describe("parseTime", () => {
  it("parses a full HH:MM time", () => {
    expect(parseTime("09:05")).toEqual({ hour: 9, minute: 5 });
  });

  it("accepts a single-digit hour", () => {
    expect(parseTime("9:30")).toEqual({ hour: 9, minute: 30 });
  });

  it("rejects invalid times", () => {
    expect(parseTime("25:00")).toBeNull();
    expect(parseTime("09:60")).toBeNull();
    expect(parseTime("9:5")).toBeNull();
    expect(parseTime("")).toBeNull();
    expect(parseTime(null)).toBeNull();
  });
});

describe("formatTime", () => {
  it("zero-pads to HH:MM", () => {
    expect(formatTime({ hour: 9, minute: 5 })).toBe("09:05");
    expect(formatTime({ hour: 23, minute: 59 })).toBe("23:59");
  });
});

describe("combineDateTime", () => {
  it("combines an ISO date and time into a UTC Date", () => {
    const result = combineDateTime("2026-09-10", { hour: 18, minute: 30 });
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(8); // September is month index 8
    expect(result.getUTCDate()).toBe(10);
    expect(result.getUTCHours()).toBe(18);
    expect(result.getUTCMinutes()).toBe(30);
  });
});

describe("minutesBetween", () => {
  it("computes whole minutes between two timestamps", () => {
    const start = new Date(Date.UTC(2026, 0, 1, 18, 0));
    const end = new Date(Date.UTC(2026, 0, 1, 19, 30));
    expect(minutesBetween(start, end)).toBe(90);
  });
});
