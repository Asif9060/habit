import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/nav-sidebar";
import { getAuth } from "@/lib/auth";
import { ensureFirstAdmin } from "@/lib/first-admin";

// Auth-gated area — never statically rendered.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  // Lazy first-user-admin promotion. No-op after the first admin exists.
  await ensureFirstAdmin(session.user.id);

  return (
    <div className="min-h-[100dvh] w-full grid grid-cols-1 md:grid-cols-[260px_1fr]">
      <Sidebar
        user={{
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          role: (session.user as { role?: string }).role ?? "user",
          timezone: (session.user as { timezone?: string }).timezone ?? "UTC",
        }}
      />
      <main className="min-w-0 px-5 md:px-10 py-8 md:py-12 max-w-6xl w-full">
        {children}
      </main>
    </div>
  );
}