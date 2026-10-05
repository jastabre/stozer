/**
 * Lightweight skeleton primitive for route transitions and async data areas.
 * Renders an animated neutral block sized by className. No third-party lib.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-muted ${className ?? ""}`}
    />
  );
}