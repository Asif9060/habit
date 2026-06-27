import Link from "next/link";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { AppUser } from "@/models/types";
import { UserRowActions } from "./user-row-actions";

export default async function AdminUsersPage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  const meId = session?.user.id;

  const db = await getDb();

  const rawUsers = await db
    .collection<AppUser>("user")
    .find(
      {},
      {
        projection: {
          _id: 1,
          email: 1,
          name: 1,
          role: 1,
          timezone: 1,
          createdAt: 1,
        },
      }
    )
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  // Normalize _id to string. The driver returns ObjectId; the AppUser type
  // declares string. Keep it consistent with how we read _id everywhere else.
  const users = rawUsers.map((u) => ({
    ...u,
    _id: (u._id as unknown as { toString(): string })?.toString() ?? "",
  }));

  const streaks = await db
    .collection("streaks")
    .find({})
    .toArray();

  const longestByUser = new Map<string, number>();
  for (const s of streaks) {
    const cur = longestByUser.get(s.userId) ?? 0;
    if (s.longest > cur) longestByUser.set(s.userId, s.longest);
  }

  return (
    <div>
      <h1 className="text-3xl md:text-4xl tracking-tight font-semibold">
        Users
      </h1>
      <p className="mt-3 text-muted max-w-[58ch]">
        The most recent 200 accounts. Promote or demote roles inline; click a
        user&rsquo;s row to view their streaks and granted rewards.
      </p>

      <div className="mt-10 rounded-2xl border border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-xs uppercase tracking-[0.16em] text-muted">
            <tr>
              <th className="text-left font-medium px-4 py-3">Name</th>
              <th className="text-left font-medium px-4 py-3">Email</th>
              <th className="text-left font-medium px-4 py-3">Role</th>
              <th className="text-left font-medium px-4 py-3">Timezone</th>
              <th className="text-right font-medium px-4 py-3">Longest streak</th>
              <th className="text-right font-medium px-4 py-3 w-44">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No users yet.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u._id}>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/admin/users/${u._id}`}
                      className="hover:underline underline-offset-4"
                    >
                      {u.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.18em] font-mono " +
                        (u.role === "admin"
                          ? "bg-brand text-white"
                          : "bg-line/50 text-muted")
                      }
                    >
                      {u.role ?? "user"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted font-mono text-xs">
                    {u.timezone || "UTC"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {longestByUser.get(u._id) ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/users/${u._id}`}
                        className="inline-flex items-center h-7 px-3 rounded-full text-xs text-muted hover:text-ink hover:bg-line/40 transition-colors"
                      >
                        View
                      </Link>
                      <UserRowActions
                        id={u._id}
                        role={u.role}
                        isSelf={u._id === meId}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}