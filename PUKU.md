# PUKU.md

This file provides guidance to puku-cli when working with code in this repository.

## Workflow

- **Always enter plan mode** for non-trivial changes (new feature, multi-file refactor, schema changes). Approve the plan before writing code.
- After non-trivial edits, run `pnpm exec tsc --noEmit && pnpm lint` before reporting done.
- **Use Conventional Commits** for commit messages (`feat:`, `fix:`, `refactor:`, `chore:`, etc.).

## Stack

- Next.js 16.2.9 + React 19 + TypeScript 5 + Tailwind v4. Better-Auth 1.6 + MongoDB 7 driver. **pnpm** is the package manager (use `pnpm add` / `pnpm install`, never `npm`).
- This is **NOT the Next.js you know** — v16 has breaking changes. Before writing any framework code, read the relevant guide in `node_modules/next/dist/docs/`. `middleware.ts` is renamed to `proxy.ts` at the project root. `cookies()` from `next/headers` is async. `params` / `searchParams` page props are Promises.
- Server is **serverless** (Vercel-style). Never import `lib/db.ts` from a `"use client"` file — the connection string must not be exposed.
- MongoDB must run as a **replica set**, even locally (Better-Auth uses transactions). See `.env.example` for the docker one-liner.
- Auth/DB pages need `export const dynamic = "force-dynamic"` — without it, the build's static prerender step fails because `getAuth()` requires the DB.
- `proxy.ts` at the project root gates protected routes on the session cookie. `app/admin/layout.tsx` does the deep role check via `notFound()` for non-admins (returns 404, not a redirect, to avoid leaking admin paths).

## Layout

- `app/(auth)/` — login, register (public)
- `app/(app)/` — auth-gated user surface (dashboard, habits, rewards, profile)
- `app/admin/` — admin-only (guarded by role check in its layout)
- `app/api/` — route handlers; all mutating routes verify session via `auth.api.getSession({ headers: req.headers })`
- `lib/` — server-only utilities (`db.ts`, `auth.ts`, `streak.ts`, `dayKey.ts`, `seed.ts`, `first-admin.ts`)
- `components/` — shared React components (icons in `icons.tsx` are inline SVGs, not the Phosphor React tree — that caused Turbopack module-eval errors)
- `models/types.ts` — TS interfaces mirroring Mongo collections
- `instrumentation.ts` — runs the idempotent seed on cold start

## Code style

- Use inline SVG icons from `components/icons.tsx` in **server components**. Phosphor React components (`@phosphor-icons/react`) are safe in `"use client"` files but break Turbopack's server build when imported from server trees.
- Inline icon SVGs accept `size` and `strokeWidth` props; never use emojis in code, markup, or text.
- For Mongo `_id` filters where the value is a `string`, cast the filter as `{ _id: id } as never` to sidestep the driver's `ObjectId` type narrowing (we store `ObjectId().toHexString()`).