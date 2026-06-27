"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, TrashIcon, PencilIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { RewardEditForm } from "./reward-edit-form";

interface RewardRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  thresholdDays: number;
}

const ICON_OPTIONS = [
  { key: "medal", label: "Medal" },
  { key: "trophy", label: "Trophy" },
  { key: "crown", label: "Crown" },
  { key: "sparkle", label: "Sparkle" },
];

export function RewardsEditor({ initial }: { initial: RewardRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function remove(id: string) {
    if (!confirm("Archive this reward rule? Existing grants stay, but no new ones will be issued.")) {
      return;
    }
    setError(null);
    setPendingId(id);

    try {
      const res = await fetch(`/api/admin/rewards/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't archive.");
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <div className="rounded-2xl border border-line overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-8 text-sm text-muted text-center">
            No reward rules yet.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-start gap-4 px-5 py-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-3">
                    <h3 className="text-sm font-semibold tracking-tight">
                      {r.name}
                    </h3>
                    <span className="font-mono text-xs text-muted">
                      {r.thresholdDays}-day
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {r.description}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted font-mono">
                    {r.slug} · {r.iconKey}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingId(r.id)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs text-muted hover:text-ink hover:bg-line/40 transition-colors"
                >
                  <PencilIcon size={12} strokeWidth={2.5} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  disabled={pendingId === r.id}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs text-muted hover:text-danger hover:bg-danger/5 transition-colors disabled:opacity-50"
                >
                  <TrashIcon size={12} strokeWidth={2.5} />
                  Archive
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <NewRewardForm
        onCreated={(row) => {
          setRows((prev) => [...prev, row].sort((a, b) => a.thresholdDays - b.thresholdDays));
          router.refresh();
        }}
        setError={setError}
      />

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      {editingId && (() => {
        const target = rows.find((r) => r.id === editingId);
        if (!target) return null;
        return (
          <RewardEditForm
            initial={target}
            onClose={() => setEditingId(null)}
            onSaved={() => {
              setRows((prev) =>
                prev
                  .map((r) =>
                    r.id === editingId
                      ? {
                          ...r,
                          name: target.name,
                          description: target.description,
                          iconKey: target.iconKey,
                          thresholdDays: target.thresholdDays,
                        }
                      : r
                  )
                  .sort((a, b) => a.thresholdDays - b.thresholdDays)
              );
              setEditingId(null);
            }}
          />
        );
      })()}
    </div>
  );
}

function NewRewardForm({
  onCreated,
  setError,
}: {
  onCreated: (row: RewardRow) => void;
  setError: (msg: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [iconKey, setIconKey] = useState("medal");
  const [threshold, setThreshold] = useState(7);
  const [isPending, startTransition] = useTransition();

  function syncSlugFromName(value: string) {
    setName(value);
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(value));
    }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/rewards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            name,
            description,
            iconKey,
            thresholdDays: threshold,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Couldn't create.");
        }
        const created = await res.json();
        onCreated(created);
        setName("");
        setSlug("");
        setDescription("");
        setThreshold(7);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const inputClass = cn(
    "h-11 w-full rounded-xl border border-line bg-background px-4 text-sm",
    "placeholder:text-muted focus:outline-none focus:border-ink",
    "transition-colors"
  );

  return (
    <form onSubmit={submit} className="mt-8 rounded-2xl border border-line p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-muted font-medium mb-4">
        Add a reward rule
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Name</label>
          <input
            value={name}
            onChange={(e) => syncSlugFromName(e.target.value)}
            className={inputClass}
            placeholder="60-Day Devotion"
            required
            maxLength={80}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={cn(inputClass, "font-mono")}
            placeholder="namaz-60-day-streak"
            required
            maxLength={80}
          />
        </div>
        <div className="md:col-span-2 flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            placeholder="Two months of uninterrupted prayer."
            maxLength={200}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Threshold (days)</label>
          <input
            type="number"
            min={1}
            max={3650}
            value={threshold}
            onChange={(e) => setThreshold(Math.max(1, parseInt(e.target.value || "1", 10)))}
            className={cn(inputClass, "font-mono")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Icon</label>
          <select
            value={iconKey}
            onChange={(e) => setIconKey(e.target.value)}
            className={inputClass}
          >
            {ICON_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={isPending || !name || !slug}
        className={cn(
          "mt-5 h-10 px-5 rounded-full bg-ink text-background text-sm font-medium",
          "inline-flex items-center gap-1.5",
          "transition-all hover:opacity-90 active:translate-y-px",
          "disabled:opacity-50 disabled:pointer-events-none"
        )}
      >
        <PlusIcon size={14} strokeWidth={2.5} />
        {isPending ? "Adding…" : "Add reward"}
      </button>
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