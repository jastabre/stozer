"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { formatAmount } from "@/lib/first-team";
import type { PaymentPlayerData } from "./MonthPayments";
import { AdjustmentList, type AdjustmentListLabels } from "./AdjustmentList";
import { PlayerAdjustmentActions } from "./PlayerAdjustmentActions";
import type {
  AdjustmentActionState,
  BulkAdjustmentLabels,
} from "./BulkAdjustmentDialog";

export interface PlayerAdjustmentsLabels {
  /** "Korekcije" — dialog title + row action. */
  title: string;
  /** "Osnovna plata" — the contracted base row. */
  baseSalary: string;
  /** "Bonus" — the +section header. */
  bonusSection: string;
  /** "Odbici" — the −section header. */
  deductionSection: string;
  /** "nema" — shown when a section has no rows. */
  none: string;
  /** "Ukupna obaveza" — base + active bonuses − active deductions. */
  total: string;
  close: string;
  list: AdjustmentListLabels;
  addLabels: { bonus: BulkAdjustmentLabels; deduction: BulkAdjustmentLabels };
}

/**
 * The compact per-player adjustment editor for one obligation month
 * ("Korekcije — Marko Marković — Septembar 2026"): the contracted base, the
 * active bonuses and deductions grouped by type with their reasons and
 * reversal actions (reversed rows stay as audit history), the resulting
 * monthly obligation, and the "Dodaj bonus"/"Dodaj odbitak" actions. Records
 * stay strictly separate from payments: corrections change the month's
 * obligation, payments only lower the remaining balance.
 */
export function PlayerAdjustmentsDialog({
  player,
  monthLabel,
  period,
  addAction,
  reverseAction,
  labels,
  onClose,
}: {
  player: PaymentPlayerData;
  monthLabel: string;
  period: string;
  addAction?: (
    state: AdjustmentActionState,
    formData: FormData
  ) => Promise<AdjustmentActionState>;
  reverseAction?: (formData: FormData) => Promise<void>;
  labels: PlayerAdjustmentsLabels;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const bonuses = player.adjustments.filter((row) => row.type === "bonus");
  const deductions = player.adjustments.filter((row) => row.type === "deduction");

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${labels.title}: ${player.name}`}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-foreground">{labels.title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {player.name} · {monthLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="mt-4 flex items-baseline justify-between gap-3 border-b border-border pb-2 text-sm">
          <span className="text-muted-foreground">{labels.baseSalary}</span>
          <span className="tabular-nums text-foreground">
            {formatAmount(player.base, player.currency)}
          </span>
        </div>

        <section className="mt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {labels.bonusSection}
          </h4>
          {bonuses.length > 0 ? (
            <AdjustmentList
              adjustments={bonuses}
              currency={player.currency}
              athleteId={player.athleteId}
              canReverse={!!reverseAction}
              reverseAction={reverseAction}
              labels={labels.list}
              className="mt-1"
            />
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">{labels.none}</p>
          )}
        </section>

        <section className="mt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {labels.deductionSection}
          </h4>
          {deductions.length > 0 ? (
            <AdjustmentList
              adjustments={deductions}
              currency={player.currency}
              athleteId={player.athleteId}
              canReverse={!!reverseAction}
              reverseAction={reverseAction}
              labels={labels.list}
              className="mt-1"
            />
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">{labels.none}</p>
          )}
        </section>

        <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-border pt-3">
          <span className="text-sm font-medium text-foreground">{labels.total}</span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatAmount(player.adjusted, player.currency)}
          </span>
        </div>

        {addAction && (
          <div className="mt-4 border-t border-border pt-3">
            <PlayerAdjustmentActions
              action={addAction}
              athleteId={player.athleteId}
              period={period}
              labels={labels.addLabels}
              currency={player.currency}
              triggerClassName="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
            />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
