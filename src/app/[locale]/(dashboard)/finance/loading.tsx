import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Mirrors the Overview layout: 4-up KPI ribbon, two panels side by side, then
 * the attention panel. Keeping the skeleton shaped like the real screen stops
 * the layout from jumping when the data lands.
 */
export default function Loading() {
  return (
    <div className="space-y-4" data-testid="page-skeleton">
      {/* KPI ribbon */}
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

      <Skeleton className="h-4 w-52" />

      {/* Two panels */}
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3 sm:px-5">
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="space-y-3 px-4 py-4 sm:px-5">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          </div>
        ))}
      </div>

      {/* Attention panel */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-1.5 h-3 w-56" />
        </div>
        <div className="px-4 py-4 sm:px-5">
          <Skeleton className="h-5 w-3/4" />
        </div>
      </div>
    </div>
  );
}