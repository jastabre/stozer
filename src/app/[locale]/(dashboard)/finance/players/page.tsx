import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  SeasonMonthsOverview,
  type SeasonMonthRow,
  type SeasonMonthsLabels,
} from "@/components/finance/SeasonMonthsOverview";
import { FinanceKpiRibbon } from "@/components/finance/FinanceSurface";
import { listFirstTeamContracts, listSeasonPaymentMonths } from "@/lib/first-team-data";
import { formatAmount, seasonMonthPlayersLabel } from "@/lib/first-team";
import { loadFinancePlayersContext } from "../_shared";

/**
 * Finansije → Isplate igrača (season overview): one row per obligation month
 * of the active season. Reuses the same domain logic and overview component as
 * the team Payments tab, now presented organization-wide under Finansije.
 */
export default async function FinancePlayersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("firstTeamPayments");

  const { supabase, org, season, lng, moneyCurrency, now } =
    await loadFinancePlayersContext(locale);

  const contracts = season
    ? await listFirstTeamContracts(supabase, org.organizationId, season.id)
    : [];
  const competitionMonths = season?.competition_months ?? null;
  const competitionMissing =
    contracts.some((contract) => contract.pay_schedule === "competition_months") &&
    !(competitionMonths && competitionMonths.length > 0);

  const months =
    season && !competitionMissing
      ? await listSeasonPaymentMonths(
          supabase,
          org.organizationId,
          season,
          competitionMonths,
          now
        )
      : [];

  const seasonPaid = months.reduce((sum, m) => sum + m.paid, 0);
  const dueRemaining = months
    .filter((m) => m.status !== "future")
    .reduce((sum, m) => sum + m.remaining, 0);
  const futureRemaining = months
    .filter((m) => m.status === "future")
    .reduce((sum, m) => sum + m.remaining, 0);
  const openMonths = months.filter(
    (m) => m.status === "late" || m.status === "partial" || m.status === "due"
  ).length;

  const monthRows: SeasonMonthRow[] = months.map((m) => {
    const { main, note } = seasonMonthPlayersLabel(m, {
      playersCount: (count) => t("playersCount", { count }),
      playersPaid: t("playersPaid"),
      playersPartial: (count) => t("playersPartial", { count }),
      playersUnpaid: (count) => t("playersUnpaid", { count }),
      allSettled: t("allSettled"),
      futurePlayersNote: t("futurePlayersNote"),
    });
    return { ...m, playersMain: main, playersNote: note };
  });

  const overviewLabels: SeasonMonthsLabels = {
    columns: {
      month: t("columns.month"),
      players: t("columns.players"),
      expected: t("columns.expected"),
      paid: t("columns.paid"),
      remaining: t("columns.remaining"),
      status: t("columns.status"),
    },
    status: {
      paid: t("monthStatus.paid"),
      partial: t("monthStatus.partial"),
      late: t("monthStatus.late"),
      due: t("monthStatus.due"),
      future: t("monthStatus.future"),
    },
  };

  return (
    <div className="space-y-4">
      {!season ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("noActiveSeason")}{" "}
          <Link href={`/${locale}/seasons`} className="text-primary hover:underline">
            {t("startSeason")}
          </Link>
        </div>
      ) : contracts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("empty.noContracts")}
        </div>
      ) : competitionMissing ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("empty.noCompetitionMonths")}{" "}
          <Link href={`/${locale}/seasons`} className="text-primary hover:underline">
            {t("empty.configureSeason")}
          </Link>
        </div>
      ) : months.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("overviewEmpty")}
        </div>
      ) : (
        <>
          <FinanceKpiRibbon
            items={[
              {
                key: "paid",
                label: t("financeSummary.paid"),
                value: formatAmount(seasonPaid, moneyCurrency),
                tone: seasonPaid > 0 ? "positive" : "default",
              },
              {
                key: "due",
                label: t("financeSummary.due"),
                value: formatAmount(dueRemaining, moneyCurrency),
              },
              {
                key: "future",
                label: t("financeSummary.future"),
                value: formatAmount(futureRemaining, moneyCurrency),
              },
              {
                key: "open",
                label: t("financeSummary.openMonths"),
                value: String(openMonths),
                hint: t("financeSummary.ofMonths", { count: months.length }),
              },
            ]}
          />

          <p className="px-1 text-xs text-muted-foreground">{t("noTransferNote")}</p>

          <SeasonMonthsOverview
            months={monthRows}
            hrefBase={`/${locale}/finance/players`}
            currency={moneyCurrency}
            lng={lng}
            labels={overviewLabels}
          />
        </>
      )}
    </div>
  );
}
