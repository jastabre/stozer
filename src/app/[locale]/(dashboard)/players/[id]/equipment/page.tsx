import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getActiveSeason, getAthleteWithMemberships } from "@/lib/club-data";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { listEquipmentTypes } from "@/lib/equipment";

export default async function PlayerEquipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await requireOrganization();
  if (!(await hasPermission("equipment.view"))) notFound();
  const supabase = await createServerClient();
  const [athlete, types, season, t] = await Promise.all([
    getAthleteWithMemberships(supabase, org.organizationId, id),
    listEquipmentTypes(supabase, org.organizationId),
    getActiveSeason(supabase, org.organizationId),
    getTranslations("equipment"),
  ]);
  if (!athlete) notFound();
  const { data: equipmentRows } = await supabase
    .from("athlete_equipment")
    .select("*")
    .eq("organization_id", org.organizationId)
    .eq("athlete_id", athlete.id);
  const rows = new Map((equipmentRows ?? []).map((row) => [row.equipment_type_id, row]));
  const current = season ? athlete.memberships.find((membership) => membership.seasonId === season.id) : undefined;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/players/${athlete.id}`} className="text-sm text-primary hover:underline">← {t("backToPlayer")}</Link>
        <h1 className="mt-1 text-2xl font-bold">{athlete.last_name} {athlete.first_name}</h1>
        <p className="text-sm text-muted-foreground">{t("profileSummary")}</p>
      </div>
      <section className="rounded-xl border border-border p-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-muted-foreground">{t("clubAthleteId")}</dt><dd className="font-mono">C{String(athlete.club_athlete_number).padStart(4, "0")}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("team")}</dt><dd>{current?.teamName ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("jersey")}</dt><dd>{current?.jerseyNumber ?? "—"}</dd></div>
        </dl>
      </section>
      <section className="rounded-xl border border-border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{t("profileEquipmentTitle")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("profileEquipmentDescription")}</p></div><Link href="/equipment" className="rounded-lg border border-border px-3 py-2 text-sm hover:border-primary">{t("openEquipment")}</Link></div>
        {types.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{t("noEnabledTypes")}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2">{t("type")}</th><th className="px-3 py-2">{t("size")}</th><th className="px-3 py-2">{t("state")}</th></tr></thead><tbody>{types.map((type) => { const item = rows.get(type.id); return <tr key={type.id} className="border-t border-border"><td className="px-3 py-3 font-medium">{type.name}</td><td className="px-3 py-3">{item?.size_value ? `${item.size_value}${item.size_value_upper ? ` / ${item.size_value_upper}` : ""}` : "—"}</td><td className="px-3 py-3">{t(`states.${item?.state ?? "missing"}`)}</td></tr>; })}</tbody></table></div>}
      </section>
    </div>
  );
}
