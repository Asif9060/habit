// Idempotent MongoDB index setup for the Discipline (chances + retro-mark)
// feature. Called from `instrumentation.ts` after `runSeed()` so the indexes
// exist on cold start.
//
// Why separate from `lib/db.ts#ensureIndexes`?
//   - Keeps the existing baseline index file untouched and avoids a single
//     ever-growing function as new features add their own collections.
//   - Each feature file owns the indexes for its own collections; the
//     instrumentation hook simply chains them.

import { getDb } from "@/lib/db";

export async function ensureDisciplineIndexes(): Promise<void> {
  const db = await getDb();

  await Promise.all([
    // One balance row per user. The unique index makes the upsert race-safe.
    db.collection("chance_balances").createIndex(
      { userId: 1 },
      { unique: true, name: "uniq_chance_balance_user" }
    ),
    // History of every chance movement, sorted newest-first when read by user.
    db.collection("chance_transactions").createIndex(
      { userId: 1, createdAt: -1 },
      { name: "idx_chance_tx_user_time" }
    ),
    // Race-safe de-dupe for "shown this user this ayat". The unique compound
    // index makes `pickUnseenAyat` safe under concurrent requests — even if
    // two requests race for the same ayahId, only one insert wins.
    db.collection("seen_ayats").createIndex(
      { userId: 1, ayatId: 1 },
      { unique: true, name: "uniq_seen_user_ayat" }
    ),
    // Helpful for "when did this user last earn/spend?" scans without a full
    // collection walk.
    db.collection("seen_ayats").createIndex(
      { userId: 1, shownAt: -1 },
      { name: "idx_seen_user_time" }
    ),
  ]);
}