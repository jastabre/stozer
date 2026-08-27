"use client";

import { Lock } from "lucide-react";
import Link from "next/link";

interface LockedFeatureProps {
  featureName: string;
  description: string;
  upgradeHref?: string;
}

export function LockedFeature({
  featureName,
  description,
  upgradeHref = "/settings/upgrade",
}: LockedFeatureProps) {
  return (
    <div className="relative rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium">{featureName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <Link
            href={upgradeHref}
            className="mt-3 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Nadogradi
          </Link>
        </div>
      </div>
    </div>
  );
}
