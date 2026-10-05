import { describe, expect, it } from "vitest";
import {
  buildEquipmentWorkbook,
  type EquipmentExportPlayer,
} from "@/lib/equipment-export";

const player = (
  overrides: Partial<EquipmentExportPlayer> = {}
): EquipmentExportPlayer => ({
  athlete_id: "a1",
  first_name: "Marko",
  last_name: "Krasić",
  club_athlete_number: 12,
  jersey_number: 10,
  jersey_name: "KRASIĆ",
  ...overrides,
});

const SIZES: Record<string, string> = {
  "a1:Match Shirt": "L",
  "a1:Match Shorts": "M",
  "a1:Tracksuit Top": "XL",
  "a1:Tracksuit Bottom": "L",
  "a1:Training Shirt": "L",
  "a1:Training Shorts": "M",
};

function build(players: EquipmentExportPlayer[]) {
  return buildEquipmentWorkbook({
    players,
    teamName: "Prvi tim",
    sizeForPlayerPiece: (athleteId, piece) => SIZES[`${athleteId}:${piece}`] ?? "",
  });
}

describe("buildEquipmentWorkbook", () => {
  it("writes the exact order-export columns", () => {
    const sheet = build([player()]).getWorksheet("oprema")!;
    const header = sheet.getRow(1).values as unknown[];
    expect(header.slice(1)).toEqual([
      "Ime",
      "Prezime",
      "Klupski ID",
      "Tim",
      "Broj dresa",
      "Natpis na dresu",
      "Dres — gornji deo",
      "Dres — donji deo",
      "Trenerka — gornji deo",
      "Trenerka — donji deo",
      "Trening majica",
      "Trening šorc",
    ]);
  });

  it("writes player identity, jersey, jersey name and the saved sizes", () => {
    const sheet = build([player()]).getWorksheet("oprema")!;
    const row = sheet.getRow(2);
    expect(row.getCell(1).value).toBe("Marko");
    expect(row.getCell(2).value).toBe("Krasić");
    expect(row.getCell(3).value).toBeTruthy();
    expect(row.getCell(4).value).toBe("Prvi tim");
    expect(row.getCell(5).value).toBe(10);
    expect(row.getCell(6).value).toBe("KRASIĆ");
    expect(row.getCell(7).value).toBe("L");
    expect(row.getCell(8).value).toBe("M");
    expect(row.getCell(9).value).toBe("XL");
    expect(row.getCell(10).value).toBe("L");
    expect(row.getCell(11).value).toBe("L");
    expect(row.getCell(12).value).toBe("M");
  });

  it("falls back to the surname when the jersey name is missing", () => {
    const sheet = build([player({ jersey_name: null })]).getWorksheet("oprema")!;
    expect(sheet.getRow(2).getCell(6).value).toBe("Krasić");
  });

  it("leaves size cells empty when the profile has no saved size", () => {
    const sheet = build([player({ athlete_id: "a2" })]).getWorksheet("oprema")!;
    expect(sheet.getRow(2).getCell(7).value).toBe("");
  });
});
