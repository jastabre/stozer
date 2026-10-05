"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { DateField } from "@/components/ui/DateField";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { useMutationFeedback } from "@/components/ui/useMutationFeedback";
import { formatAmount } from "@/lib/first-team";
import { MoneyInput } from "./MoneyInput";

export type StaffPaymentActionState = { error?: string; ok?: boolean } | null;

/** One staff member as the month payout screen needs them. */
export interface StaffPaymentRow {
  staffId: string;
  name: string;
  /** Localized club-function label, e.g. "Trener · Pomoćni trener". */
  functionLabel: string;
  expected: number;
  paid: number;
  remaining: number;
  statusLabel: string;
  statusTone: StatusTone;
}

export interface StaffMonthPaymentsLabels {
  table: {
    staff: string;
    obligation: string;
    paid: string;
    remaining: string;
    status: string;
    action: string;
  };
  selectAll: string;
  /** Hint shown before anything is selected, so the bar is never half-empty. */
  selectHint: string;
  selected: string;
  payoutTotal: string;
  markPaid: string;
  record: string;
  viewOnly: string;
  dialog: {
    title: string;
    staff: string;
    remaining: string;
    amount: string;
    amountFor: string;
    selectedCount: string;
    paidOn: string;
    method: string;
    methods: { cash: string; bank: string; other: string };
    note: string;
    notePlaceholder: string;
    submit: string;
    pending: string;
    cancel: string;
    invalidAmount: string;
  };
}

/**
 * The staff payout month table: one row per staff member with a financial
 * obligation for the month, with select-all / multi-select and a bulk
 * "Označi kao plaćeno" action, plus a per-row "Evidentiraj" for a single /
 * partial payment. Recording happens in a dialog (amounts default to the
 * remaining, i.e. full payment) — no adjustments, no payroll.
 */
export function StaffMonthPayments({
  action,
  period,
  defaultPaidOn,
  canManage,
  currency,
  staff,
  labels,
}: {
  action: (
    state: StaffPaymentActionState,
    formData: FormData
  ) => Promise<StaffPaymentActionState>;
  period: string;
  defaultPaidOn: string;
  canManage: boolean;
  currency: string;
  staff: StaffPaymentRow[];
  labels: StaffMonthPaymentsLabels;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [dialogStaffIds, setDialogStaffIds] = useState<string[] | null>(null);

  const payableIds = useMemo(
    () => staff.filter((s) => s.remaining > 0).map((s) => s.staffId),
    [staff]
  );
  const allSelected =
    payableIds.length > 0 && payableIds.every((id) => selected[id]);
  const selectedRows = staff.filter((s) => selected[s.staffId]);
  const selectedTotal = selectedRows.reduce((sum, s) => sum + s.remaining, 0);
  const dialogRows = dialogStaffIds
    ? staff.filter((s) => dialogStaffIds.includes(s.staffId))
    : null;

  function toggleOne(staffId: string, checked: boolean) {
    setSelected((current) => ({ ...current, [staffId]: checked }));
  }

  function toggleAll(checked: boolean) {
    setSelected(
      Object.fromEntries(
        staff.map((s) => [s.staffId, checked && s.remaining > 0])
      )
    );
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card px-3 py-2.5">
          <label className="flex items-center gap-2 text-xs font-medium text-foreground">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => toggleAll(event.target.checked)}
              className="accent-primary"
            />
            {labels.selectAll}
          </label>
          {selectedRows.length > 0 ? (
            <>
              <span className="text-xs text-muted-foreground">
                {labels.selected.replace("{count}", String(selectedRows.length))}
              </span>
              <span aria-hidden="true" className="text-xs text-muted-foreground/40">
                ·
              </span>
              <span className="text-xs font-medium tabular-nums text-foreground">
                {labels.payoutTotal.replace(
                  "{amount}",
                  formatAmount(selectedTotal, currency)
                )}
              </span>
              <button
                type="button"
                onClick={() =>
                  setDialogStaffIds(selectedRows.map((s) => s.staffId))
                }
                className="ml-auto h-9 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
              >
                {labels.markPaid}
              </button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              {labels.selectHint}
            </span>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{labels.viewOnly}</p>
      )}

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-muted/50 text-left text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            <tr>
              <th className="w-8 px-3 py-2.5" />
              <th className="px-3 py-2.5 font-medium">{labels.table.staff}</th>
              <th className="px-3 py-2.5 text-right font-medium">
                {labels.table.obligation}
              </th>
              <th className="px-3 py-2.5 text-right font-medium">
                {labels.table.paid}
              </th>
              <th className="px-3 py-2.5 text-right font-medium">
                {labels.table.remaining}
              </th>
              <th className="px-3 py-2.5 text-center font-medium">
                {labels.table.status}
              </th>
              <th className="px-3 py-2.5 text-right font-medium">
                {labels.table.action}
              </th>
            </tr>
          </thead>
          <tbody>
            {staff.map((row) => (
              <tr key={row.staffId} className="border-t border-border transition-colors hover:bg-muted/30">
                <td className="px-3 py-3">
                  {canManage && row.remaining > 0 ? (
                    <input
                      type="checkbox"
                      checked={!!selected[row.staffId]}
                      onChange={(event) =>
                        toggleOne(row.staffId, event.target.checked)
                      }
                      className="accent-primary"
                      aria-label={row.name}
                    />
                  ) : (
                    <span className="inline-block w-4" />
                  )}
                </td>
                <td className="px-3 py-3">
                  <p className="truncate font-medium text-foreground">{row.name}</p>
                  {row.functionLabel && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {row.functionLabel}
                    </p>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-foreground">
                  {formatAmount(row.expected, currency)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-muted-foreground">
                  {row.paid > 0 ? formatAmount(row.paid, currency) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-foreground">
                  {row.remaining > 0 ? formatAmount(row.remaining, currency) : "—"}
                </td>
                <td className="px-3 py-3 text-center">
                  <StatusBadge tone={row.statusTone} label={row.statusLabel} />
                </td>
                <td className="px-3 py-3 text-right">
                  {canManage && row.remaining > 0 ? (
                    <button
                      type="button"
                      onClick={() => setDialogStaffIds([row.staffId])}
                      className="rounded text-[11px] font-medium text-primary underline-offset-2 transition-colors hover:underline"
                    >
                      {labels.record}
                    </button>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card md:hidden">
        {staff.map((row) => (
          <li key={row.staffId} className="flex items-center gap-3 px-4 py-3">
            {canManage && row.remaining > 0 && (
              <input
                type="checkbox"
                checked={!!selected[row.staffId]}
                onChange={(event) => toggleOne(row.staffId, event.target.checked)}
                className="accent-primary"
                aria-label={row.name}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {row.name}
                </p>
                <StatusBadge tone={row.statusTone} label={row.statusLabel} />
              </div>
              {row.functionLabel && (
                <p className="truncate text-[11px] text-muted-foreground">
                  {row.functionLabel}
                </p>
              )}
              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                {labels.table.obligation}: {formatAmount(row.expected, currency)}
                {" · "}
                {labels.table.remaining}:{" "}
                {row.remaining > 0 ? formatAmount(row.remaining, currency) : "—"}
              </p>
              {canManage && row.remaining > 0 && (
                <button
                  type="button"
                  onClick={() => setDialogStaffIds([row.staffId])}
                  className="mt-1 rounded text-[11px] font-medium text-primary underline-offset-2 hover:underline"
                >
                  {labels.record}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {dialogRows && dialogRows.length > 0 && (
        <StaffPaymentDialog
          action={action}
          staff={dialogRows}
          period={period}
          defaultPaidOn={defaultPaidOn}
          currency={currency}
          labels={labels.dialog}
          onClose={() => setDialogStaffIds(null)}
        />
      )}
    </div>
  );
}

function StaffPaymentDialog({
  action,
  staff,
  period,
  defaultPaidOn,
  currency,
  labels,
  onClose,
}: {
  action: (
    state: StaffPaymentActionState,
    formData: FormData
  ) => Promise<StaffPaymentActionState>;
  staff: StaffPaymentRow[];
  period: string;
  defaultPaidOn: string;
  currency: string;
  labels: StaffMonthPaymentsLabels["dialog"];
  onClose: () => void;
}) {
  const tf = useTranslations("feedback");
  const [state, formAction] = useMutationFeedback(action, {
    successMessage: tf("paymentRecorded"),
    errorMessage: tf("paymentFailed"),
    onSuccess: onClose,
  });
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      staff.map((s) => [s.staffId, s.remaining > 0 ? String(s.remaining) : ""])
    )
  );

  const single = staff.length === 1;
  const invalid = staff.filter((s) => {
    const amount = Number(amounts[s.staffId]);
    return !Number.isInteger(amount) || amount <= 0 || amount > s.remaining;
  });

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={labels.title}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-foreground">{labels.title}</h3>

        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="period" value={period} />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-muted-foreground">
              {labels.paidOn}
              <DateField
                name="paid_on"
                defaultValue={defaultPaidOn}
                required
                ariaLabel={labels.paidOn}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              {labels.method}
              <select name="method" defaultValue="cash" className="field h-10 py-0">
                <option value="cash">{labels.methods.cash}</option>
                <option value="bank">{labels.methods.bank}</option>
                <option value="other">{labels.methods.other}</option>
              </select>
            </label>
          </div>

          {single ? (
            <div className="space-y-1.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">{labels.staff}</dt>
                <dd className="text-foreground">{staff[0].name}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">{labels.remaining}</dt>
                <dd className="font-semibold tabular-nums text-foreground">
                  {formatAmount(staff[0].remaining, currency)}
                </dd>
              </div>
              <label className="grid gap-1 text-xs text-muted-foreground">
                {labels.amount}
                <MoneyInput
                  name={`amount_${staff[0].staffId}`}
                  value={amounts[staff[0].staffId] ?? ""}
                  onValueChange={(value) =>
                    setAmounts((current) => ({
                      ...current,
                      [staff[0].staffId]: value,
                    }))
                  }
                  currency={currency}
                  ariaLabel={labels.amount}
                  required
                  inputClassName="h-10"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {labels.selectedCount.replace("{count}", String(staff.length))}
              </p>
              <ul className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
                {staff.map((row) => (
                  <li
                    key={row.staffId}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{row.name}</p>
                      <p className="text-[11px] tabular-nums text-muted-foreground">
                        {labels.remaining}:{" "}
                        {formatAmount(row.remaining, currency)}
                      </p>
                    </div>
                    <MoneyInput
                      name={`amount_${row.staffId}`}
                      value={amounts[row.staffId] ?? ""}
                      onValueChange={(value) =>
                        setAmounts((current) => ({
                          ...current,
                          [row.staffId]: value,
                        }))
                      }
                      currency={currency}
                      ariaLabel={labels.amountFor.replace("{name}", row.name)}
                      className="w-36"
                      inputClassName="h-9"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="grid gap-1 text-xs text-muted-foreground">
            {labels.note}
            <input
              name="note"
              placeholder={labels.notePlaceholder}
              className="field h-10 py-0"
            />
          </label>

          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          {invalid.length > 0 && (
            <p role="alert" className="text-xs text-destructive">
              {labels.invalidAmount}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {labels.cancel}
            </button>
            <FormSubmitButton
              idleLabel={labels.submit}
              pendingLabel={labels.pending}
              disabled={invalid.length > 0}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            />
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
