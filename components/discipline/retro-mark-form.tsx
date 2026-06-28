"use client";

import { useState, useTransition } from "react";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export interface RetroMarkFormProps {
  habitDefId: string;
  dayKey: string;
  items: { key: string; label: string }[];
  /** Current chance balance. Form is disabled if < 1. */
  balance: number;
  onSuccess: (result: {
    dayKey: string;
    newBalance: number;
    allItemsMarked: boolean;
  }) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}

/**
 * Per-day prayer checklist for retro-marking. Visually mirrors the dashboard's
 * prayer-checklist (6×6 round checkboxes, same row layout) so the user
 * recognizes the pattern. Submit is enabled only when at least one item is
 * checked; full completion unlocks reward grants on the server.
 */
export function RetroMarkForm({
  habitDefId,
  dayKey,
  items,
  balance,
  onSuccess,
  onCancel,
  onError,
}: RetroMarkFormProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const hasAny = checked.size > 0;
  const allMarked = checked.size === items.length;
  const canSubmit = hasAny && balance >= 1 && !pending;

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function submit() {
    if (!canSubmit) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/discipline/retro-mark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            habitDefId,
            dayKey,
            completedItemKeys: Array.from(checked),
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          onError(body.error ?? "Couldn't mark this day. Please try again.");
          return;
        }
        onSuccess({
          dayKey,
          newBalance: body.newBalance as number,
          allItemsMarked: body.allItemsMarked as boolean,
        });
      } catch (err) {
        onError(err instanceof Error ? err.message : "Network error.");
      }
    });
  }

  return (
    <div className="rounded-3xl border border-line bg-surface/40 p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted font-mono">
            {dayKey}
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">
            Mark this missed day
          </h3>
          <p className="mt-1 text-xs text-muted leading-relaxed max-w-[44ch]">
            Tap the prayers you offered. Marking all five preserves any streak
            rewards the day would have granted.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className={cn(
            "inline-flex items-center justify-center w-8 h-8 rounded-lg",
            "text-muted hover:text-ink hover:bg-line/40 transition-colors",
            "disabled:opacity-50 disabled:pointer-events-none"
          )}
          aria-label="Cancel"
        >
          <CloseIcon size={16} />
        </button>
      </div>

      <ul className="divide-y divide-line border-t border-b border-line mb-4">
        {items.map((item) => {
          const done = checked.has(item.key);
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => toggle(item.key)}
                disabled={pending}
                className={cn(
                  "w-full flex items-center gap-4 py-3 px-1 text-left",
                  "transition-all duration-150 ease-out",
                  "hover:bg-line/20 active:scale-[0.985] active:bg-line/30",
                  "disabled:opacity-70 disabled:pointer-events-none"
                )}
                aria-pressed={done}
              >
                <span
                  className={cn(
                    "relative inline-flex w-6 h-6 items-center justify-center rounded-full border transition-colors duration-200",
                    done
                      ? "bg-brand border-brand text-white animate-check-pop"
                      : "border-line text-transparent"
                  )}
                >
                  <CheckIcon size={12} strokeWidth={3} />
                </span>
                <span
                  className={cn(
                    "text-sm font-medium tracking-tight transition-colors duration-200",
                    done ? "text-muted line-through decoration-1" : "text-ink"
                  )}
                >
                  {item.label}
                </span>
                <span
                  className={cn(
                    "ml-auto text-[10px] uppercase tracking-[0.18em] font-mono transition-colors duration-200",
                    done ? "text-brand" : "text-muted"
                  )}
                >
                  {done ? "done" : "tap"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {allMarked
            ? "All five marked — streak rewards will count."
            : hasAny
            ? "Partial mark — streak continues but no new reward."
            : "Choose at least one prayer."}
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className={cn(
            "inline-flex items-center justify-center h-10 px-5 rounded-xl text-sm font-medium",
            "bg-brand text-white transition-all duration-150 ease-out",
            "hover:scale-[1.015] active:scale-[0.985]",
            "disabled:opacity-50 disabled:pointer-events-none"
          )}
        >
          {pending ? "Bridging…" : "Use 1 chance"}
        </button>
      </div>
    </div>
  );
}