"use client";

import { formatNumber } from "@/lib/first-team";
import { cn } from "@/lib/utils";

/**
 * Money text input: one bordered field that shows the grouped amount
 * ("150.000") with the currency code as an IN-BORDER trailing suffix. The
 * digits are right-aligned and the suffix sits in normal flow right after
 * them, so the amount and the currency always read as one unit — the code can
 * never drift to the far edge of the field (or of a table row). When the field
 * is empty the suffix is hidden, so the placeholder stays a clean hint.
 * A hidden `name` input carries the plain digit-only value, so server actions
 * keep receiving the same integer they always did. The parent owns the raw
 * value (controlled), which keeps bulk payout sums responsive to every
 * keystroke.
 *
 * `className` sizes the wrapper; `inputClassName` is the escape hatch for
 * input-only styles like a taller field.
 */
export function MoneyInput({
  name,
  value,
  onValueChange,
  currency,
  disabled,
  placeholder,
  ariaLabel,
  required,
  className,
  inputClassName,
}: {
  name: string;
  /** Raw digits only (e.g. "150000"); "" means empty. */
  value: string;
  onValueChange: (value: string) => void;
  currency: string;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  required?: boolean;
  /** Applied to the wrapper (the bordered field itself). */
  className?: string;
  inputClassName?: string;
}) {
  const digits = value.replace(/\D/g, "");
  const display = digits ? formatNumber(Number(digits)) : "";

  return (
    <div
      className={cn(
        "relative flex items-center rounded-lg border border-border bg-background",
        "focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-ring",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={display}
        onChange={(event) => onValueChange(event.target.value.replace(/\D/g, ""))}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        required={required}
        className={cn(
          "h-9 w-full min-w-0 border-0 bg-transparent pl-2 pr-0.5 text-right text-sm tabular-nums text-foreground outline-none",
          "placeholder:text-left placeholder:text-muted-foreground disabled:cursor-not-allowed",
          inputClassName
        )}
      />
      {digits !== "" && (
        <span
          aria-hidden="true"
          className="pointer-events-none select-none pr-2.5 pl-1 text-[11px] font-medium text-muted-foreground"
        >
          {currency}
        </span>
      )}
      <input type="hidden" name={name} value={digits} disabled={disabled} />
    </div>
  );
}
