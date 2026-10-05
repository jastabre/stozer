"use client";

import { useEffect, useState } from "react";

/**
 * Short count-up for dashboard KPIs. Runs 0 -> value once on mount (~500ms,
 * cubic ease-out). Falls back to the final value instantly when the user
 * prefers reduced motion, so the stat is always shown without animation.
 * Tabular figures keep the number from jittering while counting.
 */
export function CountUp({
  value,
  duration = 500,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const [reduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  return <span className={className}>{display}</span>;
}