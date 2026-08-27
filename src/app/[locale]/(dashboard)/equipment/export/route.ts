import { NextRequest, NextResponse } from "next/server";
import { getActiveSeason } from "@/lib/club-data";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { getPlayerEquipmentOverview, listEquipmentTypes } from "@/lib/equipment";
import { buildEquipmentExportCsv } from "@/lib/equipment-export";

export async function GET(request: NextRequest) {
  const org = await requireOrganization();
  if (!(await hasPermission("equipment.report"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const supabase = await createServerClient();
  const season = await getActiveSeason(supabase, org.organizationId);
  if (!season) return new NextResponse("No active season", { status: 422 });
  const params = request.nextUrl.searchParams;
  const teamId = params.get("team_id") || undefined;
  const typeIds = params.getAll("types");
  const [overview, types] = await Promise.all([
    getPlayerEquipmentOverview(supabase, org.organizationId, teamId, season.id),
    listEquipmentTypes(supabase, org.organizationId),
  ]);
  const csv = buildEquipmentExportCsv(overview.rows, types, {
    onlyMissing: params.get("only_missing") === "true",
    types: typeIds,
  });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="equipment-${season.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv"`,
    },
  });
}
