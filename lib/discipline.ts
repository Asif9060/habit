// Server-only helpers for the Discipline feature.
//
// Encapsulates all chance/seen-ayat logic so route handlers stay thin.
// All functions assume an authenticated `userId` and trust no client input
// beyond what's explicitly zod-validated upstream.
//
// Concurrency model:
//   - `awardChance` uses an upsert + `$inc` on `chance_balances`; the
//     unique index on `{ userId }` makes the row creation race-safe.
//   - `spendChanceForRetroMark` does a conditional update: it only decrements
//     when the current balance is `>= 1`. This is atomic at the document
//     level in MongoDB; no read-then-write race window.
//   - `pickUnseenAyat` relies on the unique index on `seen_ayats`; two
//     concurrent requests cannot both insert the same ayatId, so the second
//     caller simply retries against the (now-stale) pool.

import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getAllAyats, pickRandomAyat, type AyatEntry } from "@/lib/quran-data";
import type { ChanceBalance, ChanceTransaction, SeenAyat } from "@/models/types";

/** Public error class so route handlers can map to specific status codes. */
export class InsufficientChancesError extends Error {
  readonly code = "insufficient_chances" as const;
  constructor() {
    super("Not enough chances to retro-mark a missed day.");
  }
}

/**
 * Returns the user's current balance. Creates a zeroed row on first call so
 * downstream code can always rely on a row existing.
 */
export async function getBalance(userId: string): Promise<ChanceBalance> {
  const db = await getDb();
  const coll = db.collection<ChanceBalance>("chance_balances");
  const existing = await coll.findOne({ userId });
  if (existing) return existing;

  // Race-safe insert: if another request just created the row, ignore the
  // duplicate-key error and re-read.
  try {
    const created: ChanceBalance = {
      _id: new ObjectId().toHexString(),
      userId,
      balance: 0,
      lifetimeEarned: 0,
      updatedAt: new Date(),
    };
    await coll.insertOne(created);
    return created;
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: number }).code === 11000
    ) {
      const nowThere = await coll.findOne({ userId });
      if (nowThere) return nowThere;
    }
    throw err;
  }
}

/**
 * Atomically add 1 chance and append a transaction row.
 *
 * Uses a single `updateOne` with `$inc` and a parallel insert into the
 * transactions ledger. If the ledger insert fails the balance increment is
 * not rolled back here — that risk is acceptable because the next reconcile
 * pass (not built yet) can detect drift via the ledger sum. The increment
 * itself is the durable source of truth for the balance.
 */
export async function awardChance(
  userId: string,
  ayatId: string
): Promise<{ balance: number; transactionId: string }> {
  const db = await getDb();
  const balances = db.collection<ChanceBalance>("chance_balances");
  const txs = db.collection<ChanceTransaction>("chance_transactions");

  // Ensure the row exists before incrementing (else $inc on a missing doc
  // creates it with just the field we set, losing userId/_id shape).
  await getBalance(userId);

  const updated = await balances.findOneAndUpdate(
    { userId },
    {
      $inc: { balance: 1, lifetimeEarned: 1 },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after" }
  );

  if (!updated) {
    throw new Error("[discipline] awardChance: balance row vanished after update");
  }

  const tx: ChanceTransaction = {
    _id: new ObjectId().toHexString(),
    userId,
    delta: 1,
    reason: "ayat_quiz",
    refId: ayatId,
    createdAt: new Date(),
  };
  await txs.insertOne(tx);

  return { balance: updated.balance, transactionId: tx._id };
}

/**
 * Atomically subtract 1 chance and append a transaction row. Throws
 * `InsufficientChancesError` if the user does not currently have >= 1 chance.
 *
 * The decrement is conditional on `balance >= 1` so two concurrent callers
 * cannot both succeed when only 1 chance is available.
 */
export async function spendChanceForRetroMark(
  userId: string,
  dayKey: string
): Promise<{ newBalance: number; transactionId: string }> {
  const db = await getDb();
  const balances = db.collection<ChanceBalance>("chance_balances");
  const txs = db.collection<ChanceTransaction>("chance_transactions");

  // Ensure the row exists before decrementing.
  await getBalance(userId);

  const updated = await balances.findOneAndUpdate(
    { userId, balance: { $gte: 1 } },
    {
      $inc: { balance: -1 },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after" }
  );

  if (!updated) {
    throw new InsufficientChancesError();
  }

  const tx: ChanceTransaction = {
    _id: new ObjectId().toHexString(),
    userId,
    delta: -1,
    reason: "retro_mark",
    refId: dayKey,
    createdAt: new Date(),
  };
  await txs.insertOne(tx);

  return { newBalance: updated.balance, transactionId: tx._id };
}

/**
 * Pick a random ayat the user has NOT been shown, then mark it as shown.
 *
 * Concurrency: even if two concurrent callers pick the same candidate from
 * the in-memory pool, only one will succeed at the `seen_ayats` insert
 * (unique index on `{ userId, ayatId }`). The loser throws E11000; we catch
 * it, retry, and the retry sees a smaller `seen` pool (because we re-fetch
 * the seen set after the partial failure). After a small bounded number of
 * retries we give up — extremely rare in practice with 6236 ayahs.
 *
 * `userId` is used as the `_id` prefix so a single user can't accumulate
 * unbounded `_id` collisions across many sessions (a fixed-length
 * composite key is more index-friendly than a fresh ObjectId per row).
 */
export async function pickUnseenAyat(
  userId: string
): Promise<{ ayat: AyatEntry; ayatId: string }> {
  const db = await getDb();
  const seen = db.collection<SeenAyat>("seen_ayats");

  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Re-fetch the seen set on each attempt — after a conflict the seen
    // pool has grown by exactly one and the next pick is more likely to
    // succeed.
    const seenRows = await seen
      .find({ userId }, { projection: { ayatId: 1 } })
      .toArray();
    const seenIds = new Set(seenRows.map((r) => r.ayatId));

    const candidate = await pickRandomAyat(seenIds);
    const doc: SeenAyat = {
      _id: `${userId}:${candidate.ayatId}`,
      userId,
      ayatId: candidate.ayatId,
      shownAt: new Date(),
    };
    try {
      await seen.insertOne(doc);
      return { ayat: candidate, ayatId: candidate.ayatId };
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: number }).code === 11000
      ) {
        // Lost the race; retry with the now-expanded seen set.
        continue;
      }
      throw err;
    }
  }
  throw new Error(
    "[discipline] pickUnseenAyat: gave up after too many concurrent collisions"
  );
}

/**
 * Convenience: load the dataset and verify a (surah, ayah, para) triple
 * matches the canonical record for the given ayatId. Returns true only when
 * all three numbers exactly match.
 *
 * Exposed for the verify endpoint, which is the only place we need this.
 */
export async function isAyatAnswerCorrect(
  ayatId: string,
  surahNumber: number,
  ayahNumber: number,
  paraNumber: number
): Promise<boolean> {
  const all = await getAllAyats();
  const target = all.find((a) => a.ayatId === ayatId);
  if (!target) return false;
  return (
    target.surahNumber === surahNumber &&
    target.ayahNumber === ayahNumber &&
    target.paraNumber === paraNumber
  );
}