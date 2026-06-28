"use client";

import { useCallback, useEffect, useRef, useState, useTransition, useSyncExternalStore } from "react";
import { SparkleIcon } from "@/components/icons";
import { AyatQuiz } from "@/components/discipline/ayat-quiz";
import { ChanceCounterStatic } from "@/components/discipline/chance-counter";
import {
  MissedDaysCalendar,
  type MissedDay,
} from "@/components/discipline/missed-days-calendar";
import { RetroMarkForm } from "@/components/discipline/retro-mark-form";
import { cn } from "@/lib/cn";

interface AyatPayload {
  ayatId: string;
  surahNumber: number;
  ayahNumber: number;
  paraNumber: number;
  surahName: string;
  arabicText: string;
  englishTranslation: string;
  bengaliTranslation: string;
}

interface NamazHabit {
  habitDefId: string;
  name: string;
  items: { key: string; label: string }[];
}

export function DisciplinePageClient({
  today,
  namaz,
  initialBalance,
  initialAyat,
  initialMissedDays,
}: {
  today: string;
  namaz: NamazHabit | null;
  initialBalance: { current: number; lifetimeEarned: number };
  initialAyat: AyatPayload | null;
  initialMissedDays: MissedDay[];
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [ayat, setAyat] = useState<AyatPayload | null>(initialAyat);
  const [missedDays, setMissedDays] = useState<MissedDay[]>(initialMissedDays);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    | { kind: "success"; message: string }
    | { kind: "error"; message: string }
    | null
  >(null);
  const [, startTransition] = useTransition();
  const [ayatLoading, setAyatLoading] = useState(false);

  // Re-fetch a fresh ayat whenever the user requests one. Called after
  // verify/skip and on first paint when initialAyat was null.
  const fetchNextAyat = useCallback(() => {
    setAyatLoading(true);
    startTransition(async () => {
      try {
        const res = await fetch("/api/discipline/ayat", { method: "GET" });
        if (res.status === 409) {
          setAyat(null);
          setFeedback({
            kind: "error",
            message:
              "You've seen every available ayat in this session. Reset the seen list to start over.",
          });
          return;
        }
        if (!res.ok) {
          setFeedback({
            kind: "error",
            message: "Couldn't load the next ayat.",
          });
          return;
        }
        const data = (await res.json()) as {
          ayat: AyatPayload;
          balance: { current: number; lifetimeEarned: number };
        };
        setAyat(data.ayat);
        setBalance(data.balance);
        setFeedback(null);
      } catch (err) {
        setFeedback({
          kind: "error",
          message: err instanceof Error ? err.message : "Network error.",
        });
      } finally {
        setAyatLoading(false);
      }
    });
  }, []);

  // On mount: if the server didn't return an ayat (e.g. user has seen
  // every ayah already and the initial pickUnseenAyat failed), schedule a
  // client-side retry once the first paint is done. We defer via
  // `queueMicrotask` so the setState calls inside `fetchNextAyat` happen
  // outside the synchronous effect body — keeps the React 19
  // cascading-render ESLint rule happy.
  const fetchedInitialRef = useRef(false);
  useEffect(() => {
    if (fetchedInitialRef.current) return;
    if (ayat) return;
    fetchedInitialRef.current = true;
    queueMicrotask(() => {
      fetchNextAyat();
    });
  }, [ayat, fetchNextAyat]);

  // Refresh the missed-days list after a successful retro-mark.
  async function refreshMissedDays() {
    if (!namaz) return;
    try {
      const res = await fetch(
        `/api/discipline/missed-days?habitDefId=${encodeURIComponent(namaz.habitDefId)}`,
        { method: "GET" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as { missedDays: string[] };
      setMissedDays(data.missedDays.map((d) => ({ dayKey: d })));
    } catch {
      // Non-blocking — the user will see the list update next page load.
    }
  }

  return (
    <div className="max-w-5xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted font-medium">
            Discipline
          </p>
          <h1 className="mt-2 text-3xl md:text-4xl tracking-tight font-semibold">
            Earn chances. Bridge the gap.
          </h1>
          <p className="mt-3 text-muted max-w-[58ch]">
            Read the ayat, identify it correctly, and earn a chance. Spend
            chances here to mark a day you forgot — your streak continues.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <ChanceCounterStatic current={balance.current} />
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted font-mono">
            {today}
          </p>
        </div>
      </header>

      <FirstTimeIntro />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 lg:gap-12">
        {/* Left column: ayat quiz */}
        <section>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted font-medium mb-3">
            Ayat quiz
          </p>
          {ayat ? (
            <AyatQuiz
              ayat={ayat}
              onCorrect={() => {
                setBalance((b) => ({
                  current: b.current + 1,
                  lifetimeEarned: b.lifetimeEarned + 1,
                }));
                setFeedback({
                  kind: "success",
                  message: "Correct — 1 chance earned.",
                });
              }}
              onIncorrect={() => {
                setFeedback({
                  kind: "error",
                  message: "Not quite. Moving to the next one.",
                });
              }}
              onRequestNext={fetchNextAyat}
            />
          ) : ayatLoading ? (
            <div className="rounded-3xl border border-line bg-surface/40 p-10 text-center">
              <p className="text-sm text-muted">Loading the next ayat…</p>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-line p-10 text-center">
              <p className="text-sm font-medium text-ink">
                You&rsquo;ve seen every available ayat.
              </p>
              <p className="mt-2 text-xs text-muted max-w-[42ch] mx-auto leading-relaxed">
                Reset your seen-ayats list from the admin panel to start the
                cycle again.
              </p>
            </div>
          )}

          {feedback && (
            <p
              role="alert"
              className={cn(
                "mt-4 text-sm rounded-lg px-3 py-2 animate-fade-in-up",
                feedback.kind === "success"
                  ? "text-success bg-success/10 border border-success/20"
                  : "text-danger bg-danger/10 border border-danger/20"
              )}
            >
              {feedback.message}
            </p>
          )}
        </section>

        {/* Right column: missed days calendar + retro-mark form */}
        <aside className="flex flex-col gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted font-medium mb-3">
              Missed days
            </p>
            <MissedDaysCalendar
              days={missedDays}
              onPickDay={(d) => {
                setSelectedDay(d);
                setFeedback(null);
              }}
              disabled={balance.current < 1}
            />
            {balance.current < 1 && missedDays.length > 0 && (
              <p className="mt-3 text-xs text-muted">
                Earn a chance to unlock a missed day.
              </p>
            )}
          </div>

          {selectedDay && namaz && (
            <RetroMarkForm
              habitDefId={namaz.habitDefId}
              dayKey={selectedDay}
              items={namaz.items}
              balance={balance.current}
              onSuccess={(r) => {
                setBalance((b) => ({ ...b, current: r.newBalance }));
                setSelectedDay(null);
                setFeedback({
                  kind: "success",
                  message: r.allItemsMarked
                    ? "Day bridged — and your streak rewards count."
                    : "Day bridged — streak continues. Mark all five next time to count rewards.",
                });
                refreshMissedDays();
              }}
              onCancel={() => setSelectedDay(null)}
              onError={(m) => setFeedback({ kind: "error", message: m })}
            />
          )}
        </aside>
      </div>

      <TranslationsAttribution />
    </div>
  );
}

/**
 * First-visit card explaining the loop. Stored as a per-user flag in
 * localStorage so it only shows once.
 *
 * We use `useSyncExternalStore` to read the dismissed flag — this avoids
 * a setState-in-useEffect cascade the React 19 ESLint rule complains about,
 * and works correctly during SSR by returning the SSR snapshot value
 * (`false` = "show on first render") when called on the server.
 */
const INTRO_KEY = "discipline.intro.dismissed";

function subscribeIntro(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}
function getIntroSnapshot(): string | null {
  try {
    return window.localStorage.getItem(INTRO_KEY);
  } catch {
    return null;
  }
}
function getIntroServerSnapshot(): string | null {
  return null;
}

function FirstTimeIntro() {
  const raw = useSyncExternalStore(
    subscribeIntro,
    getIntroSnapshot,
    getIntroServerSnapshot
  );
  const dismissed = raw === "1";

  function dismiss() {
    try {
      window.localStorage.setItem(INTRO_KEY, "1");
      // Fire a synthetic storage event so any other components subscribed
      // via the same hook also re-read.
      window.dispatchEvent(new StorageEvent("storage", { key: INTRO_KEY }));
    } catch {
      // ignore — best-effort
    }
  }

  if (dismissed) return null;

  return (
    <div className="mb-8 rounded-3xl border border-line bg-surface/40 p-5 flex items-start gap-4">
      <span className="inline-flex w-9 h-9 shrink-0 items-center justify-center rounded-full bg-accent text-ink">
        <SparkleIcon size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold tracking-tight">How Discipline works</p>
        <ol className="mt-2 text-xs text-muted space-y-1.5 list-decimal list-inside">
          <li>Read the ayat in Arabic, English, and Bengali.</li>
          <li>
            Enter the correct <strong>surah</strong>, <strong>ayah</strong>,
            and <strong>para</strong> numbers.
          </li>
          <li>
            Spend earned chances at the missed-days calendar to bridge a
            forgotten day. Mark all five to keep streak rewards.
          </li>
        </ol>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="text-xs text-muted hover:text-ink transition-colors"
      >
        Got it
      </button>
    </div>
  );
}

/**
 * Footer attribution for the Quran translations. Required by CC-BY-SA 4.0.
 */
function TranslationsAttribution() {
  return (
    <p className="mt-12 text-[10px] text-muted leading-relaxed max-w-[68ch]">
      Arabic text, English translation (Saheeh International), and Bengali
      translation (Taisirul Quran) are sourced from the{" "}
      <a
        href="https://www.npmjs.com/package/quran-json"
        className="underline-offset-4 hover:underline"
        target="_blank"
        rel="noreferrer"
      >
        quran-json
      </a>{" "}
      package by Risan Bagja Pradana, licensed{" "}
      <a
        href="https://creativecommons.org/licenses/by-sa/4.0/"
        className="underline-offset-4 hover:underline"
        target="_blank"
        rel="noreferrer"
      >
        CC BY-SA 4.0
      </a>
      . Para (juz) numbers follow the standard Mushaf al-Madinah divisions.
    </p>
  );
}