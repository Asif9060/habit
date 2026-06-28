// Server entry for the Discipline page.
//
// Loads initial data:
//   - the user's current chance balance
//   - the missed days (last 30) for the system Namaz habit, plus any private
//     habits owned by the user
//   - the canonical Namaz habit's items (used in the retro-mark form)
//   - the first unseen ayat (so the page renders something useful on first
//     paint without a client-side fetch)
//
// Auth/DB pages must not be statically prerendered (PUKU.md).

import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dayKeyFor } from "@/lib/dayKey";
import { getBalance, pickUnseenAyat } from "@/lib/discipline";
import { ensureFirstAdmin } from "@/lib/first-admin";
import { NAMAZ_HABIT_KEY } from "@/lib/seed";
import type { HabitDef } from "@/models/types";
import { DisciplinePageClient } from "./discipline-page-client";

export const dynamic = "force-dynamic";

export default async function DisciplinePage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null; // layout already redirects; appeases TS.

  await ensureFirstAdmin(session.user.id);

  const userTz =
    (session.user as { timezone?: string }).timezone || "UTC";
  const today = dayKeyFor(new Date(), userTz);
  const userId = session.user.id;

  const db = await getDb();

  // Resolve habit defs the user can bridge. Today we only support
  // retro-marking on the system Namaz habit (the canonical five daily
  // prayers), but the design supports more — we expose only the namaz
  // habit for v1 to keep the UI focused.
  const namaz = await db
    .collection<HabitDef>("habit_defs")
    .findOne({ key: NAMAZ_HABIT_KEY, ownerId: null, archivedAt: null } as never);

  // First render: pull initial balance + first unseen ayat. We use
  // Promise.allSettled so a 409 on the ayat (e.g. user has seen everything)
  // doesn't kill the balance render too.
  const [balanceResult, ayatResult, missedResult] = await Promise.allSettled([
    getBalance(userId),
    pickUnseenAyat(userId),
    namaz
      ? db
          .collection("habit_logs")
          .find(
            {
              userId,
              habitDefId: namaz._id,
              dayKey: {
                $gte: thirtyDaysAgo(today),
                $lt: today,
              },
            },
            { projection: { dayKey: 1 } }
          )
          .toArray()
      : Promise.resolve([]),
  ]);

  const initialBalance =
    balanceResult.status === "fulfilled"
      ? {
          current: balanceResult.value.balance,
          lifetimeEarned: balanceResult.value.lifetimeEarned,
        }
      : { current: 0, lifetimeEarned: 0 };

  // If pickUnseenAyat failed (e.g. seen every ayah), surface the empty
  // state — the client will retry on demand.
  const initialAyat =
    ayatResult.status === "fulfilled"
      ? {
          ayatId: ayatResult.value.ayat.ayatId,
          surahNumber: ayatResult.value.ayat.surahNumber,
          ayahNumber: ayatResult.value.ayat.ayahNumber,
          paraNumber: ayatResult.value.ayat.paraNumber,
          surahName: ayatResult.value.ayat.surahName,
          arabicText: ayatResult.value.ayat.arabicText,
          englishTranslation: ayatResult.value.ayat.englishTranslation,
          bengaliTranslation: ayatResult.value.ayat.bengaliTranslation,
        }
      : null;

  const loggedDays = new Set<string>();
  if (missedResult.status === "fulfilled") {
    for (const r of missedResult.value) loggedDays.add(r.dayKey);
  }

  // Build the missed-days list = [thirtyDaysAgo+1 .. yesterday] \ loggedDays.
  const candidates = dayKeysBetween(thirtyDaysAgo(today), today);
  const missedDays: { dayKey: string }[] = candidates
    .filter((d) => !loggedDays.has(d))
    .map((d) => ({ dayKey: d }))
    .reverse(); // most recent first

  return (
    <DisciplinePageClient
      today={today}
      namaz={
        namaz
          ? {
              habitDefId: namaz._id,
              name: namaz.name,
              items: [...namaz.items].sort((a, b) => a.order - b.order),
            }
          : null
      }
      initialBalance={initialBalance}
      initialAyat={initialAyat}
      initialMissedDays={missedDays}
    />
  );
}

// ─── pure date helpers (server-only) ────────────────────────────────────────

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Format the day key 30 days before `todayKey`. Pure math, same noon-UTC
 * trick as `previousDayKey` in lib/dayKey.ts to dodge DST edge cases.
 */
function thirtyDaysAgo(todayKey: string): string {
  const [y, m, d] = todayKey.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d, 12) - 30 * 24 * 60 * 60 * 1000;
  const dt = new Date(utc);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Build the inclusive list of day keys from `fromKey` (exclusive) up to `toKey` (exclusive). */
function dayKeysBetween(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const cursor = new Date(Date.UTC(fy, fm - 1, fd, 12));
  const [ty, tm, td] = toKey.split("-").map(Number);
  const end = Date.UTC(ty, tm - 1, td, 12);
  while (cursor.getTime() < end) {
    out.push(
      `${cursor.getUTCFullYear()}-${pad(cursor.getUTCMonth() + 1)}-${pad(
        cursor.getUTCDate()
      )}`
    );
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}