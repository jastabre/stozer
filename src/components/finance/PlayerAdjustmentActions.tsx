"use client";

import {
  BulkAdjustmentDialog,
  type AdjustmentActionState,
  type BulkAdjustmentLabels,
} from "./BulkAdjustmentDialog";

/**
 * Per-player correction actions ("Dodaj bonus" / "Dodaj odbitak") rendered
 * inside the player's own row/card. They are deliberately NOT in the bulk
 * selection bar: a correction always belongs to one concrete player, even
 * though the dialog underneath reuses the same single-player submit flow.
 */
export function PlayerAdjustmentActions({
  action,
  athleteId,
  period,
  labels,
  currency,
  triggerClassName: triggerClassNameProp,
}: {
  action: (
    state: AdjustmentActionState,
    formData: FormData
  ) => Promise<AdjustmentActionState>;
  athleteId: string;
  period: string;
  labels: { bonus: BulkAdjustmentLabels; deduction: BulkAdjustmentLabels };
  currency: string;
  /** Overrides the default inline text style (e.g. in the detail drawer). */
  triggerClassName?: string;
}) {
  const triggerClassName =
    triggerClassNameProp ??
    "text-[11px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline";

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
      <BulkAdjustmentDialog
        action={action}
        athleteIds={[athleteId]}
        period={period}
        type="bonus"
        labels={labels.bonus}
        currency={currency}
        triggerClassName={triggerClassName}
      />
      <span aria-hidden="true" className="text-[11px] text-muted-foreground/60">
        ·
      </span>
      <BulkAdjustmentDialog
        action={action}
        athleteIds={[athleteId]}
        period={period}
        type="deduction"
        labels={labels.deduction}
        currency={currency}
        triggerClassName={triggerClassName}
      />
    </div>
  );
}
