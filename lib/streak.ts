// Streak engine — server-authoritative.
//
// A habit "day" is bounded by the user's IANA timezone. A day only "completes"
// the streak when the day's log contains ALL of the habit's items. Once a day
// is fully complete, its contribution to the streak is permanent for that
// calendar day (in the user's tz), even if the user later un-toggles items —
// matching the project's "no undo, no grace backfill" rule.
//
// `lastCompletedDayKey` stores the day on which the user last FULLY completed
// the habit. Math rules:
//
//   - If `lastCompletedDayKey` is null → next full completion sets current = 1.
//   - If `lastCompletedDayKey` === today → no change (idempotent re-toggle).
//   - If `lastCompletedDayKey` === yesterday → current += 1 (continuation).
//   - Otherwise (gap > 1 day) → current = 1 (reset and restart).
//
// Rewards: any reward whose `rule.thresholdDays <= current` that has not yet
// been granted at this streak length is inserted as a `reward_grants` row.
// The unique index on (userId, rewardId, habitDefId, streakAtGrant) makes this
// idempotent even under concurrent requests.

import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { dayKeyFor, isYesterday, type DayKey } from "@/lib/dayKey";
import type {
  CompletionResult,
  HabitDef,
  Reward,
  RewardGrant,
  StreakState,
} from "@/models/types";

interface EvaluateParams {
  userId: string;
  habitDefId: string;
  timezone: string;
  // What the user wants the day's completion state to be.
  // The server applies this as: upsert habit_log; then re-evaluate streak.
  completedItemKeys: string[];
  // Override "now" for tests. Defaults to real wall clock.
  now?: Date;
}

/**
 * Apply a completion (or un-completion) for today, then re-evaluate the streak.
 *
 * The "no undo" rule is enforced here: we never accept a custom `dayKey` from
 * the client. `now` is determined by the server, formatted in the user's tz.
 *
 * If `completedItemKeys` is empty after the operation, the day's log row is
 * removed entirely (so re-completing later that day starts fresh). Otherwise
 * it's upserted.
 */
export async function applyCompletion({
  userId,
  habitDefId,
  timezone,
  completedItemKeys,
  now,
}: EvaluateParams): Promise<CompletionResult> {
  const db = await getDb();
  const today = dayKeyFor(now ?? new Date(), timezone);
  const completedAt = now ?? new Date();

  const logs = db.collection("habit_logs");

  if (completedItemKeys.length === 0) {
    await logs.deleteOne({ userId, habitDefId, dayKey: today });
  } else {
    await logs.updateOne(
      { userId, habitDefId, dayKey: today },
      {
        $set: {
          completedItemKeys: [...new Set(completedItemKeys)],
          completedAt,
        },
        $setOnInsert: {
          userId,
          habitDefId,
          dayKey: today,
        },
      },
      { upsert: true }
    );
  }

  // Load the habit def so we can tell whether today's log is a FULL completion.
  // Only full completions advance or reset the streak — partial days don't
  // touch it (sticky semantics).
  const habitDef = await db
    .collection<HabitDef>("habit_defs")
    .findOne({ _id: habitDefId } as never);
  const totalItems = habitDef?.items.length ?? 0;
  const isFullyCompleted =
    totalItems > 0 && completedItemKeys.length >= totalItems;

  const streak = isFullyCompleted
    ? await evaluateStreakDoc({
        userId,
        habitDefId,
        timezone,
        todayKey: today,
      })
    : await readStreak(userId, habitDefId);

  // Reward evaluation runs against the streak that includes today's completion.
  const newRewards = await grantEligibleRewards({
    userId,
    habitDefId,
    streakCurrent: streak.current,
  });

  return {
    dayKey: today,
    completedItemKeys,
    streak,
    newRewards,
  };
}

/**
 * Pure streak math, isolated from persistence. Returns the new streak state.
 * Caller is responsible for persisting via `evaluateStreakDoc`.
 *
 * Rules:
 *   - If lastCompletedDayKey is null/empty → current = 1 (this is the user's
 *     first day of completing).
 *   - If lastCompletedDayKey === today → no change (idempotent).
 *   - If lastCompletedDayKey === yesterday → current += 1.
 *   - Otherwise (gap) → current = 1 (today's completion resets and restarts).
 */
export function computeNextStreak(
  prev: Pick<StreakState, "current" | "longest" | "lastCompletedDayKey">,
  todayKey: DayKey
): StreakState {
  const last = prev.lastCompletedDayKey;

  let current: number;
  if (!last) {
    current = 1;
  } else if (last === todayKey) {
    current = prev.current;
  } else if (isYesterday(last, todayKey)) {
    current = prev.current + 1;
  } else {
    // Gap > 1 day → reset. (Including `last = previousDayKey` case handled above.)
    current = 1;
  }

  const longest = Math.max(prev.longest, current);

  return {
    current,
    longest,
    lastCompletedDayKey: todayKey,
  };
}

interface EvalDocParams {
  userId: string;
  habitDefId: string;
  timezone: string;
  todayKey: DayKey;
}

/**
 * Atomic read-modify-write of the streak document. Uses `findOneAndUpdate`
 * with an upsert so concurrent requests serialise correctly on the unique
 * (userId, habitDefId) index.
 */
async function evaluateStreakDoc({
  userId,
  habitDefId,
  todayKey,
}: EvalDocParams): Promise<StreakState> {
  const db = await getDb();
  const streaks = db.collection("streaks");

  const existing = await streaks.findOne({ userId, habitDefId });

  if (existing && existing.lastCompletedDayKey === todayKey) {
    // Idempotent: already counted today.
    return {
      current: existing.current,
      longest: existing.longest,
      lastCompletedDayKey: existing.lastCompletedDayKey,
    };
  }

  // No prior completion today → compute the reset-or-increment.
  const next = computeNextStreak(
    {
      current: existing?.current ?? 0,
      longest: existing?.longest ?? 0,
      lastCompletedDayKey: existing?.lastCompletedDayKey ?? null,
    },
    todayKey
  );

  await streaks.updateOne(
    { userId, habitDefId },
    {
      $set: {
        current: next.current,
        longest: next.longest,
        lastCompletedDayKey: next.lastCompletedDayKey,
        lastEvaluatedDayKey: todayKey,
        updatedAt: new Date(),
      },
      $setOnInsert: { userId, habitDefId },
    },
    { upsert: true }
  );

  return next;
}

interface GrantParams {
  userId: string;
  habitDefId: string;
  streakCurrent: number;
}

/**
 * For each reward rule whose threshold the user has now met, insert a grant
 * row. Returns the reward documents that were newly granted in this call.
 *
 * "Newly granted" means: no existing grant for this exact (userId, rewardId,
 * habitDefId, streakAtGrant) tuple. So if the user hits a 7-day reward twice
 * (after a future reset and another 7-day climb), they earn it twice — each
 * grant carries the streak length at the moment of earning.
 */
async function grantEligibleRewards({
  userId,
  habitDefId,
  streakCurrent,
}: GrantParams): Promise<Reward[]> {
  const db = await getDb();
  const rewards = db.collection<Reward>("rewards");
  const grants = db.collection<RewardGrant>("reward_grants");

  // Look up the habit def so we can match its `key` against reward rules.
  // The habit_defs collection stores both system and user habits.
  const habitDef = await db
    .collection<HabitDef>("habit_defs")
    .findOne({ _id: habitDefId } as never);

  if (!habitDef) return [];

  const eligible = await rewards
    .find({
      "rule.habitDefKey": habitDef.key,
      "rule.thresholdDays": { $lte: streakCurrent },
      archivedAt: null,
    })
    .toArray();

  if (eligible.length === 0) return [];

  const newlyGranted: Reward[] = [];

  for (const reward of eligible) {
    try {
      await grants.insertOne({
        _id: new ObjectId().toHexString(),
        userId,
        rewardId: reward._id,
        habitDefId,
        grantedAt: new Date(),
        streakAtGrant: streakCurrent,
      });
      newlyGranted.push(reward);
    } catch (err: unknown) {
      // Duplicate key → already granted at this streak length. Safe to skip.
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: number }).code === 11000
      ) {
        continue;
      }
      throw err;
    }
  }

  return newlyGranted;
}

/**
 * Read the current streak without mutating it. Useful for the dashboard's
 * initial render before the user toggles anything.
 */
export async function readStreak(
  userId: string,
  habitDefId: string
): Promise<StreakState> {
  const db = await getDb();
  const doc = await db
    .collection("streaks")
    .findOne({ userId, habitDefId }, { projection: { current: 1, longest: 1, lastCompletedDayKey: 1 } });

  return {
    current: doc?.current ?? 0,
    longest: doc?.longest ?? 0,
    lastCompletedDayKey: doc?.lastCompletedDayKey ?? null,
  };
}

/**
 * Reads today's log for the user. Returns an empty array if not yet logged.
 */
export async function readTodayLog(
  userId: string,
  habitDefId: string,
  timezone: string,
  now?: Date
): Promise<{ dayKey: DayKey; completedItemKeys: string[] }> {
  const db = await getDb();
  const dayKey = dayKeyFor(now ?? new Date(), timezone);
  const log = await db
    .collection("habit_logs")
    .findOne(
      { userId, habitDefId, dayKey },
      { projection: { completedItemKeys: 1 } }
    );

  return {
    dayKey,
    completedItemKeys: log?.completedItemKeys ?? [],
  };
}

// ─── Retro-mark (bridge a missed day using a chance) ───────────────────────
//
// Discipline feature: when a user spends a chance to mark a forgotten day's
// prayers, we treat the chosen day as if it had been a real completion and
// replay the streak math forward to recompute `current` and `longest`. The
// pure `computeNextStreak` already handles "yesterday follows last → +1",
// so we reuse it directly.
//
// Important rule (per product spec): reward grants only fire if the user
// marked ALL items for the bridged day. Partial bridges restore streak
// continuity but skip reward evaluation — so a user can't game thresholds
// by retro-marking partial days.

export class BridgeConflictError extends Error {
  readonly code = "bridge_conflict" as const;
  constructor(public dayKey: DayKey) {
    super(`Day ${dayKey} already has a logged completion.`);
  }
}

export class BridgeDayInvalidError extends Error {
  readonly code = "bridge_day_invalid" as const;
  constructor(public dayKey: DayKey, public reason: string) {
    super(`Cannot bridge ${dayKey}: ${reason}`);
  }
}

interface BridgeParams {
  userId: string;
  habitDefId: string;
  timezone: string;
  /** The PAST day being backfilled. Must be strictly less than today in `timezone`. */
  dayKey: DayKey;
  completedItemKeys: string[];
  now?: Date;
}

interface BridgeResult {
  streak: StreakState;
  newRewards: Reward[];
  allItemsMarked: boolean;
}

/**
 * Bridges a missed day using a chance (the chance-spend is the caller's
 * responsibility — see `lib/discipline.ts#spendChanceForRetroMark`). This
 * function only mutates `habit_logs` and `streaks` and runs reward grants.
 *
 * Validation:
 *   1. `dayKey` must be < today (in user tz). Today cannot be bridged.
 *   2. `habit_logs` must not already contain a row for that day — no
 *      double-bridging, no overwriting a real completion.
 *   3. The habit must have at least one item.
 *
 * Streak math:
 *   We read the existing streak doc, then call `computeNextStreak` with the
 *   bridged dayKey. If the gap between `lastCompletedDayKey` and `dayKey`
 *   is exactly 1 day, the streak extends; otherwise the gap rule resets
 *   the count to 1 — same as a real completion today would after a gap.
 *   Persisted `lastCompletedDayKey` is the bridged day, so subsequent
 *   `applyCompletion` calls on the next real day will see "yesterday" and
 *   continue the streak naturally.
 *
 * Reward gating:
 *   Only when `completedItemKeys.length === habit.items.length` do we run
 *   `grantEligibleRewards`. Partial bridges still update the log + streak
 *   doc but skip reward evaluation entirely.
 */
export async function bridgeMissedDayWithChance({
  userId,
  habitDefId,
  timezone,
  dayKey,
  completedItemKeys,
  now,
}: BridgeParams): Promise<BridgeResult> {
  const db = await getDb();
  const today = dayKeyFor(now ?? new Date(), timezone);

  // Validation 1: target day must be strictly before today.
  if (dayKey >= today) {
    throw new BridgeDayInvalidError(
      dayKey,
      "target day must be in the past, not today"
    );
  }

  // Look up habit_def to validate item keys and get item count.
  const habitDef = await db
    .collection<HabitDef>("habit_defs")
    .findOne({ _id: habitDefId } as never);
  if (!habitDef) {
    throw new BridgeDayInvalidError(dayKey, "habit not found");
  }
  const validKeys = new Set(habitDef.items.map((i) => i.key));
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const k of completedItemKeys) {
    if (!validKeys.has(k)) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    cleaned.push(k);
  }
  if (cleaned.length === 0) {
    throw new BridgeDayInvalidError(
      dayKey,
      "must mark at least one prayer to bridge"
    );
  }

  // Validation 2: no existing log row for the target day.
  const existing = await db
    .collection("habit_logs")
    .findOne(
      { userId, habitDefId, dayKey },
      { projection: { _id: 1 } }
    );
  if (existing) {
    throw new BridgeConflictError(dayKey);
  }

  const allItemsMarked = cleaned.length === habitDef.items.length;

  // Upsert the log row. Identical shape to applyCompletion's write, so the
  // rest of the app reads the row the same way regardless of how it landed.
  await db.collection("habit_logs").updateOne(
    { userId, habitDefId, dayKey },
    {
      $set: {
        completedItemKeys: cleaned,
        completedAt: now ?? new Date(),
      },
      $setOnInsert: {
        userId,
        habitDefId,
        dayKey,
      },
    },
    { upsert: true }
  );

  // Read existing streak doc to get the prev state.
  const streaks = db.collection("streaks");
  const prev = await streaks.findOne({ userId, habitDefId });

  // Replay the math. If the user had no streak yet (first ever completion),
  // computeNextStreak treats it as `current = 1`. If they had a streak and
  // the bridged day is exactly the day after `lastCompletedDayKey`, the
  // count grows by 1 — bridging the gap. Anything more than a 1-day gap
  // resets to 1, matching the "real completion today after a gap" rule.
  //
  // Edge case: if the user previously had a streak that ALREADY ended with
  // a gap (i.e. lastCompletedDayKey was set but is far in the past), we
  // still want a fresh "1 day from today" streak anchored at the bridged
  // dayKey, so the next real completion tomorrow will continue it.
  const next = computeNextStreak(
    {
      current: prev?.current ?? 0,
      longest: prev?.longest ?? 0,
      lastCompletedDayKey: prev?.lastCompletedDayKey ?? null,
    },
    dayKey
  );

  await streaks.updateOne(
    { userId, habitDefId },
    {
      $set: {
        current: next.current,
        longest: next.longest,
        lastCompletedDayKey: next.lastCompletedDayKey,
        lastEvaluatedDayKey: dayKey,
        updatedAt: new Date(),
      },
      $setOnInsert: { userId, habitDefId },
    },
    { upsert: true }
  );

  // Reward gating: only when ALL items are marked.
  const newRewards = allItemsMarked
    ? await grantEligibleRewards({
        userId,
        habitDefId,
        streakCurrent: next.current,
      })
    : [];

  return {
    streak: {
      current: next.current,
      longest: next.longest,
      lastCompletedDayKey: next.lastCompletedDayKey,
    },
    newRewards,
    allItemsMarked,
  };
}