import Link from "next/link";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  action?: React.ReactNode;
}

/**
 * Compact empty state — invites action without occupying the whole screen.
 * Pass `action` for a custom control (e.g. a dialog trigger); otherwise
 * `actionLabel` + `actionHref` render the default link.
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </span>
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
      {!action && actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}