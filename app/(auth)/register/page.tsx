import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { RegisterForm } from "./register-form";
import { getAuth } from "@/lib/auth";

// Reads the session to redirect signed-in users.
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");

  return (
    <main className="min-h-[100dvh] w-full grid grid-cols-1 md:grid-cols-2">
      <section className="flex items-center justify-center px-5 md:px-10 py-16">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink transition-colors mb-10"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand" />
            Namaz Tracker
          </Link>
          <h1 className="text-3xl md:text-4xl tracking-tight font-semibold leading-tight">
            Begin.
          </h1>
          <p className="mt-3 text-muted">
            A few details, then you&rsquo;re tracking.
          </p>
          <div className="mt-10">
            <RegisterForm />
          </div>
          <p className="mt-8 text-sm text-muted">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-ink underline-offset-4 hover:underline font-medium"
            >
              Log in
            </Link>
          </p>
        </div>
      </section>

      <aside className="hidden md:flex bg-ink text-background items-center justify-center px-12 py-20">
        <RegisterVisual />
      </aside>
    </main>
  );
}

function RegisterVisual() {
  return (
    <div className="w-full max-w-xs">
      <p className="text-xs uppercase tracking-[0.2em] text-background/60 font-medium">
        Why we ask for your timezone
      </p>
      <h2 className="mt-4 text-3xl tracking-tight font-medium leading-tight">
        Your streak lives where you live.
      </h2>
      <p className="mt-5 text-sm leading-relaxed text-background/70">
        A day ends at midnight in <em>your</em> timezone, not ours. We use it
        to decide whether today&rsquo;s prayers count or whether the streak
        resets. No tracking, no ads — just math.
      </p>
    </div>
  );
}