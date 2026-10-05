import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TeamHeader } from "@/components/teams/TeamHeader";
import {
  SeasonMonthsOverview,
  type SeasonMonthRow,
  type SeasonMonthsLabels,
} from "@/components/finance/SeasonMonthsOverview";
import { listFirstTeamContracts, listSeasonPaymentMonths } from "@/lib/first-team-data";
import { formatAmount, seasonMonthPlayersLabel } from "@/lib/first-team";
import { loadTeamPaymentsContext } from "./_shared";

export default async function TeamPaymentsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations("firstTeamPayments");
  const tov = await getTranslations("teams.overview");
  const tt = await getTranslations("teams");

  const { org, supabase, season, team, memberCount, lng, moneyCurrency, now } =
    await loadTeamPaymentsContext(locale, id);

  // Contracts drive the empty states; the season months drive the overview.
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

  // Season rollups: money already paid, money due now (all non-future months),
  // money that is not due yet (future obligations), and the count of months
  // that still need attention. Future months are never "open".
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

  // The "Igrači" cell wording is semantic per status: future months read as a
  // neutral player count, due months as a paid fraction + breakdown, settled
  // months as "Sve izmireno" — never "nije plaćeno" before the due date.
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

  const meta = (
    <>
      {tt(`categories.${team.category}`)} · {season ? season.name : tov("noSeason")}
      {season ? ` · ${tov("memberCount", { count: memberCount })}` : ""}
    </>
  );

  const tabs = [
    { href: `/${locale}/teams/${team.id}/registrations`, label: tov("tabPlayers") },
    { href: `/${locale}/teams/${team.id}/payments`, label: tov("tabPayments") },
  ];

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
    <div className="space-y-6">
      <TeamHeader
        backHref={`/${locale}/teams`}
        backLabel={t("back")}
        title={team.name}
        meta={meta}
        description={t("description")}
        tabs={tabs}
        activeHref={`/${locale}/teams/${team.id}/payments`}
        tabsLabel={tt("title")}
      />

      {!season ? (
        // A) No active season.
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("noActiveSeason")}{" "}
          <Link href={`/${locale}/seasons`} className="text-primary hover:underline">
            {t("startSeason")}
          </Link>
        </div>
      ) : contracts.length === 0 ? (
        // B) No active first-team contract with a monthly amount.
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("empty.noContracts")}
        </div>
      ) : competitionMissing ? (
        // C) competition_months contracts but the season has no months set.
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("empty.noCompetitionMonths")}{" "}
          <Link href={`/${locale}/seasons`} className="text-primary hover:underline">
            {t("empty.configureSeason")}
          </Link>
        </div>
      ) : months.length === 0 ? (
        // D) No contracted obligations anywhere in the season.
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("overviewEmpty")}
        </div>
      ) : (
        <>
          {/* One compact season summary line — no big KPI cards on the overview. */}
          <section className="rounded-xl border border-border bg-card px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {t("seasonLabel", { name: season.name })}
              </h2>
              <p className="text-[11px] text-muted-foreground">{t("noTransferNote")}</p>
            </div>
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              {[
                t("seasonPaid", {
                  amount: formatAmount(seasonPaid, moneyCurrency),
                }),
                t("seasonDue", {
                  amount: formatAmount(dueRemaining, moneyCurrency),
                }),
                t("seasonFuture", {
                  amount: formatAmount(futureRemaining, moneyCurrency),
                }),
                t("openMonths", { count: openMonths }),
              ].join(" · ")}
            </p>
          </section>

          <SeasonMonthsOverview
            months={monthRows}
            hrefBase={`/${locale}/teams/${team.id}/payments`}
            currency={moneyCurrency}
            lng={lng}
            labels={overviewLabels}
          />
        </>
      )}
    </div>
  );
}
