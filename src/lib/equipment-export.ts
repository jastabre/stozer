import ExcelJS from "exceljs";
import { formatClubAthleteNumber } from "@/lib/athlete-id";

export interface EquipmentExportPlayer {
  athlete_id: string;
  first_name: string;
  last_name: string;
  club_athlete_number: number;
  jersey_number: number | null;
  jersey_name: string | null;
}

/** Seeded piece type names that map to export columns. */
export const EQUIPMENT_EXPORT_PIECES = [
  { key: "match_top", header: "Dres — gornji deo", piece: "Match Shirt", width: 14 },
  { key: "match_bottom", header: "Dres — donji deo", piece: "Match Shorts", width: 14 },
  { key: "tracksuit_top", header: "Trenerka — gornji deo", piece: "Tracksuit Top", width: 16 },
  { key: "tracksuit_bottom", header: "Trenerka — donji deo", piece: "Tracksuit Bottom", width: 16 },
  { key: "training_shirt", header: "Trening majica", piece: "Training Shirt", width: 14 },
  { key: "training_shorts", header: "Trening šorc", piece: "Training Shorts", width: 14 },
] as const;

/**
 * Build the per-team equipment/order XLSX from SAVED size profiles, the
 * current-season jersey number and the jersey name (natpis, falls back to the
 * surname). Pure: the caller supplies the size lookup, so this is unit
 * testable without a database.
 */
export function buildEquipmentWorkbook({
  players,
  teamName,
  sizeForPlayerPiece,
}: {
  players: EquipmentExportPlayer[];
  teamName: string;
  sizeForPlayerPiece: (athleteId: string, pieceName: string) => string;
}): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("oprema");
  sheet.columns = [
    { header: "Ime", key: "first_name", width: 16 },
    { header: "Prezime", key: "last_name", width: 16 },
    { header: "Klupski ID", key: "club_id", width: 12 },
    { header: "Tim", key: "team", width: 16 },
    { header: "Broj dresa", key: "jersey_number", width: 10 },
    { header: "Natpis na dresu", key: "jersey_name", width: 16 },
    ...EQUIPMENT_EXPORT_PIECES.map(({ key, header, width }) => ({
      header,
      key,
      width,
    })),
  ];

  for (const player of players) {
    const row: Record<string, string | number> = {
      first_name: player.first_name,
      last_name: player.last_name,
      club_id: formatClubAthleteNumber(player.club_athlete_number),
      team: teamName,
      jersey_number: player.jersey_number ?? "",
      jersey_name: player.jersey_name || player.last_name,
    };
    for (const { key, piece } of EQUIPMENT_EXPORT_PIECES) {
      row[key] = sizeForPlayerPiece(player.athlete_id, piece);
    }
    sheet.addRow(row);
  }

  return workbook;
}
