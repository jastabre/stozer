import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CircleAlert } from "lucide-react";
import { requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveSeason } from "@/lib/club-data";
import { normalizeCurrency } from "@/lib/currency";
import { listSeasonPaymentMonths } from "@/lib/first-team-data";
import {
  currentPeriodKey,
  listStaffFinanceMonth,
  listStaffFinanceMonths,
} from "@/lib/staff-finance-data";
import { formatAmount, monthName, parsePeriod } from "@/lib/first-team";
import {
  FinanceKpiRibbon,
  FinancePanel,
  FinanceStatRow,
} from "@/components/finance/FinanceSurface";

function monthLabel(period: string, locale: "sr" | "en"): string {
  const { year, month } = parsePeriod(period);
  return `${monthName(month, locale)} ${year}`;
}

const OPEN_MONTH_STATUSES = new Set(["late", "partial", "due"]);

/**
 * Finansije → Pregled. A dashboard the club president reads in seconds: this
 * month's money first, then the season, then anything overdue.
 *
 * Every figure comes from the SAME obligation/payment rows the operational tabs
 * use — nothing is invented, estimated or double counted:
 *   - current month → the month's derived obligation state
 *   - overdue       → the still-unpaid remainder of PAST months only
 *   - future        → months that have not started yet (never counted as due)
 *
 * Terminology is always the club's side: the club owes the player / the staff
 * member, never the other way around.
 */
export default async function FinanceOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lng: "sr" | "en" = locale === "en" ? "en" : "sr";
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const now = new Date();
  const currentPeriod = currentPeriodKey(now);

  const [season, orgRow] = await Promise.all([
    getActiveSeason(supabase, org.organizationId),
    supabase
      .from("organizations")
      .select("currency")
      .eq("id", org.organizationId)
      .maybeSingle()
      .then((r) => r.data),
  ]);
  const currency = normalizeCurrency(orgRow?.currency);

  const competitionMonths = season?.competition_months ?? null;
  const [playerMonths, staffMonths, staffCurrentRows] = await Promise.all([
    season
      ? listSeasonPaymentMonths(
          supabase,
          org.organizationId,
          season,
          competitionMonths,
          now
        )
      : Promise.resolve([]),
    listStaffFinanceMonths(supabase, org.organizationId, now),
    listStaffFinanceMonth(supabase, org.organizationId, currentPeriod, now),
  ]);

  const playerCurrent = playerMonths.find((m) => m.period === currentPeriod);

  const sum = (rows: { expected: number; paid: number; remaining: number }[]) => ({
    expected: rows.reduce((s, r) => s + r.expected, 0),
    paid: rows.reduce((s, r) => s + r.paid, 0),
    remaining: rows.reduce((s, r) => s + r.remaining, 0),
  });

  const staffCurrent = sum(staffCurrentRows);

  const current = {
    players: playerCurrent?.expected ?? 0,
    staff: staffCurrent.expected,
    total: (playerCurrent?.expected ?? 0) + staffCurrent.expected,
    paid: (playerCurrent?.paid ?? 0) + staffCurrent.paid,
    remaining: (playerCurrent?.remaining ?? 0) + staffCurrent.remaining,
  };

  const playerSeason = sum(playerMonths);
  const staffSeason = sum(staffMonths);
  const seasonTotal = {
    players: playerSeason.expected,
    staff: staffSeason.expected,
    paid: playerSeason.paid + staffSeason.paid,
    remaining: playerSeason.remaining + staffSeason.remaining,
  };

  // Overdue = the unpaid remainder of months that have ALREADY started. The
  // current month is not overdue (it is still payable), and a future month is
  // not open at all.
  const pastMonths = [
    ...playerMonths.filter((m) => m.period < currentPeriod),
    ...staffMonths.filter((m) => m.period < currentPeriod),
  ];
  const overdueAmount = pastMonths.reduce((s, m) => s + m.remaining, 0);
  const overdueMonths = pastMonths.filter((m) => m.remaining > 0).length;

  const futureRemaining =
    playerMonths
      .filter((m) => m.status === "future")
      .reduce((s, m) => s + m.remaining, 0) +
    staffMonths
      .filter((m) => m.status === "future")
      .reduce((s, m) => s + m.remaining, 0);

  const openMonthCount = [...playerMonths, ...staffMonths].filter((m) =>
    OPEN_MONTH_STATUSES.has(m.status)
  ).length;

  const t = await getTranslations("finance");
  const money = (value: number) => formatAmount(value, currency);
  const hasAnyData = playerMonths.length > 0 || staffMonths.length > 0;

  return (
    <div className="space-y-4">
      {!hasAnyData ? (
        <FinancePanel title={t("overview.seasonPanel")}>
          <p className="text-sm text-muted-foreground">{t("overview.empty")}</p>
        </FinancePanel>
      ) : (
        <>
          <FinanceKpiRibbon
            items={[
              {
                key: "total",
                label: t("overview.kpiObligation"),
                value: money(current.total),
              },
              {
                key: "paid",
                label: t("overview.kpiPaid"),
                value: money(current.paid),
                tone: current.paid > 0 ? "positive" : "default",
              },
              {
                key: "remaining",
                label: t("overview.kpiRemaining"),
                value: money(current.remaining),
              },
              {
                key: "overdue",
                label: t("overview.kpiOverdue"),
                value: money(overdueAmount),
                hint:
                  overdueMonths > 0
                    ? t("overview.overdueMonths", { count: overdueMonths })
                    : t("overview.overdueNone"),
                tone: overdueAmount > 0 ? "danger" : "default",
              },
            ]}
          />

          <p className="px-1 text-xs text-muted-foreground">
            {t("overview.currentMonthNote", {
              month: monthLabel(currentPeriod, lng),
            })}
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <FinancePanel title={t("overview.monthPanel")}>
              <dl className="divide-y divide-border">
                <FinanceStatRow
                  label={t("overview.owesPlayers")}
                  value={money(current.players)}
                />
                <FinanceStatRow
                  label={t("overview.owesStaff")}
                  value={money(current.staff)}
                />
                <FinanceStatRow
                  label={t("overview.totalObligation")}
                  value={money(current.total)}
                  strong
                />
              </dl>
            </FinancePanel>

            <FinancePanel
              title={t("overview.seasonPanel")}
              subtitle={
                season
                  ? t("overview.seasonNamed", { name: season.name })
                  : t("overview.seasonUnnamed")
              }
            >
              <dl className="divide-y divide-border">
                <FinanceStatRow
                  label={t("overview.playerObligation")}
                  value={money(seasonTotal.players)}
                />
                <FinanceStatRow
                  label={t("overview.staffObligation")}
                  value={money(seasonTotal.staff)}
                />
                <FinanceStatRow
                  label={t("overview.totalPaid")}
                  value={money(seasonTotal.paid)}
                />
                <FinanceStatRow
                  label={t("overview.totalRemaining")}
                  value={money(seasonTotal.remaining)}
                  strong
                />
                {futureRemaining > 0 && (
                  <FinanceStatRow
                    label={t("overview.futureObligationLabel")}
                    value={money(futureRemaining)}
                    tone="muted"
                  />
                )}
              </dl>
            </FinancePanel>
          </div>

          <FinancePanel
            title={t("overview.attentionTitle")}
            subtitle={t("overview.attentionSubtitle")}
            right={
              overdueAmount > 0 ? (
                <span className="rounded-full bg-danger-bg px-2 py-0.5 text-xs font-semibold tabular-nums text-danger">
                  {money(overdueAmount)}
                </span>
              ) : undefined
            }
          >
            {overdueAmount > 0 ? (
              <ul className="divide-y divide-border">
                <li>
                  <Link
                    href={`/${locale}/finance/players`}
                    className="group -mx-1 flex items-center gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <CircleAlert
                      className="h-[18px] w-[18px] shrink-0 text-danger"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 text-sm text-foreground">
                      {t("overview.attentionOverdue", {
                        count: overdueMonths,
                      })}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-primary">
                      {t("overview.openPlayers")}
                    </span>
                  </Link>
                </li>
              </ul>
            ) : (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-success"
                  aria-hidden="true"
                />
                <p className="text-sm text-foreground">
                  {t("overview.attentionClear")}
                </p>
                {openMonthCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("overview.openMonths", { count: openMonthCount })}
                  </p>
                )}
              </div>
            )}
          </FinancePanel>
        </>
      )}
    </div>
  );
}