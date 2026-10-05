"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { adjustmentTotals, formatAmount } from "@/lib/first-team";
import type { PaymentPlayerData } from "./MonthPayments";
import { AdjustmentList, type AdjustmentListLabels } from "./AdjustmentList";
import { PlayerAdjustmentActions } from "./PlayerAdjustmentActions";
import { PaymentsDisclosure, type PaymentsDisclosureLabels } from "./PaymentsDisclosure";
import type {
  AdjustmentActionState,
  BulkAdjustmentLabels,
} from "./BulkAdjustmentDialog";

export interface PlayerDetailActions {
  /** Obligation month whose corrections the drawer manages. */
  period: string;
  canManageAdjustments: boolean;
  addAdjustmentAction?: (
    state: AdjustmentActionState,
    formData: FormData
  ) => Promise<AdjustmentActionState>;
  reverseAdjustmentAction?: (formData: FormData) => Promise<void>;
  canReversePayments: boolean;
  reversePaymentAction?: (formData: FormData) => Promise<void>;
}

export interface PlayerDetailLabels {
  title: string;
  close: string;
  calcTitle: string;
  correctionsTitle: string;
  paymentsTitle: string;
  noCorrections: string;
  noPayments: string;
  base: string;
  bonus: string;
  deduction: string;
  totalDue: string;
  paid: string;
  remaining: string;
  overpaid: string;
  adjustmentList: AdjustmentListLabels;
  paymentReverse: PaymentsDisclosureLabels;
  addLabels: { bonus: BulkAdjustmentLabels; deduction: BulkAdjustmentLabels };
}

/**
 * Per-player detail view opened from the player's name in the month table.
 * The main rows stay compact: the full month calculation (base + bonus −
 * deduction = total due, paid, remaining), the correction history with its
 * add/reverse actions, and this player's individual/partial payments all live
 * here, in a right-side drawer (full-width on small screens) that scrolls on
 * its own. Rendered through a portal so its nested forms never nest inside any
 * page form.
 */
export function PlayerDetailDrawer({
  player,
  actions,
  labels,
  onClose,
}: {
  player: PaymentPlayerData;
  actions: PlayerDetailActions;
  labels: PlayerDetailLabels;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const totals = adjustmentTotals(player.adjustments);

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-40 bg-black/40"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${labels.title}: ${player.name}`}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto bg-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {player.name}
              {player.jersey ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  #{player.jersey}
                </span>
              ) : null}
            </p>
            <div className="mt-1">
              <StatusBadge tone={player.statusTone} label={player.statusLabel} />
            </div>
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

        <div className="space-y-5 px-4 py-4 sm:px-5">
          {/* The month's calculation in one place. */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {labels.calcTitle}
            </h3>
            <dl className="mt-2 space-y-1.5 text-sm">
              <DetailRow
                label={labels.base}
                value={formatAmount(player.base, player.currency)}
              />
              {totals.bonus > 0 && (
                <DetailRow
                  label={labels.bonus}
                  value={`+${formatAmount(totals.bonus, player.currency)}`}
                />
              )}
              {totals.deduction > 0 && (
                <DetailRow
                  label={labels.deduction}
                  value={`\u2212${formatAmount(totals.deduction, player.currency)}`}
                />
              )}
              <DetailRow
                label={labels.totalDue}
                value={formatAmount(player.adjusted, player.currency)}
                strong
              />
              <DetailRow
                label={labels.paid}
                value={formatAmount(player.paid, player.currency)}
              />
              <DetailRow
                label={labels.remaining}
                value={formatAmount(player.remaining, player.currency)}
                strong
              />
            </dl>
            {player.paid > player.adjusted && (
              <p className="mt-2 text-xs text-muted-foreground">{labels.overpaid}</p>
            )}
          </section>

          {/* Corrections: history + add/reverse actions. */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {labels.correctionsTitle}
            </h3>
            {actions.canManageAdjustments && actions.addAdjustmentAction && (
              <PlayerAdjustmentActions
                action={actions.addAdjustmentAction}
                athleteId={player.athleteId}
                period={actions.period}
                labels={labels.addLabels}
                currency={player.currency}
                triggerClassName="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
              />
            )}
            {player.adjustments.length > 0 ? (
              <AdjustmentList
                adjustments={player.adjustments}
                currency={player.currency}
                athleteId={player.athleteId}
                canReverse={actions.canManageAdjustments}
                reverseAction={actions.reverseAdjustmentAction}
                labels={labels.adjustmentList}
                className="mt-2"
              />
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                {labels.noCorrections}
              </p>
            )}
          </section>

          {/* This player's individual/partial payments for the month. */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {labels.paymentsTitle}
            </h3>
            {player.recordedPayments.length > 0 ? (
              <div className="mt-2">
                <PaymentsDisclosure
                  payments={player.recordedPayments}
                  athleteId={player.athleteId}
                  canReverse={actions.canReversePayments}
                  reverseAction={actions.reversePaymentAction}
                  labels={labels.paymentReverse}
                  expandAll
                />
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                {labels.noPayments}
              </p>
            )}
          </section>
        </div>
      </aside>
    </div>,
    document.body
  );
}

function DetailRow({
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
      <dd
        className={`tabular-nums text-foreground ${strong ? "font-semibold" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
