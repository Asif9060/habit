"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { detectTimezone } from "@/lib/dayKey";

interface Profile {
  name: string;
  email: string;
  timezone: string;
}

export function ProfileForm({ initial }: { initial: Profile }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      try {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), timezone }),
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

  const inputClass = cn(
    "h-11 w-full rounded-xl border border-line bg-background px-4 text-sm",
    "placeholder:text-muted focus:outline-none focus:border-ink",
    "transition-colors"
  );

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-xs font-medium text-muted">
          Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-medium text-muted">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={initial.email}
          readOnly
          className={cn(inputClass, "bg-surface/50 text-muted cursor-not-allowed")}
        />
        <p className="text-xs text-muted">
          Email changes are not supported in this build.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="tz" className="text-xs font-medium text-muted">
          Timezone
        </label>
        <input
          id="tz"
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className={cn(inputClass, "font-mono")}
        />
        <div className="flex items-center gap-3 mt-1">
          <button
            type="button"
            onClick={() => setTimezone(detectTimezone())}
            className="text-xs text-brand hover:underline underline-offset-4"
          >
            Auto-detect
          </button>
        </div>
        <p className="text-xs text-muted">
          IANA timezone name (e.g. <code>Asia/Karachi</code>,{" "}
          <code>America/New_York</code>, <code>UTC</code>).
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-success bg-success/10 border border-success/20 rounded-lg px-3 py-2">
          Saved.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className={cn(
          "h-11 px-5 self-start rounded-xl bg-ink text-background text-sm font-medium",
          "transition-all hover:opacity-90 active:translate-y-px",
          "disabled:opacity-50 disabled:pointer-events-none"
        )}
      >
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}