"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays } from "lucide-react";
import { formatDmy, parseDmy } from "@/lib/date-format";
import { cn } from "@/lib/utils";

const COMPLETE = /^\d{1,2}\.\d{1,2}\.\d{4}$/;

/**
 * The single, app-wide date input for STOŽER.
 *
 * One visible field: an editable DD.MM.GGGG text box with a calendar button on
 * its right edge. The button opens the browser's native date picker through a
 * visually-hidden `<input type="date">` (via `showPicker()`, click fallback), so
 * typing and picking share one field. ISO `YYYY-MM-DD` is the one source of
 * truth: it feeds the picker, and in uncontrolled mode is submitted through a
 * hidden `name` input so existing server actions are unchanged.
 *
 * Validation is intentionally non-aggressive while typing — an error only shows
 * once the text is a complete DD.MM.GGGG that is not a real calendar day (or is
 * outside min/max), so deletion and in-progress editing stay friction-free.
 * Date math uses UTC to avoid timezone day-shifts.
 */
export function DateField({
  name,
  defaultValue,
  value,
  onChange,
  ariaLabel,
  required,
  disabled,
  min,
  max,
  error,
  className,
}: {
  name?: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (iso: string) => void;
  ariaLabel?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  error?: string | null;
  className?: string;
}) {
  const t = useTranslations("common");
  const errorId = useId();
  const controlled = value !== undefined;
  const initialIso = controlled ? value ?? "" : defaultValue ?? "";

  const [iso, setIso] = useState(initialIso);
  const [text, setText] = useState(() => formatDmy(initialIso));
  const [invalid, setInvalid] = useState(false);
  const nativeRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const lastEmitted = useRef(initialIso);

  // In controlled mode, adopt external value changes (but never clobber a
  // half-typed buffer that we ourselves just emitted).
  useEffect(() => {
    if (!controlled) return;
    const next = value ?? "";
    if (next !== lastEmitted.current) {
      lastEmitted.current = next;
      setIso(next);
      setText(formatDmy(next));
      setInvalid(false);
    }
  }, [controlled, value]);

  function inBounds(nextIso: string): boolean {
    if (!nextIso) return true;
    if (min && nextIso < min) return false;
    if (max && nextIso > max) return false;
    return true;
  }

  function setFromText(raw: string) {
    setText(raw);
    const trimmed = raw.trim();
    if (trimmed === "") {
      setIso("");
      setInvalid(false);
      lastEmitted.current = "";
      onChange?.("");
      return;
    }
    const parsed = parseDmy(trimmed);
    if (parsed && inBounds(parsed)) {
      setIso(parsed);
      setInvalid(false);
      lastEmitted.current = parsed;
      onChange?.(parsed);
      return;
    }
    // Reached when the text is unparseable or out of range. Only flag an error
    // once the shape is complete (a real impossible date, or beyond min/max), so
    // in-progress typing stays quiet.
    setIso("");
    setInvalid(COMPLETE.test(trimmed));
    lastEmitted.current = "";
    onChange?.("");
  }

  function setFromPicker(nextIso: string) {
    const accepted = inBounds(nextIso) ? nextIso : "";
    setIso(nextIso);
    setText(nextIso ? formatDmy(nextIso) : "");
    setInvalid(nextIso !== "" && !inBounds(nextIso));
    lastEmitted.current = accepted;
    onChange?.(accepted);
  }

  function openPicker() {
    const el = nativeRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  }

  const shownError = error ?? (invalid ? t("invalidDate") : null);

  useEffect(() => {
    if (textRef.current) {
      textRef.current.setCustomValidity(shownError ?? "");
    }
  }, [shownError]);

  return (
    <div className={className}>
      <div className="relative flex items-stretch">
        <input
          ref={textRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD.MM.GGGG"
          value={text}
          onChange={(e) => setFromText(e.target.value)}
          required={required}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? errorId : undefined}
          aria-required={required || undefined}
          className={cn(
            "h-10 w-full rounded-lg border bg-background pl-3 pr-11 text-sm text-foreground",
            "placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1",
            "focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60",
            shownError ? "border-danger" : "border-border"
          )}
        />
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          aria-label={ariaLabel ? `${ariaLabel} — ${t("openCalendar")}` : t("openCalendar")}
          className={cn(
            "absolute right-0 top-0 flex h-full w-11 items-center justify-center rounded-r-lg",
            "text-muted-foreground transition-colors hover:text-foreground",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
            "disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Native picker driver behind the button — visually hidden but real and
          * openable; carries no `name`, so the hidden ISO input is the source. */}
        <input
          ref={nativeRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={iso}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(e) => setFromPicker(e.target.value)}
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-0"
        />

        {!controlled && name && (
          <input type="hidden" name={name} value={invalid ? "" : iso} />
        )}
      </div>

      {shownError && (
        <p id={errorId} className="mt-1 text-xs text-destructive">
          {shownError}
        </p>
      )}
    </div>
  );
}
