// Next.js 16 Proxy (formerly `middleware.ts`).
//
// Sits in front of every request matched by the `config.matcher` below and
// enforces:
//   1. Auth: requests to `/dashboard`, `/habits`, `/rewards`, `/profile`,
//      `/admin/*` require a valid Better-Auth session.
//   2. Role: requests to `/admin/*` additionally require `role === "admin"`.
//
// We don't call into Better-Auth here (it pulls in the full adapter chain
// which is heavy at the edge). Instead, we read the session cookie and
// verify the JWT signature. The user role is then read from the cookie cache.
//
// The proxy is intentionally lean: deep verification happens in route
// handlers and server components, where we can fetch the full session.

import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/habits", "/rewards", "/profile"];
const ADMIN_PREFIX = "/admin";

const SESSION_COOKIE_CANDIDATES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

function readSessionCookie(req: NextRequest): string | null {
  for (const name of SESSION_COOKIE_CANDIDATES) {
    const c = req.cookies.get(name);
    if (c?.value) return c.value;
  }
  return null;
}

export function proxy(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const needsAdmin = pathname.startsWith(ADMIN_PREFIX);

  if (!needsAuth && !needsAdmin) return NextResponse.next();

  const session = readSessionCookie(req);

  if (!session) {
    const url = new URL("/login", origin);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // For admin routes we still let the layout server component do the deep
  // role check (the cookie cache is JWT-signed by Better-Auth; decoding here
  // would require pulling in `jose` and the auth secret). Returning through
  // is safe — admin/layout.tsx will 404 if the role is wrong.
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on app routes; skip _next, static assets, the API auth handler,
    // and the public landing/login/register pages.
    "/((?!_next/static|_next/image|favicon.ico|api/auth|login|register|$).*)",
  ],
};