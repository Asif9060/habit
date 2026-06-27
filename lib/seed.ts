// Idempotent boot seed.
//
// Runs on every cold start via `instrumentation.ts`. Uses upserts keyed by
// stable `key`/`slug` so repeated calls are no-ops after the first.
//
// Inserts:
//   1. The system `namaz` habit_def with the canonical 5 prayers.
//   2. A few default rewards: 7-day, 30-day, 100-day streak badges.
//
// Admin users can edit/delete (archive) these afterwards from the admin panel.

import { ObjectId } from "mongodb";
import { getDb, ensureIndexes } from "@/lib/db";

export const NAMAZ_HABIT_KEY = "namaz";

export const DEFAULT_NAMAZ_ITEMS = [
  { key: "fajr", label: "Fajr", order: 0 },
  { key: "dhuhr", label: "Dhuhr", order: 1 },
  { key: "asr", label: "Asr", order: 2 },
  { key: "maghrib", label: "Maghrib", order: 3 },
  { key: "isha", label: "Isha", order: 4 },
] as const;

const DEFAULT_REWARDS = [
  {
    slug: "namaz-7-day-streak",
    name: "7-Day Consistency",
    description: "Prayed all five on time for a full week.",
    iconKey: "medal",
    thresholdDays: 7,
  },
  {
    slug: "namaz-30-day-streak",
    name: "30-Day Devotion",
    description: "A full month of steadfast prayer.",
    iconKey: "trophy",
    thresholdDays: 30,
  },
  {
    slug: "namaz-100-day-streak",
    name: "Century of Salah",
    description: "One hundred consecutive days of prayer.",
    iconKey: "crown",
    thresholdDays: 100,
  },
];

export async function runSeed(): Promise<void> {
  const db = await getDb();
  await ensureIndexes();

  // 1. Namaz habit (system-owned).
  await db.collection("habit_defs").updateOne(
    { key: NAMAZ_HABIT_KEY, ownerId: null },
    {
      $set: {
        name: "Five Daily Prayers",
        type: "system",
        schedule: "daily",
        items: DEFAULT_NAMAZ_ITEMS.map((i) => ({ ...i })),
        archivedAt: null,
      },
      $setOnInsert: {
        _id: new ObjectId().toHexString(),
        key: NAMAZ_HABIT_KEY,
        ownerId: null,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  // 2. Default rewards.
  const now = new Date();
  for (const r of DEFAULT_REWARDS) {
    await db.collection("rewards").updateOne(
      { slug: r.slug },
      {
        $set: {
          name: r.name,
          description: r.description,
          iconKey: r.iconKey,
          rule: {
            type: "streak",
            habitDefKey: NAMAZ_HABIT_KEY,
            thresholdDays: r.thresholdDays,
          },
          archivedAt: null,
        },
        $setOnInsert: {
          _id: new ObjectId().toHexString(),
          slug: r.slug,
          createdBy: "system",
          createdAt: now,
        },
      },
      { upsert: true }
    );
  }
}