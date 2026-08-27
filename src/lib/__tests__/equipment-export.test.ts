import { describe, expect, it } from "vitest";
import { buildEquipmentExportCsv } from "@/lib/equipment-export";
import type { EquipmentType, PlayerEquipmentRow } from "@/lib/equipment";

const type = (id: string, name: string): EquipmentType => ({
  id,
  organization_id: "org",
  name,
  size_model: "single",
  enabled: true,
  is_club_property: true,
  sort_order: 1,
  created_at: "",
  updated_at: "",
});

const row = (lastName: string, state: "issued" | "missing"): PlayerEquipmentRow => ({
  athlete_id: lastName,
  first_name: "Ana",
  last_name: lastName,
  club_athlete_number: 7,
  team_id: "team",
  jersey_number: 10,
  items: [{
    id: "item",
    organization_id: "org",
    athlete_id: lastName,
    equipment_type_id: "kit",
    size_value: state === "issued" ? "M" : null,
    size_value_upper: null,
    state,
    issued_at: null,
    returned_at: null,
    note: null,
    created_at: "",
    updated_at: "",
    equipment_type: type("kit", "Kit"),
  }],
  summary: { complete: state === "issued", missing: state === "missing", not_issued: state === "missing", lost_or_damaged: false },
});

describe("buildEquipmentExportCsv", () => {
  it("renders identity, jersey, size, and issue state columns", () => {
    const csv = buildEquipmentExportCsv([row("Petrović", "issued")], [type("kit", "Match Kit")]);
    expect(csv).toContain("surname,first name,club athlete ID,jersey number,Match Kit");
    expect(csv).toContain("Petrović,Ana,C0007,10,M · issued");
  });

  it("filters rows to athletes missing a selected type", () => {
    const csv = buildEquipmentExportCsv([row("Ready", "issued"), row("Needs", "missing")], [type("kit", "Kit")], { onlyMissing: true });
    expect(csv).toContain("Needs,Ana");
    expect(csv).not.toContain("Ready,Ana");
  });

  it("limits output to the selected type ids", () => {
    const second = type("tracksuit", "Tracksuit");
    const csv = buildEquipmentExportCsv([row("Ready", "issued")], [type("kit", "Kit"), second], { types: ["tracksuit"] });
    expect(csv).toContain("jersey number,Tracksuit");
    expect(csv).not.toContain(",Kit");
  });

  it("escapes formula-leading names and CSV punctuation", () => {
    const dangerous = { ...row("=SUM(A1)", "issued"), first_name: "A,na" };
    const csv = buildEquipmentExportCsv([dangerous], [type("kit", "Kit")]);
    expect(csv).toContain("'=SUM(A1),\"A,na\"");
  });
});
