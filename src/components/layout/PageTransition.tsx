"use client";

import { usePathname } from "next/navigation";

/**
 * Applies a fast, subtle entrance animation whenever the active route changes
 * (keyed by pathname). Respects prefers-reduced-motion via the CSS media query.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-page">
      {children}
    </div>
  );
}