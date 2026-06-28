"use client";

import {
  useState,
  useOptimistic,
  useMemo,
  useTransition,
  useRef,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { CheckIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { StreakRing } from "@/components/streak-ring";

export interface ChecklistItem {
  key: string;
  label: string;
}

export interface ChecklistHabit {
  habitDefId: string;
  name: string;
  items: ChecklistItem[];
  // Initial completion state — server-rendered.
  completedItemKeys: string[];
  // Streak state — `lastCompletedDayKey` is needed by the client to know
  // whether today is already counted (so we don't double-increment in the
  // optimistic render).
  streak: {
    current: number;
    longest: number;
    lastCompletedDayKey: string | null;
  };
}

/**
 * Dashboard layout: prayer checklist on the left, streak ring on the right.
 * Both share the same `useOptimistic` set so the ring updates instantly the
 * moment the last prayer is checked off — no waiting for `router.refresh()`.
 *
 * Usage:
 *   <PrayerChecklistProvider habits={habits} dayKey={dayKey}>
 *     <PrayerChecklist />
 *     <PrayerChecklistRail />
 *   </PrayerChecklistProvider>
 *
 * The provider holds the optimistic state. Both child components are tiny
 * leaves — keeping the dashboard server component in charge of layout.
 */

interface Ctx {
  habits: ChecklistHabit[];
  dayKey: string;
  optimistic: Set<string>;
  setOptimistic: (action: { id: string; on: boolean }) => void;
  toggle: (habit: ChecklistHabit, itemKey: string, next: boolean) => void;
  pendingId: string | null;
  instantStreak: { current: number; longest: number };
  error: string | null;
}

const ChecklistContext = createContext<Ctx | null>(null);

function useChecklist(): Ctx {
  const ctx = useContext(ChecklistContext);
  if (!ctx) {
    throw new Error(
      "PrayerChecklist child must be rendered inside PrayerChecklistProvider."
    );
  }
  return ctx;
}

export function PrayerChecklistProvider({
  habits,
  dayKey,
  children,
}: {
  habits: ChecklistHabit[];
  dayKey: string;
  children: ReactNode;
}) {
  const router = useRouter();

  // Build initial state from server data. We key by `${habitDefId}:${itemKey}`.
  const initial = useMemo(() => {
    const s = new Set<string>();
    for (const h of habits) {
      for (const k of h.completedItemKeys) {
        s.add(`${h.habitDefId}:${k}`);
      }
    }
    return s;
  }, [habits]);

  const [optimistic, setOptimistic] = useOptimistic(
    initial,
    (state: Set<string>, action: { id: string; on: boolean }) => {
      const next = new Set(state);
      if (action.on) next.add(action.id);
      else next.delete(action.id);
      return next;
    }
  );

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Find the Namaz habit (if present) so the ring can mirror its progress.
  const namazHabit = useMemo(
    () =>
      habits.find((h) => h.name.toLowerCase().includes("namaz")) ?? habits[0],
    [habits]
  );

  // ── Instant streak ──────────────────────────────────────────────────
  // Compute the namaz streak client-side from the optimistic set so the
  // ring animates the moment the last prayer is checked — no waiting for
  // router.refresh(). The rule mirrors lib/streak.ts:
  //   - partial → current unchanged
  //   - all items → +1 if no full completion yet today, else unchanged
  const instantStreak = useMemo(() => {
    if (!namazHabit) return { current: 0, longest: 0 };
    const total = namazHabit.items.length;
    const prefix = namazHabit.habitDefId + ":";
    const doneHere = Array.from(optimistic).filter((k) =>
      k.startsWith(prefix)
    ).length;
    const isFull = total > 0 && doneHere >= total;

    const server = namazHabit.streak;
    if (!isFull) return server;

    if (server.lastCompletedDayKey === dayKey) return server;
    if (server.current === 0) {
      return { ...server, current: 1, longest: Math.max(server.longest, 1) };
    }
    return {
      ...server,
      current: server.current + 1,
      longest: Math.max(server.longest, server.current + 1),
    };
  }, [namazHabit, optimistic, dayKey]);

  async function toggle(habit: ChecklistHabit, itemKey: string, next: boolean) {
    const id = `${habit.habitDefId}:${itemKey}`;
    const fullId = `${habit.habitDefId}::${itemKey}`;
    setError(null);
    setPendingId(fullId);

    startTransition(() => {
      setOptimistic({ id, on: next });
    });

    // Compute the new full set of completed keys for this habit.
    const prefix = habit.habitDefId + ":";
    const nextSet = new Set(
      Array.from(optimistic).filter((k) => k.startsWith(prefix))
    );
    if (next) nextSet.add(prefix + itemKey);
    else nextSet.delete(prefix + itemKey);
    const completedItemKeys = Array.from(nextSet).map((k) =>
      k.substring(prefix.length)
    );

    try {
      const res = await fetch(`/api/habits/${habit.habitDefId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedItemKeys }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't save. Please try again.");
      }
      // Re-run the dashboard server component in the background so the
      // streak (server-authoritative), longest, and any newly granted
      // rewards reflect Mongo state. The optimistic state above remains
      // as the immediate UX; React reconciles with the fresh server
      // props automatically when they arrive.
      router.refresh();
    } catch (err: unknown) {
      startTransition(() => {
        setOptimistic({ id, on: !next });
      });
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setTimeout(() => setPendingId(null), 180);
    }
  }

  return (
    <ChecklistContext.Provider
      value={{
        habits,
        dayKey,
        optimistic,
        setOptimistic,
        toggle,
        pendingId,
        instantStreak,
        error,
      }}
    >
      {children}
    </ChecklistContext.Provider>
  );
}

/** The prayer list. Reads state from the provider. */
export function PrayerChecklist() {
  const { habits, dayKey, optimistic, pendingId, toggle, error } = useChecklist();

  return (
    <div className="flex flex-col gap-8">
      {habits.map((habit) => (
        <section key={habit.habitDefId}>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-base font-semibold tracking-tight">
              {habit.name}
            </h2>
            <p className="text-xs font-mono text-muted tabular-nums">
              {dayKey}
            </p>
          </div>
          <ul className="divide-y divide-line border-t border-b border-line">
            {habit.items.map((item) => {
              const id = `${habit.habitDefId}:${item.key}`;
              const fullId = `${habit.habitDefId}::${item.key}`;
              const done = optimistic.has(id);
              const isPending = pendingId === fullId;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => toggle(habit, item.key, !done)}
                    disabled={isPending}
                    className={cn(
                      "w-full flex items-center gap-4 py-3.5 px-1 text-left",
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
                        done
                          ? "text-muted line-through decoration-1"
                          : "text-ink"
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
        </section>
      ))}

      {error && (
        <p
          role="alert"
          className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 animate-fade-in-up"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** Right rail — streak ring. Pulses once each time the streak advances. */
export function PrayerChecklistRail() {
  const { habits, instantStreak } = useChecklist();
  const namazHabit = useMemo(
    () =>
      habits.find((h) => h.name.toLowerCase().includes("namaz")) ?? habits[0],
    [habits]
  );

  const lastCurrentRef = useRef(instantStreak.current);
  const [pulseKey, setPulseKey] = useState(0);
  const current = instantStreak.current;
  useEffect(() => {
    if (current > lastCurrentRef.current) {
      setPulseKey((k) => k + 1);
    }
    lastCurrentRef.current = current;
  }, [current]);

  if (!namazHabit) return null;

  return (
    <div className="rounded-3xl border border-line p-6 bg-surface/40">
      <p className="text-xs uppercase tracking-[0.18em] text-muted mb-5 font-medium">
        Namaz streak
      </p>
      <div
        key={pulseKey}
        className="flex justify-center pb-8 animate-reward-pulse rounded-full"
      >
        <StreakRing
          current={instantStreak.current}
          longest={instantStreak.longest}
        />
      </div>
      <p className="text-xs text-muted text-center max-w-[28ch] mx-auto leading-relaxed">
        A missed day resets your counter. Earn a chance at{" "}
        <a
          href="/discipline"
          className="text-ink underline-offset-4 hover:underline font-medium"
        >
          /discipline
        </a>{" "}
        and bridge it.
      </p>
    </div>
  );
}