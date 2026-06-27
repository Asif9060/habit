import { getDb } from "@/lib/db";
import type { Reward } from "@/models/types";
import { RewardsEditor } from "./rewards-editor";

export default async function AdminRewardsPage() {
  const db = await getDb();
  const rewards = await db
    .collection<Reward>("rewards")
    .find({ archivedAt: null })
    .sort({ "rule.thresholdDays": 1 })
    .toArray();

  return (
    <div>
      <h1 className="text-3xl md:text-4xl tracking-tight font-semibold">
        Rewards
      </h1>
      <p className="mt-3 text-muted max-w-[58ch]">
        Define streak milestones. When a user&rsquo;s current streak crosses a
        threshold, the reward is granted on their next completion.
      </p>

      <div className="mt-10">
        <RewardsEditor
          initial={rewards.map((r) => ({
            id: r._id,
            slug: r.slug,
            name: r.name,
            description: r.description,
            iconKey: r.iconKey,
            thresholdDays: r.rule.thresholdDays,
          }))}
        />
      </div>
    </div>
  );
}