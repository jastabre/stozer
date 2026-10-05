"use client";

import { ChevronDown } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDmy } from "@/lib/date-format";
import { formatAmount } from "@/lib/first-team";
import { ReversePaymentButton } from "./ReversePaymentButton";

/** One recorded payment as the UI needs it (active or reversed). */
export interface RecordedPaymentData {
  id: string;
  amount: number;
  currency: string;
  paidOn: string;
  method: string;
  note: string | null;
  reversed: boolean;
}

export interface PaymentsDisclosureLabels {
  action: string;
  title: string;
  body: string;
  cancel: string;
  pending: string;
  reversed: string;
  methods: { cash: string; bank: string; other: string };
}

/**
 * Payment history for ONE player, rendered inside the player detail drawer:
 *   - exactly one payment -> the date/method and reverse action sit inline, no
 *     extra toggle step;
 *   - more than one -> with `expandAll` the full list renders directly (the
 *     drawer is already the detail view); without it a secondary text action
 *     ("2 isplate · Istorija") expands the inline panel.
 * Each panel item scans top-down: date · method and note on the left, the
 * amount (or struck-through reversed amount) right-aligned, and the existing
 * discreet reverse action below. Reversed rows are audit history only — they
 * never add to the paid total (the sum is computed server-side from active
 * payments).
 */
export function PaymentsDisclosure({
  payments,
  athleteId,
  canReverse,
  reverseAction,
  historyAction,
  labels,
  expandAll = false,
  className,
}: {
  payments: RecordedPaymentData[];
  athleteId: string;
  canReverse: boolean;
  reverseAction?: (formData: FormData) => Promise<void>;
  /** Ready-made action label for the multi-payment toggle, e.g. "2 isplate · Istorija". */
  historyAction?: string;
  labels: PaymentsDisclosureLabels;
  /** Render every payment directly, without the toggle step. */
  expandAll?: boolean;
  className?: string;
}) {
  if (payments.length === 0) return null;

  const methodLabel = (method: string) =>
    labels.methods[method as keyof typeof labels.methods] ?? method;

  const reverseButton = (payment: RecordedPaymentData) =>
    canReverse && reverseAction ? (
      <ReversePaymentButton
        action={reverseAction}
        paymentId={payment.id}
        athleteId={athleteId}
        amount={payment.amount}
        currency={payment.currency}
        labels={labels}
        triggerClassName="rounded text-[11px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-destructive hover:underline"
      />
    ) : null;

  // A single payment: everything fits inline — no history toggle needed.
  if (payments.length === 1) {
    const payment = payments[0];
    return (
      <div className={`space-y-0.5 ${className ?? ""}`}>
        {payment.reversed ? (
          <>
            <p className="text-[11px] tabular-nums text-muted-foreground line-through">
              {formatAmount(payment.amount, payment.currency)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {formatDmy(payment.paidOn)} · {methodLabel(payment.method)}
            </p>
            <StatusBadge tone="neutral" label={labels.reversed} />
          </>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground">
              {formatDmy(payment.paidOn)} · {methodLabel(payment.method)}
            </p>
            {reverseButton(payment)}
          </>
        )}
      </div>
    );
  }

  // Inline history panel: one scannable list, no nested table.
  const list = (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <ul className="divide-y divide-border">
        {payments.map((payment) => (
          <li key={payment.id} className="px-2.5 py-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">
                  {formatDmy(payment.paidOn)} · {methodLabel(payment.method)}
                </p>
                {payment.note && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                    {payment.note}
                  </p>
                )}
                <div className="mt-1">
                  {payment.reversed ? (
                    <StatusBadge tone="neutral" label={labels.reversed} />
                  ) : (
                    reverseButton(payment)
                  )}
                </div>
              </div>
              <p
                className={`shrink-0 text-xs font-semibold tabular-nums ${
                  payment.reversed
                    ? "text-muted-foreground line-through"
                    : "text-foreground"
                }`}
              >
                {formatAmount(payment.amount, payment.currency)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  if (expandAll) {
    return <div className={className}>{list}</div>;
  }

  return (
    <div className={className}>
      <details className="group font-normal">
        <summary className="mt-0.5 inline-flex cursor-pointer select-none items-center gap-1 text-[11px] font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          {historyAction}
          <ChevronDown
            className="h-3 w-3 shrink-0 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="mt-1.5">{list}</div>
      </details>
    </div>
  );
}
