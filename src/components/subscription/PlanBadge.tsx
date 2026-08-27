interface PlanBadgeProps {
  planName: string;
  isTrial?: boolean;
  trialDaysLeft?: number;
}

export function PlanBadge({ planName, isTrial, trialDaysLeft }: PlanBadgeProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
      <span className="text-xs font-medium uppercase text-muted-foreground">
        {planName}
      </span>
      {isTrial && trialDaysLeft !== undefined && (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          Trial: {trialDaysLeft}d
        </span>
      )}
    </div>
  );
}
