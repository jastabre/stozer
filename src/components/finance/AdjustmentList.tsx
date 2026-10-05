"use client";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatAmount, type AdjustmentType } from "@/lib/first-team";
import type { ObligationAdjustmentRecord } from "@/lib/first-team-data";
import { ReverseAdjustmentButton } from "./ReverseAdjustmentButton";

export interface AdjustmentListLabels {
  bonus: string;
  deduction: string;
  reversed: string;
  reverse: string;
  reverseTitle: string;
  reverseBody: string;
  cancel: string;
  pending: string;
}

/** Label bundle for the adjustments overview + its history list. */
export interface AdjustmentsLabels {
  base: string;
  corrections: string;
  overpaid: string;
  list: AdjustmentListLabels;
}

/** "+20.000 RSD" / "−10.000 RSD" — the sign carries the meaning. */
export function signedAdjustmentAmount(
  type: AdjustmentType,
  amount: number,
  currency: string
): string {
  const formatted = formatAmount(amount, currency);
  return type === "bonus" ? `+${formatted}` : `−${formatted}`;
}

/**
 * Compact history of one obligation's corrections: signed amount, type +
 * reason, and (for managers) a "Poništi korekciju" action on active rows.
 * Reversed corrections stay visible with a discrete "Poništeno" badge.
 */
export function AdjustmentList({
  adjustments,
  currency,
  athleteId,
  canReverse,
  reverseAction,
  labels,
  className,
}: {
  adjustments: ObligationAdjustmentRecord[];
  currency: string;
  athleteId: string;
  canReverse: boolean;
  reverseAction?: (formData: FormData) => Promise<void>;
  labels: AdjustmentListLabels;
  className?: string;
}) {
  return (
    <ul className={`divide-y divide-border/60 ${className ?? ""}`}>
      {adjustments.map((adjustment) => {
        const reversed = adjustment.reversed_at != null;
        const amountLabel = signedAdjustmentAmount(
          adjustment.type,
          adjustment.amount,
          currency
        );
        return (
          <li key={adjustment.id} className="flex items-start justify-between gap-3 py-1.5">
            <div className="min-w-0">
              <p
                className={`text-xs tabular-nums ${
                  reversed
                    ? "text-muted-foreground line-through"
                    : "font-medium text-foreground"
                }`}
              >
                {amountLabel}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {adjustment.type === "bonus" ? labels.bonus : labels.deduction} ·{" "}
                {adjustment.reason}
              </p>
              {adjustment.note && (
                <p className="text-[11px] text-muted-foreground">{adjustment.note}</p>
              )}
            </div>
            {reversed ? (
              <StatusBadge tone="neutral" label={labels.reversed} />
            ) : canReverse && reverseAction ? (
              <ReverseAdjustmentButton
                action={reverseAction}
                adjustmentId={adjustment.id}
                athleteId={athleteId}
                amountLabel={amountLabel}
                labels={labels}
                triggerClassName="shrink-0 rounded text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
