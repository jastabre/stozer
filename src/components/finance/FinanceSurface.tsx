/**
 * Shared surface primitives for the Finansije module.
 *
 * All three tabs (Pregled / Isplate igrača / Isplate osoblja) render through
 * these, so the section reads as one module instead of three separate screens:
 *   - `FinancePanel`   → the standard titled surface (header + optional body)
 *   - `FinanceKpiRibbon` → the 4-up number row (numbers lead, labels support)
 *   - `FinanceStatRow` → one label/value line inside a panel
 *
 * The KPI ribbon deliberately reuses the home dashboard's stats-ribbon idiom
 * (one surface, hairline accent on top, divided cells) so a finance number
 * looks like the same product as a team count — not a borrowed admin template.
 */

import { cn } from "@/lib/utils";

export function FinancePanel({
  title,
  subtitle,
  right,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  /** Small right-aligned slot: a total, a badge, a link. */
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        className
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {right && (
          <div className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {right}
          </div>
        )}
      </header>
      <div className={cn("px-4 py-4 sm:px-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export interface FinanceKpi {
  key: string;
  label: string;
  value: string;
  /** Optional short qualifier under the number (e.g. "3 stavke"). */
  hint?: string;
  /** Accent the number when this figure needs the president's attention. */
  tone?: "default" | "positive" | "danger";
}

const KPI_TONE: Record<NonNullable<FinanceKpi["tone"]>, string> = {
  default: "text-foreground",
  positive: "text-success",
  danger: "text-danger",
};

/**
 * The 4-up KPI row. One continuous surface divided into cells — the money is
 * the only thing at display size, labels stay small and quiet. Cells stack 2×2
 * on phones and go 4-across from `sm` up.
 */
export function FinanceKpiRibbon({
  items,
  className,
}: {
  items: FinanceKpi[];
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        className
      )}
    >
      {/* The single place the club accent appears on this surface. */}
      <div className="h-0.5 w-full bg-primary" aria-hidden="true" />
      <dl className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
        {items.map((item) => (
          <div key={item.key} className="min-w-0 px-4 py-4 sm:px-5 sm:py-5">
            <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {item.label}
            </dt>
            <dd
              className={cn(
                "mt-1.5 text-lg font-semibold leading-tight tabular-nums tracking-tight sm:text-2xl",
                KPI_TONE[item.tone ?? "default"]
              )}
              title={item.value}
            >
              {item.value}
            </dd>
            {item.hint && (
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {item.hint}
              </p>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * One label/value line. `strong` marks the figure a reader should land on
 * (the total); `tone` tints only when the value itself carries meaning.
 */
export function FinanceStatRow({
  label,
  value,
  strong,
  tone,
  hint,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "default" | "positive" | "danger" | "muted";
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="min-w-0 text-sm text-muted-foreground">
        <span className="truncate">{label}</span>
        {hint && <span className="ml-1.5 text-xs">{hint}</span>}
      </dt>
      <dd
        className={cn(
          "shrink-0 whitespace-nowrap tabular-nums",
          strong
            ? "text-base font-semibold text-foreground"
            : "text-sm font-medium text-foreground",
          tone === "positive" && "text-success",
          tone === "danger" && "text-danger",
          tone === "muted" && "text-muted-foreground"
        )}
      >
        {value}
      </dd>
    </div>
  );
}