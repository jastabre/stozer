import { describe, expect, it } from "vitest";
import {
  formatDmy,
  isValidCalendarDate,
  isCompleteValidDmy,
  parseDmy,
} from "@/lib/date-format";

describe("parseDmy (DD.MM.GGGG -> ISO YYYY-MM-DD)", () => {
  it("parses a standard date", () => {
    expect(parseDmy("05.09.2026")).toBe("2026-09-05");
  });

  it("accepts an old date for direct DOB entry", () => {
    expect(parseDmy("12.05.2001")).toBe("2001-05-12");
  });

  it("accepts unpadded day/month", () => {
    expect(parseDmy("5.9.2026")).toBe("2026-09-05");
    expect(parseDmy("12.5.2001")).toBe("2001-05-12");
  });

  it("accepts a leap-day on a leap year", () => {
    expect(parseDmy("29.02.2024")).toBe("2024-02-29");
    expect(parseDmy("29.02.2000")).toBe("2000-02-29"); // divisible by 400
  });

  it("rejects a leap-day on a non-leap year", () => {
    expect(parseDmy("29.02.2025")).toBeNull();
    expect(parseDmy("29.02.2100")).toBeNull(); // century not divisible by 400
  });

  it("rejects impossible calendar days", () => {
    expect(parseDmy("31.02.2026")).toBeNull();
    expect(parseDmy("31.04.2026")).toBeNull(); // April has 30 days
    expect(parseDmy("00.01.2026")).toBeNull();
  });

  it("rejects malformed or incomplete input", () => {
    expect(parseDmy("12.05.200")).toBeNull();
    expect(parseDmy("2026-09-05")).toBeNull(); // ISO is not DD.MM.GGGG
    expect(parseDmy("")).toBeNull();
    expect(parseDmy(null)).toBeNull();
    expect(parseDmy(undefined)).toBeNull();
  });

  it("is timezone independent (UTC-based)", () => {
    // Parsing must not shift the day regardless of the host zone.
    expect(parseDmy("01.01.2000")).toBe("2000-01-01");
    expect(parseDmy("31.12.2026")).toBe("2026-12-31");
  });
});

describe("isValidCalendarDate", () => {
  it("validates real days", () => {
    expect(isValidCalendarDate(2024, 2, 29)).toBe(true);
    expect(isValidCalendarDate(2025, 2, 29)).toBe(false);
    expect(isValidCalendarDate(2026, 2, 31)).toBe(false);
    expect(isValidCalendarDate(2026, 13, 1)).toBe(false);
    expect(isValidCalendarDate(999, 1, 1)).toBe(false);
  });
});

describe("formatDmy (ISO -> DD.MM.GGGG)", () => {
  it("formats an ISO date", () => {
    expect(formatDmy("2026-09-05")).toBe("05.09.2026");
    expect(formatDmy("2001-05-12")).toBe("12.05.2001");
  });

  it("returns empty string for empty or invalid input", () => {
    expect(formatDmy(null)).toBe("");
    expect(formatDmy(undefined)).toBe("");
    expect(formatDmy("not-a-date")).toBe("");
  });
});

describe("round trip + completeness", () => {
  it("parse then format is identity for canonical dates", () => {
    for (const v of ["05.09.2026", "29.02.2024", "12.05.2001", "31.12.2026"]) {
      expect(formatDmy(parseDmy(v))).toBe(v);
    }
  });

  it("isCompleteValidDmy mirrors parseDmy", () => {
    expect(isCompleteValidDmy("29.02.2025")).toBe(false);
    expect(isCompleteValidDmy("29.02.2024")).toBe(true);
    expect(isCompleteValidDmy("5.9.2026")).toBe(true);
  });
});
