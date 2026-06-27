"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

interface Habit {
  id: string;
  name: string;
  items: string[];
}

export function HabitsManager({ initialHabits }: { initialHabits: Habit[] }) {
  const router = useRouter();
  const [habits, setHabits] = useState(initialHabits);
  const [name, setName] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isCreating, startCreating] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return;

    startCreating(async () => {
      try {
        const res = await fetch("/api/habits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Couldn't create habit.");
        }
        setName("");
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  async function remove(id: string) {
    if (!confirm("Archive this habit? Your past completions stay, but it won't be tracked going forward.")) {
      return;
    }
    setError(null);
    setPendingId(id);

    try {
      const res = await fetch(`/api/habits/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't archive habit.");
      }
      setHabits((prev) => prev.filter((h) => h.id !== id));
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <section>
        <form onSubmit={create} className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Read one Quran page"
            className="h-11 flex-1 rounded-xl border border-line bg-background px-4 text-sm placeholder:text-muted focus:outline-none focus:border-ink transition-colors"
            maxLength={80}
          />
          <button
            type="submit"
            disabled={isCreating || !name.trim()}
            className={cn(
              "h-11 px-5 rounded-xl bg-ink text-background text-sm font-medium",
              "inline-flex items-center gap-1.5",
              "transition-all hover:opacity-90 active:translate-y-px",
              "disabled:opacity-50 disabled:pointer-events-none"
            )}
          >
            <PlusIcon size={14} strokeWidth={2.5} />
            Add
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </section>

      <section>
        {habits.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {habits.map((habit) => (
              <li
                key={habit.id}
                className="py-4 flex items-center gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium tracking-tight truncate">
                    {habit.name}
                  </p>
                  <p className="text-xs text-muted truncate">
                    {habit.items.length === 1
                      ? "Single check"
                      : `${habit.items.length} items`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(habit.id)}
                  disabled={pendingId === habit.id}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs text-muted hover:text-danger hover:bg-danger/5 transition-colors disabled:opacity-50"
                >
                  <TrashIcon size={12} strokeWidth={2.5} />
                  Archive
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-line py-14 px-8 text-center">
      <p className="text-sm font-medium text-ink">
        No custom habits yet.
      </p>
      <p className="mt-2 text-sm text-muted max-w-[42ch] mx-auto">
        Add one above. Anything you want to keep doing daily — small,
        measurable, repeatable.
      </p>
    </div>
  );
}