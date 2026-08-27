import { csvEscaped } from "@/lib/import/rows";
import type { EquipmentType, PlayerEquipmentRow } from "@/lib/equipment";

export interface EquipmentExportOptions {
  onlyMissing?: boolean;
  types?: string[];
}

function itemForType(row: PlayerEquipmentRow, typeId: string) {
  return row.items.find((item) => item.equipment_type_id === typeId);
}

/** Build a spreadsheet-safe team equipment order/export without database access. */
export function buildEquipmentExportCsv(
  rows: PlayerEquipmentRow[],
  includedTypes: EquipmentType[],
  options: EquipmentExportOptions = {}
): string {
  const typeIds = new Set(options.types?.length ? options.types : includedTypes.map((type) => type.id));
  const types = includedTypes.filter((type) => typeIds.has(type.id));
  const selectedRows = rows.filter((row) => {
    if (!options.onlyMissing) return true;
    return types.some((type) => itemForType(row, type.id)?.state !== "issued");
  });
  const headers = ["surname", "first name", "club athlete ID", "jersey number", ...types.map((type) => type.name)];
  const lines = [headers.map(csvEscaped).join(",")];
  for (const row of selectedRows) {
    const values = [
      row.last_name,
      row.first_name,
      `C${String(row.club_athlete_number).padStart(4, "0")}`,
      row.jersey_number ?? "",
      ...types.map((type) => {
        const item = itemForType(row, type.id);
        if (!item) return "missing";
        const size = [item.size_value, item.size_value_upper].filter(Boolean).join(" / ");
        return [size, item.state].filter(Boolean).join(" · ");
      }),
    ];
    lines.push(values.map(csvEscaped).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}
