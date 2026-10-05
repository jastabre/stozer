"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem as NavItemType } from "@/lib/rbac";
import {
  Home,
  Shield,
  UsersRound,
  UserRound,
  Shirt,
  FileText,
  Building2,
  Settings,
  Coins,
  MoreHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  Shield,
  UsersRound,
  UserRound,
  Shirt,
  FileText,
  Building2,
  Settings,
  Coins,
  MoreHorizontal,
};

/**
 * Mobile bottom navigation.
 *
 * Pattern: the 4 most important sections live in the tab bar, everything else
 * goes behind a "More" sheet. 4+1 is the standard mobile navigation pattern —
 * it keeps thumb-reach navigation to a glanceable set without cramming every
 * section into the bar. When the role has exactly 4 sections (coach) the
 * More button is omitted.
 */
export function BottomNav({
  navItems,
  moreLabel,
}: {
  navItems: NavItemType[];
  moreLabel: string;
}) {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  const locale = pathname.startsWith("/en") ? "en" : "sr";

  const primaryNav = navItems.slice(0, 4);
  const moreNav = navItems.slice(4);

  const isActive = (item: NavItemType) => {
    const fullPath = `/${locale}${item.href}`;
    return item.href === ""
      ? pathname === fullPath
      : pathname === fullPath || pathname.startsWith(fullPath + "/");
  };

  const tabClass = (active: boolean) =>
    cn(
      "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
    );

  return (
    <>
      {/* More sheet */}
      {showMore && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMore(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-card px-4 pb-[env(safe-area-inset-bottom)] pt-2 shadow-raised">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{moreLabel}</h3>
              <button
                onClick={() => setShowMore(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1 pb-2">
              {moreNav.map((item) => {
                const Icon = iconMap[item.icon] || Home;
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={`/${locale}${item.href}`}
                    onClick={() => setShowMore(false)}
                    className={cn(
                      "flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Bottom tab bar: 4 primary tabs + More */}
      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-card/95 backdrop-blur px-1 pb-[env(safe-area-inset-bottom)] md:hidden",
          moreNav.length > 0 ? "justify-between" : "justify-around"
        )}
      >
        {primaryNav.map((item) => {
          const Icon = iconMap[item.icon] || Home;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={`/${locale}${item.href}`}
              className={tabClass(active)}
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <span
                  className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary"
                  aria-hidden="true"
                />
              )}
              <Icon className="h-5 w-5" />
              <span className={cn(active && "font-semibold")}>{item.label}</span>
            </Link>
          );
        })}
        {moreNav.length > 0 && (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className={cn(tabClass(false), "min-w-0 flex-1")}
            aria-haspopup="menu"
            aria-expanded={showMore}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>{moreLabel}</span>
          </button>
        )}
      </nav>
    </>
  );
}