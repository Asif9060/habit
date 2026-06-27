import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = session.user as typeof session.user & { timezone?: string };

  return (
    <div className="max-w-2xl">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted font-medium">
          Profile
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl tracking-tight font-semibold">
          Your account.
        </h1>
        <p className="mt-3 text-muted max-w-[58ch]">
          Update the basics. Your timezone drives when your day rolls over.
        </p>
      </header>

      <ProfileForm
        initial={{
          name: user.name || "",
          email: user.email,
          timezone: user.timezone || "UTC",
        }}
      />
    </div>
  );
}