// Next.js instrumentation hook — runs once per cold start on the server.
//
// We use it to seed the database (Namaz habit + default rewards) idempotently.
// Failures here are logged but do NOT crash the app — endpoints that need the
// seed will surface clearer errors at request time.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { runSeed } = await import("@/lib/seed");
    await runSeed();
  } catch (err) {
    console.error("[instrumentation] seed failed:", err);
  }
}