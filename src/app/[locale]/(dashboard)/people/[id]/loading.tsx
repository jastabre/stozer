import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Content-only skeleton for the staff-profile tab area. The shell (back link,
 * identity header, tabs) lives in `layout.tsx` and stays mounted during tab
 * navigation, so this only fills the region below the tabs.
 */
export default function StaffProfileLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-2.5 sm:px-5">
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-2.5 px-4 py-4 sm:px-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-40" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-2.5 sm:px-5">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="px-4 py-4 sm:px-5">
          <Skeleton className="h-9 w-56 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
