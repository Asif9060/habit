// POST /api/admin/habits
//
// Admin-only. Creates a new SYSTEM habit (ownerId: null, type: "system").
// Used by the /admin/habits page's "Create a system habit" form.
//
// Body: { name, key?, items: [{ key, label }] }
//
// `key` is optional — if absent, the server slugifies the name. If present,
// the admin is asserting the key (e.g. "quran" or "dhikr"). Conflicts on
// (key, ownerId=null) return 409.

import { NextResponse } from "next/server";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { HabitDef } from "@/models/types";

const Body = z.object({
  name: z.string().min(1).max(80).trim(),
  key: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "key must be lowercase letters, digits, hyphens")
    .optional(),
  items: z
    .array(
      z.object({
        key: z.string().min(1).max(40),
        label: z.string().min(1).max(40),
      })
    )
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

  const items = body.items ?? [{ key: "default", label: body.name }];

  const baseKey = body.key ?? slugify(body.name);
  const key = baseKey || "habit";

  const db = await getDb();
  const existing = await db
    .collection("habit_defs")
    .findOne({ key, ownerId: null } as never);
  if (existing) {
    return NextResponse.json(
      { error: `A system habit with key "${key}" already exists.` },
      { status: 409 }
    );
  }

  const now = new Date();
  const id = new ObjectId().toHexString();

  await db.collection<HabitDef>("habit_defs").insertOne({
    _id: id,
    key,
    name: body.name,
    ownerId: null,
    type: "system",
    schedule: "daily",
    items: items.map((it, idx) => ({ ...it, order: idx })),
    createdAt: now,
    archivedAt: null,
  });

  return NextResponse.json({ id, key }, { status: 201 });
}