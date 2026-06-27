// PostToolUse hook for Write|Edit on .ts/.tsx files under app/, components/,
// lib/, models/. Reads the tool input from stdin (JSON), filters by path,
// then runs `pnpm exec tsc --noEmit` from the project root.
//
// Why Node + cjs: the hook runs on Windows, must read stdin synchronously
// before exiting, and the project already has Node 22+ in the toolchain.
// Keeping it as a .cjs script so it runs without TS compilation.

const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

let raw = "";
try {
  raw = fs.readFileSync(0, "utf8");
} catch {
  process.exit(0); // no stdin → nothing to do
}

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0);
}

const filePath = payload?.tool_input?.file_path;
if (typeof filePath !== "string") process.exit(0);

const projectRoot = process.cwd();
const absolute = path.isAbsolute(filePath)
  ? filePath
  : path.resolve(projectRoot, filePath);
const relative = path.relative(projectRoot, absolute).replace(/\\/g, "/");

// Scope: only typecheck when a relevant source file changes.
const SCOPED_PREFIXES = ["app/", "components/", "lib/", "models/"];
const SCOPED_EXTS = [".ts", ".tsx"];

const inScope =
  !relative.startsWith("..") &&
  SCOPED_PREFIXES.some((p) => relative.startsWith(p)) &&
  SCOPED_EXTS.some((ext) => relative.endsWith(ext));

if (!inScope) process.exit(0);

// Run tsc. We deliberately do NOT pass the file — tsc --noEmit is whole-project
// anyway, and per-file checking would miss cross-file type errors.
const result = spawnSync("pnpm", ["exec", "tsc", "--noEmit"], {
  cwd: projectRoot,
  encoding: "utf8",
  shell: true, // needed on Windows for pnpm.cmd resolution
});

if (result.status === 0) {
  // PASS — silent. Per design, the hook should be invisible on success.
  process.exit(0);
}

// FAIL — surface errors to the model as additional context. The hook
// JSON shape is fixed: { hookSpecificOutput: { hookEventName, additionalContext } }.
const stdout = (result.stdout || "").trim();
const stderr = (result.stderr || "").trim();
const body = [stdout, stderr].filter(Boolean).join("\n");

const out = {
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext:
      `[typecheck-hook] tsc --noEmit failed after editing ${relative}.\n` +
      `Fix the errors below before continuing. Do NOT auto-run the fix; report them.\n\n` +
      body,
  },
};
process.stdout.write(JSON.stringify(out));
process.exit(0);
