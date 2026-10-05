"use client";

import { useMemo, useState } from "react";
import type { StatusTone } from "@/components/ui/StatusBadge";
import { formatAmount } from "@/lib/first-team";
import { PaymentPlayerRow } from "./PaymentPlayerRow";
import { PaymentPlayerCard } from "./PaymentPlayerCard";
import {
  PlayerDetailDrawer,
  type PlayerDetailActions,
  type PlayerDetailLabels,
} from "./PlayerDetailDrawer";
import {
  RecordPaymentDialog,
  type PaymentActionState,
  type RecordPaymentDialogLabels,
} from "./RecordPaymentDialog";
import {
  PlayerAdjustmentsDialog,
  type PlayerAdjustmentsLabels,
} from "./PlayerAdjustmentsDialog";
import type { AdjustmentActionState } from "./BulkAdjustmentDialog";
import type { RecordedPaymentData } from "./PaymentsDisclosure";
import type { ObligationAdjustmentRecord } from "@/lib/first-team-data";

/** One player as the month detail needs them. */
export interface PaymentPlayerData {
  athleteId: string;
  name: string;
  jersey: number | null;
  /** Contracted base amount for the month. */
  base: number;
  /** Active bonus total (part of the month's obligation, not a payment). */
  bonus: number;
  /** Active deduction total, positive number (part of the obligation). */
  deduction: number;
  /** base + active bonuses - active deductions — what is actually due. */
  adjusted: number;
  paid: number;
  remaining: number;
  currency: string;
  statusLabel: string;
  statusTone: StatusTone;
  /** Accessible label for the name button that opens the detail drawer. */
  detailAria: string;
  /** All payments recorded this period (active + reversed), newest first. */
  recordedPayments: RecordedPaymentData[];
  /** Correction history (active + reversed) for this obligation. */
  adjustments: ObligationAdjustmentRecord[];
}

export interface MonthPaymentsLabels {
  table: {
    player: string;
    obligation: string;
    paid: string;
    remaining: string;
    status: string;
    action: string;
  };
  record: string;
  details: string;
  /** Discreet per-row entry into the adjustment editor. */
  corrections: string;
  selectAll: string;
  /** Template with {count}: "Izabrano: {count} igrača". */
  selected: string;
  /** Template with {amount}: "Za isplatu: {amount}". */
  payoutTotal: string;
  confirm: string;
  viewOnly: string;
  /** "Osnovna" / "Bonus" / "Odbitak" — the obligation structure line. */
  breakdown: { base: string; bonus: string; deduction: string };
  dialog: RecordPaymentDialogLabels;
  adjustmentsDialog: PlayerAdjustmentsLabels;
  detail: PlayerDetailLabels;
}

/**
 * The month detail: the ONLY place where payments are recorded. The player
 * table stays compact for long rosters (checkbox, name/detail, obligation,
 * paid, remaining, status, one row action). Recording happens in a dialog:
 *   - "Evidentiraj" on one row -> the dialog with that single player
 *     (obligation context + one amount, defaulting to the remaining);
 *   - check several rows (or "Izaberi sve") -> "Evidentiraj isplatu" opens the
 *     same dialog in bulk with one editable amount per selected player.
 * Amounts can only be lowered (partial payments); the server re-validates the
 * obligation binding, positivity and the remaining cap. Corrections, payment
 * history and reversal live in the player detail drawer and the month history.
 */
export function MonthPayments({
  action,
  reversePaymentAction,
  addAdjustmentAction,
  reverseAdjustmentAction,
  period,
  monthLabel,
  defaultPaidOn,
  canManage,
  players,
  labels,
}: {
  action: (state: PaymentActionState, formData: FormData) => Promise<PaymentActionState>;
  reversePaymentAction?: (formData: FormData) => Promise<void>;
  addAdjustmentAction?: (
    state: AdjustmentActionState,
    formData: FormData
  ) => Promise<AdjustmentActionState>;
  reverseAdjustmentAction?: (formData: FormData) => Promise<void>;
  period: string;
  monthLabel: string;
  defaultPaidOn: string;
  canManage: boolean;
  players: PaymentPlayerData[];
  labels: MonthPaymentsLabels;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [dialogPlayerIds, setDialogPlayerIds] = useState<string[] | null>(null);
  const [adjustmentsId, setAdjustmentsId] = useState<string | null>(null);

  const currency = players[0]?.currency ?? "RSD";

  // Only players with something left to pay can be selected or recorded;
  // settled obligations are shown for context (details, history).
  const payableIds = useMemo(
    () => players.filter((p) => p.remaining > 0).map((p) => p.athleteId),
    [players]
  );
  const allSelected = useMemo(
    () => payableIds.length > 0 && payableIds.every((id) => selected[id]),
    [payableIds, selected]
  );
  const selectedPlayers = useMemo(
    () => players.filter((p) => selected[p.athleteId]),
    [players, selected]
  );
  const selectedTotal = useMemo(
    () => selectedPlayers.reduce((sum, p) => sum + p.remaining, 0),
    [selectedPlayers]
  );

  const detailPlayer = detailId
    ? players.find((p) => p.athleteId === detailId) ?? null
    : null;
  const dialogPlayers = dialogPlayerIds
    ? players.filter((p) => dialogPlayerIds.includes(p.athleteId))
    : null;
  const adjustmentsPlayer = adjustmentsId
    ? players.find((p) => p.athleteId === adjustmentsId) ?? null
    : null;

  const detailActions: PlayerDetailActions = {
    period,
    canManageAdjustments: !!addAdjustmentAction,
    addAdjustmentAction,
    reverseAdjustmentAction,
    canReversePayments: !!reversePaymentAction,
    reversePaymentAction,
  };

  function toggleOne(athleteId: string, checked: boolean) {
    setSelected((current) => ({ ...current, [athleteId]: checked }));
  }

  function toggleAll(checked: boolean) {
    setSelected(
      Object.fromEntries(players.map((p) => [p.athleteId, checked && p.remaining > 0]))
    );
  }

  const rowLabels = {
    record: labels.record,
    details: labels.details,
    corrections: labels.corrections,
    obligation: labels.table.obligation,
    paid: labels.table.paid,
    remaining: labels.table.remaining,
  };

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
          <label className="flex items-center gap-2 text-xs font-medium text-foreground">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => toggleAll(event.target.checked)}
              className="accent-primary"
            />
            {labels.selectAll}
          </label>
          <span className="text-xs text-muted-foreground">
            {labels.selected.replace("{count}", String(selectedPlayers.length))}
          </span>
          {selectedPlayers.length > 0 && (
            <>
              <span aria-hidden="true" className="text-xs text-muted-foreground/60">
                ·
              </span>
              <span className="text-xs font-medium tabular-nums text-foreground">
                {labels.payoutTotal.replace(
                  "{amount}",
                  formatAmount(selectedTotal, currency)
                )}
              </span>
              <div className="ml-auto">
                <button
                  type="button"
                  onClick={() => setDialogPlayerIds(selectedPlayers.map((p) => p.athleteId))}
                  className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                >
                  {labels.confirm}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{labels.viewOnly}</p>
      )}

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-8 px-3 py-2" />
              <th className="px-3 py-2 font-medium">{labels.table.player}</th>
              <th className="px-3 py-2 font-medium">{labels.table.obligation}</th>
              <th className="px-3 py-2 font-medium">{labels.table.paid}</th>
              <th className="px-3 py-2 font-medium">{labels.table.remaining}</th>
              <th className="px-3 py-2 font-medium">{labels.table.status}</th>
              <th className="px-3 py-2 font-medium">{labels.table.action}</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <PaymentPlayerRow
                key={player.athleteId}
                player={player}
                canRecord={canManage}
                canAdjust={canManage && !!addAdjustmentAction}
                selectable={canManage && player.remaining > 0}
                checked={!!selected[player.athleteId]}
                onCheckedChange={(checked) => toggleOne(player.athleteId, checked)}
                labels={rowLabels}
                breakdownLabels={labels.breakdown}
                onOpenDetail={() => setDetailId(player.athleteId)}
                onOpenRecord={() => setDialogPlayerIds([player.athleteId])}
                onOpenAdjustments={() => setAdjustmentsId(player.athleteId)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card md:hidden">
        {players.map((player) => (
          <PaymentPlayerCard
            key={player.athleteId}
            player={player}
            canRecord={canManage}
            canAdjust={canManage && !!addAdjustmentAction}
            selectable={canManage && player.remaining > 0}
            checked={!!selected[player.athleteId]}
            onCheckedChange={(checked) => toggleOne(player.athleteId, checked)}
            labels={rowLabels}
            breakdownLabels={labels.breakdown}
            onOpenDetail={() => setDetailId(player.athleteId)}
            onOpenRecord={() => setDialogPlayerIds([player.athleteId])}
            onOpenAdjustments={() => setAdjustmentsId(player.athleteId)}
          />
        ))}
      </ul>

      {dialogPlayers && dialogPlayers.length > 0 && (
        <RecordPaymentDialog
          action={action}
          players={dialogPlayers}
          period={period}
          monthLabel={monthLabel}
          defaultPaidOn={defaultPaidOn}
          labels={labels.dialog}
          onClose={() => setDialogPlayerIds(null)}
        />
      )}

      {detailPlayer && (
        <PlayerDetailDrawer
          player={detailPlayer}
          actions={detailActions}
          labels={labels.detail}
          onClose={() => setDetailId(null)}
        />
      )}

      {adjustmentsPlayer && (
        <PlayerAdjustmentsDialog
          player={adjustmentsPlayer}
          monthLabel={monthLabel}
          period={period}
          addAction={addAdjustmentAction}
          reverseAction={reverseAdjustmentAction}
          labels={labels.adjustmentsDialog}
          onClose={() => setAdjustmentsId(null)}
        />
      )}
    </div>
  );
}
