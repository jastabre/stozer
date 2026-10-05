import Link from "next/link";
import { notFound } from "next/navigation";
import { differenceInCalendarDays } from "date-fns";
import { getTranslations } from "next-intl/server";
import {
  getActiveSeason,
  getOrganizationSettings,
  listContracts,
  type Contract,
} from "@/lib/club-data";
import { hasPermission, requireOrganization } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";
import { deleteContract, saveContract } from "./actions";
import {
  reverseObligationAdjustment,
  reversePayment,
} from "../../../teams/first-team-actions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import {
  ContractForm,
  type ContractFormLabels,
  type ContractFormValues,
} from "@/components/players/ContractForm";
import {
  listAthleteObligations,
  listAthletePayments,
  type AthleteObligation,
} from "@/lib/first-team-data";
import { AdjustmentList, type AdjustmentListLabels } from "@/components/finance/AdjustmentList";
import { formatAmount, monthName, parsePeriod } from "@/lib/first-team";
import { normalizeCurrency } from "@/lib/currency";
import { formatDmy } from "@/lib/date-format";

type BadgeTone = "green" | "yellow" | "red" | "neutral";

// One user-facing contract status derived from stored status + dates.
function contractStatus(
  contract: Contract,
  threshold: number,
  today: Date
): { label: "active" | "expiring" | "expired" | "notStarted" | "terminated"; tone: BadgeTone } {
  if (contract.status === "terminated") return { label: "terminated", tone: "neutral" };
  if (contract.valid_from) {
    const from = new Date(`${contract.valid_from}T00:00:00`);
    if (from > today) return { label: "notStarted", tone: "neutral" };
  }
  if (contract.valid_until) {
    const until = new Date(`${contract.valid_until}T00:00:00`);
    const days = differenceInCalendarDays(until, today);
    if (days < 0) return { label: "expired", tone: "red" };
    if (days <= threshold) return { label: "expiring", tone: "yellow" };
  }
  return { label: "active", tone: "green" };
}

const OBLIGATION_TONE: Record<string, BadgeTone> = {
  paid: "green",
  partial: "yellow",
  late: "red",
  due: "neutral",
  future: "neutral",
};

// One month's obligation: base + corrections -> total due, paid/remaining and
// status, with the correction history (incl. reversed rows) expandable. Future
// periods are labelled distinctly from the ones already due.
function ObligationRow({
  o,
  athleteId,
  currency,
  lng,
  isFuture,
  canManageFinance,
  adjustmentLabels,
  t,
}: {
  o: AthleteObligation;
  athleteId: string;
  currency: string;
  lng: "sr" | "en";
  isFuture: boolean;
  canManageFinance: boolean;
  adjustmentLabels: AdjustmentListLabels;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const { year, month } = parsePeriod(o.period);
  const statusKey = isFuture ? "future" : o.status;
  const hasCorrections = o.adjustments.length > 0;
  const corrections = [
    o.bonus > 0 ? `+${formatAmount(o.bonus, currency)}` : null,
    o.deduction > 0 ? `−${formatAmount(o.deduction, currency)}` : null,
  ]
    .filter(Boolean)
    .join(" / ");
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          {monthName(month, lng)} {year}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {t("baseLabel")}: {formatAmount(o.base, currency)}
          {hasCorrections && (
            <>
              {" · "}
              {t("adjustmentsLabel")}: {corrections}
            </>
          )}
          {" · "}
          {t("totalDueLabel")}: {formatAmount(o.adjusted, currency)}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {t("table.paid")}: {formatAmount(o.paid, currency)} ·{" "}
          {t("table.remaining")}: {formatAmount(o.remaining, currency)}
        </p>
        {hasCorrections && (
          <details className="group mt-1">
            <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
              {t("adjustmentsLabel")} · {o.adjustments.length}
            </summary>
            <AdjustmentList
              adjustments={o.adjustments}
              currency={currency}
              athleteId={athleteId}
              canReverse={canManageFinance}
              reverseAction={reverseObligationAdjustment}
              labels={adjustmentLabels}
              className="mt-1"
            />
          </details>
        )}
      </div>
      <StatusBadge
        tone={OBLIGATION_TONE[statusKey] ?? "neutral"}
        label={t(`obligationStatus.${statusKey}`)}
      />
    </li>
  );
}

export default async function PlayerContractPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const org = await requireOrganization();
  const supabase = await createServerClient();
  const t = await getTranslations("players.contracts");
  const tc = await getTranslations("common");
  const tf = await getTranslations("feedback");

  const [canView, canManage, canViewFinance, canManageFinance] = await Promise.all([
    hasPermission("contracts.view"),
    hasPermission("contracts.manage"),
    hasPermission("first_team_finance.view"),
    hasPermission("first_team_finance.manage"),
  ]);
  if (!canView) notFound();

  const [contracts, settings, obligations, payments, activeSeason, orgRow] =
    await Promise.all([
      listContracts(supabase, org.organizationId, id),
      getOrganizationSettings(supabase, org.organizationId),
      canViewFinance
        ? listAthleteObligations(supabase, org.organizationId, id)
        : Promise.resolve([]),
      canViewFinance
        ? listAthletePayments(supabase, org.organizationId, id)
        : Promise.resolve([]),
      getActiveSeason(supabase, org.organizationId),
      supabase
        .from("organizations")
        .select("currency")
        .eq("id", org.organizationId)
        .maybeSingle()
        .then((result) => result.data),
    ]);
  // The club's single currency (V1) — the contract form writes it and shows it
  // as the salary suffix; there is no per-contract choice.
  const clubCurrency = normalizeCurrency(orgRow?.currency);

  const threshold = settings?.warning_threshold_days ?? 30;
  const lng = locale === "en" ? "en" : "sr";
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Current = the active contract, else the most recent one; the rest is history.
  const current = contracts.find((c) => c.status === "active") ?? contracts[0] ?? null;
  const history = contracts.filter((c) => c.id !== current?.id);

  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const due = obligations.filter((o) => o.period <= currentMonthKey);
  const accrued = due.reduce((sum, o) => sum + o.adjusted, 0);
  const paidSum = due.reduce((sum, o) => sum + o.paid, 0);
  const remaining = Math.max(0, accrued - paidSum);
  const currency = current?.currency ?? "RSD";
  const upcoming = obligations.filter((o) => o.period > currentMonthKey);

  const adjustmentLabels: AdjustmentListLabels = {
    bonus: t("bonus"),
    deduction: t("deduction"),
    reversed: t("reversed"),
    reverse: t("reverseAdjustment"),
    // t.raw keeps the {amount} placeholder: the dialog fills it client-side.
    reverseTitle: t.raw("reverseAdjustmentTitle"),
    reverseBody: t("reverseAdjustmentBody"),
    cancel: tc("cancel"),
    pending: tc("reversing"),
  };

  const formValues: ContractFormValues | undefined = current
    ? {
        id: current.id,
        contract_type: current.contract_type,
        status: current.status,
        valid_from: current.valid_from ?? "",
        valid_until: current.valid_until ?? "",
        monthly_salary: current.monthly_salary ?? null,
        pay_schedule: current.pay_schedule ?? "all_year",
        custom_months: current.custom_months ?? null,
        notes: current.notes ?? "",
      }
    : undefined;

  const formLabels: ContractFormLabels = {
    startDate: t("startDate"),
    endDate: t("endDate"),
    monthlySalary: t("monthlySalary"),
    paySchedule: t("paySchedule"),
    schedules: {
      all_year: t("paySchedules.all_year"),
      competition_months: t("paySchedules.competition_months"),
      custom_months: t("paySchedules.custom_months"),
    },
    months: Array.from({ length: 12 }, (_, i) => monthName(i + 1, lng)),
    pickMonths: t("pickMonths"),
    notes: t("notes"),
    save: t("save"),
    saving: t("saving"),
  };

  const scheduleMissingMonths =
    current?.pay_schedule === "competition_months" &&
    !(activeSeason?.competition_months && activeSeason.competition_months.length > 0);

  return (
    <div className="space-y-4">
      {/* Header + primary action on one line; the form expands full-width below. */}
      {canManage ? (
        <details className="group">
          <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-x-4 gap-y-2 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{t("intro")}</p>
            </div>
            <span className="inline-flex h-9 shrink-0 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
              {current ? t("editContract") : t("add")}
            </span>
          </summary>
          <div className="mt-3 rounded-xl border border-border bg-card p-4 sm:p-5">
            <ContractForm
              action={saveContract}
              athleteId={id}
              contract={formValues}
              currency={clubCurrency}
              labels={formLabels}
            />
          </div>
        </details>
      ) : (
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("intro")}</p>
        </div>
      )}

      {/* Current contract — compact financial summary. */}
      {current ? (
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
                {current.monthly_salary != null
                  ? formatAmount(current.monthly_salary, current.currency ?? "RSD")
                  : "—"}
              </p>
              {current.monthly_salary != null && (
                <p className="text-sm text-muted-foreground">{t("monthlyUnit")}</p>
              )}
              <p className="mt-2 text-sm text-foreground tabular-nums">
                {current.valid_from ? `${formatDmy(current.valid_from)}.` : "—"}
                {" – "}
                {current.valid_until ? `${formatDmy(current.valid_until)}.` : "—"}
              </p>
            </div>
            {(() => {
              const s = contractStatus(current, threshold, now);
              return (
                <StatusBadge
                  tone={s.tone}
                  label={
                    s.label === "terminated"
                      ? t("statuses.terminated")
                      : t(`contractStatuses.${s.label}`)
                  }
                />
              );
            })()}
          </div>

          <dl className="mt-4 grid gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">{t("paySchedule")}</dt>
              <dd className="text-sm text-foreground">
                {t(`paySchedules.${current.pay_schedule ?? "all_year"}`)}
              </dd>
            </div>
            {current.notes && (
              <div>
                <dt className="text-xs text-muted-foreground">{t("notes")}</dt>
                <dd className="text-sm text-foreground">{current.notes}</dd>
              </div>
            )}
          </dl>

          {scheduleMissingMonths && (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("seasonMonthsMissing")}{" "}
              <Link href={`/${locale}/seasons`} className="font-medium text-primary hover:underline">
                {t("configureSeason")}
              </Link>
            </p>
          )}

          {/* Delete is a low-emphasis escape hatch for mistakenly entered
              contracts (guarded by confirmation), never the primary action. */}
          {canManage && (
            <div className="mt-3 flex justify-end border-t border-border pt-3">
              <ConfirmDeleteButton
                action={deleteContract}
                hiddenFields={{ id: current.id, athlete_id: id }}
                triggerLabel={t("delete")}
                triggerClassName="rounded text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                title={t("deleteConfirmTitle")}
                body={t("deleteConfirmBody")}
                confirmLabel={t("deleteConfirm")}
                cancelLabel={tc("cancel")}
                pendingLabel={tc("deleting")}
                successMessage={tf("itemDeleted")}
                errorMessage={tf("deleteFailed")}
              />
            </div>
          )}
        </section>
      ) : (
        <p className="rounded-xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      )}

      {/* Financial overview + obligations by month (per-athlete, not bulk). */}
      {canViewFinance && current && (
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("financialTitle")}
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground">{t("monthlyDue")}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                {formatAmount(current.monthly_salary, currency)}
              </p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground">{t("accrued")}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                {formatAmount(accrued, currency)}
              </p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground">{t("paidLabel")}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                {formatAmount(paidSum, currency)}
              </p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground">{t("remainingLabel")}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                {formatAmount(remaining, currency)}
              </p>
            </div>
          </div>

          {obligations.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("noDueObligations")}</p>
          ) : (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("obligationsTitle")}
              </h3>
              {due.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">{t("noDueObligations")}</p>
              ) : (
                <ul className="mt-1 divide-y divide-border">
                  {due.map((o) => (
                    <ObligationRow
                      key={o.period}
                      o={o}
                      athleteId={id}
                      currency={currency}
                      lng={lng}
                      isFuture={false}
                      canManageFinance={canManageFinance}
                      adjustmentLabels={adjustmentLabels}
                      t={t}
                    />
                  ))}
                </ul>
              )}

              {upcoming.length > 0 && (
                <details className="group mt-2">
                  <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                    {t("futureObligations")} · {upcoming.length}
                  </summary>
                  <ul className="mt-1 divide-y divide-border">
                    {upcoming.map((o) => (
                      <ObligationRow
                        key={o.period}
                        o={o}
                        athleteId={id}
                        currency={currency}
                        lng={lng}
                        isFuture
                        canManageFinance={canManageFinance}
                        adjustmentLabels={adjustmentLabels}
                        t={t}
                      />
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </section>
      )}

      {/* Payment history for this player. */}
      {canViewFinance && payments.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("paymentsTitle")}
          </h2>
          <ul className="mt-1 divide-y divide-border">
            {payments.map((p) => {
              const pd = p.period ? parsePeriod(p.period) : null;
              // Reversed payments stay in the history as discrete evidence —
              // never presented as a valid "Plaćeno".
              const reversed = p.reversed_at != null;
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5"
                >
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium tabular-nums ${
                        reversed ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {formatDmy(p.paid_on)}.
                    </p>
                    {p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}
                    {reversed && (
                      <p className="mt-1">
                        <StatusBadge tone="neutral" label={t("reversed")} />
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p
                        className={`text-sm font-semibold tabular-nums ${
                          reversed ? "text-muted-foreground line-through" : "text-foreground"
                        }`}
                      >
                        {formatAmount(p.amount, p.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(`methods.${p.method}`)}
                        {pd ? ` · ${monthName(pd.month, lng)} ${pd.year}` : ""}
                      </p>
                    </div>
                    {!reversed && canManageFinance && (
                      <ConfirmDeleteButton
                        action={reversePayment}
                        hiddenFields={{ payment_id: p.id, athlete_id: id }}
                        triggerLabel={t("reverse")}
                        triggerClassName="rounded text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                        title={t("reverseConfirmTitle", {
                          amount: formatAmount(p.amount, p.currency),
                        })}
                        body={t("reverseConfirmBody")}
                        confirmLabel={t("reverse")}
                        cancelLabel={tc("cancel")}
                        pendingLabel={tc("reversing")}
                        successMessage={tf("paymentReversed")}
                        errorMessage={tf("reverseFailed")}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Older contracts, read-only. */}
      {history.length > 0 && (
        <section className="rounded-xl border border-border bg-card">
          <header className="border-b border-border px-4 py-2.5 sm:px-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("contractsHistory")}
            </h2>
          </header>
          <ul className="divide-y divide-border">
            {history.map((c) => {
              const s = contractStatus(c, threshold, now);
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium tabular-nums text-foreground">
                      {formatAmount(c.monthly_salary, c.currency ?? "RSD")}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {c.valid_from ? `${formatDmy(c.valid_from)}.` : "—"} –{" "}
                        {c.valid_until ? `${formatDmy(c.valid_until)}.` : "—"}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      tone={s.tone}
                      label={
                        s.label === "terminated"
                          ? t("statuses.terminated")
                          : t(`contractStatuses.${s.label}`)
                      }
                    />
                    {canManage && (
                      <ConfirmDeleteButton
                        action={deleteContract}
                        hiddenFields={{ id: c.id, athlete_id: id }}
                        triggerLabel={t("delete")}
                        triggerClassName="rounded text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                        title={t("deleteConfirmTitle")}
                        body={t("deleteConfirmBody")}
                        confirmLabel={t("deleteConfirm")}
                        cancelLabel={tc("cancel")}
                        pendingLabel={tc("deleting")}
                        successMessage={tf("itemDeleted")}
                        errorMessage={tf("deleteFailed")}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
