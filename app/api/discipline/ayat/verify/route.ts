// POST /api/discipline/ayat/verify
//
// Body: { ayatId: string, surahNumber: number, ayahNumber: number, paraNumber: number }
//
// Validates that all three numbers match the canonical record for the
// ayatId. On match, awards 1 chance. On miss, returns 400 with `{ correct:
// false }` and does NOT reveal the right answer — the user moves on to the
// next unseen ayat.
//
// Auth: required.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import {
  awardChance,
  isAyatAnswerCorrect,
} from "@/lib/discipline";

export const dynamic = "force-dynamic";

const Body = z.object({
  ayatId: z.string().regex(/^\d+:\d+$/, "ayatId must be 'surah:ayah'"),
  surahNumber: z.number().int().min(1).max(114),
  ayahNumber: z.number().int().min(1).max(286),
  paraNumber: z.number().int().min(1).max(30),
});

export async function POST(req: Request) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", detail: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  const correct = await isAyatAnswerCorrect(
    body.ayatId,
    body.surahNumber,
    body.ayahNumber,
    body.paraNumber
  );

  if (!correct) {
    // Do NOT reveal the right answer — let the user move on to the next
    // ayat and learn organically.
    return NextResponse.json(
      { correct: false, error: "Not quite. Try the next ayat." },
      { status: 400 }
    );
  }

  const awarded = await awardChance(session.user.id, body.ayatId);

  return NextResponse.json({
    correct: true,
    balance: awarded.balance,
    transactionId: awarded.transactionId,
  });
}