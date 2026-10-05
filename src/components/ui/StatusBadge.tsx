import { cn } from "@/lib/utils";

export type StatusTone = "green" | "yellow" | "red" | "neutral" | "blue" | "muted";

const TONE_CLASSES: Record<StatusTone, string> = {
  green: "bg-success-bg text-success",
  yellow: "bg-warning-bg text-warning",
  red: "bg-danger-bg text-danger",
  neutral: "bg-neutral-bg text-neutral",
  blue: "bg-info-bg text-info",
  muted: "bg-muted text-muted-foreground",
};

const DOT_CLASSES: Record<StatusTone, string> = {
  green: "bg-success",
  yellow: "bg-warning",
  red: "bg-danger",
  neutral: "bg-neutral",
  blue: "bg-info",
  muted: "bg-muted-foreground/60",
};

/** Same status tone as text color — for amounts tinted like their badge. */
const TEXT_TONE_CLASSES: Record<StatusTone, string> = {
  green: "text-success",
  yellow: "text-warning",
  red: "text-danger",
  neutral: "text-foreground",
  blue: "text-info",
  muted: "text-muted-foreground",
};

/**
 * Shared status chip. Never color-only: a small leading dot plus text keeps the
 * state readable for everyone, including with reduced/greyscale rendering.
 * Uses semantic status tokens (success/warning/danger/info/neutral) that adapt
 * to light and dark themes — independent of the club accent.
 */
export function StatusBadge({
  tone,
  children,
  label,
  dot = true,
  className,
}: {
  tone: StatusTone;
  children?: React.ReactNode;
  label?: string;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-transparent px-2 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className
      )}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASSES[tone])}
          aria-hidden="true"
        />
      )}
      {label ?? children}
    </span>
  );
}

export { TONE_CLASSES, TEXT_TONE_CLASSES };