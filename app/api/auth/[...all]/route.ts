// Better-Auth catch-all route handler.
//
// We cache the resolved Next.js handler so each request avoids re-awaiting the
// auth construction. Better-Auth's handler is idempotent and stateless, so a
// shared reference is safe.

import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

let cached: ReturnType<typeof toNextJsHandler> | null = null;
let pending: Promise<ReturnType<typeof toNextJsHandler>> | null = null;

function resolveHandler() {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = getAuth().then((auth) => {
      cached = toNextJsHandler(auth);
      return cached;
    });
  }
  return pending;
}

export const GET = async (req: Request) => (await resolveHandler()).GET(req);
export const POST = async (req: Request) => (await resolveHandler()).POST(req);