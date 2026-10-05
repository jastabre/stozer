import { Check, Minus } from "lucide-react";

/**
 * Compact, localized capability rows. Purely presentational: every phrase is
 * derived from the backend role metadata (loadRoleMetadata), never hardcoded.
 */

export function CapabilityCheckList({
  title,
  items,
  className,
}: {
  title: string;
  items: string[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={className}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </p>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-foreground">
            <Check
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success"
              aria-hidden="true"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CapabilityDeniedList({
  title,
  items,
  limit,
  className,
}: {
  title: string;
  items: string[];
  limit?: number;
  className?: string;
}) {
  const visible = limit ? items.slice(0, limit) : items;
  if (visible.length === 0) return null;
  return (
    <div className={className}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </p>
      <ul className="mt-1.5 space-y-1">
        {visible.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-sm text-muted-foreground"
          >
            <Minus
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
              aria-hidden="true"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface CapabilityDetailGroup {
  key: string;
  label: string;
  items: { area: string; actions: string[]; denied: boolean }[];
}

/** Grouped real capabilities for the expandable details section. */
export function CapabilityDetails({
  groups,
  noAccessLabel,
  className,
}: {
  groups: CapabilityDetailGroup[];
  noAccessLabel: string;
  className?: string;
}) {
  if (groups.length === 0) return null;
  return (
    <div className={className}>
      {groups.map((group) => (
        <section key={group.key} className="pt-3 first:pt-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {group.label}
          </p>
          <dl className="mt-1.5 space-y-0.5">
            {group.items.map((item) => (
              <div
                key={item.area}
                className="flex items-baseline justify-between gap-4 py-0.5 text-sm"
              >
                <dt className="text-muted-foreground">{item.area}</dt>
                <dd
                  className={
                    item.denied
                      ? "text-muted-foreground/70"
                      : "text-right font-medium text-foreground"
                  }
                >
                  {item.denied ? noAccessLabel : item.actions.join(" · ")}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
