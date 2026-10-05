"use client";

import { useState } from "react";
import { formatAmount } from "@/lib/first-team";
import { formatDmy } from "@/lib/date-format";
import { MutationForm } from "@/components/ui/MutationForm";
import { DateField } from "@/components/ui/DateField";
import { MoneyInput } from "@/components/finance/MoneyInput";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import type { StaffCompensationView } from "@/lib/staff-finance-data";

export interface StaffCompensationLabels {
  title: string;
  monthly: string;
  noCompensation: string;
  validFrom: string;
  validUntil: string;
  note: string;
  notePlaceholder: string;
  save: string;
  saving: string;
  saved: string;
  error: string;
  /** Read-only summary prefix when there is no compensation. */
  none: string;
  /** "od" / "do" joiners for the read-only window line. */
  from: string;
  to: string;
}

/**
 * The staff profile's engagement finance ("Naknada / plata") section. Managers
 * with staff_finance.manage see an inline form; everyone else sees a compact
 * read-only summary. The currency is the club's single currency and is never
 * chosen here. "Bez naknade" stores no monthly amount and clears the unpaid
 * obligations server-side.
 */
export function StaffCompensationCard({
  staffId,
  compensation,
  currency,
  canManage,
  labels,
  action,
}: {
  staffId: string;
  compensation: StaffCompensationView | null;
  currency: string;
  canManage: boolean;
  labels: StaffCompensationLabels;
  action: (formData: FormData) => Promise<void>;
}) {
  const [noCompensation, setNoCompensation] = useState(
    compensation?.monthly_amount == null
  );
  const [amount, setAmount] = useState(
    compensation?.monthly_amount != null ? String(compensation.monthly_amount) : ""
  );

  const inputClass = "field";
  const blockTitle =
    "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground";

  if (!canManage) {
    const hasAmount =
      compensation?.monthly_amount != null && compensation.monthly_amount > 0;
    const windowText = compensation?.valid_from
      ? [
          `${labels.from} ${formatDmy(compensation.valid_from)}`,
          compensation.valid_until
            ? `${labels.to} ${formatDmy(compensation.valid_until)}`
            : null,
        ]
          .filter(Boolean)
          .join(" ")
      : "";

    return (
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className={blockTitle}>{labels.title}</h2>
        <p className="mt-2 text-sm text-foreground">
          {hasAmount ? (
            <>
              <span className="font-semibold tabular-nums">
                {formatAmount(compensation!.monthly_amount, currency)}
              </span>
              <span className="text-muted-foreground"> · {windowText}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{labels.none}</span>
          )}
        </p>
        {compensation?.note && (
          <p className="mt-1 text-sm text-muted-foreground">{compensation.note}</p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className={blockTitle}>{labels.title}</h2>
      <MutationForm
        action={action}
        successMessage={labels.saved}
        errorMessage={labels.error}
        className="mt-3 grid gap-3 sm:grid-cols-2"
      >
        <input type="hidden" name="staff_id" value={staffId} />

        <label className="flex items-center gap-2 text-sm font-medium text-foreground sm:col-span-2">
          <input
            type="checkbox"
            name="no_compensation"
            checked={noCompensation}
            onChange={(event) => setNoCompensation(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          {labels.noCompensation}
        </label>

        <label className="grid gap-1 text-xs text-muted-foreground">
          {labels.monthly}
          <MoneyInput
            name="monthly_amount"
            value={noCompensation ? "" : amount}
            onValueChange={setAmount}
            currency={currency}
            disabled={noCompensation}
            ariaLabel={labels.monthly}
            required={!noCompensation}
          />
        </label>

        <span aria-hidden="true" />

        <label className="grid gap-1 text-xs text-muted-foreground">
          {labels.validFrom}
          <DateField
            name="valid_from"
            defaultValue={compensation?.valid_from ?? ""}
            ariaLabel={labels.validFrom}
            required
          />
        </label>

        <label className="grid gap-1 text-xs text-muted-foreground">
          {labels.validUntil}
          <DateField
            name="valid_until"
            defaultValue={compensation?.valid_until ?? ""}
            ariaLabel={labels.validUntil}
          />
        </label>

        <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2">
          {labels.note}
          <textarea
            name="note"
            defaultValue={compensation?.note ?? ""}
            rows={2}
            placeholder={labels.notePlaceholder}
            className={inputClass}
          />
        </label>

        <div className="sm:col-span-2">
          <FormSubmitButton
            idleLabel={labels.save}
            pendingLabel={labels.saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          />
        </div>
      </MutationForm>
    </section>
  );
}
