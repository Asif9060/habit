// POST /api/habits — create a private habit for the current user.
// DELETE handled in [id]/route.ts (soft archive).

import { NextResponse } from "next/server";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { HabitDef } from "@/models/types";

const Body = z.object({
  name: z.string().min(1).max(80).trim(),
  // Optional per-item labels. Defaults to a single item named after the habit.
  items: z
    .array(z.object({ key: z.string().min(1).max(40), label: z.string().min(1).max(40) }))
    .min(1)
    .max(20)
    .optional(),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

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

  const items = body.items ?? [
    { key: "default", label: body.name },
  ];

  const db = await getDb();

  // Ensure unique (ownerId, key) — append a short suffix if it collides.
  let baseKey = slugify(body.name);
  if (!baseKey) baseKey = "habit";
  let key = baseKey;
  let attempt = 0;
  while (
    await db.collection("habit_defs").findOne({ ownerId: session.user.id, key })
  ) {
    attempt += 1;
    key = `${baseKey}-${attempt}`;
    if (attempt > 50) {
      return NextResponse.json(
        { error: "Couldn't allocate a unique slug. Try a different name." },
        { status: 409 }
      );
    }
  }

  const now = new Date();
  const id = new ObjectId().toHexString();

  await db.collection<HabitDef>("habit_defs").insertOne({
    _id: id,
    key,
    name: body.name,
    ownerId: session.user.id,
    type: "user",
    schedule: "daily",
    items: items.map((it, idx) => ({ ...it, order: idx })),
    createdAt: now,
    archivedAt: null,
  });

  return NextResponse.json({ id, key }, { status: 201 });
}