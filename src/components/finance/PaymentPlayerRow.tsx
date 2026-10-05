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
 * One player row of the month detail (desktop table): checkbox for the bulk
 * selection (only when the obligation is still payable), the player name opens
 * the detail drawer, the month's obligation with its real structure line
 * ("Osnovna 150.000 · Bonus +20.000 · Odbitak −15.000" — only active
 * corrections, never a generic "korekcija"), paid, remaining, status and the
 * row actions: "Evidentiraj" opens the recording dialog (settled rows show
 * "Detalji"), and managers get a discreet "Korekcije" entry into the
 * adjustment editor. No inline amount inputs.
 */
export function PaymentPlayerRow({
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
  labels: { record: string; details: string; corrections: string };
  breakdownLabels: ObligationBreakdownLabels;
  onOpenDetail: () => void;
  onOpenRecord: () => void;
  onOpenAdjustments: () => void;
}) {
  // Financial amounts stay neutral: the semantic color lives only on the
  // status badge, never on the number itself.
  const remainingClass = cn(
    "tabular-nums",
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
    <tr className="border-t border-border">
      <td className="px-3 py-2 align-top">
        {selectable && (
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onCheckedChange(event.target.checked)}
            aria-label={player.name}
            className="accent-primary"
          />
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <button
          type="button"
          onClick={onOpenDetail}
          aria-label={player.detailAria}
          className="group inline-flex max-w-full items-center gap-1 text-left font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
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
      </td>
      <td className="px-3 py-2 align-top">
        <p className="tabular-nums text-foreground">
          {formatAmount(player.adjusted, player.currency)}
        </p>
        {breakdown && (
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {breakdown}
          </p>
        )}
      </td>
      <td className="px-3 py-2 align-top tabular-nums text-foreground">
        {player.paid > 0 ? formatAmount(player.paid, player.currency) : "\u2014"}
      </td>
      <td className="px-3 py-2 align-top">
        <p className={remainingClass}>
          {player.remaining > 0
            ? formatAmount(player.remaining, player.currency)
            : "\u2014"}
        </p>
      </td>
      <td className="px-3 py-2 align-top">
        <StatusBadge tone={player.statusTone} label={player.statusLabel} />
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
      </td>
    </tr>
  );
}
