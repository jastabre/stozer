"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Club identity link — the crest + club name that returns the user to the
 * dashboard home. Shared by the desktop sidebar, the mobile drawer and the
 * mobile top bar so the micro-interaction and focus behaviour live in one place.
 *
 * The interaction is deliberately quiet: on hover the crest lifts by a hair of
 * scale and the name settles to full opacity — enough to say "this is an
 * interactive brand link" without drawing attention to itself.
 *
 * Motion + accessibility notes:
 *  - The crest transform is gated behind `motion-safe:`, so under
 *    `prefers-reduced-motion` the crest never scales (no size change at all).
 *    A clear, motionless hover state remains via the name opacity.
 *  - `hover:`/`group-hover:` utilities compile inside `@media (hover: hover)`
 *    in Tailwind v4, so touch devices never get a stuck hover state.
 *  - Keyboard focus relies on the shared `:focus-visible` outline ring; the
 *    hover effect is never the only affordance.
 */
export function ClubBrandLink({
  href,
  orgName,
  logoUrl,
  ariaLabel,
  size = "md",
  onNavigate,
  className,
}: {
  href: string;
  orgName: string;
  logoUrl?: string | null;
  ariaLabel: string;
  size?: "md" | "sm";
  onNavigate?: () => void;
  className?: string;
}) {
  const md = size === "md";

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label={ariaLabel}
      className={cn(
        "group flex min-w-0 items-center rounded-md",
        md ? "gap-3.5" : "gap-2.5",
        className
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out group-hover:motion-safe:scale-[1.03]",
          md ? "h-[3.75rem] w-[3.75rem]" : "h-9 w-9"
        )}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          <span
            className={cn(
              "font-bold leading-none",
              md
                ? "text-[1.75rem] text-sidebar-accent-foreground"
                : "text-lg text-primary"
            )}
          >
            {orgName.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      <span
        className={cn(
          "min-w-0 truncate opacity-90 transition-opacity duration-200 ease-out group-hover:opacity-100",
          md
            ? "text-lg font-semibold leading-tight tracking-tight text-sidebar-accent-foreground"
            : "text-[15px] font-semibold tracking-tight text-foreground"
        )}
      >
        {orgName}
      </span>
    </Link>
  );
}
