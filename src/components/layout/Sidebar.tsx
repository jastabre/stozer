"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { NavItem as NavItemType } from "@/lib/rbac";
import { NavItem } from "./NavItem";
import { ClubBrandLink } from "./ClubBrandLink";
import { cn } from "@/lib/utils";

interface SidebarProps {
  variant: "desktop" | "mobile";
  navItems: NavItemType[];
  orgName: string;
  logoUrl?: string | null;
  closeLabel: string;
  open?: boolean;
  onClose?: () => void;
}

/**
 * Premium neutral sidebar. The club's primary accent appears only on the
 * active item. Operational sections sit at the top; utility items (Settings)
 * render in a separated bottom zone above the product footer.
 */
export function Sidebar({
  variant,
  navItems,
  orgName,
  logoUrl,
  closeLabel,
  open,
  onClose,
}: SidebarProps) {
  if (variant === "mobile") {
    return (
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-sidebar-border bg-sidebar-background transition-transform duration-200 md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!open}
      >
        <SidebarBody
          navItems={navItems}
          orgName={orgName}
          logoUrl={logoUrl}
          closeLabel={closeLabel}
          onClose={onClose}
        />
      </aside>
    );
  }

  return (
    <aside className="hidden w-[17rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar-background md:flex">
      <SidebarBody
        navItems={navItems}
        orgName={orgName}
        logoUrl={logoUrl}
        closeLabel={closeLabel}
      />
    </aside>
  );
}

function SidebarBody({
  navItems,
  orgName,
  logoUrl,
  closeLabel,
  onClose,
}: {
  navItems: NavItemType[];
  orgName: string;
  logoUrl?: string | null;
  closeLabel: string;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("navigation");
  const locale = pathname.startsWith("/en") ? "en" : "sr";

  const core = navItems.filter((item) => !item.bottom);
  const utility = navItems.filter((item) => item.bottom);

  return (
    <>
      {/* Brand block — club identity; the whole crest + name links home. Same
        * height + border as the main top header so their dividers are one line. */}
      <div className="flex h-[var(--shell-header-height)] shrink-0 items-center justify-between border-b border-border px-4">
        <ClubBrandLink
          href={`/${locale}`}
          onNavigate={onClose}
          ariaLabel={t("goHome")}
          orgName={orgName}
          logoUrl={logoUrl}
          size="md"
        />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label={closeLabel}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Operational navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {core.map((item) => (
          <NavItem
            key={item.href}
            label={item.label}
            href={item.href}
            icon={item.icon}
            onNavigate={onClose}
          />
        ))}
      </nav>

      {/* Utility navigation (Settings) */}
      {utility.length > 0 && (
        <nav className="shrink-0 space-y-0.5 border-t border-border px-3 py-2">
          {utility.map((item) => (
            <NavItem
              key={item.href}
              label={item.label}
              href={item.href}
              icon={item.icon}
              onNavigate={onClose}
            />
          ))}
        </nav>
      )}
    </>
  );
}