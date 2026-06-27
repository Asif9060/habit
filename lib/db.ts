// Singleton MongoDB client. Serverless-safe: hot-reloads reuse the same
// promise on `globalThis` so we don't open a new connection per request.
//
// IMPORTANT: never import this file from a `"use client"` component.
// The driver is server-only and the connection string must not be exposed.

import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "habit_tracker";

if (!uri) {
  // We don't throw at import time — Vercel builds without secrets would crash
  // otherwise. We throw lazily on first use so local devs see a clear error.
  console.warn(
    "[db] MONGODB_URI is not set. Database calls will fail until it is configured."
  );
}

type GlobalWithMongo = typeof globalThis & {
  __mongoClient?: Promise<MongoClient>;
};

const globalForMongo = globalThis as GlobalWithMongo;

export function getMongoClient(): Promise<MongoClient> {
  if (!uri) {
    return Promise.reject(
      new Error(
        "MONGODB_URI is not configured. Set it in .env.local before starting the app."
      )
    );
  }
  if (!globalForMongo.__mongoClient) {
    globalForMongo.__mongoClient = new MongoClient(uri, {
      // Serverless-friendly options. The driver auto-pools per-host.
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 5_000,
    }).connect();
  }
  return globalForMongo.__mongoClient;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(dbName);
}

/**
 * Idempotently creates indexes the app relies on. Safe to call on every
 * cold start — Mongo's `createIndex` is a no-op if the index already exists
 * with the same spec.
 */
export async function ensureIndexes(): Promise<void> {
  const db = await getDb();

  await Promise.all([
    db.collection("habit_logs").createIndex(
      { userId: 1, habitDefId: 1, dayKey: 1 },
      { unique: true, name: "uniq_user_habit_day" }
    ),
    db.collection("habit_defs").createIndex(
      { key: 1, ownerId: 1 },
      { unique: true, name: "uniq_key_owner" }
    ),
    db.collection("streaks").createIndex(
      { userId: 1, habitDefId: 1 },
      { unique: true, name: "uniq_user_habit_streak" }
    ),
    db.collection("rewards").createIndex(
      { slug: 1 },
      { unique: true, name: "uniq_reward_slug" }
    ),
    db.collection("reward_grants").createIndex(
      { userId: 1, rewardId: 1, habitDefId: 1, streakAtGrant: 1 },
      { unique: true, name: "uniq_grant_threshold" }
    ),
  ]);
}