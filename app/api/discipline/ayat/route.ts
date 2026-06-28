// GET /api/discipline/ayat
//
// Returns a random unseen ayat for the current user + their current chance
// balance. The "unseen" guarantee comes from the unique index on
// `seen_ayats` (see lib/discipline-indexes.ts).
//
// Auth: required.
// Auth/DB pages must not be statically prerendered — see PUKU.md.

import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import {
  getBalance,
  pickUnseenAyat,
} from "@/lib/discipline";
import type { AyatEntry, ChanceBalance } from "@/models/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const userId = session.user.id;

  // Run balance read + unseen pick in parallel — they don't depend on each
  // other. If pickUnseenAyat throws (e.g. user has seen every ayah), surface
  // a 409 so the UI can show "Come back tomorrow — you've seen them all".
  const [balance, picked] = await Promise.allSettled([
    getBalance(userId),
    pickUnseenAyat(userId),
  ]);

  if (balance.status === "rejected") {
    console.error("[GET /api/discipline/ayat] balance failed:", balance.reason);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if (picked.status === "rejected") {
    console.error(
      "[GET /api/discipline/ayat] pickUnseenAyat failed:",
      picked.reason
    );
    return NextResponse.json(
      {
        error:
          "You've seen every available ayah in this session. New ayahs will appear as the dataset expands.",
      },
      { status: 409 }
    );
  }

  const ayat: AyatEntry = picked.value.ayat;
  const bal: ChanceBalance = balance.value;

  return NextResponse.json({
    ayat: {
      ayatId: ayat.ayatId,
      surahNumber: ayat.surahNumber,
      ayahNumber: ayat.ayahNumber,
      paraNumber: ayat.paraNumber,
      surahName: ayat.surahName,
      arabicText: ayat.arabicText,
      englishTranslation: ayat.englishTranslation,
      bengaliTranslation: ayat.bengaliTranslation,
    },
    balance: {
      current: bal.balance,
      lifetimeEarned: bal.lifetimeEarned,
    },
  });
}