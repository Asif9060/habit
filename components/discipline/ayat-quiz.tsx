"use client";

import { useState, useTransition } from "react";
import { AyatAudioPlayer } from "@/components/discipline/ayat-audio-player";
import { cn } from "@/lib/cn";

export interface AyatQuizProps {
  ayat: {
    ayatId: string;
    surahNumber: number;
    ayahNumber: number;
    paraNumber: number;
    surahName: string;
    arabicText: string;
    englishTranslation: string;
    bengaliTranslation: string;
  };
  /** Called after a correct answer is verified; the parent should fetch the next ayat. */
  onCorrect: () => void;
  /** Called after a wrong answer; the parent should fetch the next ayat. */
  onIncorrect: () => void;
  onRequestNext: () => void;
}

/**
 * The ayat quiz card. Renders Arabic + English + Bengali translations and
 * three number inputs (surah, ayah, para). On submit, POSTs to
 * `/api/discipline/ayat/verify`. Surfaces inline banners for success/failure.
 */
export function AyatQuiz({
  ayat,
  onCorrect,
  onIncorrect,
  onRequestNext,
}: AyatQuizProps) {
  const [surah, setSurah] = useState("");
  const [ayah, setAyah] = useState("");
  const [para, setPara] = useState("");
  const [feedback, setFeedback] = useState<
    | { kind: "success"; message: string }
    | { kind: "error"; message: string }
    | null
  >(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setSurah("");
    setAyah("");
    setPara("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;

    // Client-side sanity check; the server is the source of truth.
    const s = Number(surah);
    const a = Number(ayah);
    const p = Number(para);
    if (!Number.isInteger(s) || s < 1 || s > 114) {
      setFeedback({ kind: "error", message: "Surah must be 1–114." });
      return;
    }
    if (!Number.isInteger(a) || a < 1 || a > 286) {
      setFeedback({ kind: "error", message: "Ayah must be 1–286." });
      return;
    }
    if (!Number.isInteger(p) || p < 1 || p > 30) {
      setFeedback({ kind: "error", message: "Para must be 1–30." });
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/discipline/ayat/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ayatId: ayat.ayatId,
            surahNumber: s,
            ayahNumber: a,
            paraNumber: p,
          }),
        });
        if (res.status === 400) {
          const body = await res.json().catch(() => ({}));
          setFeedback({
            kind: "error",
            message: body.error ?? "Not quite. Try the next ayat.",
          });
          reset();
          onIncorrect();
          return;
        }
        if (!res.ok) {
          setFeedback({
            kind: "error",
            message: "Couldn't save. Please try again.",
          });
          return;
        }
        setFeedback({ kind: "success", message: "+1 chance earned." });
        reset();
        onCorrect();
        // Auto-advance to the next ayat after a beat.
        setTimeout(() => {
          setFeedback(null);
          onRequestNext();
        }, 1100);
      } catch (err) {
        setFeedback({
          kind: "error",
          message: err instanceof Error ? err.message : "Network error.",
        });
      }
    });
  }

  return (
    <article className="rounded-3xl border border-line bg-surface/40 overflow-hidden">
      {/* Top row: surah name + audio player. `key` ensures the player
          remounts on each new ayah so its internal `<audio>` element
          starts clean. */}
      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-1">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted font-mono">
          {ayat.surahName} · {ayat.paraNumber}
        </p>
        <AyatAudioPlayer
          key={`${ayat.surahNumber}:${ayat.ayahNumber}`}
          surahNumber={ayat.surahNumber}
          ayahNumber={ayat.ayahNumber}
        />
      </div>

      {/* Arabic — rendered with Amiri (loaded via next/font/google) so the
          Uthmani diacritics and ligatures render correctly. The font is
          self-hosted by Next, no runtime cost beyond the initial CSS. */}
      <div className="px-6 pt-2 pb-6 text-right" dir="rtl">
        <p className="font-amiri text-3xl md:text-4xl leading-[2.2] text-ink">
          {ayat.arabicText}
        </p>
      </div>

      {/* English translation */}
      <div className="px-6 py-3 border-t border-line">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted font-medium mb-1">
          English
        </p>
        <p className="text-sm text-ink/90 leading-relaxed">
          {ayat.englishTranslation}
        </p>
      </div>

      {/* Bengali translation */}
      <div className="px-6 py-3 border-t border-line">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted font-medium mb-1">
          বাংলা
        </p>
        <p className="text-sm text-ink/90 leading-relaxed">
          {ayat.bengaliTranslation}
        </p>
      </div>

      {/* Quiz form */}
      <form
        onSubmit={submit}
        className="px-6 py-5 border-t border-line bg-background/40"
      >
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted font-medium mb-3">
          Identify this ayat
        </p>
        <div className="grid grid-cols-3 gap-3">
          <NumberField
            label="Surah"
            min={1}
            max={114}
            value={surah}
            onChange={setSurah}
            disabled={pending}
            placeholder="1–114"
          />
          <NumberField
            label="Ayah"
            min={1}
            max={286}
            value={ayah}
            onChange={setAyah}
            disabled={pending}
            placeholder="1–286"
          />
          <NumberField
            label="Para"
            min={1}
            max={30}
            value={para}
            onChange={setPara}
            disabled={pending}
            placeholder="1–30"
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending || !surah || !ayah || !para}
            className={cn(
              "inline-flex items-center justify-center h-10 px-5 rounded-xl text-sm font-medium",
              "bg-ink text-background transition-all duration-150 ease-out",
              "hover:scale-[1.015] active:scale-[0.985]",
              "disabled:opacity-50 disabled:pointer-events-none"
            )}
          >
            {pending ? "Checking…" : "Verify"}
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              setFeedback(null);
              onRequestNext();
            }}
            disabled={pending}
            className={cn(
              "inline-flex items-center h-10 px-4 rounded-xl text-sm font-medium",
              "text-muted hover:text-ink transition-colors",
              "disabled:opacity-50 disabled:pointer-events-none"
            )}
          >
            Skip
          </button>
        </div>

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
      </form>
    </article>
  );
}

function NumberField({
  label,
  min,
  max,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  min: number;
  max: number;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted font-medium">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          "mt-1.5 w-full h-11 rounded-xl border border-line bg-background px-3",
          "text-sm font-mono tabular-nums",
          "focus:border-ink focus:outline-none transition-colors",
          "disabled:opacity-50"
        )}
      />
    </label>
  );
}