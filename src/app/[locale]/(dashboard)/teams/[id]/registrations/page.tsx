import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireOrganization, hasPermission } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import {
  listTeamStatusOverview,
  getActiveSeason,
  getOrganizationSettings,
  listSeasons,
} from "@/lib/club-data";
import {
  deriveStatus,
  medicalStatus,
  type StatusTone,
  type MedicalTone,
} from "@/lib/status";
import { formatClubAthleteNumber } from "@/lib/athlete-id";

const REG_PILL: Record<StatusTone, string> = {
  green: "bg-emerald-100 text-emerald-800",
  yellow: "bg-amber-100 text-amber-800",
  red: "bg-rose-100 text-rose-800",
};
const MED_PILL: Record<MedicalTone, string> = {
  not_recorded: "bg-slate-100 text-slate-700",
  valid: "bg-emerald-100 text-emerald-800",
  expiring_soon: "bg-amber-100 text-amber-800",
  expired: "bg-rose-100 text-rose-800",
};

export default async function TeamOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ reg?: string; med?: string; season?: string }>;
}) {
  const { id: teamId } = await params;
  const sp = await searchParams;
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("teams.overview");
  const tReg = await getTranslations("players.registrations");
  const tMed = await getTranslations("players.medical");

  const [canViewReg, canViewMed] = await Promise.all([
    hasPermission("registrations.view"),
    hasPermission("medical.view"),
  ]);
  if (!canViewReg && !canViewMed) notFound();

  const [seasons, active, settings, teamResp] = await Promise.all([
    listSeasons(supabase, org.organizationId),
    getActiveSeason(supabase, org.organizationId),
    getOrganizationSettings(supabase, org.organizationId),
    supabase
      .from("teams")
      .select("id, name, organization_id")
      .eq("id", teamId)
      .eq("organization_id", org.organizationId)
      .maybeSingle(),
  ]);
  const team = teamResp.data;

  if (!team) notFound();

  const seasonId =
    sp.season && sp.season !== "" ? sp.season : active?.id ?? "";
  const threshold =
    settings?.warning_threshold_days != null
      ? settings.warning_threshold_days
      : 30;

  const rows = seasonId
    ? await listTeamStatusOverview(supabase, org.organizationId, teamId, seasonId)
    : [];

  const regFilter = sp.reg ?? "all";
  const medFilter = sp.med ?? "all";

  const visible = rows.filter((r) => {
    const regTone = r.latestRegistrationValidUntil
      ? deriveStatus(new Date(r.latestRegistrationValidUntil), threshold)
      : deriveStatus(null, threshold);
    const medTone = r.latestMedicalValidUntil
      ? medicalStatus(new Date(r.latestMedicalValidUntil), threshold)
      : medicalStatus(null, threshold);
    if (regFilter !== "all" && regTone !== regFilter) return false;
    if (medFilter !== "all" && medTone !== medFilter) return false;
    return true;
  });

  const regTones: StatusTone[] = ["green", "yellow", "red"];
  const medTones: MedicalTone[] = [
    "not_recorded",
    "valid",
    "expiring_soon",
    "expired",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/teams"
            className="text-sm text-primary hover:underline"
          >
            ← {t("back")}
          </Link>
          <h1 className="mt-1 text-2xl font-bold">
            {team.name} — {t("title")}
          </h1>
        </div>
        <form method="get" action="" className="flex items-center gap-2 text-xs">
          <label className="text-muted-foreground">{t("season")}</label>
          <input type="hidden" name="reg" value={regFilter} />
          <input type="hidden" name="med" value={medFilter} />
          <select
            name="season"
            defaultValue={seasonId}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">{t("noSeason")}</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg border border-border px-3 py-2 hover:border-primary"
          >
            {t("go")}
          </button>
        </form>
      </div>

      {/* Filters (D-38: registration tone AND medical tone, never merged D-40) */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("filterReg")}</span>
          {([["all", t("all")]] as [string, string][])
            .concat(regTones.map((rt) => [rt, tReg(`tones.${rt}`)]))
            .map(([val, label]) => (
              <a
                key={val}
                href={`?reg=${val}&med=${medFilter}&season=${seasonId}`}
                className={`rounded-full px-3 py-1 text-xs ${
                  regFilter === val
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:border-primary"
                }`}
              >
                {label}
              </a>
            ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("filterMed")}</span>
          {([["all", t("all")]] as [string, string][])
            .concat(medTones.map((mt) => [mt, tMed(`tones.${mt}`)]))
            .map(([val, label]) => (
              <a
                key={val}
                href={`?reg=${regFilter}&med=${val}&season=${seasonId}`}
                className={`rounded-full px-3 py-1 text-xs ${
                  medFilter === val
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:border-primary"
                }`}
              >
                {label}
              </a>
            ))}
        </div>
      </div>

      {!seasonId ? (
        <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
          {t("noActiveSeason")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">{t("table.name")}</th>
                <th className="px-4 py-2">{t("table.clubId")}</th>
                <th className="px-4 py-2">{t("table.jersey")}</th>
                <th className="px-4 py-2">{t("table.registration")}</th>
                <th className="px-4 py-2">{t("table.medical")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr className="border-t border-border">
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                visible.map((r) => {
                  const regTone = r.latestRegistrationValidUntil
                    ? deriveStatus(new Date(r.latestRegistrationValidUntil), threshold)
                    : deriveStatus(null, threshold);
                  const medTone = r.latestMedicalValidUntil
                    ? medicalStatus(new Date(r.latestMedicalValidUntil), threshold)
                    : medicalStatus(null, threshold);
                  return (
                    <tr key={r.athleteId} className="border-t border-border">
                      <td className="px-4 py-2">
                        <Link
                          href={`/players/${r.athleteId}`}
                          className="font-medium hover:text-primary"
                        >
                          {r.last_name} {r.first_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {formatClubAthleteNumber(r.club_athlete_number)}
                      </td>
                      <td className="px-4 py-2">{r.jersey_number ?? "—"}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${REG_PILL[regTone]}`}
                        >
                          {tReg(`tones.${regTone}`)}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${MED_PILL[medTone]}`}
                        >
                          {tMed(`tones.${medTone}`)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
