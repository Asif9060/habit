// GET /api/discipline/missed-days?habitDefId=<id>
//
// Returns the list of day keys in the last 30 days (in the user's timezone)
// where the user has NO habit_log row for the given habit. Used by the
// discipline page to render the missed-days calendar.
//
// Auth: required.

import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dayKeyFor, previousDayKey, type DayKey } from "@/lib/dayKey";
import type { HabitDef } from "@/models/types";

export const dynamic = "force-dynamic";

const LOOKBACK_DAYS = 30;

export async function GET(req: Request) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const habitDefId = url.searchParams.get("habitDefId");
  if (!habitDefId) {
    return NextResponse.json(
      { error: "habitDefId is required" },
      { status: 400 }
    );
  }

  const userTz =
    (session.user as { timezone?: string }).timezone || "UTC";
  const today = dayKeyFor(new Date(), userTz);

  const db = await getDb();

  // Verify the habit exists and the user can see it (system namaz OR owned).
  const habit = await db
    .collection<HabitDef>("habit_defs")
    .findOne({ _id: habitDefId, archivedAt: null } as never);
  if (!habit) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }
  if (habit.ownerId !== null && habit.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Build the candidate window: last 30 days, EXCLUDING today (you can't
  // bridge a day you haven't finished yet).
  const candidates: DayKey[] = [];
  let cursor = today;
  for (let i = 0; i < LOOKBACK_DAYS; i++) {
    cursor = previousDayKey(cursor);
    candidates.push(cursor);
  }

  // Find which of those candidates already have a log row.
  const existing = await db
    .collection("habit_logs")
    .find(
      { userId: session.user.id, habitDefId, dayKey: { $in: candidates } },
      { projection: { dayKey: 1 } }
    )
    .toArray();
  const loggedSet = new Set(existing.map((r) => r.dayKey));

  // Preserve descending (most-recent first) for the UI.
  const missed = candidates.filter((d) => !loggedSet.has(d));

  return NextResponse.json({
    today,
    missedDays: missed,
    lookbackDays: LOOKBACK_DAYS,
  });
}