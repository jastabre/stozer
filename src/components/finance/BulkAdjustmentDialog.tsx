"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { isNavigationError } from "@/components/ui/MutationForm";
import { useToast } from "@/components/ui/Toast";
import { safeFeedbackMessage } from "@/lib/feedback";
import { MoneyInput } from "./MoneyInput";

export type AdjustmentActionState = { error?: string; ok?: boolean } | null;

export interface BulkAdjustmentLabels {
  trigger: string;
  title: string;
  /** Template with {count}: "Odabrano igrača: {count}". */
  selected: string;
  /** "Iznos po igraču" — the amount is applied to EACH selected player. */
  amount: string;
  perPlayerNote: string;
  reason: string;
  reasonPlaceholder: string;
  note: string;
  notePlaceholder: string;
  submit: string;
  pending: string;
  cancel: string;
}

/**
 * "Dodaj bonus" / "Dodaj odbitak" correction modal. In the payouts screen it is
 * always opened from ONE player's row/card (single-player context); the
 * multi-athlete branch below is kept for the existing bulk payload contract.
 * Shows player count, the amount PER PLAYER, reason and optional note while a
 * player is selected. While the server action runs everything is disabled and
 * the submit shows a spinner ("Dodavanje...") — no double submit. The modal
 * closes when the action reports success; the page reload recomputes totals.
 */
export function BulkAdjustmentDialog({
  action,
  athleteIds,
  period,
  type,
  labels,
  currency = "RSD",
  triggerClassName,
  disabled,
}: {
  action: (state: AdjustmentActionState, formData: FormData) => Promise<AdjustmentActionState>;
  athleteIds: string[];
  period: string;
  type: "bonus" | "deduction";
  labels: BulkAdjustmentLabels;
  /** Player currency for the formatted amount input. */
  currency?: string;
  triggerClassName?: string;
  disabled?: boolean;
}) {
  const tf = useTranslations("feedback");
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [state, setState] = useState<AdjustmentActionState>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await action(null, formData);
        setState(result);
        if (result?.ok) {
          success(tf("adjustmentAdded"));
          setOpen(false);
        } else if (result?.error) {
          error(safeFeedbackMessage(result.error, tf("paymentFailed")));
        }
      } catch (caught) {
        if (isNavigationError(caught)) {
          success(tf("adjustmentAdded"));
          setOpen(false);
          return;
        }
        error(tf("paymentFailed"));
        setState({ error: "Greška pri unosu korekcije. Pokušajte ponovo." });
      }
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setAmount("");
          setState(null);
          setOpen(true);
        }}
        className={triggerClassName}
      >
        {labels.trigger}
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={labels.title}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => {
              if (!pending) setOpen(false);
            }}
          >
            <div
              className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold">{labels.title}</h3>
              {athleteIds.length > 1 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {labels.selected.replace("{count}", String(athleteIds.length))}
                </p>
              )}
              <form action={handleSubmit} className="mt-4 space-y-3">
                {athleteIds.map((athleteId) => (
                  <input
                    key={athleteId}
                    type="hidden"
                    name="athlete_ids"
                    value={athleteId}
                  />
                ))}
                <input type="hidden" name="period" value={period} />
                <input type="hidden" name="type" value={type} />
                <label className="grid gap-1 text-xs text-muted-foreground">
                  {labels.amount}
                  <MoneyInput
                    name="amount"
                    value={amount}
                    onValueChange={setAmount}
                    currency={currency}
                    ariaLabel={labels.amount}
                    required
                    inputClassName="h-10"
                  />
                </label>
                {athleteIds.length > 1 && (
                  <p className="text-[11px] text-muted-foreground">{labels.perPlayerNote}</p>
                )}
                <label className="grid gap-1 text-xs text-muted-foreground">
                  {labels.reason}
                  <input
                    name="reason"
                    type="text"
                    maxLength={200}
                    required
                    placeholder={labels.reasonPlaceholder}
                    className="field h-10 py-0"
                  />
                </label>
                <label className="grid gap-1 text-xs text-muted-foreground">
                  {labels.note}
                  <input
                    name="note"
                    type="text"
                    maxLength={1000}
                    placeholder={labels.notePlaceholder}
                    className="field h-10 py-0"
                  />
                </label>

                {state?.error && (
                  <p role="alert" className="text-sm text-destructive">
                    {state.error}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={pending}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
                  >
                    {labels.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
                  >
                    {pending && (
                      <span
                        aria-hidden="true"
                        className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                      />
                    )}
                    {pending ? labels.pending : labels.submit}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
