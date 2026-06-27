import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { HabitsManager } from "./habits-manager";
import type { HabitDef } from "@/models/types";

export default async function HabitsPage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const db = await getDb();
  const userHabits = await db
    .collection<HabitDef>("habit_defs")
    .find({ ownerId: session.user.id, archivedAt: null })
    .sort({ createdAt: -1 })
    .toArray();

  return (
    <div className="max-w-3xl">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted font-medium">
          Your habits
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl tracking-tight font-semibold">
          Beyond the five prayers.
        </h1>
        <p className="mt-3 text-muted max-w-[58ch]">
          Add any daily habit you want to stay accountable for — Quran page,
          water, sleep, exercise. Habits you create are private to your
          account and tracked on the same streak rules as Namaz.
        </p>
      </header>

      <HabitsManager
        initialHabits={userHabits.map((h) => ({
          id: h._id,
          name: h.name,
          items: h.items.map((i) => i.label),
        }))}
      />
    </div>
  );
}