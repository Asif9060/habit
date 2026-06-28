"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  HouseIcon,
  ListChecksIcon,
  TrophyIcon,
  UserIcon,
  SignOutIcon,
  GearIcon,
  CloseIcon,
  SparkleIcon,
} from "@/components/icons";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

interface SidebarUser {
  id: string;
  name: string;
  email: string;
  role: string;
  timezone: string;
}

export function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const isAdmin = user.role === "admin";
  const [menuOpen, setMenuOpen] = useState(false);

  // Escape key dismisses the menu while it's open.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Helper used by the nav <Link>s so tapping one closes the sheet without
  // needing a setState-in-effect driven by pathname.
  const closeMenu = () => setMenuOpen(false);

  const nav: { href: string; label: string; icon: React.ElementType }[] = [
    { href: "/dashboard", label: "Today", icon: HouseIcon },
    { href: "/habits", label: "Habits", icon: ListChecksIcon },
    { href: "/discipline", label: "Discipline", icon: SparkleIcon },
    { href: "/rewards", label: "Rewards", icon: TrophyIcon },
    { href: "/profile", label: "Profile", icon: UserIcon },
  ];

  const initials = user.name.trim().charAt(0).toUpperCase() || "?";

  // User info card — rendered inside the desktop sidebar AND the mobile
  // dropdown sheet. Extracted so the two surfaces stay in sync.
  const userCard = (
    <div className="rounded-2xl border border-line p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">
        Signed in as
      </p>
      <p className="mt-1 text-sm font-medium truncate">{user.name}</p>
      <p className="mt-0.5 text-xs text-muted truncate">{user.email}</p>
      <p className="mt-3 text-xs font-mono text-muted">{user.timezone}</p>
      <button
        type="button"
        onClick={() => signOut().then(() => (window.location.href = "/"))}
        className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors"
      >
        <SignOutIcon size={12} strokeWidth={2.5} />
        Sign out
      </button>
    </div>
  );

  return (
    <aside className="md:border-r md:border-line md:min-h-[100dvh] md:px-5 md:py-8 md:flex-col md:gap-1.5 sticky top-0 z-30 bg-surface/80 backdrop-blur border-b border-line">
      {/* Mobile-only top bar: brand on the left, avatar toggle on the right. */}
      <div className="flex md:hidden items-center h-14 px-4 -mx-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-brand" />
          Namaz Tracker
        </Link>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close account menu" : "Open account menu"}
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          className={cn(
            "inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-semibold",
            "transition-colors",
            menuOpen
              ? "bg-ink text-background"
              : "bg-line/60 text-ink hover:bg-line"
          )}
        >
          {menuOpen ? <CloseIcon size={16} strokeWidth={2.4} /> : initials}
        </button>
      </div>

      {/* Mobile dropdown sheet (full-width, anchored below the top bar). */}
      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close account menu"
            onClick={() => setMenuOpen(false)}
            className="md:hidden fixed inset-0 z-[-1] cursor-default"
          />
          <div
            role="dialog"
            aria-label="Account"
            className="md:hidden mt-1 mb-3 animate-fade-in-up"
          >
            {userCard}
          </div>
        </>
      )}

      {/* Brand — desktop only (mobile shows it in the top bar above). */}
      <Link
        href="/"
        className="hidden md:inline-flex items-center gap-2 text-sm font-semibold tracking-tight px-2 mb-8"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-brand" />
        Namaz Tracker
      </Link>

      <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {nav.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMenu}
              className={cn(
                "group inline-flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-medium",
                "transition-all duration-150 ease-out whitespace-nowrap shrink-0",
                "hover:scale-[1.015] active:scale-[0.985]",
                active
                  ? "bg-ink text-background"
                  : "text-muted hover:text-ink hover:bg-line/40"
              )}
            >
              <span
                className={cn(
                  "inline-flex transition-transform duration-200 ease-out",
                  "group-hover:scale-110"
                )}
              >
                <Icon size={16} strokeWidth={active ? 2.4 : 2} />
              </span>
              {item.label}
            </Link>
          );
        })}

        {isAdmin && (
          <Link
            href="/admin"
            onClick={closeMenu}
            className={cn(
              "group inline-flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-medium md:mt-2",
              "transition-all duration-150 ease-out whitespace-nowrap shrink-0",
              "hover:scale-[1.015] active:scale-[0.985]",
              pathname?.startsWith("/admin")
                ? "bg-brand text-white"
                : "text-brand hover:bg-brand-soft"
            )}
          >
            <span className="inline-flex transition-transform duration-200 ease-out group-hover:scale-110 group-hover:rotate-45">
              <GearIcon size={16} strokeWidth={2.4} />
            </span>
            Admin
          </Link>
        )}
      </nav>

      {/* Desktop user card — unchanged. */}
      <div className="hidden md:block md:mt-auto pt-8">
        {userCard}
      </div>
    </aside>
  );
}