"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export interface MissedDay {
  /** YYYY-MM-DD in the user's timezone. */
  dayKey: string;
}

/**
 * Sparse missed-days calendar. Per product spec, we do NOT render a full
 * month grid — only the days the user missed. Each card shows the day key
 * + a friendly date label. Clicking a card opens the retro-mark form via
 * the `onPickDay` callback.
 */
export function MissedDaysCalendar({
  days,
  onPickDay,
  disabled,
}: {
  days: MissedDay[];
  onPickDay: (dayKey: string) => void;
  disabled: boolean;
}) {
  if (days.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-line py-10 px-6 text-center">
        <p className="text-sm font-medium text-ink">
          No missed days in the last 30.
        </p>
        <p className="mt-2 text-xs text-muted max-w-[42ch] mx-auto leading-relaxed">
          When you skip a day, it&rsquo;ll appear here so you can bridge it with
          a chance.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3">
      {days.map((d) => (
        <button
          key={d.dayKey}
          type="button"
          onClick={() => onPickDay(d.dayKey)}
          disabled={disabled}
          className={cn(
            "group text-left rounded-2xl border border-line bg-surface/40",
            "p-4 transition-all duration-150 ease-out",
            "hover:scale-[1.015] hover:border-ink hover:bg-surface/80",
            "active:scale-[0.985]",
            "disabled:opacity-50 disabled:pointer-events-none",
            "animate-fade-in-up"
          )}
        >
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted font-mono">
            {d.dayKey}
          </p>
          <p className="mt-1 text-base font-semibold tracking-tight text-ink">
            {friendlyDate(d.dayKey)}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Tap to mark with a chance
          </p>
        </button>
      ))}
    </div>
  );
}

/**
 * Format a YYYY-MM-DD day key as "Sat, 14 Jun" for friendly display in the
 * user's locale. Falls back to the raw dayKey on parse failure.
 */
function friendlyDate(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return dayKey;
  // Use noon UTC to dodge any DST edge effects on the day boundary.
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  try {
    return dt.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  } catch {
    return dayKey;
  }
}

// Re-export a tiny utility used by the page to keep "open" state local.
export function useRetroMarkSelection() {
  const [selected, setSelected] = useState<string | null>(null);
  return { selected, setSelected };
}