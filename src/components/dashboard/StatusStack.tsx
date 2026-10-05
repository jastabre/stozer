"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface StatusSegmentData {
  tone: "green" | "yellow" | "red" | "neutral";
  label: string;
  count: number;
}

const SEG_TONE: Record<StatusSegmentData["tone"], string> = {
  green: "bg-success",
  yellow: "bg-warning",
  red: "bg-danger",
  neutral: "bg-neutral",
};

/**
 * Animated stacked status bar. Segments grow 0 -> width once on mount with a
 * short stagger so the panel reads as a data visualization, not a static bar.
 * With `prefers-reduced-motion` the final state renders immediately.
 */
export function StatusStack({
  label,
  total,
  segments,
  emptyLabel,
}: {
  label: string;
  total: number;
  segments: StatusSegmentData[];
  emptyLabel: string;
}) {
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

  const dur = reduced ? "0ms" : "700ms";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <p className="text-xs font-medium tabular-nums text-muted-foreground">{total}</p>
      </div>
      {total === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <>
          <div className="mt-2 flex h-3 w-full gap-0.5 overflow-hidden rounded-md bg-muted/60 p-0.5">
            {segments.map((segment, index) => (
              <span
                key={`${segment.tone}-${segment.label}`}
                className={cn(
                  "h-full rounded-[3px]",
                  SEG_TONE[segment.tone],
                  segment.count === 0 && "opacity-30"
                )}
                style={{
                  width: ready ? `${(segment.count / total) * 100}%` : "0%",
                  transitionProperty: "width",
                  transitionDuration: dur,
                  transitionDelay: reduced ? "0ms" : `${index * 90}ms`,
                  transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            ))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {segments.map((segment) => (
              <li
                key={`${segment.tone}-${segment.label}`}
                className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  className={cn("h-1.5 w-1.5 shrink-0 rounded-full", SEG_TONE[segment.tone])}
                  aria-hidden="true"
                />
                <span className="min-w-0 truncate" title={segment.label}>
                  {segment.label}
                </span>
                <span className="ml-auto shrink-0 font-medium tabular-nums text-foreground">
                  {segment.count}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}