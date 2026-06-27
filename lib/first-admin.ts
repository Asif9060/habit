// First-user-admin promotion.
//
// When the very first user signs up, promote them to `role: "admin"` so they
// can reach the admin panel and configure rewards/habits. Subsequent users
// stay as `"user"`.
//
// Better-Auth's admin plugin doesn't auto-promote; doing it lazily on the
// first dashboard load is simpler and safer than a separate bootstrap script.
//
// Better-Auth's MongoDB adapter stores user docs with `id` as the primary key
// (not `_id`). We follow the same convention here.

import { getDb } from "@/lib/db";

export async function ensureFirstAdmin(userId: string): Promise<void> {
  const db = await getDb();
  const users = db.collection("user");

  const anyAdmin = await users.findOne({ role: "admin" });
  if (anyAdmin) return;

  await users.updateOne(
    { id: userId } as never,
    { $set: { role: "admin" } }
  );
}