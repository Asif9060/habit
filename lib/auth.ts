// Better-Auth configuration.
//
// Notes:
//   - We use the MongoDB adapter pointed at the same database the rest of the
//     app reads. Better-Auth manages `user`, `session`, `account`, `verification`.
//   - `additionalFields` lets us store `timezone` directly on the user document.
//     `role` is owned by the `admin` plugin (which also writes `banned`, etc.).
//   - First-user-admin promotion lives in lib/first-admin.ts — Better-Auth does
//     not auto-promote, and we don't want a fragile bootstrap on auth creation.
//
// Why `await getDb()` inside the factory: the MongoDB adapter's signature
// requires a connected `Db` at construction time, not a promise. We resolve the
// promise once on first auth call and cache the resulting `Auth` instance.

import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { getDb } from "@/lib/db";

// We intentionally type this as `Awaited<ReturnType<typeof buildAuth>>` so all
// callers see the fully-augmented Auth type (with admin plugin's endpoints).
type AppAuth = Awaited<ReturnType<typeof buildAuth>>;

let cachedAuth: AppAuth | null = null;
let pendingInit: Promise<AppAuth> | null = null;

async function buildAuth() {
  const db = await getDb();

  return betterAuth({
    database: mongodbAdapter(db),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL,
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 8,
    },
    user: {
      additionalFields: {
        timezone: {
          type: "string",
          required: false,
          defaultValue: "UTC",
          input: true,
        },
      },
    },
    plugins: [
      admin({
        defaultRole: "user",
        adminRoles: ["admin"],
      }),
    ],
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes — balances perf vs. fresh role reads
      },
    },
  });
}

/**
 * Resolve and cache the Better-Auth instance. Safe to call concurrently;
 * the underlying `pendingInit` promise is shared until first build completes.
 */
export async function getAuth(): Promise<AppAuth> {
  if (cachedAuth) return cachedAuth;
  if (!pendingInit) {
    pendingInit = buildAuth().then((auth) => {
      cachedAuth = auth;
      pendingInit = null;
      return auth;
    });
  }
  return pendingInit;
}

export type AppSession = Awaited<
  ReturnType<AppAuth["api"]["getSession"]>
>;