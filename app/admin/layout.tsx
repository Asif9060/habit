// Admin layout — guarded at the data layer (404 for non-admins). The proxy
// has already ensured an auth cookie exists; this layout's server component
// fetches the role and bails to notFound() if it's not "admin".
//
// Returning 404 (rather than redirecting) avoids leaking the existence of
// /admin paths to non-admin users.

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  GearIcon,
  ListChecksIcon,
  TrophyIcon,
  UsersIcon,
} from "@/components/icons";
import { getAuth } from "@/lib/auth";

// This layout touches auth + DB at request time. Force dynamic so Next.js
// does not attempt to statically collect page data (which would invoke
// getAuth() during build and fail without a real MongoDB).
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") notFound();

  // Simple inline sub-nav. Stays out of the global sidebar so admins can
  // distinguish their user-facing vs admin context.
  return (
    <div>
      <div className="border-b border-line mb-8">
        <div className="max-w-6xl mx-auto px-5 md:px-10 pt-8 pb-0 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-brand font-medium">
          <GearIcon size={14} strokeWidth={2.5} />
          Admin
        </div>
        <nav className="max-w-6xl mx-auto px-5 md:px-10 flex gap-1 overflow-x-auto">
          <AdminLink href="/admin" label="Overview" />
          <AdminLink href="/admin/habits" label="Habits" icon={ListChecksIcon} />
          <AdminLink href="/admin/rewards" label="Rewards" icon={TrophyIcon} />
          <AdminLink href="/admin/users" label="Users" icon={UsersIcon} />
        </nav>
      </div>
      <div className="max-w-6xl mx-auto px-5 md:px-10 pb-16">
        {children}
      </div>
    </div>
  );
}

function AdminLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon?: React.ElementType;
}) {
  // We can't read pathname here (server component). Use exact-match hints:
  // "/admin" is the overview, others are exact. Client would be cleaner but
  // server is fine for an admin surface that doesn't change between visits.
  return (
    <Link
      href={href}
      className={
        "inline-flex items-center gap-1.5 h-11 px-4 -mb-px border-b-2 border-transparent " +
        "text-sm font-medium text-muted hover:text-ink transition-colors"
      }
    >
      {Icon && <Icon size={14} />}
      {label}
    </Link>
  );
}