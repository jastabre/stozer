import { getTranslations } from "next-intl/server";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { normalizeCurrency } from "@/lib/currency";
import {
  currentPeriodKey,
  listStaffFinanceMonth,
  listStaffFinanceMonths,
} from "@/lib/staff-finance-data";
import { staffFunctionLabel } from "@/lib/staff-functions";
import { formatAmount, monthName, parsePeriod, type ObligationStatus } from "@/lib/first-team";
import type { StatusTone } from "@/components/ui/StatusBadge";
import { FinanceKpiRibbon } from "@/components/finance/FinanceSurface";
import { StaffEmptyState } from "@/components/finance/StaffEmptyState";
import { StaffMonthSelector } from "@/components/finance/StaffMonthSelector";
import {
  StaffMonthPayments,
  type StaffPaymentRow,
  type StaffMonthPaymentsLabels,
} from "@/components/finance/StaffMonthPayments";
import { recordStaffPayments } from "./actions";

const STATUS_TONE: Record<ObligationStatus, StatusTone> = {
  paid: "green",
  partial: "yellow",
  late: "red",
  due: "neutral",
  future: "neutral",
};

/**
 * Finansije → Isplate osoblja. One month at a time (selector defaults to the
 * current month): the staff with a financial obligation that month, their
 * expected / paid / remaining / status, and the bulk or single payment
 * recording. No payroll, no adjustments.
 */
export default async function FinanceStaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const lng: "sr" | "en" = locale === "en" ? "en" : "sr";

  const org = await requireOrganization();
  const supabase = await createServerClient();
  const now = new Date();
  const currentPeriod = currentPeriodKey(now);

  const [canManage, orgRow] = await Promise.all([
    hasPermission("staff_finance.manage"),
    supabase
      .from("organizations")
      .select("currency")
      .eq("id", org.organizationId)
      .maybeSingle()
      .then((r) => r.data),
  ]);
  const currency = normalizeCurrency(orgRow?.currency);

  const period =
    query.period && /^\d{4}-\d{2}$/.test(query.period)
      ? query.period
      : currentPeriod;

  const [months, rows] = await Promise.all([
    listStaffFinanceMonths(supabase, org.organizationId, now),
    listStaffFinanceMonth(supabase, org.organizationId, period, now),
  ]);

  const periodOptions = Array.from(
    new Set([currentPeriod, ...months.map((m) => m.period)])
  ).sort();

  const t = await getTranslations("finance");

  const staffRows: StaffPaymentRow[] = rows.map((row) => ({
    staffId: row.staff_id,
    name: `${row.last_name} ${row.first_name}`,
    functionLabel: row.functions
      .map((fn) => staffFunctionLabel(fn.function_key, lng, fn.custom_label))
      .join(" · "),
    expected: row.expected,
    paid: row.paid,
    remaining: row.remaining,
    statusLabel: t(`staff.status.${row.status}`),
    statusTone: STATUS_TONE[row.status],
  }));

  const labels: StaffMonthPaymentsLabels = {
    table: {
      staff: t("staff.table.staff"),
      obligation: t("staff.table.obligation"),
      paid: t("staff.table.paid"),
      remaining: t("staff.table.remaining"),
      status: t("staff.table.status"),
      action: t("staff.table.action"),
    },
    selectAll: t("staff.selectAll"),
    selectHint: t("staff.selectHint"),
    selected: t.raw("staff.selected"),
    payoutTotal: t.raw("staff.payoutTotal"),
    markPaid: t("staff.markPaid"),
    record: t("staff.record"),
    viewOnly: t("staff.viewOnly"),
    dialog: {
      title: t("staff.dialog.title"),
      staff: t("staff.dialog.staff"),
      remaining: t("staff.dialog.remaining"),
      amount: t("staff.dialog.amount"),
      amountFor: t.raw("staff.dialog.amountFor"),
      selectedCount: t.raw("staff.dialog.selectedCount"),
      paidOn: t("staff.dialog.paidOn"),
      method: t("staff.dialog.method"),
      methods: {
        cash: t("staff.dialog.methods.cash"),
        bank: t("staff.dialog.methods.bank"),
        other: t("staff.dialog.methods.other"),
      },
      note: t("staff.dialog.note"),
      notePlaceholder: t("staff.dialog.notePlaceholder"),
      submit: t("staff.dialog.submit"),
      pending: t("staff.dialog.pending"),
      cancel: t("staff.dialog.cancel"),
      invalidAmount: t("staff.dialog.invalidAmount"),
    },
  };

  const { year, month } = parsePeriod(period);
  const monthLabel = `${monthName(month, lng)} ${year}`;

  const monthTotal = rows.reduce(
    (acc, row) => ({
      expected: acc.expected + row.expected,
      paid: acc.paid + row.paid,
      remaining: acc.remaining + row.remaining,
    }),
    { expected: 0, paid: 0, remaining: 0 }
  );
  const openCount = rows.filter((row) => row.remaining > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {t("staff.obligationForMonth", { month: monthLabel })}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("staff.description")}
          </p>
        </div>
        <StaffMonthSelector
          periods={periodOptions}
          current={period}
          locale={lng}
          label={t("staff.monthSelectorLabel")}
        />
      </div>

      {rows.length === 0 ? (
        <StaffEmptyState
          canManage={canManage}
          locale={locale}
          labels={{
            title: t("staff.emptyTitle"),
            description: t("staff.emptyDescription"),
            hint:
              months.length > 0
                ? t("staff.emptyOtherMonth")
                : t("staff.emptyNoCompensation"),
            action: canManage ? t("staff.emptyAction") : undefined,
          }}
        />
      ) : (
        <>
          <FinanceKpiRibbon
            items={[
              {
                key: "total",
                label: t("staff.kpiObligation"),
                value: formatAmount(monthTotal.expected, currency),
                hint: t("staff.kpiPeople", { count: rows.length }),
              },
              {
                key: "paid",
                label: t("staff.kpiPaid"),
                value: formatAmount(monthTotal.paid, currency),
                tone: monthTotal.paid > 0 ? "positive" : "default",
              },
              {
                key: "remaining",
                label: t("staff.kpiRemaining"),
                value: formatAmount(monthTotal.remaining, currency),
              },
              {
                key: "open",
                label: t("staff.kpiOpen"),
                value: String(openCount),
                hint: t("staff.kpiOpenHint"),
              },
            ]}
          />

          <StaffMonthPayments
            action={recordStaffPayments}
            period={period}
            defaultPaidOn={new Date().toISOString().slice(0, 10)}
            canManage={canManage}
            currency={currency}
            staff={staffRows}
            labels={labels}
          />
        </>
      )}
    </div>
  );
}
