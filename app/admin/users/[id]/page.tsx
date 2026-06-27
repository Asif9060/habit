import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArrowRightIcon } from "@/components/icons";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type {
  AppUser,
  HabitDef,
  Reward,
  RewardGrant,
  Streak,
} from "@/models/types";
import { UserRowActions } from "../user-row-actions";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  const meId = session?.user.id;

  const db = await getDb();
  const rawUser = await db
    .collection<AppUser>("user")
    .findOne({ _id: id } as never);

  if (!rawUser) notFound();
  const user: AppUser = { ...rawUser, _id: rawUser._id?.toString() ?? id };

  const [streaks, recentLogs, grants] = await Promise.all([
    db.collection<Streak>("streaks").find({ userId: id }).toArray(),
    db
      .collection("habit_logs")
      .find({ userId: id })
      .sort({ dayKey: -1 })
      .limit(30)
      .toArray(),
    db
      .collection<RewardGrant>("reward_grants")
      .find({ userId: id })
      .sort({ grantedAt: -1 })
      .limit(20)
      .toArray(),
  ]);

  // Enrich streaks + grants with habit / reward names for display.
  const habitById = new Map<string, HabitDef>();
  for (const s of streaks) {
    if (!habitById.has(s.habitDefId)) {
      const h = await db
        .collection<HabitDef>("habit_defs")
        .findOne({ _id: s.habitDefId } as never);
      if (h) habitById.set(s.habitDefId, h);
    }
  }
  const rewardById = new Map<string, Reward>();
  for (const g of grants) {
    if (!rewardById.has(g.rewardId)) {
      const r = await db
        .collection<Reward>("rewards")
        .findOne({ _id: g.rewardId } as never);
      if (r) rewardById.set(g.rewardId, r);
    }
  }

  return (
    <div>
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted hover:text-ink transition-colors"
      >
        <span className="rotate-180 inline-flex">
          <ArrowRightIcon size={12} strokeWidth={2.5} />
        </span>
        All users
      </Link>

      <header className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <h1 className="text-3xl md:text-4xl tracking-tight font-semibold">
          {user.name}
        </h1>
        <span
          className={
            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.18em] font-mono " +
            (user.role === "admin"
              ? "bg-brand text-white"
              : "bg-line/50 text-muted")
          }
        >
          {user.role ?? "user"}
        </span>
      </header>
      <p className="mt-2 text-muted">{user.email}</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted font-mono">
          {user.timezone || "UTC"}
        </span>
        <span className="text-xs text-muted">·</span>
        <span className="text-xs text-muted">
          joined{" "}
          {new Date(user.createdAt).toLocaleDateString("en-CA", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
        <span className="ml-auto">
          <UserRowActions id={user._id} role={user.role} isSelf={user._id === meId} />
        </span>
      </div>

      <section className="mt-12">
        <h2 className="text-base font-semibold tracking-tight mb-4">
          Streaks
        </h2>
        {streaks.length === 0 ? (
          <p className="text-sm text-muted">No streaks yet.</p>
        ) : (
          <div className="rounded-2xl border border-line overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface/60 text-xs uppercase tracking-[0.16em] text-muted">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Habit</th>
                  <th className="text-right font-medium px-4 py-3">Current</th>
                  <th className="text-right font-medium px-4 py-3">Longest</th>
                  <th className="text-right font-medium px-4 py-3">Last full day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {streaks.map((s) => {
                  const h = habitById.get(s.habitDefId);
                  return (
                    <tr key={s.habitDefId}>
                      <td className="px-4 py-3 font-medium">
                        {h?.name ?? s.habitDefId.slice(0, 12) + "…"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {s.current}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {s.longest}
                      </td>
                      <td className="px-4 py-3 text-right text-muted font-mono text-xs">
                        {s.lastCompletedDayKey ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-base font-semibold tracking-tight mb-4">
          Granted rewards
        </h2>
        {grants.length === 0 ? (
          <p className="text-sm text-muted">No rewards granted yet.</p>
        ) : (
          <ul className="divide-y divide-line border border-line rounded-2xl overflow-hidden">
            {grants.map((g) => {
              const r = rewardById.get(g.rewardId);
              return (
                <li
                  key={g._id}
                  className="px-5 py-3.5 flex items-baseline gap-4 bg-surface/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold tracking-tight">
                      {r?.name ?? "Unknown reward"}
                    </p>
                    <p className="text-xs text-muted mt-0.5">{r?.description}</p>
                  </div>
                  <span className="text-xs font-mono text-muted tabular-nums">
                    streak {g.streakAtGrant}
                  </span>
                  <span className="text-xs text-muted font-mono">
                    {new Date(g.grantedAt).toLocaleDateString("en-CA")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-base font-semibold tracking-tight mb-4">
          Recent activity
        </h2>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-muted">No habit completions yet.</p>
        ) : (
          <ul className="divide-y divide-line border border-line rounded-2xl overflow-hidden">
            {recentLogs.map((log) => {
              const h = habitById.get(log.habitDefId);
              return (
                <li
                  key={log._id?.toString() ?? log.dayKey}
                  className="px-5 py-3 flex items-baseline gap-4 bg-surface/30"
                >
                  <span className="font-mono text-xs text-muted w-24 tabular-nums">
                    {log.dayKey}
                  </span>
                  <span className="text-sm font-medium flex-1 min-w-0 truncate">
                    {h?.name ?? log.habitDefId.slice(0, 12) + "…"}
                  </span>
                  <span className="text-xs text-muted font-mono tabular-nums">
                    {(log.completedItemKeys ?? []).length}/{h?.items.length ?? "?"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}