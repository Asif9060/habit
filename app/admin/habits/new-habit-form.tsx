"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, ArrowUpIcon, ArrowDownIcon, TrashIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

interface ItemDraft {
  key: string;
  label: string;
}

export function NewHabitForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([
    { key: "item-1", label: "Item 1" },
  ]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function syncKeyFromName(value: string) {
    setName(value);
    if (!key || key === slugify(name)) {
      setKey(slugify(value));
    }
  }

  function setItem(idx: number, patch: Partial<ItemDraft>) {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    setItems(next);
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { key: `item-${prev.length + 1}`, label: `Item ${prev.length + 1}` },
    ]);
  }

  function removeItem(idx: number) {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function move(idx: number, dir: -1 | 1) {
    const next = [...items];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setItems(next);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/habits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            key: key || undefined,
            items: items.map((it) => ({ key: it.key, label: it.label })),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Couldn't create.");
        }
        setName("");
        setKey("");
        setItems([{ key: "item-1", label: "Item 1" }]);
        setOpen(false);
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-ink text-background text-sm font-medium transition-all hover:opacity-90 active:translate-y-px"
      >
        <PlusIcon size={14} strokeWidth={2.5} />
        New system habit
      </button>
    );
  }

  const inputClass = cn(
    "h-11 w-full rounded-xl border border-line bg-background px-4 text-sm",
    "placeholder:text-muted focus:outline-none focus:border-ink",
    "transition-colors"
  );

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-line p-5 bg-surface/30"
    >
      <p className="text-xs uppercase tracking-[0.18em] text-muted font-medium mb-4">
        New system habit
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Name</label>
          <input
            value={name}
            onChange={(e) => syncKeyFromName(e.target.value)}
            className={inputClass}
            placeholder="Read Quran"
            required
            maxLength={80}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Key (slug)</label>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className={cn(inputClass, "font-mono")}
            placeholder="read-quran"
            maxLength={40}
          />
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs font-medium text-muted">Items</p>
          <button
            type="button"
            onClick={addItem}
            className="text-xs text-muted hover:text-ink transition-colors"
          >
            + Add item
          </button>
        </div>
        <ul className="divide-y divide-line border border-line rounded-xl overflow-hidden">
          {items.map((it, idx) => (
            <li
              key={idx}
              className="flex items-center gap-3 px-4 py-2.5 bg-background"
            >
              <span className="font-mono text-xs text-muted w-6 tabular-nums">
                {idx + 1}
              </span>
              <input
                type="text"
                value={it.key}
                onChange={(e) => setItem(idx, { key: e.target.value })}
                placeholder="key"
                className="h-9 w-32 rounded-lg border border-line bg-background px-3 text-xs font-mono focus:outline-none focus:border-ink transition-colors"
                maxLength={40}
              />
              <input
                type="text"
                value={it.label}
                onChange={(e) => setItem(idx, { label: e.target.value })}
                placeholder="Label"
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
              <button
                type="button"
                onClick={() => removeItem(idx)}
                disabled={items.length === 1}
                className="w-8 h-8 inline-flex items-center justify-center rounded-md text-muted hover:text-danger hover:bg-danger/5 transition-colors disabled:opacity-30"
                aria-label="Remove"
              >
                <TrashIcon size={14} strokeWidth={2.5} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !name}
          className={cn(
            "h-10 px-5 rounded-full bg-ink text-background text-sm font-medium",
            "transition-all hover:opacity-90 active:translate-y-px",
            "disabled:opacity-50 disabled:pointer-events-none"
          )}
        >
          {pending ? "Creating…" : "Create habit"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="h-10 px-4 rounded-full text-sm text-muted hover:text-ink transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}