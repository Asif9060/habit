"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export interface HabitRowHabit {
  id: string;
  name: string;
  type: "system" | "user";
  items: { key: string; label: string; order: number }[];
}

export function HabitRowActions({ habit }: { habit: HabitRowHabit }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs text-muted hover:text-ink hover:bg-line/40 transition-colors"
      >
        <PencilIcon size={12} strokeWidth={2.5} />
        Edit
      </button>
      <ArchiveHabitButton
        id={habit.id}
        name={habit.name}
        onDone={() => router.refresh()}
      />
      {editing && (
        <HabitEditDialog
          habit={habit}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ArchiveHabitButton({
  id,
  name,
  onDone,
}: {
  id: string;
  name: string;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function archive() {
    if (!confirm(`Archive "${name}"? It will no longer appear on user dashboards. You can restore it from the database if needed.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/habits/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Couldn't archive.");
        }
        onDone();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={archive}
      disabled={pending}
      title={error ?? ""}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs text-muted hover:text-danger hover:bg-danger/5 transition-colors disabled:opacity-50"
    >
      <TrashIcon size={12} strokeWidth={2.5} />
      {pending ? "…" : "Archive"}
    </button>
  );
}

interface HabitEditDialogProps {
  habit: HabitRowHabit;
  onClose: () => void;
  onSaved: () => void;
}

function HabitEditDialog({ habit, onClose, onSaved }: HabitEditDialogProps) {
  const [name, setName] = useState(habit.name);
  const [items, setItems] = useState(habit.items);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function move(idx: number, dir: -1 | 1) {
    const next = [...items];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setItems(next.map((it, i) => ({ ...it, order: i })));
  }

  function rename(idx: number, label: string) {
    const next = [...items];
    next[idx] = { ...next[idx], label };
    setItems(next);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/habits/${habit.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            items: items.map((it) => ({
              key: it.key,
              label: it.label,
              order: it.order,
            })),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Couldn't save.");
        }
        onSaved();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-ink/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-xl bg-background rounded-t-2xl md:rounded-2xl border border-line shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="px-6 py-5 border-b border-line">
          <p className="text-xs uppercase tracking-[0.18em] text-muted font-medium">
            Edit habit
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            {habit.name}
          </h2>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-background px-4 text-sm focus:outline-none focus:border-ink transition-colors"
              required
              maxLength={80}
            />
          </div>

          <div>
            <p className="text-xs font-medium text-muted mb-2">Items</p>
            <ul className="divide-y divide-line border border-line rounded-xl overflow-hidden">
              {items.map((it, idx) => (
                <li
                  key={it.key}
                  className="flex items-center gap-3 px-4 py-2.5 bg-surface/30"
                >
                  <span className="font-mono text-xs text-muted w-6 tabular-nums">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={it.label}
                    onChange={(e) => rename(idx, e.target.value)}
                    className="h-9 flex-1 rounded-lg border border-line bg-background px-3 text-sm focus:outline-none focus:border-ink transition-colors"
                    maxLength={40}
                  />
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-md text-muted hover:text-ink hover:bg-line/40 transition-colors disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ArrowUpIcon size={14} strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === items.length - 1}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-md text-muted hover:text-ink hover:bg-line/40 transition-colors disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ArrowDownIcon size={14} strokeWidth={2.5} />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-line flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-full text-sm text-muted hover:text-ink transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || !name}
            className={cn(
              "h-10 px-5 rounded-full bg-ink text-background text-sm font-medium",
              "transition-all hover:opacity-90 active:translate-y-px",
              "disabled:opacity-50 disabled:pointer-events-none"
            )}
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}