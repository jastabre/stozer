"use client";

import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  formatAmount,
  obligationBreakdownLabel,
  type ObligationBreakdownLabels,
} from "@/lib/first-team";
import { cn } from "@/lib/utils";
import type { PaymentPlayerData } from "./MonthPayments";

/**
 * Mobile presentation of one player in the month detail: checkbox (when the
 * obligation is still payable) + name that opens the detail drawer, status,
 * the three amounts that matter (Obaveza / Isplaćeno / Preostalo) with the
 * real structure line under the obligation, and the row actions
 * ("Evidentiraj" / "Detalji" + a discreet "Korekcije" for managers). No inline
 * amount inputs.
 */
export function PaymentPlayerCard({
  player,
  canRecord,
  canAdjust,
  selectable,
  checked,
  onCheckedChange,
  labels,
  breakdownLabels,
  onOpenDetail,
  onOpenRecord,
  onOpenAdjustments,
}: {
  player: PaymentPlayerData;
  /** False for view-only users: the row offers details, never recording. */
  canRecord: boolean;
  /** Managers only: show the discreet "Korekcije" action. */
  canAdjust: boolean;
  selectable: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  labels: {
    record: string;
    details: string;
    corrections: string;
    obligation: string;
    paid: string;
    remaining: string;
  };
  breakdownLabels: ObligationBreakdownLabels;
  onOpenDetail: () => void;
  onOpenRecord: () => void;
  onOpenAdjustments: () => void;
}) {
  // Financial amounts stay neutral: the semantic color lives only on the
  // status badge, never on the number itself.
  const remainingClass = cn(
    "text-sm tabular-nums",
    player.remaining > 0
      ? "font-semibold text-foreground"
      : "font-medium text-muted-foreground"
  );

  const breakdown = obligationBreakdownLabel(
    player.base,
    { bonus: player.bonus, deduction: player.deduction },
    breakdownLabels
  );

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        {selectable && (
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onCheckedChange(event.target.checked)}
            aria-label={player.name}
            className="mt-0.5 accent-primary"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={onOpenDetail}
              aria-label={player.detailAria}
              className="group inline-flex min-w-0 items-center gap-1 text-left text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
            >
              <span className="min-w-0">{player.name}</span>
              {player.jersey ? (
                <span className="text-xs font-normal text-muted-foreground">
                  #{player.jersey}
                </span>
              ) : null}
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                aria-hidden="true"
              />
            </button>
            <StatusBadge tone={player.statusTone} label={player.statusLabel} />
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {labels.obligation}
              </p>
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {formatAmount(player.adjusted, player.currency)}
              </p>
              {breakdown && (
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {breakdown}
                </p>
              )}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {labels.paid}
              </p>
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {player.paid > 0 ? formatAmount(player.paid, player.currency) : "\u2014"}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {labels.remaining}
              </p>
              <p className={remainingClass}>
                {player.remaining > 0
                  ? formatAmount(player.remaining, player.currency)
                  : "\u2014"}
              </p>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            {canRecord && player.remaining > 0 ? (
              <button
                type="button"
                onClick={onOpenRecord}
                className="rounded text-sm font-medium text-primary underline-offset-2 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
              >
                {labels.record}
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenDetail}
                className="rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
              >
                {labels.details}
              </button>
            )}
            {canAdjust && (
              <button
                type="button"
                onClick={onOpenAdjustments}
                className="rounded text-xs font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
              >
                {labels.corrections}
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
