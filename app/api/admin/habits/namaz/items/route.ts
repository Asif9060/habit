// PATCH /api/admin/habits/namaz/items
//
// Admin-only. Updates the items array of the system Namaz habit_def.
// Keys are preserved (so existing logs still resolve) but labels and orders
// can change.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { NAMAZ_HABIT_KEY } from "@/lib/seed";

const Body = z.object({
  items: z
    .array(
      z.object({
        key: z.string().min(1).max(40),
        label: z.string().min(1).max(40),
        order: z.number().int().min(0).max(50),
      })
    )
    .min(1)
    .max(20),
});

export async function PATCH(req: Request) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  const result = await db
    .collection("habit_defs")
    .updateOne(
      { key: NAMAZ_HABIT_KEY, ownerId: null } as never,
      { $set: { items: body.items } }
    );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Namaz habit not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}