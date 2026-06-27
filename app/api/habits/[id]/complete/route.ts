// POST /api/habits/:id/complete
//
// Body: { completedItemKeys: string[] }
//
// Server-authoritative: the request body MUST NOT include a `dayKey` or `now`.
// The server computes "today" in the user's timezone and applies the
// completion atomically, then re-evaluates the streak and grants any newly
// crossed reward thresholds.
//
// Returns: CompletionResult { dayKey, completedItemKeys, streak, newRewards }
//
// Errors:
//   - 401 if no session
//   - 403 if the user doesn't own the habit and it's not the system namaz habit
//   - 404 if the habit_def doesn't exist
//   - 400 for malformed bodies or unknown item keys
//   - 500 on database errors

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { applyCompletion } from "@/lib/streak";
import type { HabitDef } from "@/models/types";

const Body = z.object({
  completedItemKeys: z.array(z.string().min(1).max(64)).max(64),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

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

  const db = await getDb();

  // Load the habit def to verify ownership and item keys.
  const habit = await db
    .collection<HabitDef>("habit_defs")
    .findOne({ _id: id, archivedAt: null } as never);

  if (!habit) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }
  if (habit.ownerId !== null && habit.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate that every submitted key is a known item.
  const validKeys = new Set(habit.items.map((i) => i.key));
  for (const k of body.completedItemKeys) {
    if (!validKeys.has(k)) {
      return NextResponse.json(
        { error: `Unknown item key: ${k}` },
        { status: 400 }
      );
    }
  }

  // De-dupe and trim — never trust the client for shape.
  const cleaned = Array.from(new Set(body.completedItemKeys));

  const userTz =
    (session.user as { timezone?: string }).timezone || "UTC";

  try {
    const result = await applyCompletion({
      userId: session.user.id,
      habitDefId: id,
      timezone: userTz,
      completedItemKeys: cleaned,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/habits/:id/complete] failed:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}