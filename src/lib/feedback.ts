/**
 * Central guard for user-facing feedback messages.
 *
 * Server actions sometimes surface database or infrastructure text (Postgres
 * constraint names, PostgREST codes, storage errors). Those must never reach a
 * toast or an inline alert. `safeFeedbackMessage` keeps the short, human part
 * of a message when it is clearly not a raw backend error, trims the raw tail
 * of prefixed messages ("Greška pri čuvanju: duplicate key ..."), and falls
 * back to a localized generic message otherwise.
 */

const RAW_ERROR_MARKERS: RegExp[] = [
  /duplicate key/i,
  /violates/i,
  /constraint/i,
  /permission denied/i,
  /row-level security/i,
  /pgrst/i,
  /sqlstate/i,
  /invalid input syntax/i,
  /invalid input value/i,
  /null value in column/i,
  /foreign key/i,
  /does not exist/i,
  /syntax error/i,
  /relation "/i,
  /column "/i,
  /new row for relation/i,
  /fetch failed/i,
  /econnrefused/i,
  /etimedout/i,
  /networkerror/i,
  /stack trace/i,
  /\n\s+at\s/,
  /specific message is omitted/i,
  /server components render/i,
  /digest/i,
];

export function isRawBackendError(message: string): boolean {
  return RAW_ERROR_MARKERS.some((marker) => marker.test(message));
}

export function safeFeedbackMessage(
  message: unknown,
  fallback: string
): string {
  if (typeof message !== "string") return fallback;
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 160) return fallback;
  if (!isRawBackendError(trimmed)) return trimmed;

  // "Greška pri čuvanju igrača: duplicate key ..." keeps the human prefix.
  const prefix = trimmed.split(":")[0]?.trim() ?? "";
  if (prefix.length >= 8 && prefix.length < trimmed.length && !isRawBackendError(prefix)) {
    return `${prefix}.`;
  }
  return fallback;
}
