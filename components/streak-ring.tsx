"use client";

import { useEffect, useRef, useState } from "react";

// Streak ring — animated.
//
// - The conic-gradient fill smoothly tweens between degrees as `current` changes.
// - The center number counts up/down over ~400ms when it changes.
// - The longest callout fades in on first paint.

const VISIBLE_CAP = 30;
const DURATION_MS = 420;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function useAnimatedNumber(target: number, durationMs = DURATION_MS): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // First render: snap to target without animating.
    if (fromRef.current === target) return;
    fromRef.current = display;
    startRef.current = null;

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(t);
      const next = Math.round(
        fromRef.current + (target - fromRef.current) * eased
      );
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return display;
}

function useAnimatedDegrees(current: number, durationMs = DURATION_MS): number {
  const [degrees, setDegrees] = useState(() =>
    Math.round((Math.min(1, current / VISIBLE_CAP)) * 360)
  );
  const fromRef = useRef(degrees);
  const targetRef = useRef(degrees);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const target = Math.round((Math.min(1, current / VISIBLE_CAP)) * 360);
    if (target === targetRef.current) return;
    targetRef.current = target;
    startRef.current = null;

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(t);
      const next = fromRef.current + (target - fromRef.current) * eased;
      setDegrees(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        setDegrees(target);
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [current, durationMs]);

  return degrees;
}

export function StreakRing({
  current,
  longest,
  size = 168,
  caption = "day streak",
}: {
  current: number;
  longest: number;
  size?: number;
  caption?: string;
}) {
  const displayCurrent = useAnimatedNumber(current);
  const displayLongest = useAnimatedNumber(longest);
  const degrees = useAnimatedDegrees(current);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded-full transition-[background] duration-300"
        style={{
          background:
            degrees === 0
              ? "transparent"
              : `conic-gradient(var(--brand) ${degrees}deg, var(--line) ${degrees}deg 360deg)`,
        }}
      />
      {/* Inner cutout for the ring effect. */}
      <div
        className="absolute rounded-full bg-background border border-line"
        style={{
          inset: 8,
        }}
      />
      <div className="relative flex flex-col items-center">
        <span
          className="font-mono text-4xl tracking-tight tabular-nums text-ink"
          // Re-keying on the final value lets CSS transitions kick in if any
          // future styling changes per-number; today it stays a tabular span.
          key={current}
        >
          {displayCurrent}
        </span>
        <span className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted">
          {caption}
        </span>
      </div>

      <div className="absolute -bottom-7 left-0 right-0 text-center text-[10px] font-mono text-muted">
        longest {displayLongest}
      </div>
    </div>
  );
}