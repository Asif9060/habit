// PATCH /api/admin/habits/:id   — edit a habit's name and/or items.
// DELETE /api/admin/habits/:id  — soft-archive any habit (system or user).
//
// Admin-only. Used by the per-row actions on /admin/habits.
//
// PATCH body: { name?: string, items?: [{ key, label, order }] }
//   - `items` replaces the array entirely. Keys are preserved so existing
//     habit_logs keep resolving; the admin can change labels and order.
// DELETE: no body; sets archivedAt = now().

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";

const PatchBody = z.object({
  name: z.string().min(1).max(80).trim().optional(),
  items: z
    .array(
      z.object({
        key: z.string().min(1).max(40),
        label: z.string().min(1).max(40),
        order: z.number().int().min(0).max(50),
      })
    )
    .min(1)
    .max(20)
    .optional(),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", detail: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  if (!body.name && !body.items) {
    return NextResponse.json(
      { error: "Provide at least `name` or `items`." },
      { status: 400 }
    );
  }

  const set: Record<string, unknown> = {};
  if (body.name) set.name = body.name;
  if (body.items) set.items = body.items;

  const db = await getDb();
  const result = await db
    .collection("habit_defs")
    .updateOne({ _id: id } as never, { $set: set });

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

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
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();
  const result = await db
    .collection("habit_defs")
    .updateOne(
      { _id: id } as never,
      { $set: { archivedAt: new Date() } }
    );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}