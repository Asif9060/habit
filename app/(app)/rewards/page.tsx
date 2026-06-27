import { headers } from "next/headers";
import {
  MedalIcon,
  TrophyIcon,
  CrownIcon,
  SparkleIcon,
} from "@/components/icons";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { readStreak } from "@/lib/streak";
import type { HabitDef, Reward, RewardGrant } from "@/models/types";
import { NAMAZ_HABIT_KEY } from "@/lib/seed";

// Map iconKey → component. Keeps the DB schema simple (string key).
function iconFor(key: string) {
  switch (key) {
    case "medal":
      return MedalIcon;
    case "trophy":
      return TrophyIcon;
    case "crown":
      return CrownIcon;
    default:
      return SparkleIcon;
  }
}

export default async function RewardsPage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const db = await getDb();

  // All reward definitions + the user's grants.
  const [rewards, grants] = await Promise.all([
    db
      .collection<Reward>("rewards")
      .find({ archivedAt: null })
      .sort({ "rule.thresholdDays": 1 })
      .toArray(),
    db
      .collection<RewardGrant>("reward_grants")
      .find({ userId: session.user.id })
      .toArray(),
  ]);

  // Find the Namaz habit to read the user's current streak length.
  const namaz = await db
    .collection<HabitDef>("habit_defs")
    .findOne({ key: NAMAZ_HABIT_KEY, ownerId: null });

  const streak = namaz
    ? await readStreak(session.user.id, namaz._id)
    : { current: 0, longest: 0, lastCompletedDayKey: null };

  const grantsByReward = new Map<string, RewardGrant[]>();
  for (const g of grants) {
    const list = grantsByReward.get(g.rewardId) ?? [];
    list.push(g);
    grantsByReward.set(g.rewardId, list);
  }

  return (
    <div className="max-w-4xl">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted font-medium">
          Rewards
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl tracking-tight font-semibold">
          What consistency is worth here.
        </h1>
        <p className="mt-3 text-muted max-w-[58ch]">
          Each reward is tied to a streak length on the five daily prayers.
          Reach the threshold, and the badge is yours — kept forever in your
          account.
        </p>
        <div className="mt-6 inline-flex items-center gap-4 px-4 py-2.5 rounded-2xl border border-line bg-surface/50">
          <span className="text-xs uppercase tracking-[0.18em] text-muted">
            Current streak
          </span>
          <span className="font-mono text-xl tabular-nums">{streak.current}</span>
          <span className="text-xs text-muted">days</span>
        </div>
      </header>

      {rewards.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rewards.map((r) => {
            const earned = grantsByReward.get(r._id) ?? [];
            const earnedCount = earned.length;
            const Icon = iconFor(r.iconKey);
            const threshold = r.rule.thresholdDays;
            const isEarned = earnedCount > 0;
            const progress = Math.min(1, streak.current / threshold);

            return (
              <article
                key={r._id}
                className={
                  "rounded-3xl border p-6 transition-colors " +
                  (isEarned
                    ? "border-accent/40 bg-accent-soft/30"
                    : "border-line bg-surface/40")
                }
              >
                <div className="flex items-start gap-4">
                  <div
                    className={
                      "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 " +
                      (isEarned
                        ? "bg-accent text-ink"
                        : "bg-line/50 text-muted")
                    }
                  >
                    <Icon size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold tracking-tight">
                      {r.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted leading-relaxed">
                      {r.description}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-muted font-mono">
                      {threshold}-day streak
                    </span>
                    {earnedCount > 1 && (
                      <span className="text-xs text-accent font-medium font-mono">
                        earned ×{earnedCount}
                      </span>
                    )}
                  </div>
                  {!isEarned ? (
                    <div className="h-1.5 rounded-full bg-line overflow-hidden">
                      <div
                        className="h-full bg-brand transition-[width] duration-500"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-success font-medium">
                      Earned{" "}
                      {earned[0]
                        ? new Date(earned[0].grantedAt).toLocaleDateString()
                        : ""}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-line py-14 px-8 text-center">
      <p className="text-sm font-medium text-ink">No rewards configured yet.</p>
      <p className="mt-2 text-sm text-muted max-w-[42ch] mx-auto">
        An admin needs to publish reward rules before they appear here.
      </p>
    </div>
  );
}