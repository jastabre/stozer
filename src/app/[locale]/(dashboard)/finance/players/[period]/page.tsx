import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronDown } from "lucide-react";
import {
  MonthPayments,
  type MonthPaymentsLabels,
  type PaymentPlayerData,
} from "@/components/finance/MonthPayments";
import {
  PaymentHistory,
  type PaymentHistoryLabels,
  type PaymentHistoryRow,
} from "@/components/finance/PaymentHistory";
import { listBulkPaymentPlayers } from "@/lib/first-team-data";
import { formatAmount, monthName, type ObligationStatus } from "@/lib/first-team";
import type { StatusTone } from "@/components/ui/StatusBadge";
import {
  addBulkAdjustment,
  recordBulkPayments,
  reverseObligationAdjustment,
  reversePayment,
} from "../../../teams/first-team-actions";
import { loadFinancePlayersContext } from "../../_shared";

const STATUS_TONE: Record<ObligationStatus, StatusTone> = {
  paid: "green",
  partial: "yellow",
  late: "red",
  due: "neutral",
  future: "neutral",
};

/**
 * Finansije → Isplate igrača → month detail. Same recording workflow as the
 * team Payments tab, presented organization-wide under Finansije.
 */
export default async function FinancePlayersMonthPage({
  params,
}: {
  params: Promise<{ locale: string; period: string }>;
}) {
  const { locale, period } = await params;
  if (!/^\d{4}-\d{2}$/.test(period)) notFound();

  const t = await getTranslations("firstTeamPayments");
  const tc = await getTranslations("common");

  const { supabase, org, season, lng, canManage, moneyCurrency, now } =
    await loadFinancePlayersContext(locale);

  const monthLabel = `${monthName(Number(period.slice(5)), lng)} ${period.slice(0, 4)}`;

  if (!season) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("noActiveSeason")}{" "}
          <Link href={`/${locale}/seasons`} className="text-primary hover:underline">
            {t("startSeason")}
          </Link>
        </div>
      </div>
    );
  }

  const players = await listBulkPaymentPlayers(
    supabase,
    org.organizationId,
    season.id,
    period,
    season.competition_months ?? null,
    now
  );

  const totalExpected = players.reduce((sum, p) => sum + p.adjusted, 0);
  const totalPaid = players.reduce((sum, p) => sum + p.paid, 0);
  const totalRemaining = players.reduce((sum, p) => sum + p.remaining, 0);
  const unpaidCount = players.filter((p) => p.remaining > 0).length;

  const rows: PaymentPlayerData[] = players.map((player) => ({
    athleteId: player.athlete_id,
    name: `${player.last_name} ${player.first_name}`,
    jersey: player.jersey_number,
    base: player.base,
    bonus: player.bonus,
    deduction: player.deduction,
    adjusted: player.adjusted,
    paid: player.paid,
    remaining: player.remaining,
    currency: moneyCurrency,
    statusLabel: t(`status.${player.status}`),
    statusTone: STATUS_TONE[player.status],
    detailAria: t("detail.openAria", {
      name: `${player.last_name} ${player.first_name}`,
    }),
    recordedPayments: player.recorded_payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      currency: moneyCurrency,
      paidOn: payment.paid_on,
      method: payment.method,
      note: payment.note,
      reversed: payment.reversed_at != null,
    })),
    adjustments: player.adjustments,
  }));

  const monthLabels: MonthPaymentsLabels = {
    table: {
      player: t("table.player"),
      obligation: t("table.obligation"),
      paid: t("table.paid"),
      remaining: t("table.remaining"),
      status: t("table.status"),
      action: t("table.action"),
    },
    record: t("record"),
    details: t("details"),
    corrections: t("correctionsAction"),
    selectAll: t("selectAll"),
    selected: t.raw("selected"),
    payoutTotal: t.raw("payoutTotal"),
    confirm: t("confirm"),
    viewOnly: t("viewOnly"),
    breakdown: {
      base: t("base"),
      bonus: t("bonus"),
      deduction: t("deduction"),
    },
    dialog: {
      title: t("dialog.title"),
      player: t("dialog.player"),
      obligationForMonth: t("dialog.obligationForMonth"),
      baseSalary: t("baseSalary"),
      bonus: t("bonus"),
      deduction: t("deduction"),
      obligation: t("dialog.obligation"),
      alreadyPaid: t("dialog.alreadyPaid"),
      remaining: t("table.remaining"),
      amount: t("dialog.amount"),
      amountFor: t.raw("dialog.amountFor"),
      selectedCount: t.raw("dialog.selectedPlayers"),
      paidOn: t("paidOn"),
      method: t("method"),
      methods: {
        cash: t("methods.cash"),
        bank: t("methods.bank"),
        other: t("methods.other"),
      },
      note: t("note"),
      notePlaceholder: t("notePlaceholder"),
      submit: t("confirm"),
      pending: t("saving"),
      cancel: tc("cancel"),
      invalidAmount: t("invalidAmount"),
    },
    adjustmentsDialog: {
      title: t("correctionsAction"),
      baseSalary: t("baseSalary"),
      bonusSection: t("bonus"),
      deductionSection: t("deductionsSection"),
      none: t("none"),
      total: t("totalObligation"),
      close: t("detail.close"),
      list: {
        bonus: t("bonus"),
        deduction: t("deduction"),
        reversed: t("reversed"),
        reverse: t("reverseAdjustment"),
        reverseTitle: t.raw("reverseAdjustmentTitle"),
        reverseBody: t("reverseAdjustmentBody"),
        cancel: tc("cancel"),
        pending: tc("reversing"),
      },
      addLabels: {
        bonus: {
          trigger: t("addBonus"),
          title: t("addBonus"),
          selected: t.raw("dialogSelected"),
          amount: t("amountPerPlayer"),
          perPlayerNote: t("perPlayerNote"),
          reason: t("reason"),
          reasonPlaceholder: t("reasonPlaceholder"),
          note: t("note"),
          notePlaceholder: t("notePlaceholder"),
          submit: t("addBonus"),
          pending: tc("adding"),
          cancel: tc("cancel"),
        },
        deduction: {
          trigger: t("addDeduction"),
          title: t("addDeduction"),
          selected: t.raw("dialogSelected"),
          amount: t("amountPerPlayer"),
          perPlayerNote: t("perPlayerNote"),
          reason: t("reason"),
          reasonPlaceholder: t("reasonPlaceholder"),
          note: t("note"),
          notePlaceholder: t("notePlaceholder"),
          submit: t("addDeduction"),
          pending: tc("adding"),
          cancel: tc("cancel"),
        },
      },
    },
    detail: {
      title: t("detail.title"),
      close: t("detail.close"),
      calcTitle: t("detail.calcTitle"),
      correctionsTitle: t("corrections"),
      paymentsTitle: t("detail.paymentsTitle"),
      noCorrections: t("detail.noCorrections"),
      noPayments: t("detail.noPayments"),
      base: t("base"),
      bonus: t("bonus"),
      deduction: t("deduction"),
      totalDue: t("dialog.obligation"),
      paid: t("table.paid"),
      remaining: t("table.remaining"),
      overpaid: t("overpaid"),
      adjustmentList: {
        bonus: t("bonus"),
        deduction: t("deduction"),
        reversed: t("reversed"),
        reverse: t("reverseAdjustment"),
        reverseTitle: t.raw("reverseAdjustmentTitle"),
        reverseBody: t("reverseAdjustmentBody"),
        cancel: tc("cancel"),
        pending: tc("reversing"),
      },
      paymentReverse: {
        action: t("reverse"),
        title: t.raw("reverseConfirmTitle"),
        body: t("reverseConfirmBody"),
        cancel: tc("cancel"),
        pending: tc("reversing"),
        reversed: t("reversed"),
        methods: {
          cash: t("methods.cash"),
          bank: t("methods.bank"),
          other: t("methods.other"),
        },
      },
      addLabels: {
        bonus: {
          trigger: t("addBonus"),
          title: t("addBonus"),
          selected: t.raw("dialogSelected"),
          amount: t("amountPerPlayer"),
          perPlayerNote: t("perPlayerNote"),
          reason: t("reason"),
          reasonPlaceholder: t("reasonPlaceholder"),
          note: t("note"),
          notePlaceholder: t("notePlaceholder"),
          submit: t("addBonus"),
          pending: tc("adding"),
          cancel: tc("cancel"),
        },
        deduction: {
          trigger: t("addDeduction"),
          title: t("addDeduction"),
          selected: t.raw("dialogSelected"),
          amount: t("amountPerPlayer"),
          perPlayerNote: t("perPlayerNote"),
          reason: t("reason"),
          reasonPlaceholder: t("reasonPlaceholder"),
          note: t("note"),
          notePlaceholder: t("notePlaceholder"),
          submit: t("addDeduction"),
          pending: tc("adding"),
          cancel: tc("cancel"),
        },
      },
    },
  };

  const rowsSignature = players
    .map((player) => `${player.athlete_id}:${player.paid}:${player.adjusted}`)
    .join(",");

  const historyRows: PaymentHistoryRow[] = players
    .flatMap((player) =>
      player.recorded_payments.map((payment) => ({
        id: payment.id,
        athleteId: player.athlete_id,
        name: `${player.last_name} ${player.first_name}`,
        jersey: player.jersey_number,
        amount: payment.amount,
        currency: moneyCurrency,
        paidOn: payment.paid_on,
        method: payment.method,
        note: payment.note,
        reversed: payment.reversed_at != null,
      }))
    )
    .sort(
      (a, b) => b.paidOn.localeCompare(a.paidOn) || a.name.localeCompare(b.name)
    );
  const historyActive = historyRows.filter((row) => !row.reversed);
  const historyReversed = historyRows.length - historyActive.length;
  const historyActiveTotal = historyActive.reduce((sum, row) => sum + row.amount, 0);

  const historyLabels: PaymentHistoryLabels = {
    title: `${t("history.title")} · ${monthLabel}`,
    summary:
      historyRows.length === 0
        ? ""
        : [
            t("history.activeCount", { count: historyActive.length }),
            historyReversed > 0
              ? t("history.reversedCount", { count: historyReversed })
              : null,
            t("history.paidTotal", {
              total: formatAmount(historyActiveTotal, moneyCurrency),
            }),
          ]
            .filter(Boolean)
            .join(" · "),
    columns: {
      player: t("history.columns.player"),
      date: t("history.columns.date"),
      method: t("history.columns.method"),
      note: t("history.columns.note"),
      amount: t("history.columns.amount"),
    },
    empty: t("history.empty"),
    reverse: monthLabels.detail.paymentReverse,
  };

  const summaryCells = [
    { label: t("summary.expected"), value: formatAmount(totalExpected, moneyCurrency) },
    { label: t("summary.paid"), value: formatAmount(totalPaid, moneyCurrency) },
    { label: t("summary.remaining"), value: formatAmount(totalRemaining, moneyCurrency) },
    { label: t("summary.openCount"), value: String(unpaidCount) },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {t("obligationForMonth", { month: monthLabel })}
      </h2>

      {players.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("empty.noObligationsForMonth")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
            {summaryCells.map((cell) => (
              <div key={cell.label} className="bg-card px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {cell.label}
                </p>
                <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
                  {cell.value}
                </p>
              </div>
            ))}
          </div>

          <MonthPayments
            key={rowsSignature}
            action={recordBulkPayments}
            reversePaymentAction={reversePayment}
            addAdjustmentAction={addBulkAdjustment}
            reverseAdjustmentAction={reverseObligationAdjustment}
            period={period}
            monthLabel={monthLabel}
            defaultPaidOn={new Date().toISOString().slice(0, 10)}
            canManage={canManage}
            players={rows}
            labels={monthLabels}
          />

          <details className="group space-y-3">
            <summary className="flex cursor-pointer select-none items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring sm:px-5 [&::-webkit-details-marker]:hidden">
              <span>
                {t("historyToggle")} ({historyRows.length})
              </span>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <PaymentHistory
              rows={historyRows}
              labels={historyLabels}
              canReverse={canManage}
              reverseAction={reversePayment}
            />
          </details>
        </>
      )}
    </div>
  );
}
