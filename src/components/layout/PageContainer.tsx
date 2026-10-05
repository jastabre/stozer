import { cn } from "@/lib/utils";

/**
 * The single source of truth for page content width and gutters.
 *
 * Every dashboard route renders inside this via AppShell, so headings, action
 * buttons, filters/tabs, tables, cards and forms all share one left/right
 * alignment and one outer width across Početna, Igrači, Timovi, Osoblje,
 * Oprema, Dokumenti, Klub and Podešavanja.
 *
 * Width strategy:
 *  - Fluid 100% width that fills smaller monitors (nothing is artificially
 *    squeezed when there is little room).
 *  - A single `max-w-7xl` (1280px) cap keeps content controlled and centered
 *    on large/ultra-wide monitors instead of stretching edge to edge.
 *  - Horizontal gutters tighten on mobile and widen on larger screens.
 */
export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8",
        className
      )}
    >
      {children}
    </div>
  );
}
