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