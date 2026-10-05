"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { readTheme, setTheme, subscribeTheme } from "@/lib/theme";

function persistLocale(next: string) {
  document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * General preferences — interface language and app theme. Both controls share
 * one calm segmented style (muted track, raised selected segment) and reuse
 * the existing i18n (NEXT_LOCALE cookie + locale path) and theme token
 * systems. Nothing here introduces parallel state logic.
 */
export function SettingsGeneral({
  generalTitle,
  languageTitle,
  languageDescription,
  themeTitle,
  themeDescription,
  srLabel,
  enLabel,
  lightLabel,
  darkLabel,
}: {
  generalTitle: string;
  languageTitle: string;
  languageDescription: string;
  themeTitle: string;
  themeDescription: string;
  srLabel: string;
  enLabel: string;
  lightLabel: string;
  darkLabel: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = pathname.startsWith("/en") ? "en" : "sr";
  const dark = useSyncExternalStore(subscribeTheme, readTheme, () => false);

  function switchLocale(next: "sr" | "en") {
    if (next === locale) return;
    persistLocale(next);
    router.push(`/${next}${pathname.slice(3) || ""}`);
    router.refresh();
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {generalTitle}
        </h2>
      </header>
      <div className="divide-y divide-border">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{languageTitle}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{languageDescription}</p>
          </div>
          <div
            role="group"
            aria-label={languageTitle}
            className="flex items-center gap-1 self-start rounded-lg border border-border bg-muted/60 p-1 sm:self-auto"
          >
            <SegButton active={locale === "sr"} onClick={() => switchLocale("sr")}>
              {srLabel}
            </SegButton>
            <SegButton active={locale === "en"} onClick={() => switchLocale("en")}>
              {enLabel}
            </SegButton>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{themeTitle}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{themeDescription}</p>
          </div>
          <div
            role="group"
            aria-label={themeTitle}
            className="flex items-center gap-1 self-start rounded-lg border border-border bg-muted/60 p-1 sm:self-auto"
          >
            <SegButton active={!dark} onClick={() => setTheme(false)}>
              <Sun className="h-4 w-4" />
              {lightLabel}
            </SegButton>
            <SegButton active={dark} onClick={() => setTheme(true)}>
              <Moon className="h-4 w-4" />
              {darkLabel}
            </SegButton>
          </div>
        </div>
      </div>
    </section>
  );
}

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-9 items-center justify-center gap-2 rounded-md px-3.5 text-sm font-medium transition-colors",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}