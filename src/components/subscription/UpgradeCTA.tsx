import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface UpgradeCTAProps {
  currentPlan?: string;
  href?: string;
}

export function UpgradeCTA({
  currentPlan = "FREE",
  href = "/settings/upgrade",
}: UpgradeCTAProps) {
  if (currentPlan !== "FREE") return null;

  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
    >
      <span>Nadogradi na Club</span>
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
