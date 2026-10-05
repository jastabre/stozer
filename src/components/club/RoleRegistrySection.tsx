"use client";

import { useState } from "react";
import { RoleSummaryCard } from "@/components/club/RoleSummaryCard";
import { cn } from "@/lib/utils";
import type { RoleMetadataView } from "@/lib/staff-profile";

/**
 * Read-only "Uloge i dozvole" section: a compact selector shows one predefined
 * role at a time in a single detail panel. Every phrase comes from
 * loadRoleMetadata(), which is derived from the backend role_permissions table
 * — roles are explained here, never edited, and no drawer or overlay exists.
 */
export function RoleRegistrySection({
  roles,
  labels,
}: {
  roles: RoleMetadataView[];
  labels: {
    title: string;
    description: string;
    selectorLabel: string;
    scope: string;
    canTitle: string;
    deniedTitle: string;
    detailsToggle: string;
    noAccess: string;
  };
}) {
  const [activeKey, setActiveKey] = useState(roles[0]?.key ?? "");
  const active = roles.find((role) => role.key === activeKey) ?? roles[0];
  if (!active) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-foreground">{labels.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{labels.description}</p>

      <div
        role="tablist"
        aria-label={labels.selectorLabel}
        className="no-scrollbar mt-4 flex flex-nowrap items-center gap-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1"
      >
        {roles.map((role) => {
          const selected = role.key === active.key;
          return (
            <button
              key={role.key}
              type="button"
              role="tab"
              id={`role-tab-${role.key}`}
              aria-selected={selected}
              aria-controls="role-registry-panel"
              onClick={() => setActiveKey(role.key)}
              className={cn(
                "flex h-8 shrink-0 items-center rounded-md px-3 text-sm font-medium transition-colors",
                selected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background hover:text-foreground"
              )}
            >
              {role.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="role-registry-panel"
        aria-labelledby={`role-tab-${active.key}`}
        className="mt-4 border-t border-border pt-4"
      >
        <RoleSummaryCard
          role={active}
          labels={{
            scope: labels.scope,
            canTitle: labels.canTitle,
            deniedTitle: labels.deniedTitle,
            detailsToggle: labels.detailsToggle,
            noAccess: labels.noAccess,
          }}
        />
      </div>
    </section>
  );
}
