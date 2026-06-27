"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpIcon, ArrowDownIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

interface Item {
  key: string;
  label: string;
  order: number;
}

export function NamazItemsEditor({
  initialItems,
}: {
  initialItems: Item[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function move(idx: number, dir: -1 | 1) {
    const next = [...items];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setItems(next.map((it, i) => ({ ...it, order: i })));
    setSaved(false);
  }

  function rename(idx: number, label: string) {
    const next = [...items];
    next[idx] = { ...next[idx], label };
    setItems(next);
    setSaved(false);
  }

  async function save() {
    setError(null);
    setSaved(false);

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/habits/namaz/items", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((it) => ({ key: it.key, label: it.label, order: it.order })),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Couldn't save.");
        }
        setSaved(true);
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-line">
      <ul className="divide-y divide-line">
        {items.map((item, idx) => (
          <li
            key={item.key}
            className="flex items-center gap-3 px-4 py-3"
          >
            <span className="font-mono text-xs text-muted w-6 tabular-nums">
              {idx + 1}
            </span>
            <input
              type="text"
              value={item.label}
              onChange={(e) => rename(idx, e.target.value)}
              className={cn(
                "h-9 flex-1 rounded-lg border border-line bg-background px-3 text-sm",
                "focus:outline-none focus:border-ink transition-colors"
              )}
              maxLength={40}
            />
            <div className="flex items-center gap-1">
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
            </div>
          </li>
        ))}
      </ul>

      <div className="border-t border-line px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className={cn(
            "h-9 px-4 rounded-full bg-ink text-background text-sm font-medium",
            "transition-all hover:opacity-90 active:translate-y-px",
            "disabled:opacity-50 disabled:pointer-events-none"
          )}
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
        {saved && (
          <span className="text-xs text-success font-medium">Saved.</span>
        )}
        {error && (
          <span role="alert" className="text-xs text-danger">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}