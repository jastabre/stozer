import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { SectionTabs, type SectionTabItem } from "@/components/ui/SectionTabs";

/**
 * Shared team-screen header. The team name is dominant; a single metadata line
 * carries category · season · roster size, and the tabs (Igrači / Isplate) sit
 * flush below. Used by both the players and payments tabs so the hierarchy is
 * identical across the team.
 */
export function TeamHeader({
  backHref,
  backLabel,
  title,
  meta,
  description,
  action,
  tabs,
  activeHref,
  tabsLabel,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  meta: ReactNode;
  description: string;
  action?: ReactNode;
  tabs?: SectionTabItem[];
  activeHref?: string;
  tabsLabel?: string;
}) {
  return (
    <div className="space-y-4">
      <Link
        href={backHref}
        className="inline-flex h-8 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {backLabel}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{meta}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>

      {tabs && tabs.length > 0 && (
        <SectionTabs
          variant="underline"
          items={tabs}
          activeHref={activeHref ?? tabs[0].href}
          label={tabsLabel ?? title}
        />
      )}
    </div>
  );
}
