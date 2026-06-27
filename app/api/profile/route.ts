// PATCH /api/profile — update the user's name and/or timezone.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";

const Body = z.object({
  name: z.string().min(1).max(80).trim().optional(),
  timezone: z.string().min(1).max(80).trim().optional(),
});

export async function PATCH(req: Request) {
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

  const update: Record<string, string> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.timezone !== undefined) {
    // Light validation: must be a non-empty IANA-ish string.
    if (!/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(body.timezone)) {
      return NextResponse.json(
        { error: "Timezone must be an IANA name like Asia/Karachi." },
        { status: 400 }
      );
    }
    update.timezone = body.timezone;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  const db = await getDb();
  await db.collection("user").updateOne(
    { id: session.user.id } as never,
    { $set: update }
  );

  return NextResponse.json({ ok: true });
}