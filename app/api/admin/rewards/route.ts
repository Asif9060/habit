// POST /api/admin/rewards — create a new reward rule.
// Admin-only. See app/admin/rewards/[id]/route.ts for archive.

import { NextResponse } from "next/server";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";

const Body = z.object({
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, "lowercase letters, digits, hyphens only"),
  name: z.string().min(1).max(80),
  description: z.string().max(200).default(""),
  iconKey: z.string().min(1).max(40),
  thresholdDays: z.number().int().min(1).max(3650),
});

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

  const db = await getDb();
  const id = new ObjectId().toHexString();

  try {
    await db.collection("rewards").insertOne({
      _id: id,
      slug: body.slug,
      name: body.name,
      description: body.description,
      iconKey: body.iconKey,
      rule: {
        type: "streak",
        habitDefKey: "namaz",
        thresholdDays: body.thresholdDays,
      },
      createdBy: session.user.id,
      createdAt: new Date(),
      archivedAt: null,
    } as never);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: number }).code === 11000) {
      return NextResponse.json(
        { error: `Slug "${body.slug}" already exists.` },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json(
    {
      id,
      slug: body.slug,
      name: body.name,
      description: body.description,
      iconKey: body.iconKey,
      thresholdDays: body.thresholdDays,
    },
    { status: 201 }
  );
}