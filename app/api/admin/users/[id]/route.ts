// PATCH /api/admin/users/:id
//
// Admin-only. Updates a user's role or banned status. Body fields are all
// optional; provide at least one.
//
//   { role?: "user" | "admin", banned?: boolean }
//
// The current admin cannot demote or ban themselves — prevents the
// self-lockout footgun.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";

const Body = z.object({
  role: z.enum(["user", "admin"]).optional(),
  banned: z.boolean().optional(),
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

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", detail: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  if (!body.role && body.banned === undefined) {
    return NextResponse.json(
      { error: "Provide at least `role` or `banned`." },
      { status: 400 }
    );
  }

  // Self-protection: don't let the acting admin demote or ban themselves.
  if ((body.role === "user" || body.banned === true) && session.user.id === id) {
    return NextResponse.json(
      { error: "You can't demote or ban yourself." },
      { status: 400 }
    );
  }

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (body.role !== undefined) set.role = body.role;
  if (body.banned !== undefined) set.banned = body.banned;

  const db = await getDb();
  const result = await db
    .collection("user")
    .updateOne({ _id: id } as never, { $set: set });

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}