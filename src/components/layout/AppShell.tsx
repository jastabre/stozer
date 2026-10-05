"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import type { NavItem as NavItemType } from "@/lib/rbac";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { UserMenu } from "./UserMenu";
import { PageTransition } from "./PageTransition";
import { PageContainer } from "./PageContainer";

export interface AppShellProps {
  navItems: NavItemType[];
  orgName: string;
  logoUrl?: string | null;
  userEmail?: string | null;
  userInitials: string;
  logoutLabel: string;
  moreLabel: string;
  closeLabel: string;
  children: React.ReactNode;
}

/**
 * Application shell — one responsive layout for every dashboard screen.
 *
 *  - Desktop/tablet: neutral sidebar + a thin GLOBAL header carrying only the
 *    Stožer brand, truly centered (grid 1fr/auto/1fr, so side controls can
 *    never push it off center), plus the account menu on the right.
 *  - Mobile: the same centered brand header with a hamburger on the left and
 *    the bottom navigation for thumb reach.
 *
 * The current section/page title belongs to the page content (PageHeader /
 * TeamHeader), never to the global header — "STOŽER + Igrači" side by side is
 * intentionally not rendered here anymore.
 *
 * Language and theme preferences live on the Settings page, not the shell.
 */
export function AppShell({
  navItems,
  orgName,
  logoUrl,
  userEmail,
  userInitials,
  logoutLabel,
  moreLabel,
  closeLabel,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const t = useTranslations("navigation");
  const tc = useTranslations("common");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const locale = pathname.startsWith("/en") ? "en" : "sr";

  return (
    <>
      <Sidebar
        variant="desktop"
        navItems={navItems}
        orgName={orgName}
        logoUrl={logoUrl}
        closeLabel={closeLabel}
      />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden animate-fade"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar
        variant="mobile"
        navItems={navItems}
        orgName={orgName}
        logoUrl={logoUrl}
        closeLabel={closeLabel}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Global product header — ONLY the brand, centered in the viewport.
            No section title, no club name: titles live in the page content. */}
        <header className="sticky top-0 z-30 grid h-[var(--shell-header-height)] shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center justify-start">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring md:hidden"
              aria-label={moreLabel}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <Link
            href={`/${locale}`}
            aria-label={t("goHome")}
            className="flex items-center gap-2 rounded-md px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {/* Placeholder wordmark, ready for a future real STOŽER logo. */}
            <span
              aria-hidden="true"
              className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-muted/60 text-[11px] font-bold text-muted-foreground"
            >
              S
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {tc("appName")}
            </span>
          </Link>

          <div className="flex items-center justify-end">
            <UserMenu
              email={userEmail}
              initials={userInitials}
              logoutLabel={logoutLabel}
            />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <PageContainer>
            <PageTransition>{children}</PageTransition>
          </PageContainer>
        </main>
      </div>

      <BottomNav navItems={navItems} moreLabel={moreLabel} />
    </>
  );
}