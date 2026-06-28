"use client";

import { SparkleIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Pill showing the user's current spendable chances. Pulses briefly each
 * time `current` ticks up so an earned chance is felt immediately.
 */
export function ChanceCounter({
  current,
  pulse,
}: {
  current: number;
  pulse: number;
}) {
  return (
    <div
      key={pulse}
      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-accent/40 bg-accent-soft/40 animate-reward-pulse"
    >
      <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-accent text-ink">
        <SparkleIcon size={12} />
      </span>
      <span className="text-sm font-semibold tracking-tight tabular-nums">
        {current}
      </span>
      <span className="text-xs text-muted">
        {current === 1 ? "chance" : "chances"}
      </span>
    </div>
  );
}

/**
 * Variant: a passive (non-pulsing) counter for use in compact places like
 * the page header. Same visual language, no animation.
 */
export function ChanceCounterStatic({ current }: { current: number }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3.5 py-2 rounded-full",
        "border border-line bg-surface/50"
      )}
    >
      <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-accent text-ink">
        <SparkleIcon size={12} />
      </span>
      <span className="text-sm font-semibold tracking-tight tabular-nums">
        {current}
      </span>
      <span className="text-xs text-muted">
        {current === 1 ? "chance" : "chances"}
      </span>
    </div>
  );
}