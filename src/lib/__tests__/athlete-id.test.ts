import { describe, expect, it } from "vitest";
import {
  buildClubAthleteNumber,
  formatClubAthleteNumber,
} from "@/lib/athlete-id";

describe("formatClubAthleteNumber", () => {
  it("formats 1 as C0001 (zero-padded to 4 digits)", () => {
    expect(formatClubAthleteNumber(1)).toBe("C0001");
  });

  it("formats 42 as C0042", () => {
    expect(formatClubAthleteNumber(42)).toBe("C0042");
  });

  it("formats 12345 as C12345 (no padding beyond 4 digits)", () => {
    expect(formatClubAthleteNumber(12345)).toBe("C12345");
  });

  it("formats 9999 as C9999 (exactly 4 digits, no extra padding)", () => {
    expect(formatClubAthleteNumber(9999)).toBe("C9999");
  });
});

describe("buildClubAthleteNumber", () => {
  it("returns the next counter value (counter + 1)", () => {
    expect(buildClubAthleteNumber({ club_athlete_counter: 0 })).toBe(1);
    expect(buildClubAthleteNumber({ club_athlete_counter: 41 })).toBe(42);
  });

  it("does not mutate the org object", () => {
    const org = { club_athlete_counter: 7 };
    buildClubAthleteNumber(org);
    expect(org.club_athlete_counter).toBe(7);
  });
});
