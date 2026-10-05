import Link from "next/link";
import { Wallet } from "lucide-react";

/**
 * Empty state for Finansije → Isplate osoblja.
 *
 * "No obligations this month" is a VALID state, not a broken screen, so it is
 * written as a designed panel that says what the section is for and what to do
 * next — never as a bare sentence or a blank card. The primary mass sits in a
 * muted roundel so the page keeps the same visual weight as the populated one.
 *
 * The message adapts honestly to the real cause:
 *   - obligations exist in other months → "pick another month"
 *   - no compensation is defined at all → "define it on a staff profile"
 * and the action only renders for a user who may actually manage finance.
 */
export function StaffEmptyState({
  canManage,
  labels,
  locale,
}: {
  canManage: boolean;
  labels: {
    title: string;
    description: string;
    hint: string;
    action?: string;
  };
  locale: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col items-center px-6 py-10 text-center sm:py-12">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted"
          aria-hidden="true"
        >
          <Wallet className="h-5 w-5 text-muted-foreground" />
        </span>

        <h2 className="mt-4 text-base font-semibold text-foreground">
          {labels.title}
        </h2>
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
          {labels.description}
        </p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {labels.hint}
        </p>

        {canManage && labels.action && (
          <Link
            href={`/${locale}/people`}
            className="mt-5 inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {labels.action}
          </Link>
        )}
      </div>
    </section>
  );
}