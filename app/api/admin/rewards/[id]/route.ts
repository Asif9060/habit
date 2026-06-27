// PATCH  /api/admin/rewards/:id — edit a reward rule's name, description, icon,
//                                or threshold. Slug and habitDefKey are
//                                immutable post-create (they would orphan
//                                existing reward_grants lookups).
// DELETE /api/admin/rewards/:id — soft-archive a reward rule.
// Admin-only.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";

const PatchBody = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(200).optional(),
  iconKey: z.string().min(1).max(40).optional(),
  thresholdDays: z.number().int().min(1).max(3650).optional(),
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

  if (!body.name && !body.description && !body.iconKey && !body.thresholdDays) {
    return NextResponse.json(
      { error: "Provide at least one of name, description, iconKey, thresholdDays." },
      { status: 400 }
    );
  }

  const set: Record<string, unknown> = {};
  if (body.name !== undefined) set.name = body.name;
  if (body.description !== undefined) set.description = body.description;
  if (body.iconKey !== undefined) set.iconKey = body.iconKey;
  if (body.thresholdDays !== undefined) {
    set["rule.thresholdDays"] = body.thresholdDays;
  }

  const db = await getDb();
  const result = await db
    .collection("rewards")
    .updateOne({ _id: id } as never, { $set: set });

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Reward not found" }, { status: 404 });
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
    .collection("rewards")
    .updateOne({ _id: id } as never, { $set: { archivedAt: new Date() } });

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Reward not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}