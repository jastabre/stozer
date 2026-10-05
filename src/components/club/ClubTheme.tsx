"use client";

import { useEffect } from "react";

/**
 * Applies the active club's single accent color as CSS custom properties on
 * <html>: --primary / --primary-foreground / --ring (focus states).
 *
 * Contrast is maintained by choosing black or white foreground based on the
 * luminance of the chosen color (simple WCAG AA approximation). Neutral UI
 * surfaces stay neutral; only the accent is personalized.
 */
export function ClubTheme({ primary }: { primary?: string | null }) {
  useEffect(() => {
    const root = document.documentElement;
    if (primary && /^#[0-9a-f]{6}$/i.test(primary)) {
      root.style.setProperty("--primary", primary);
      root.style.setProperty("--ring", primary);
      root.style.setProperty("--primary-foreground", pickForeground(primary));
    } else {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--primary-foreground");
    }
  }, [primary]);

  return null;
}

/** Black or white foreground for acceptable contrast on a hex background. */
function pickForeground(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0f172a" : "#ffffff";
}