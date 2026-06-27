import { headers } from "next/headers";
import {
  PrayerChecklist,
  PrayerChecklistProvider,
  PrayerChecklistRail,
} from "@/components/prayer-checklist";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dayKeyFor } from "@/lib/dayKey";
import { readStreak, readTodayLog } from "@/lib/streak";
import { ensureFirstAdmin } from "@/lib/first-admin";
import type { HabitDef } from "@/models/types";

export default async function DashboardPage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null; // layout already redirects, but TS appeasement

  // Lazily promote the first-ever user to admin. No-op if an admin already
  // exists. One indexed `findOne({ role: "admin" })` per dashboard load.
  await ensureFirstAdmin(session.user.id);

  const user = session.user as typeof session.user & {
    timezone?: string;
    role?: string;
  };
  const tz = user.timezone || "UTC";
  const dayKey = dayKeyFor(new Date(), tz);

  // Load system Namaz habit + any user-created private habits.
  const db = await getDb();
  const habitDefs = await db
    .collection<HabitDef>("habit_defs")
    .find({
      archivedAt: null,
      $or: [{ ownerId: null }, { ownerId: session.user.id }],
    })
    .sort({ type: 1, createdAt: 1 })
    .toArray();

  // For each habit: today's log + streak. We do these in parallel.
  const checklists = await Promise.all(
    habitDefs.map(async (habit) => {
      const [log, streak] = await Promise.all([
        readTodayLog(session.user.id, habit._id, tz),
        readStreak(session.user.id, habit._id),
      ]);
      return {
        habitDefId: habit._id,
        name: habit.name,
        items: [...habit.items].sort((a, b) => a.order - b.order),
        completedItemKeys: log.completedItemKeys,
        streak,
      };
    })
  );

  const namaz = checklists.find((c) =>
    habitDefs.find((h) => h._id === c.habitDefId && h.key === "namaz")
  );
  const customHabits = checklists.filter(
    (c) =>
      habitDefs.find((h) => h._id === c.habitDefId && h.key)!.key !== "namaz"
  );

  return (
    <PrayerChecklistProvider
      habits={[...(namaz ? [namaz] : []), ...customHabits]}
      dayKey={dayKey}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10 lg:gap-14">
        <div className="min-w-0">
          <header className="mb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-muted font-medium animate-fade-in-up">
              {dayKey}
            </p>
            <h1
              className="mt-2 text-3xl md:text-4xl tracking-tight font-semibold animate-fade-in-up"
              style={{ animationDelay: "60ms" }}
            >
              Salaam, {firstName(user.name || user.email)}.
            </h1>
            <p
              className="mt-2 text-muted max-w-[58ch] animate-fade-in-up"
              style={{ animationDelay: "120ms" }}
            >
              Mark each prayer you&rsquo;ve offered today. Your streak updates the
              moment you check the last one off.
            </p>
          </header>

          <PrayerChecklist />

          {customHabits.length === 0 && (
            <p className="mt-10 text-sm text-muted">
              Looking to track something else?{" "}
              <a
                href="/habits"
                className="text-ink underline-offset-4 hover:underline font-medium"
              >
                Add a custom habit
              </a>
              .
            </p>
          )}
        </div>

        {/* Right rail — streak ring + timezone card. The ring is driven by
            the same optimistic set as the checklist, so it animates the
            moment the user checks the last prayer off. */}
        <aside className="flex flex-col gap-8 lg:sticky lg:top-8 self-start">
          <PrayerChecklistRail />

          <div className="rounded-3xl border border-line p-5 text-xs text-muted leading-relaxed">
            <p className="uppercase tracking-[0.18em] font-medium text-ink mb-2">
              Timezone
            </p>
            <p className="font-mono">{tz}</p>
            <p className="mt-3">
              Your day rolls over at midnight here. Update in{" "}
              <a
                href="/profile"
                className="text-ink underline-offset-4 hover:underline"
              >
                profile
              </a>
              .
            </p>
          </div>
        </aside>
      </div>
    </PrayerChecklistProvider>
  );
}

function firstName(raw: string): string {
  // Conservative: first whitespace-separated token, capitalised.
  const token = raw.split(/\s+/)[0] || "there";
  return token.charAt(0).toUpperCase() + token.slice(1);
}