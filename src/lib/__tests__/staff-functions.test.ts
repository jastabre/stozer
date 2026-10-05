import { describe, expect, it } from "vitest";
import {
  staffFunctionHasTeamScope,
  staffFunctionKey,
  staffFunctionLabel,
  staffFunctionRequiresLicense,
  staffFunctionsHaveTeamScope,
  staffFunctionsRequireLicense,
} from "@/lib/staff-functions";

describe("staff function license relevance", () => {
  it("flags licensed functions across stored labels in both locales", () => {
    expect(staffFunctionRequiresLicense("Trener")).toBe(true);
    expect(staffFunctionRequiresLicense("Coach")).toBe(true);
    expect(staffFunctionRequiresLicense("Pomoćni trener")).toBe(true);
    expect(staffFunctionRequiresLicense("Assistant coach")).toBe(true);
    expect(staffFunctionRequiresLicense("Fizioterapeut")).toBe(true);
    expect(staffFunctionRequiresLicense("Physiotherapist")).toBe(true);
  });

  it("does not flag functions without a license obligation", () => {
    expect(staffFunctionRequiresLicense("Predsednik")).toBe(false);
    expect(staffFunctionRequiresLicense("President")).toBe(false);
    expect(staffFunctionRequiresLicense("Sekretar")).toBe(false);
    expect(staffFunctionRequiresLicense("Ekonom")).toBe(false);
  });

  it("treats custom and empty functions as not license-tracked", () => {
    expect(staffFunctionRequiresLicense("Vozač")).toBe(false);
    expect(staffFunctionRequiresLicense("")).toBe(false);
    expect(staffFunctionRequiresLicense(null)).toBe(false);
    expect(staffFunctionKey("Vozač")).toBeNull();
  });
});

describe("staff function team scope", () => {
  it("flags coaching functions as team-scoped in both locales", () => {
    expect(staffFunctionHasTeamScope("Trener")).toBe(true);
    expect(staffFunctionHasTeamScope("Coach")).toBe(true);
    expect(staffFunctionHasTeamScope("Trener golmana")).toBe(true);
  });

  it("does not flag non-team functions or custom values", () => {
    expect(staffFunctionHasTeamScope("Predsednik")).toBe(false);
    expect(staffFunctionHasTeamScope("Sekretar")).toBe(false);
    expect(staffFunctionHasTeamScope("Vozač")).toBe(false);
    expect(staffFunctionHasTeamScope(null)).toBe(false);
  });
});

describe("staff functions from stored rows", () => {
  it("tracks a license when ANY assigned function requires one", () => {
    expect(
      staffFunctionsRequireLicense([
        { function_key: "sport_director" },
        { function_key: "coach" },
      ])
    ).toBe(true);
    expect(
      staffFunctionsRequireLicense([{ function_key: "sport_director" }])
    ).toBe(false);
    expect(
      staffFunctionsRequireLicense([
        { function_key: "custom", custom_label: "Vozač" },
      ])
    ).toBe(false);
    expect(staffFunctionsRequireLicense([])).toBe(false);
  });

  it("applies team scope when ANY assigned function is team-scoped", () => {
    expect(
      staffFunctionsHaveTeamScope([
        { function_key: "sport_director" },
        { function_key: "assistant_coach" },
      ])
    ).toBe(true);
    expect(
      staffFunctionsHaveTeamScope([{ function_key: "sport_director" }])
    ).toBe(false);
    expect(staffFunctionsHaveTeamScope([])).toBe(false);
  });

  it("localizes preset labels and falls back to the custom label", () => {
    expect(staffFunctionLabel("coach", "sr")).toBe("Trener");
    expect(staffFunctionLabel("coach", "en")).toBe("Coach");
    expect(staffFunctionLabel("custom", "sr", "Vozač")).toBe("Vozač");
  });
});
