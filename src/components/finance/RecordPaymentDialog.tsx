"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { DateField } from "@/components/ui/DateField";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { useMutationFeedback } from "@/components/ui/useMutationFeedback";
import { formatAmount } from "@/lib/first-team";
import { MoneyInput } from "./MoneyInput";

export type PaymentActionState = { error?: string; ok?: boolean } | null;

/** The subset of a player the recording dialog needs. */
export interface RecordPaymentPlayer {
  athleteId: string;
  name: string;
  /** Contracted base salary for the month. */
  base: number;
  /** Active bonus total (changes the obligation, not the payment). */
  bonus: number;
  /** Active deduction total, positive number. */
  deduction: number;
  /** Monthly obligation (base + bonuses − deductions). */
  adjusted: number;
  paid: number;
  remaining: number;
  currency: string;
}

export interface RecordPaymentDialogLabels {
  title: string;
  player: string;
  obligationForMonth: string;
  /** "Osnovna plata" — the contracted base row of the breakdown. */
  baseSalary: string;
  bonus: string;
  deduction: string;
  obligation: string;
  alreadyPaid: string;
  remaining: string;
  amount: string;
  /** Template with {name} for the per-player inputs in a bulk recording. */
  amountFor: string;
  /** Template with {count} shown for a bulk recording. */
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
}

/**
 * Recording dialog for ONE player (individual / partial payment) or SEVERAL
 * selected players (bulk). Shows the monthly obligation context for a single
 * player and an editable amount per player for a bulk run. Amounts default to
 * each player's remaining and can be lowered for a partial payment; the
 * submit is blocked until every amount is a positive integer within the
 * obligation's remaining (the server action enforces the same rules, plus the
 * obligation/org/player binding). Reuses the existing bulk server action
 * payload, so a one-player recording is just a bulk with one row.
 */
export function RecordPaymentDialog({
  action,
  players,
  period,
  monthLabel,
  defaultPaidOn,
  labels,
  onClose,
}: {
  action: (state: PaymentActionState, formData: FormData) => Promise<PaymentActionState>;
  players: RecordPaymentPlayer[];
  period: string;
  monthLabel: string;
  defaultPaidOn: string;
  labels: RecordPaymentDialogLabels;
  onClose: () => void;
}) {
  const tf = useTranslations("feedback");
  // The recording succeeded: the success toast fires and the dialog closes;
  // the page revalidates with fresh sums.
  const [state, formAction] = useMutationFeedback(action, {
    successMessage: tf("paymentRecorded"),
    errorMessage: tf("paymentFailed"),
    onSuccess: onClose,
  });
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      players.map((p) => [p.athleteId, p.remaining > 0 ? String(p.remaining) : ""])
    )
  );

  const single = players.length === 1;
  const invalid = players.filter((player) => {
    const amount = Number(amounts[player.athleteId]);
    return !Number.isInteger(amount) || amount <= 0 || amount > player.remaining;
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

        {single ? (
          <>
            {/* Context first: who, for which month, and how the obligation is
                composed. Then the payment math (already paid / remaining). The
                correction editor lives in the "Korekcije" dialog, not here. */}
            <dl className="mt-3 space-y-1.5 text-sm">
              <DialogRow label={labels.player} value={players[0].name} />
              <DialogRow label={labels.obligationForMonth} value={monthLabel} />
            </dl>

            <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
              <DialogRow
                label={labels.baseSalary}
                value={formatAmount(players[0].base, players[0].currency)}
              />
              <DialogRow
                label={labels.bonus}
                value={
                  players[0].bonus > 0
                    ? `+${formatAmount(players[0].bonus, players[0].currency)}`
                    : "\u2014"
                }
              />
              <DialogRow
                label={labels.deduction}
                value={
                  players[0].deduction > 0
                    ? `\u2212${formatAmount(players[0].deduction, players[0].currency)}`
                    : "\u2014"
                }
              />
            </dl>

            <dl className="mt-2 border-t border-border pt-2 text-sm">
              <DialogRow
                label={labels.obligation}
                value={formatAmount(players[0].adjusted, players[0].currency)}
                strong
              />
            </dl>

            <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
              <DialogRow
                label={labels.alreadyPaid}
                value={formatAmount(players[0].paid, players[0].currency)}
              />
              <DialogRow
                label={labels.remaining}
                value={formatAmount(players[0].remaining, players[0].currency)}
                strong
              />
            </dl>
          </>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            {labels.selectedCount.replace("{count}", String(players.length))}
          </p>
        )}

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
            <label className="grid gap-1 text-xs text-muted-foreground">
              {labels.amount}
              <MoneyInput
                name={`amount_${players[0].athleteId}`}
                value={amounts[players[0].athleteId] ?? ""}
                onValueChange={(value) =>
                  setAmounts((current) => ({
                    ...current,
                    [players[0].athleteId]: value,
                  }))
                }
                currency={players[0].currency}
                ariaLabel={labels.amount}
                required
                inputClassName="h-10"
              />
            </label>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {labels.amount}
              </p>
              <ul className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
                {players.map((player) => (
                  <li
                    key={player.athleteId}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{player.name}</p>
                      <p className="text-[11px] tabular-nums text-muted-foreground">
                        {labels.remaining}:{" "}
                        {formatAmount(player.remaining, player.currency)}
                      </p>
                    </div>
                    <MoneyInput
                      name={`amount_${player.athleteId}`}
                      value={amounts[player.athleteId] ?? ""}
                      onValueChange={(value) =>
                        setAmounts((current) => ({
                          ...current,
                          [player.athleteId]: value,
                        }))
                      }
                      currency={player.currency}
                      ariaLabel={labels.amountFor.replace("{name}", player.name)}
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

function DialogRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums text-foreground ${strong ? "font-semibold" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
