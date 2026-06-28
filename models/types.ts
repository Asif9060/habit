// Shared TS types for MongoDB collections.
// Field names mirror Better-Auth where applicable (user/session/account/verification).

export type UserRole = "user" | "admin";

export interface AppUser {
  _id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image?: string | null;
  role: UserRole;
  timezone: string; // IANA, e.g. "Asia/Karachi"
  banned: boolean | null;
  banReason?: string | null;
  banExpires?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type HabitDefType = "system" | "user";

export interface HabitItem {
  key: string; // stable slug, e.g. "fajr"
  label: string; // display, e.g. "Fajr"
  order: number;
}

export interface HabitDef {
  _id: string;
  key: string; // "namaz" for system, or user-scoped slug for private habits
  name: string;
  ownerId: string | null; // null for system habits
  type: HabitDefType;
  schedule: "daily";
  items: HabitItem[];
  createdAt: Date;
  archivedAt: Date | null;
}

export interface HabitLog {
  _id: string;
  userId: string;
  habitDefId: string;
  dayKey: string; // YYYY-MM-DD in user timezone
  completedItemKeys: string[];
  completedAt: Date;
}

export interface Streak {
  _id: string;
  userId: string;
  habitDefId: string;
  current: number;
  longest: number;
  lastCompletedDayKey: string | null;
  lastEvaluatedDayKey: string | null;
  updatedAt: Date;
}

export interface RewardRule {
  type: "streak";
  habitDefKey: string; // matches HabitDef.key, e.g. "namaz"
  thresholdDays: number;
}

export interface Reward {
  _id: string;
  slug: string;
  name: string;
  description: string;
  iconKey: string; // mapped to a Phosphor icon
  rule: RewardRule;
  createdBy: string; // admin user id
  createdAt: Date;
  archivedAt: Date | null;
}

export interface RewardGrant {
  _id: string;
  userId: string;
  rewardId: string;
  habitDefId: string;
  grantedAt: Date;
  streakAtGrant: number;
}

// Result of an "evaluate" call. Returned by API handlers so the client can render.
export interface StreakState {
  current: number;
  longest: number;
  lastCompletedDayKey: string | null;
}

export interface CompletionResult {
  dayKey: string;
  completedItemKeys: string[];
  streak: StreakState;
  newRewards: Reward[]; // rewards granted by this completion
}

// ─── Discipline (chances & retro-marking) ────────────────────────────

/**
 * A single verse (ayah) of the Quran, prepared for the discipline quiz.
 *
 * `ayatId` is stable: `${surahNumber}:${ayahNumber}` (e.g. "2:255").
 * Para/juz numbers come from the canonical Mushaf al-Madinah boundaries.
 *
 * Source attribution: Arabic text + English translation come from the
 * `quran-json` npm package (CC-BY-SA 4.0, by Risan Bagja Pradana). Bengali
 * translation also from `quran-json` (sourced from quranenc.com, originally
 * Taisirul Quran / Sheikh Mujibur Rahman).
 */
export interface AyatEntry {
  ayatId: string;
  surahNumber: number; // 1..114
  surahName: string; // transliteration e.g. "Al-Baqarah"
  surahNameArabic: string;
  ayahNumber: number; // 1..286
  paraNumber: number; // 1..30 (juz)
  arabicText: string;
  englishTranslation: string;
  bengaliTranslation: string;
}

/**
 * Current spendable chance balance for a user. Created lazily on first earn
 * or first spend. `lifetimeEarned` is kept so the UI can show a stat like
 * "You've earned 12 chances in total".
 */
export interface ChanceBalance {
  _id: string;
  userId: string;
  balance: number;
  lifetimeEarned: number;
  updatedAt: Date;
}

/**
 * Append-only ledger of chance movements. Negative deltas are spends
 * (retro-mark), positive deltas are earns (correct ayat-quiz answer).
 * `refId` ties the transaction back to its trigger — `ayatId` for earns,
 * `dayKey` for spends.
 */
export interface ChanceTransaction {
  _id: string;
  userId: string;
  delta: number; // +1 or -1 today; allowed range is wider for future rules
  reason: "ayat_quiz" | "retro_mark";
  refId: string;
  createdAt: Date;
}

/**
 * Tracks every ayah a user has been shown during a logged-in session.
 * The unique index on `{ userId, ayatId }` makes `pickUnseenAyat` race-safe:
 * two concurrent requests cannot both insert the same ayahId.
 *
 * Lifecycle: rows persist for the session (not cleared automatically). For
 * v1 this means once shown, an ayah stays "seen" until the row is deleted —
 * simplest model. A future "reset seen" admin action can wipe this collection.
 */
export interface SeenAyat {
  _id: string; // `${userId}:${ayatId}`
  userId: string;
  ayatId: string;
  shownAt: Date;
}