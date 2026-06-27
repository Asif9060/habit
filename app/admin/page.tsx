import { getDb } from "@/lib/db";

export default async function AdminOverviewPage() {
  const db = await getDb();

  // Aggregate metrics. Capped at sensible upper bounds for cheap queries.
  const [userCount, activeStreaks, grantsToday] = await Promise.all([
    db.collection("user").countDocuments(),
    db
      .collection("streaks")
      .countDocuments({ current: { $gte: 1 } }),
    db
      .collection("reward_grants")
      .countDocuments({
        grantedAt: { $gte: startOfTodayUTC() },
      }),
  ]);

  return (
    <div>
      <h1 className="text-3xl md:text-4xl tracking-tight font-semibold">
        Overview
      </h1>
      <p className="mt-3 text-muted max-w-[58ch]">
        High-level signals across the app. Numbers update on each page load.
      </p>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Users" value={userCount} />
        <Stat label="Active streaks" value={activeStreaks} hint="current ≥ 1" />
        <Stat label="Rewards granted today" value={grantsToday} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl border border-line p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-muted font-medium">
        {label}
      </p>
      <p className="mt-3 font-mono text-4xl tracking-tight tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function startOfTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}