import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { formatAmount, monthName, parsePeriod, type MonthStatus } from "@/lib/first-team";
import type { SeasonPaymentMonth } from "@/lib/first-team-data";
import { cn } from "@/lib/utils";

export interface SeasonMonthsLabels {
  columns: {
    month: string;
    players: string;
    expected: string;
    paid: string;
    remaining: string;
    status: string;
  };
  status: Record<MonthStatus, string>;
}

/** One overview row: the month rollup plus its prebuilt Igrači wording. */
export interface SeasonMonthRow extends SeasonPaymentMonth {
  /** Main cell line, e.g. "0/1 plaćeno" or "1 igrač". */
  playersMain: string;
  /** Secondary line, e.g. "1 nije plaćen" / "Sve izmireno" / "Buduća obaveza". */
  playersNote: string;
}

/**
 * Semantic color map for month statuses. Only the badge carries color —
 * amounts stay neutral. "Za isplatu" is neutral, "Buduće" is muted.
 */
const MONTH_TONE: Record<MonthStatus, StatusTone> = {
  paid: "green",
  partial: "yellow",
  late: "red",
  due: "neutral",
  future: "muted",
};

const EMPTY = "\u2014";

/**
 * Status is carried by the row's LEFT EDGE, not only by the badge: a settled
 * month reads quiet, an unpaid one draws the eye down the column. This is the
 * single strongest signal in the list and it costs no extra chrome.
 */
const MONTH_EDGE: Record<MonthStatus, string> = {
  paid: "bg-transparent",
  partial: "bg-warning",
  late: "bg-danger",
  due: "bg-primary/45",
  future: "bg-transparent",
};

/** Shared column template so the header and every row line up exactly. */
const GRID =
  "grid grid-cols-[minmax(0,1.15fr)_minmax(0,1.25fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.95fr)_1.25rem] items-center gap-x-4";

/**
 * Season overview: one row per obligation month (never a players × months
 * matrix), built as a scannable financial list rather than a plain table.
 *
 * Hierarchy: the month leads, money columns are right-aligned and tabular so
 * digits line up vertically, and the status is expressed twice — a thin
 * left-edge marker for scanning plus the badge for precision. Every row is one
 * link to the month detail with an explicit hover/focus treatment.
 *
 * Desktop is a table-like grid of links (the whole row is clickable in every
 * browser); mobile is a compact stacked list that keeps month, status and the
 * two money figures that matter most.
 */
export function SeasonMonthsOverview({
  months,
  hrefBase,
  currency,
  lng,
  labels,
}: {
  months: SeasonMonthRow[];
  hrefBase: string;
  currency: string;
  lng: "sr" | "en";
  labels: SeasonMonthsLabels;
}) {
  const monthNameOf = (period: string) => {
    const { year, month } = parsePeriod(period);
    return `${monthName(month, lng)} ${year}`;
  };

  return (
    <>
      {/* Desktop — a table-like grid where each row is a single link. */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <div
          className={cn(
            GRID,
            "border-b border-border bg-muted/50 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground"
          )}
        >
          <span>{labels.columns.month}</span>
          <span>{labels.columns.players}</span>
          <span className="text-right">{labels.columns.expected}</span>
          <span className="text-right">{labels.columns.paid}</span>
          <span className="text-right">{labels.columns.remaining}</span>
          <span className="text-center">{labels.columns.status}</span>
          <span />
        </div>
        <ul className="divide-y divide-border">
          {months.map((m) => (
            <li key={m.period} className="group relative">
              <span
                className={cn(
                  "absolute inset-y-0 left-0 w-[3px]",
                  MONTH_EDGE[m.status]
                )}
                aria-hidden="true"
              />
              <Link
                href={`${hrefBase}/${m.period}`}
                className={cn(
                  GRID,
                  "py-3 pl-6 pr-4 text-sm transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                )}
              >
                <span className="truncate font-medium text-foreground">
                  {monthNameOf(m.period)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-foreground">
                    {m.playersMain}
                  </span>
                  {m.playersNote && (
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {m.playersNote}
                    </span>
                  )}
                </span>
                <span className="whitespace-nowrap text-right tabular-nums text-foreground">
                  {formatAmount(m.expected, currency)}
                </span>
                <span className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                  {m.paid > 0 ? formatAmount(m.paid, currency) : EMPTY}
                </span>
                <span className="whitespace-nowrap text-right tabular-nums text-foreground">
                  {m.remaining > 0 ? formatAmount(m.remaining, currency) : EMPTY}
                </span>
                <span className="flex justify-center">
                  <StatusBadge
                    tone={MONTH_TONE[m.status]}
                    label={labels.status[m.status]}
                  />
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Mobile list — month + status lead, obligation and remaining follow. */}
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card md:hidden">
        {months.map((m) => (
          <li key={m.period} className="relative">
            <span
              className={cn("absolute inset-y-0 left-0 w-[3px]", MONTH_EDGE[m.status])}
              aria-hidden="true"
            />
            <Link
              href={`${hrefBase}/${m.period}`}
              className="block py-3 pl-5 pr-4 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-sm font-semibold text-foreground">
                  {monthNameOf(m.period)}
                </p>
                <StatusBadge tone={MONTH_TONE[m.status]} label={labels.status[m.status]} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {[m.playersMain, m.playersNote].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-1.5 flex items-baseline justify-between gap-3">
                <p className="text-xs tabular-nums text-muted-foreground">
                  {labels.columns.expected}{" "}
                  <span className="font-medium text-foreground">
                    {formatAmount(m.expected, currency)}
                  </span>
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {labels.columns.remaining}{" "}
                  <span className="font-medium text-foreground">
                    {m.remaining > 0 ? formatAmount(m.remaining, currency) : EMPTY}
                  </span>
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}