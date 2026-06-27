---
name: verify
description: Run typecheck and lint for the Namaz Tracker project. Use after non-trivial edits, before committing, or whenever you want to confirm the codebase still type-checks and lints cleanly.
---

# /verify — typecheck and lint

Runs the project's two fast verification commands in sequence and reports a clean pass/fail summary.

## Commands

```bash
pnpm exec tsc --noEmit && pnpm lint
```

- `pnpm exec tsc --noEmit` — TypeScript type check (no JS emitted; reuses the existing `tsconfig.json`).
- `pnpm lint` — ESLint via `eslint.config.mjs`. Runs `eslint-config-next`'s core-web-vitals + TypeScript rules.

## Workflow

1. Run the combined command above.
2. If both pass (exit 0): report `PASS — typecheck + lint clean`.
3. If either fails: list every error with its `file:line:col` location, then group them by file so the user can jump to each.
4. Do NOT attempt to auto-fix. Surface the errors and stop.

## When to run

- After any non-trivial edit (per the project PUKU.md).
- Before running `pnpm build` or pushing commits.
- When the user explicitly asks to verify.

## What this does NOT check

- Runtime correctness — there are no tests yet. For end-to-end checks the user has to manually exercise the app with a running Mongo replica set.
- Build correctness — run `pnpm build` separately if you need it. The hook will catch many type errors before this is necessary.