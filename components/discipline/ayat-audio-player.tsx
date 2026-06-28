"use client";

import { useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon, SpeakerIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Inline audio player for a single Quran ayah recitation.
 *
 * Audio source: everyayah.com, Alafasy 128kbps MP3 stream. CORS is open
 * (`Access-Control-Allow-Origin: *`) so the browser can play it directly
 * without a server proxy. The CDN cache is ~296 days, so repeat plays
 * are essentially free.
 *
 * URL pattern: https://everyayah.com/data/Alafasy_128kbps/{SSS AAA}.mp3
 *   - SSS = 3-digit zero-padded surah number
 *   - AAA = 3-digit zero-padded ayah number
 *
 * Lifecycle: the parent should `key={surahNumber:ayahNumber}` this
 * component when the ayah changes, so React fully remounts it and the
 * `<audio>` element is recreated from scratch. That avoids all
 * "reset state when source changes" effects and keeps the React 19
 * lint rules happy.
 *
 * Attribution: Sheikh Mishary Alafasy's recitation, served by everyayah.com.
 * The recitation itself is not bundled with the app.
 */
export function AyatAudioPlayer({
  surahNumber,
  ayahNumber,
}: {
  surahNumber: number;
  ayahNumber: number;
}) {
  const src = buildAudioUrl(surahNumber, ayahNumber);

  // The audio element is created lazily inside `toggle()` on first play.
  // We only mutate this ref inside `toggle()` — no effect reads it,
  // so the React immutability rule is satisfied.
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pause and release on unmount only. The "ayah changed" case is
  // handled by remounting (key={src}) — see component docs.
  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.src = "";
      }
    };
  }, []);

  async function toggle() {
    if (error) setError(null);

    // Guard: if the caller passed invalid numbers, refuse to fire a
    // bad request. Surfaces a clear error instead of `NaNNaN.mp3`.
    if (
      !Number.isFinite(surahNumber) ||
      !Number.isFinite(ayahNumber) ||
      surahNumber < 1 ||
      surahNumber > 114 ||
      ayahNumber < 1 ||
      ayahNumber > 286
    ) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[AyatAudioPlayer] invalid surah/ayah", {
          surahNumber,
          ayahNumber,
          src,
        });
      }
      setError("This ayat is missing audio metadata. Skipping.");
      return;
    }

    // Lazily create the audio element on first play. The `key` on the
    // parent guarantees a fresh mount per ayah, so we don't need to
    // reconcile src here.
    let a = audioRef.current;
    if (!a) {
      a = new Audio(src);
      a.preload = "none";
      a.crossOrigin = "anonymous";
      a.addEventListener("play", () => setPlaying(true));
      a.addEventListener("pause", () => setPlaying(false));
      a.addEventListener("ended", () => setPlaying(false));
      a.addEventListener("waiting", () => setLoading(true));
      a.addEventListener("canplay", () => setLoading(false));
      a.addEventListener("error", () => {
        setPlaying(false);
        setLoading(false);
        setError("Couldn't load the recitation. Check your connection.");
      });
      audioRef.current = a;
    }

    if (a.paused) {
      try {
        setLoading(true);
        await a.play();
      } catch (err) {
        setLoading(false);
        setError(
          err instanceof Error ? err.message : "Couldn't start playback."
        );
      }
    } else {
      a.pause();
    }
  }

  const Icon = playing ? PauseIcon : PlayIcon;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause recitation" : "Play recitation"}
        aria-pressed={playing}
        className={cn(
          "inline-flex items-center justify-center w-9 h-9 rounded-full",
          "border border-line bg-surface/60 transition-all duration-150 ease-out",
          "hover:scale-[1.04] hover:border-ink active:scale-[0.96]",
          "disabled:opacity-50 disabled:pointer-events-none"
        )}
      >
        <Icon size={14} />
      </button>
      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted font-mono">
        <SpeakerIcon size={12} />
        {loading ? "Loading…" : playing ? "Playing" : "Listen"}
      </span>
      {error && (
        <span className="text-[10px] text-danger ml-2" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Build the everyayah.com URL for a given (surah, ayah). Pads each to 3
 * digits. Defensive: clamps to valid ranges; callers should pass validated
 * data, but we never want a runtime crash on bad input.
 */
function buildAudioUrl(surah: number, ayah: number): string {
  const s = Math.max(1, Math.min(114, Math.floor(surah)));
  const a = Math.max(1, Math.min(286, Math.floor(ayah)));
  const sss = s.toString().padStart(3, "0");
  const aaa = a.toString().padStart(3, "0");
  return `https://everyayah.com/data/Alafasy_128kbps/${sss}${aaa}.mp3`;
}