import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Mirrors the staff payouts layout: month heading + selector, the KPI ribbon,
 * then either the table or the designed empty state.
 */
export default function Loading() {
  return (
    <div className="space-y-4" data-testid="page-skeleton">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-72" />
        </div>
        <Skeleton className="h-10 w-full sm:w-44" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="h-0.5 w-full bg-primary" aria-hidden="true" />
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-4 sm:px-5 sm:py-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2.5 h-7 w-24" />
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="h-11 border-b border-border bg-muted/40" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-5 py-3.5 last:border-b-0"
          >
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-40" />
            <div className="ml-auto flex gap-8">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}