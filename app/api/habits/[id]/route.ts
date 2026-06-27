// DELETE /api/habits/:id — soft-archive a user-owned habit.
// System habits (ownerId === null) cannot be deleted via this route — admins
// must use the admin endpoint to archive them.

import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: _req.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const db = await getDb();
  const habit = await db
    .collection("habit_defs")
    .findOne({ _id: id } as never);

  if (!habit) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }

  // Only the owner can delete their private habits.
  if (habit.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db
    .collection("habit_defs")
    .updateOne({ _id: id } as never, { $set: { archivedAt: new Date() } });

  return NextResponse.json({ ok: true });
}