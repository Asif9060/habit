import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRightIcon, CircleNotchIcon, SparkleIcon } from "@/components/icons";
import { getAuth } from "@/lib/auth";

// Reads auth session to show signed-in CTA in nav.
export const dynamic = "force-dynamic";

export default async function Home() {
  // If the user already has a session, surface the "Continue" CTA in the nav.
  // We deliberately don't auto-redirect — the marketing page doubles as the
  // landing for signed-out users, and showing it briefly to signed-in users
  // gives them a moment to orient.
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="min-h-[100dvh] w-full">
      {/* Top nav — kept simple; not a sticky bar so the hero owns first paint. */}
      <nav className="w-full border-b border-line">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium tracking-tight">
            <span className="inline-block w-2 h-2 rounded-full bg-brand" aria-hidden />
            Namaz Tracker
          </div>
          <div className="flex items-center gap-1.5">
            {session ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-ink text-background text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Continue <ArrowRightIcon size={14} strokeWidth={2.5} />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center h-9 px-3 rounded-full text-sm font-medium hover:bg-line/40 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-ink text-background text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Start tracking <ArrowRightIcon size={14} strokeWidth={2.5} />
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero — asymmetric (DESIGN_VARIANCE: 5). Left content, right counter mock. */}
      <section className="w-full">
        <div className="max-w-6xl mx-auto px-5 md:px-8 pt-16 md:pt-28 pb-20 md:pb-32 grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16 items-start">
          <div className="md:col-span-7">
            <p className="text-xs uppercase tracking-[0.2em] text-muted mb-6 font-medium">
              For the ummah, by discipline
            </p>
            <h1 className="text-5xl md:text-7xl tracking-tighter leading-[0.95] font-semibold text-ink">
              Show up for
              <br />
              <span className="text-brand">all five.</span>
              <br />
              Every day.
            </h1>
            <p className="mt-7 text-lg md:text-xl leading-relaxed text-muted max-w-[58ch]">
              Track Fajr through Isha, build an unbroken streak, and earn
              rewards for staying consistent. Miss a day and your streak resets —
              no backfills, no excuses.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href={session ? "/dashboard" : "/register"}
                className="group inline-flex items-center gap-2 h-12 px-6 rounded-full bg-brand text-white text-base font-medium hover:bg-brand/90 transition-all active:translate-y-px"
              >
                {session ? "Go to dashboard" : "Start your streak"}
                <ArrowRightIcon
                  size={18}
                  strokeWidth={2.5}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
              {!session && (
                <Link
                  href="/login"
                  className="inline-flex items-center h-12 px-5 rounded-full border border-line text-base font-medium hover:bg-line/30 transition-colors"
                >
                  I already have an account
                </Link>
              )}
            </div>
          </div>

          {/* Right column: live "today" preview card. Server-rendered, no JS. */}
          <aside className="md:col-span-5 md:pt-6">
            <TodayPreview />
          </aside>
        </div>
      </section>

      {/* Feature strip — 2-column zig-zag (per skill: no 3-equal-cards row). */}
      <section className="border-t border-line bg-surface/40">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28 grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-14">
          <FeatureCell
            eyebrow="01 — Daily"
            title="One screen, all five prayers"
            body="Check off Fajr, Dhuhr, Asr, Maghrib, Isha as you go. Each one moves your day closer to logged."
          />
          <FeatureCell
            eyebrow="02 — Streak"
            title="A counter that resets itself"
            body="Complete at least one prayer every day and your streak grows. Miss a day and it falls to zero. The clock is honest."
            className="md:mt-16"
          />
          <FeatureCell
            eyebrow="03 — Rewards"
            title="Milestones worth marking"
            body="Hit seven consecutive days and you earn a badge. Admins define the rules — you bring the consistency."
          />
          <FeatureCell
            eyebrow="04 — Privacy"
            title="Your data, your account"
            body="Custom habits live only on your profile. Streak math runs server-side, not in your browser where it could lie."
            className="md:mt-16"
          />
        </div>
      </section>

      {/* Closing CTA. */}
      <section className="border-t border-line">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div>
            <h2 className="text-3xl md:text-5xl tracking-tight font-semibold leading-tight max-w-[18ch]">
              Tomorrow&rsquo;s streak starts with tonight&rsquo;s Isha.
            </h2>
            <p className="mt-5 text-muted max-w-[58ch]">
              Free to use, no ads, no notifications you didn&rsquo;t ask for.
            </p>
          </div>
          <Link
            href={session ? "/dashboard" : "/register"}
            className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-ink text-background text-base font-medium hover:opacity-90 transition-opacity self-start md:self-auto"
          >
            <SparkleIcon size={16} className="text-accent" />
            {session ? "Dashboard" : "Create an account"}
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between text-xs text-muted">
          <span>Namaz Tracker</span>
          <span className="font-mono">v0.1.0</span>
        </div>
      </footer>
    </main>
  );
}

// ─── Small server-only components ────────────────────────────────────

function TodayPreview() {
  const prayers = [
    { key: "fajr", label: "Fajr", time: "05:14" },
    { key: "dhuhr", label: "Dhuhr", time: "12:31" },
    { key: "asr", label: "Asr", time: "16:02" },
    { key: "maghrib", label: "Maghrib", time: "18:48" },
    { key: "isha", label: "Isha", time: "20:14" },
  ];

  return (
    <div className="rounded-3xl border border-line bg-background p-6 md:p-7 shadow-[0_24px_60px_-32px_rgba(15,118,110,0.25)]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">
            Today
          </p>
          <p className="mt-1 text-lg font-medium tracking-tight">Tuesday</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">
            Streak
          </p>
          <p className="mt-1 font-mono text-2xl font-medium text-brand tabular-nums">
            14
          </p>
        </div>
      </div>
      <ul className="divide-y divide-line">
        {prayers.map((p, idx) => (
          <li
            key={p.key}
            className="flex items-center justify-between py-3"
          >
            <div className="flex items-center gap-3">
              <span
                className={
                  "inline-flex w-5 h-5 items-center justify-center rounded-full border " +
                  (idx < 2
                    ? "bg-brand border-brand text-white"
                    : "border-line text-muted")
                }
                aria-hidden
              >
                {idx < 2 ? "✓" : ""}
              </span>
              <span className="text-sm font-medium">{p.label}</span>
            </div>
            <span className="text-xs font-mono tabular-nums text-muted">
              {p.time}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-center gap-2 text-xs text-muted">
        <CircleNotchIcon size={12} />
        <span>3 of 5 logged today</span>
      </div>
    </div>
  );
}

function FeatureCell({
  eyebrow,
  title,
  body,
  className = "",
}: {
  eyebrow: string;
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <article className={className}>
      <p className="text-xs uppercase tracking-[0.2em] text-muted mb-3 font-mono">
        {eyebrow}
      </p>
      <h3 className="text-2xl md:text-3xl tracking-tight font-medium leading-tight">
        {title}
      </h3>
      <p className="mt-4 text-muted leading-relaxed max-w-[42ch]">{body}</p>
    </article>
  );
}