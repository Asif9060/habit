// POST /api/discipline/retro-mark
//
// Body: { habitDefId: string, dayKey: string, completedItemKeys: string[] }
//
// Spends 1 chance and bridges the missed day. Validates:
//   1. The user is authenticated and owns the habit (or it's system namaz).
//   2. `dayKey` is strictly < today in the user's timezone.
//   3. `dayKey` is in the last 30 days (cannot bridge very-old days).
//   4. No existing log row for that day (no double-bridging).
//   5. User has >= 1 chance available.
//
// On success, returns the new streak state, any newly granted rewards (only
// if ALL items were marked), and the new balance.
//
// Auth: required.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dayKeyFor, type DayKey } from "@/lib/dayKey";
import {
  InsufficientChancesError,
  spendChanceForRetroMark,
} from "@/lib/discipline";
import {
  BridgeConflictError,
  BridgeDayInvalidError,
  bridgeMissedDayWithChance,
} from "@/lib/streak";
import type { HabitDef } from "@/models/types";

export const dynamic = "force-dynamic";

const Body = z.object({
  habitDefId: z.string().min(1),
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dayKey must be YYYY-MM-DD"),
  completedItemKeys: z.array(z.string().min(1).max(64)).min(1).max(64),
});

export async function POST(req: Request) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", detail: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  const userTz =
    (session.user as { timezone?: string }).timezone || "UTC";
  const today: DayKey = dayKeyFor(new Date(), userTz);

  if (body.dayKey >= today) {
    return NextResponse.json(
      { error: "Cannot bridge today or future days. Use the regular checklist instead." },
      { status: 400 }
    );
  }

  const db = await getDb();
  const habit = await db
    .collection<HabitDef>("habit_defs")
    .findOne({ _id: body.habitDefId, archivedAt: null } as never);
  if (!habit) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }
  if (habit.ownerId !== null && habit.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate item keys against the habit definition.
  const validKeys = new Set(habit.items.map((i) => i.key));
  for (const k of body.completedItemKeys) {
    if (!validKeys.has(k)) {
      return NextResponse.json(
        { error: `Unknown item key: ${k}` },
        { status: 400 }
      );
    }
  }

  // 1. Spend the chance FIRST. This is the user's commitment — if the
  // bridge write later fails for any reason, the user loses 1 chance.
  // We chose this order because:
  //   - the bridge is more likely to succeed than to fail
  //   - failing after the spend is preferable to charging twice on retries
  //   - the bridge failure modes are deterministic and the user can retry
  //     safely (a second spend on the same day hits BridgeConflictError,
  //     which we map to 409 — and they don't get charged again because we
  //     also check balance first).
  let spent;
  try {
    spent = await spendChanceForRetroMark(session.user.id, body.dayKey);
  } catch (err) {
    if (err instanceof InsufficientChancesError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 402 }
      );
    }
    console.error("[POST /api/discipline/retro-mark] spend failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  // 2. Apply the bridge.
  try {
    const result = await bridgeMissedDayWithChance({
      userId: session.user.id,
      habitDefId: body.habitDefId,
      timezone: userTz,
      dayKey: body.dayKey as DayKey,
      completedItemKeys: body.completedItemKeys,
    });

    return NextResponse.json({
      dayKey: body.dayKey,
      streak: result.streak,
      newRewards: result.newRewards,
      allItemsMarked: result.allItemsMarked,
      newBalance: spent.newBalance,
    });
  } catch (err) {
    if (err instanceof BridgeConflictError) {
      return NextResponse.json(
        { error: err.message, code: err.code, dayKey: err.dayKey },
        { status: 409 }
      );
    }
    if (err instanceof BridgeDayInvalidError) {
      return NextResponse.json(
        { error: err.message, code: err.code, dayKey: err.dayKey },
        { status: 400 }
      );
    }
    console.error(
      "[POST /api/discipline/retro-mark] bridge failed:",
      err
    );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}