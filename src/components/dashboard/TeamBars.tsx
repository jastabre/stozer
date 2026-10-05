"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface TeamBar {
  id: string;
  name: string;
  count: number;
}

/**
 * Real horizontal bar chart of player counts per team.
 *
 * - Bar length is a true ratio of `count / maxCount`, so 1v1 renders as two
 *   equal bars and 25v10 renders as 100% vs ~40%.
 * - The chart area has a fixed comfortable width; it never stretches across
 *   the whole page.
 * - Bars grow from 0 to their final width once on mount (CSS width transition).
 *   With `prefers-reduced-motion` the final state renders immediately.
 */
export function TeamBars({ teams, locale }: { teams: TeamBar[]; locale: string }) {
  const max = useMemo(
    () => Math.max(1, ...teams.map((team) => team.count)),
    [teams]
  );
  const [reduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [ready, setReady] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setReady(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const dur = reduced ? "0ms" : "650ms";

  return (
    <div className="space-y-3.5">
      {teams.map((team, index) => {
        const pct = Math.round((team.count / max) * 100);
        return (
          <div key={team.id} className="animate-rise" style={{ animationDelay: `${index * 50}ms` }}>
            <Link
              href={`/${locale}/teams/${team.id}/registrations`}
              className="group flex items-center gap-3 sm:gap-4"
            >
              <span className="w-24 shrink-0 truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary sm:w-40">
                {team.name}
              </span>
              <span
                className="flex h-3 min-w-0 flex-1 items-center overflow-hidden rounded-full bg-muted/60"
                role="img"
                aria-label={`${team.name}: ${team.count}`}
              >
                <span
                  className="h-full rounded-full bg-primary/90 transition-[width] group-hover:bg-primary"
                  style={{
                    width: ready ? `${pct}%` : "0%",
                    transitionDuration: dur,
                    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                />
              </span>
              <span className="w-9 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                {team.count}
              </span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}