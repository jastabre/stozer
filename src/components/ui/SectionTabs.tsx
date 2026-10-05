import Link from "next/link";
import { cn } from "@/lib/utils";

export interface SectionTabItem {
  href: string;
  label: string;
}

/**
 * Shared tab component. Two variants:
 *  - "segmented" (default): pill container with the club primary accent on the
 *    active tab. Used by the equipment screens AND every section shell (player,
 *    staff, club) via ProfileTabs, so the top-level tabs look and behave
 *    identically everywhere.
 *  - "underline": an integrated tab bar that sits flush below a header, the
 *    active tab carrying a primary underline (team screen tabs).
 */
export function SectionTabs({
  items,
  activeHref,
  label,
  className,
  variant = "segmented",
}: {
  items: SectionTabItem[];
  activeHref: string;
  label: string;
  className?: string;
  variant?: "segmented" | "underline";
}) {
  if (variant === "underline") {
    return (
      <div
        role="tablist"
        aria-label={label}
        className={cn(
          "no-scrollbar flex flex-nowrap items-center gap-1 overflow-x-auto border-b border-border",
          className
        )}
      >
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              scroll={false}
              role="tab"
              aria-selected={active}
              className={cn(
                "flex h-9 shrink-0 items-center border-b-2 px-3 text-sm font-medium transition-colors",
                active
                  ? "-mb-px border-primary text-primary"
                  : "-mb-px border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "no-scrollbar flex flex-nowrap items-center gap-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1",
        className
      )}
    >
      {items.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            scroll={false}
            role="tab"
            aria-selected={active}
            className={cn(
              "flex h-8 shrink-0 items-center rounded-md px-3 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}