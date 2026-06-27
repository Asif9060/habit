"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

const ICON_OPTIONS = [
  { key: "medal", label: "Medal" },
  { key: "trophy", label: "Trophy" },
  { key: "crown", label: "Crown" },
  { key: "sparkle", label: "Sparkle" },
];

export interface RewardEditInitial {
  id: string;
  name: string;
  description: string;
  iconKey: string;
  thresholdDays: number;
}

export function RewardEditForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: RewardEditInitial;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [iconKey, setIconKey] = useState(initial.iconKey);
  const [threshold, setThreshold] = useState(initial.thresholdDays);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/rewards/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            iconKey,
            thresholdDays: threshold,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Couldn't save.");
        }
        onSaved();
        router.refresh();
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
            Edit reward
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            {initial.name}
          </h2>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              required
              maxLength={80}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">
                Threshold (days)
              </label>
              <input
                type="number"
                min={1}
                max={3650}
                value={threshold}
                onChange={(e) =>
                  setThreshold(Math.max(1, parseInt(e.target.value || "1", 10)))
                }
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
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
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