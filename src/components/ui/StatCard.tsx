import { cn } from "@/lib/utils";

/**
 * Compact KPI block — strong sports-dashboard number, small label, discrete
 * icon. The number is where the eye lands. The club accent appears once per
 * card (a small icon tile); surfaces stay neutral and shadow stays quiet.
 */
export function StatCard({
  label,
  value,
  tone,
  icon,
  className,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "positive" | "warning" | "danger";
  icon?: React.ReactNode;
  className?: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "danger"
          ? "text-rose-600"
          : "text-foreground";
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        {icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary [&_svg]:h-4 [&_svg]:w-4">
            {icon}
          </span>
        )}
      </div>
      <p
        className={cn(
          "mt-2.5 truncate text-2xl font-semibold leading-none tabular-nums tracking-tight sm:text-[2rem]",
          toneClass
        )}
        title={String(value)}
      >
        {value}
      </p>
    </div>
  );
}