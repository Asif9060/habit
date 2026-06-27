// Timezone-aware "YYYY-MM-DD" helpers.
//
// We store the day key as a string (not a Date) so day comparisons are
// trivial lexicographic ops after we materialize "today" in the user's tz.
//
// The Intl-based formatter is used here because:
//   - it's built into Node 20+ and the Edge runtime
//   - it correctly handles IANA tz names without shipping a tz database
//
// Edge case: server-side rendering on Vercel uses UTC for "now" by default.
// That's fine — we always pass an explicit `now` from the caller, which is
// `new Date()` evaluated at request time.

export type DayKey = string; // "YYYY-MM-DD"

const pad = (n: number): string => n.toString().padStart(2, "0");

/**
 * Format a Date as YYYY-MM-DD in the given IANA timezone.
 *
 * Uses `Intl.DateTimeFormat` with the `en-CA` locale, which renders dates as
 * "YYYY-MM-DD" by default — cheaper than calling formatToParts.
 */
export function dayKeyFor(now: Date, timezone: string): DayKey {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;

    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // fall through to UTC below
  }
  // Invalid timezone — fall back to UTC so we never throw on hot paths.
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
}

/**
 * Returns the day key for "yesterday" relative to `todayKey`, in the same tz.
 * Pure math: avoids a second Intl round-trip.
 */
export function previousDayKey(todayKey: DayKey): DayKey {
  const [y, m, d] = todayKey.split("-").map(Number);
  // Construct a UTC date at noon (midday avoids DST edge artifacts), subtract 1.
  const utc = Date.UTC(y, m - 1, d, 12) - 24 * 60 * 60 * 1000;
  const dt = new Date(utc);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/**
 * Returns true if `candidateKey` is exactly yesterday (in the user's tz) relative to `todayKey`.
 */
export function isYesterday(candidateKey: DayKey, todayKey: DayKey): boolean {
  return previousDayKey(todayKey) === candidateKey;
}

/**
 * Detects the user's IANA timezone from a Date observed in a given tz.
 * Falls back to UTC if detection fails (very rare — only with malformed tz).
 */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}