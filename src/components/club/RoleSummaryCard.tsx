"use client";

import { ChevronDown } from "lucide-react";
import {
  CapabilityCheckList,
  CapabilityDeniedList,
  CapabilityDetails,
} from "@/components/club/CapabilityList";
import { cn } from "@/lib/utils";
import type { RoleMetadataView } from "@/lib/staff-profile";

/**
 * One role at a glance: a short "can" list and a short "no access" list, with
 * the real grouped capabilities behind the secondary "Prikaži detaljne
 * dozvole" disclosure. Plain sections — the main flow must never turn into a
 * permission dump or a stack of cards.
 */
export function RoleSummaryCard({
  role,
  labels,
  showDescription = true,
  showDenied = true,
  showDetails = true,
  className,
}: {
  role: RoleMetadataView;
  labels: {
    scope: string;
    canTitle: string;
    deniedTitle: string;
    detailsToggle: string;
    noAccess: string;
  };
  showDescription?: boolean;
  showDenied?: boolean;
  showDetails?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-5", className)}>
      {showDescription && (
        <div>
          <p className="text-sm font-medium text-foreground">{role.label}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {role.description}
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {labels.scope}:{" "}
        <span className="font-medium text-foreground">{role.scopeLabel}</span>
      </p>

      <CapabilityCheckList title={labels.canTitle} items={role.summary} />

      {showDenied && (
        <CapabilityDeniedList
          title={labels.deniedTitle}
          items={role.denied}
          limit={5}
        />
      )}

      {showDetails && role.details.length > 0 && (
        <details className="group border-t border-border pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-primary [&::-webkit-details-marker]:hidden">
            {labels.detailsToggle}
            <ChevronDown
              className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <CapabilityDetails
            className="mt-2"
            groups={role.details}
            noAccessLabel={labels.noAccess}
          />
        </details>
      )}
    </div>
  );
}
