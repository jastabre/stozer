import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Content-only skeleton for the player-profile tab area. The shell (back link,
 * player header, tabs) lives in `layout.tsx` and stays mounted during tab
 * navigation, so this only fills the region below the tabs — the profile never
 * blanks out or jumps while a tab's data loads.
 */
export default function PlayerProfileLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-16 rounded-xl" />
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-2.5 sm:px-5">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-2.5 px-4 py-4 sm:px-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-36" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-2.5 sm:px-5">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-2.5 px-4 py-4 sm:px-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
