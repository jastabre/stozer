import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-4" data-testid="page-skeleton" aria-busy="true">
      <Skeleton className="h-8 w-56" />
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/40 px-3 py-2.5">
          <Skeleton className="h-3.5 w-full max-w-3xl" />
        </div>
        <div className="space-y-3 px-3 py-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="hidden h-3.5 w-28 sm:block" />
              <Skeleton className="hidden h-3.5 w-32 md:block" />
              <Skeleton className="ml-auto h-5 w-24 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
