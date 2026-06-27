import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { LoginForm } from "./login-form";
import { getAuth } from "@/lib/auth";

// Reads the session to redirect signed-in users.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");

  const { next } = await searchParams;

  return (
    <main className="min-h-[100dvh] w-full grid grid-cols-1 md:grid-cols-2">
      {/* Form column */}
      <section className="flex items-center justify-center px-5 md:px-10 py-16">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink transition-colors mb-10"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand" />
            Namaz Tracker
          </Link>
          <h1 className="text-3xl md:text-4xl tracking-tight font-semibold leading-tight">
            Welcome back.
          </h1>
          <p className="mt-3 text-muted">
            Log in to keep your streak alive.
          </p>
          <div className="mt-10">
            <LoginForm next={next ?? "/dashboard"} />
          </div>
          <p className="mt-8 text-sm text-muted">
            New here?{" "}
            <Link
              href="/register"
              className="text-ink underline-offset-4 hover:underline font-medium"
            >
              Create an account
            </Link>
          </p>
        </div>
      </section>

      {/* Decorative column — a quiet streak visualization. Server-rendered. */}
      <aside className="hidden md:flex bg-brand text-white items-center justify-center px-12 py-20">
        <StreakVisual />
      </aside>
    </main>
  );
}

function StreakVisual() {
  // 14-day grid: 14 cells representing the last 14 days. The first 7 lit.
  const days = Array.from({ length: 14 }, (_, i) => i < 11);
  return (
    <div className="w-full max-w-xs">
      <p className="text-xs uppercase tracking-[0.2em] text-white/70 font-medium">
        Your streak
      </p>
      <p className="mt-3 font-mono text-6xl tracking-tight tabular-nums">
        11
      </p>
      <p className="mt-2 text-sm text-white/70">days in a row</p>
      <div className="mt-10 grid grid-cols-7 gap-2">
        {days.map((on, i) => (
          <span
            key={i}
            className={
              "h-7 rounded-md " +
              (on ? "bg-white" : "bg-white/15 border border-white/25")
            }
            aria-label={on ? "completed" : "missed"}
          />
        ))}
      </div>
      <p className="mt-6 text-xs text-white/60 font-mono">
        resets at local midnight
      </p>
    </div>
  );
}