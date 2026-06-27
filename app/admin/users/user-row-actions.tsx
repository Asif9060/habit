"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

export function UserRowActions({
  id,
  role,
  isSelf,
}: {
  id: string;
  role: "user" | "admin" | null | undefined;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setRole(next: "user" | "admin") {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/users/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: next }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          alert(body.error ?? "Couldn't update role.");
          return;
        }
        router.refresh();
      } catch {
        alert("Network error.");
      }
    });
  }

  if (role === "admin") {
    return (
      <button
        type="button"
        onClick={() => setRole("user")}
        disabled={pending || isSelf}
        title={isSelf ? "You can't demote yourself." : "Demote to user"}
        className={cn(
          "h-7 px-3 rounded-full text-xs transition-colors",
          "text-muted hover:text-ink hover:bg-line/40",
          "disabled:opacity-40 disabled:pointer-events-none"
        )}
      >
        Demote
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setRole("admin")}
      disabled={pending}
      className={cn(
        "h-7 px-3 rounded-full text-xs transition-colors",
        "bg-brand/10 text-brand hover:bg-brand/20",
        "disabled:opacity-40 disabled:pointer-events-none"
      )}
    >
      Promote
    </button>
  );
}