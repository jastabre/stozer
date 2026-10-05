"use client";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDmy } from "@/lib/date-format";
import { formatAmount } from "@/lib/first-team";
import { ReversePaymentButton } from "./ReversePaymentButton";
import type { PaymentsDisclosureLabels } from "./PaymentsDisclosure";

/** One recorded payment as the history section needs it. */
export interface PaymentHistoryRow {
  id: string;
  athleteId: string;
  name: string;
  jersey: number | null;
  amount: number;
  currency: string;
  /** ISO YYYY-MM-DD as stored. */
  paidOn: string;
  method: string;
  note: string | null;
  reversed: boolean;
}

export interface PaymentHistoryLabels {
  /** Ready-made heading, e.g. "Istorija isplata · Septembar 2026". */
  title: string;
  /** Ready-made summary of ACTIVE payments, e.g. "1 aktivna · 1 poništena · Isplaćeno 20.000 RSD". */
  summary: string;
  columns: {
    player: string;
    date: string;
    method: string;
    note: string;
    amount: string;
  };
  empty: string;
  /** Reversal dialog copy — same strings as the per-player disclosures. */
  reverse: PaymentsDisclosureLabels;
}

/**
 * The selected month's payment ledger: every recorded payment (active AND
 * reversed) in one compact, scannable financial list — player, payment date
 * (DD.MM.YYYY.), payment method, note and amount. The month is already the
 * screen's filter and lives in the title, so there is no "for month" column.
 * Desktop renders a real table; mobile renders the same rows as tight
 * two-line entries (never oversized cards). Reversed payments stay visible
 * struck-through with a "Poništeno" badge, while the summary total counts
 * ACTIVE payments only.
 */
export function PaymentHistory({
  rows,
  labels,
  canReverse,
  reverseAction,
}: {
  rows: PaymentHistoryRow[];
  labels: PaymentHistoryLabels;
  canReverse: boolean;
  reverseAction?: (formData: FormData) => Promise<void>;
}) {
  const methodLabel = (method: string) =>
    labels.reverse.methods[method as keyof typeof labels.reverse.methods] ?? method;

  const reverseButton = (row: PaymentHistoryRow, triggerClassName: string) =>
    canReverse && reverseAction ? (
      <ReversePaymentButton
        action={reverseAction}
        paymentId={row.id}
        athleteId={row.athleteId}
        amount={row.amount}
        currency={row.currency}
        labels={labels.reverse}
        triggerClassName={triggerClassName}
      />
    ) : null;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {labels.title}
        </h2>
        {labels.summary && (
          <p className="text-xs tabular-nums text-muted-foreground">{labels.summary}</p>
        )}
      </header>

      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground sm:px-5">{labels.empty}</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">
                    {labels.columns.player}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {labels.columns.date}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {labels.columns.method}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {labels.columns.note}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    {labels.columns.amount}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium text-foreground">
                      {row.name}
                      {row.jersey ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          #{row.jersey}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums text-foreground">
                      {formatDmy(row.paidOn)}.
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-foreground">
                      {methodLabel(row.method)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.note ? (
                        <span className="block max-w-[18rem] truncate" title={row.note}>
                          {row.note}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <p
                        className={`whitespace-nowrap tabular-nums ${
                          row.reversed
                            ? "text-muted-foreground line-through"
                            : "font-semibold text-foreground"
                        }`}
                      >
                        {formatAmount(row.amount, row.currency)}
                      </p>
                      <div className="mt-0.5 flex justify-end">
                        {row.reversed ? (
                          <StatusBadge tone="neutral" label={labels.reverse.reversed} />
                        ) : (
                          reverseButton(
                            row,
                            "rounded text-[11px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-destructive hover:underline"
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <ul className="divide-y divide-border md:hidden">
            {rows.map((row) => (
              <li key={row.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-medium text-foreground">
                    {row.name}
                    {row.jersey ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        #{row.jersey}
                      </span>
                    ) : null}
                  </p>
                  <p
                    className={`shrink-0 whitespace-nowrap text-sm tabular-nums ${
                      row.reversed
                        ? "text-muted-foreground line-through"
                        : "font-semibold text-foreground"
                    }`}
                  >
                    {formatAmount(row.amount, row.currency)}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDmy(row.paidOn)}. · {methodLabel(row.method)}
                </p>
                {row.note && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{row.note}</p>
                )}
                <div className="mt-1">
                  {row.reversed ? (
                    <StatusBadge tone="neutral" label={labels.reverse.reversed} />
                  ) : (
                    reverseButton(
                      row,
                      "rounded text-[11px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-destructive hover:underline"
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
