import { NextRequest, NextResponse } from "next/server";
import { getActiveSeason } from "@/lib/club-data";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { getPlayerEquipmentByTeam, listEquipmentTypes } from "@/lib/equipment";
import {
  buildEquipmentWorkbook,
  EQUIPMENT_EXPORT_PIECES,
} from "@/lib/equipment-export";

const PIECE_KEYS: readonly string[] = EQUIPMENT_EXPORT_PIECES.map(
  (piece) => piece.piece
);

/**
 * XLSX equipment/order export for one team. Uses each player's SAVED size
 * profile, the ACTUAL current-season jersey number and the jersey name
 * (natpis, falls back to the player's surname). Team is required — never
 * exports the whole organization.
 */
export async function GET(request: NextRequest) {
  const org = await requireOrganization();
  if (!(await hasPermission("equipment.report"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const supabase = await createServerClient();
  const season = await getActiveSeason(supabase, org.organizationId);
  if (!season) return new NextResponse("No active season", { status: 422 });

  const teamId = request.nextUrl.searchParams.get("team_id");
  if (!teamId) return new NextResponse("Team required", { status: 422 });
  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("id", teamId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!team) return new NextResponse("Team not found", { status: 404 });

  const [players, types] = await Promise.all([
    getPlayerEquipmentByTeam(supabase, org.organizationId, teamId, season.id),
    listEquipmentTypes(supabase, org.organizationId),
  ]);
  const pieceTypeIdByName = new Map(
    types.filter((t) => PIECE_KEYS.includes(t.name)).map((t) => [t.name, t.id])
  );
  const pieceIds = PIECE_KEYS.map((key) => pieceTypeIdByName.get(key)).filter(
    (id): id is string => Boolean(id)
  );
  const athleteIds = players.map((p) => p.athlete_id);

  const { data: sizeRows } =
    athleteIds.length && pieceIds.length
      ? await supabase
          .from("athlete_equipment")
          .select("athlete_id, equipment_type_id, size_value")
          .eq("organization_id", org.organizationId)
          .in("athlete_id", athleteIds)
          .in("equipment_type_id", pieceIds)
      : { data: [] };
  const sizeByKey = new Map(
    (sizeRows ?? []).map((row) => [`${row.athlete_id}:${row.equipment_type_id}`, row.size_value])
  );

  const workbook = buildEquipmentWorkbook({
    players,
    teamName: team.name,
    sizeForPlayerPiece: (athleteId, pieceName) => {
      const typeId = pieceTypeIdByName.get(pieceName);
      return typeId ? (sizeByKey.get(`${athleteId}:${typeId}`) ?? "") : "";
    },
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const slug = (value: string) => value.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const filename = `oprema-${slug(team.name)}-${slug(season.name)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
