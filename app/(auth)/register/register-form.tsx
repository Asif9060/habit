"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import { detectTimezone } from "@/lib/dayKey";
import { cn } from "@/lib/cn";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // SSR can't know the user's IANA tz, so we render "UTC" on first paint and
  // upgrade after hydration. The input is `readOnly` until upgraded, then
  // becomes editable — so users on slow connections still get a sensible
  // starting value, and SSR/CSR markup always matches.
  const [timezone, setTimezone] = useState<string>("UTC");
  const [tzReady, setTzReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Detected client-side only; SSR has no tz context. One-shot mount effect
    // is the right tool here despite the lint rule — we're syncing React to
    // a non-React source (the browser's reported tz).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimezone(detectTimezone());
    setTzReady(true);
  }, []);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    startTransition(async () => {
      const result = await signUp.email({
        email,
        password,
        name: name.trim() || email.split("@")[0],
        // additionalFields typed via Better-Auth inference; the cast keeps the
        // surface clean even if our auth-options timezone enum drifts.
        timezone,
      } as Parameters<typeof signUp.email>[0]);

      if (result.error) {
        setError(result.error.message ?? "Sign up failed. Try again.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  }

  const inputClass = cn(
    "h-11 w-full rounded-xl border border-line bg-background px-4 text-sm",
    "placeholder:text-muted focus:outline-none focus:border-ink",
    "transition-colors"
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-xs font-medium text-muted">
          Name
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="What should we call you?"
        />
      </div>

      <div className="flex flex-col gap-1.5 mt-3">
        <label htmlFor="email" className="text-xs font-medium text-muted">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="you@example.com"
        />
      </div>

      <div className="flex flex-col gap-1.5 mt-3">
        <label htmlFor="password" className="text-xs font-medium text-muted">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          placeholder="At least 8 characters"
        />
        <p className="text-xs text-muted">
          Used only to log you back in. Stored hashed.
        </p>
      </div>

      <div className="flex flex-col gap-1.5 mt-3">
        <label htmlFor="tz" className="text-xs font-medium text-muted">
          Timezone
        </label>
        <input
          id="tz"
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className={cn(inputClass, "font-mono")}
          readOnly={!tzReady}
        />
        <p className="text-xs text-muted">
          {tzReady
            ? "Detected automatically. Edit only if it looks wrong."
            : "Detecting your timezone…"}
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-2 text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className={cn(
          "mt-6 h-12 w-full rounded-full bg-brand text-white text-sm font-medium",
          "transition-all hover:bg-brand/90 active:translate-y-px",
          "disabled:opacity-50 disabled:pointer-events-none"
        )}
      >
        {isPending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}