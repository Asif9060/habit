import { getDb } from "@/lib/db";
import { NAMAZ_HABIT_KEY } from "@/lib/seed";
import type { HabitDef } from "@/models/types";
import { NamazItemsEditor } from "./namaz-editor";
import { HabitRowActions } from "./habit-row-actions";
import { NewHabitForm } from "./new-habit-form";

export const dynamic = "force-dynamic";

export default async function AdminHabitsPage() {
  const db = await getDb();

  const namaz = await db
    .collection<HabitDef>("habit_defs")
    .findOne({ key: NAMAZ_HABIT_KEY, ownerId: null });

  if (!namaz) {
    return (
      <p className="text-danger">
        The system Namaz habit is missing. Restart the server to re-seed.
      </p>
    );
  }

  const allHabits = await db
    .collection<HabitDef>("habit_defs")
    .find({ archivedAt: null })
    .sort({ type: 1, createdAt: -1 })
    .toArray();

  return (
    <div>
      <h1 className="text-3xl md:text-4xl tracking-tight font-semibold">
        Habits
      </h1>
      <p className="mt-3 text-muted max-w-[58ch]">
        Edit the five canonical prayers, create new system habits, or archive
        habits that should no longer appear on user dashboards.
      </p>

      <section className="mt-10 max-w-2xl">
        <h2 className="text-base font-semibold tracking-tight mb-4">
          System: {namaz.name}
        </h2>
        <NamazItemsEditor
          initialItems={[...namaz.items].sort((a, b) => a.order - b.order)}
        />
      </section>

      <section className="mt-14">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-base font-semibold tracking-tight">All habits</h2>
          <NewHabitForm />
        </div>
        <div className="rounded-2xl border border-line overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface/60 text-xs uppercase tracking-[0.16em] text-muted">
              <tr>
                <th className="text-left font-medium px-4 py-3">Name</th>
                <th className="text-left font-medium px-4 py-3">Type</th>
                <th className="text-left font-medium px-4 py-3">Owner</th>
                <th className="text-right font-medium px-4 py-3">Items</th>
                <th className="text-right font-medium px-4 py-3 w-44">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {allHabits.map((h) => (
                <tr key={h._id}>
                  <td className="px-4 py-3 font-medium">{h.name}</td>
                  <td className="px-4 py-3 text-muted">{h.type}</td>
                  <td className="px-4 py-3 text-muted font-mono text-xs">
                    {h.ownerId ? h.ownerId.slice(0, 12) + "…" : "system"}
                  </td>
                  <td className="px-4 py-3 text-right text-muted">
                    {h.items.length}
                  </td>
                  <td className="px-4 py-3">
                    <HabitRowActions
                      habit={{
                        id: h._id,
                        name: h.name,
                        type: h.type,
                        items: [...h.items].sort((a, b) => a.order - b.order),
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}