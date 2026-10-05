import Link from "next/link";
import { cn } from "@/lib/utils";

export interface TeamFilterOption {
  id: string;
  name: string;
}

/**
 * Compact team selector for the players list and the equipment views. Renders
 * as a segmented control (same design language as tabs) that navigates
 * immediately on click — no "Primeni" button. `allLabel`/`allHref` add an
 * "all" option (players list); when omitted the control always has a concrete
 * team selected (equipment).
 *
 * `tone="soft"` gives the active item a quieter primary tint instead of the
 * filled accent, so a content FILTER never reads as the main navigation.
 * `label` renders a small caption above the control (e.g. "Tim").
 */
export function TeamFilter({
  teams,
  selectedTeamId,
  allLabel,
  allHref,
  teamHref,
  ariaLabel,
  label,
  tone = "primary",
  className,
}: {
  teams: TeamFilterOption[];
  selectedTeamId: string | null;
  allLabel?: string;
  allHref?: string;
  teamHref: (teamId: string) => string;
  ariaLabel: string;
  /** Optional small caption above the control. */
  label?: string;
  /** "primary" (default, main navigation look) or "soft" (filter look). */
  tone?: "primary" | "soft";
  className?: string;
}) {
  const itemClass = (active: boolean) =>
    cn(
      "flex h-8 shrink-0 items-center rounded-md px-3 text-sm font-medium transition-colors",
      tone === "soft"
        ? active
          ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/30"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
        : active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
    );

  return (
    <div className={cn(label ? "space-y-1.5" : undefined, className)}>
      {label && (
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      )}
      <div
        role="group"
        aria-label={ariaLabel}
        className="flex flex-nowrap items-center gap-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1"
      >
        {allLabel && allHref && (
          <Link
            href={allHref}
            scroll={false}
            className={itemClass(selectedTeamId === null)}
            aria-current={selectedTeamId === null ? "page" : undefined}
          >
            {allLabel}
          </Link>
        )}
        {teams.map((team) => (
          <Link
            key={team.id}
            href={teamHref(team.id)}
            scroll={false}
            className={itemClass(selectedTeamId === team.id)}
            aria-current={selectedTeamId === team.id ? "page" : undefined}
          >
            {team.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
