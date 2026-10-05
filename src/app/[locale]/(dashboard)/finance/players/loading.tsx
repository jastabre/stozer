import { Skeleton } from "@/components/ui/Skeleton";

/** Mirrors the player payouts layout: KPI ribbon, note line, then month list. */
export default function Loading() {
  return (
    <div className="space-y-4" data-testid="page-skeleton">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="h-0.5 w-full bg-primary" aria-hidden="true" />
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-4 sm:px-5 sm:py-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2.5 h-7 w-28" />
            </div>
          ))}
        </div>
      </div>

      <Skeleton className="h-3.5 w-64" />

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-6 gap-4 border-b border-border bg-muted/50 px-5 py-2.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-3" />
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-5 py-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <div className="ml-auto flex gap-8">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}