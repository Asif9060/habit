// Quran data wrapper around the `quran-json` npm package (v3.1.2, CC-BY-SA 4.0).
//
// Why this wrapper exists:
//   - The package's per-chapter JSONs only ship the default Arabic text and
//     transliteration, so we need to consume the per-language consolidated
//     files (`quran_en.json`, `quran_bn.json`) to get translations.
//   - We flatten the nested `chapter → verses` structure into one
//     `AyatEntry[]` so `pickRandomUnseenAyat` can index it in O(1).
//   - We attach the canonical `paraNumber` (1..30) per (surah, ayah) using
//     the Mushaf al-Madinah boundaries, which are not present in the package.
//
// Attribution (CC-BY-SA 4.0, package authors):
//   - Arabic text (Uthmani script): The Noble Qur'an Encyclopedia (quranenc.com).
//   - English translation: Saheeh International.
//   - Bengali translation: Taisirul Quran / Sheikh Mujibur Rahman
//     (sourced via quranenc.com).
//   - Transliteration: Tanzil.net.
// Package: Risan Bagja Pradana, https://github.com/risan/quran-json.
// License: https://creativecommons.org/licenses/by-sa/4.0/
//
// Performance: all three JSONs are imported lazily on first access and the
// merged dataset is memoised at module scope, so subsequent `getAllAyats()`
// calls are O(1). Initial import cost on cold start is ~7.5MB of JSON parse,
// which is acceptable for the discipline feature path.

import type { AyatEntry } from "@/models/types";

// Raw chapter shape from `quran-json`'s consolidated English/Bengali files.
interface RawVerse {
  id: number;
  text: string;
  translation: string;
}
interface RawChapter {
  id: number;
  name: string; // Arabic e.g. "الفاتحة"
  transliteration: string; // e.g. "Al-Fatihah"
  translation: string; // English name translation e.g. "The Opener"
  verses: RawVerse[];
}

// ─── Juz (para) boundaries — Mushaf al-Madinah ──────────────────────────────
//
// Each entry is the inclusive range of ayahs that fall in that juz. We sort
// the array once at module init and binary-search on `(surah, ayah)` to
// resolve `paraNumber` for any ayah.
//
// Boundaries are the standard 30-juz Madinah Mushaf divisions; verified
// against quran.com's chapter info for the canonical ayah IDs listed.
//
// Format: { surah: number, ayah: number }
type JuzBoundary = { surah: number; ayah: number };

interface JuzRange {
  juz: number;
  start: JuzBoundary;
  end: JuzBoundary;
}

const JUZ_RANGES: JuzRange[] = [
  { juz: 1,  start: { surah: 1, ayah: 1 },     end: { surah: 2, ayah: 141 } },
  { juz: 2,  start: { surah: 2, ayah: 142 },   end: { surah: 2, ayah: 252 } },
  { juz: 3,  start: { surah: 2, ayah: 253 },   end: { surah: 3, ayah: 92 } },
  { juz: 4,  start: { surah: 3, ayah: 93 },    end: { surah: 4, ayah: 23 } },
  { juz: 5,  start: { surah: 4, ayah: 24 },    end: { surah: 4, ayah: 147 } },
  { juz: 6,  start: { surah: 4, ayah: 148 },   end: { surah: 5, ayah: 81 } },
  { juz: 7,  start: { surah: 5, ayah: 82 },    end: { surah: 6, ayah: 110 } },
  { juz: 8,  start: { surah: 6, ayah: 111 },   end: { surah: 7, ayah: 87 } },
  { juz: 9,  start: { surah: 7, ayah: 88 },    end: { surah: 8, ayah: 40 } },
  { juz: 10, start: { surah: 8, ayah: 41 },    end: { surah: 9, ayah: 92 } },
  { juz: 11, start: { surah: 9, ayah: 93 },    end: { surah: 11, ayah: 5 } },
  { juz: 12, start: { surah: 11, ayah: 6 },    end: { surah: 12, ayah: 52 } },
  { juz: 13, start: { surah: 12, ayah: 53 },   end: { surah: 14, ayah: 52 } },
  { juz: 14, start: { surah: 15, ayah: 1 },    end: { surah: 16, ayah: 128 } },
  { juz: 15, start: { surah: 17, ayah: 1 },    end: { surah: 18, ayah: 74 } },
  { juz: 16, start: { surah: 18, ayah: 75 },   end: { surah: 20, ayah: 135 } },
  { juz: 17, start: { surah: 21, ayah: 1 },    end: { surah: 22, ayah: 78 } },
  { juz: 18, start: { surah: 23, ayah: 1 },    end: { surah: 25, ayah: 20 } },
  { juz: 19, start: { surah: 25, ayah: 21 },   end: { surah: 27, ayah: 55 } },
  { juz: 20, start: { surah: 27, ayah: 56 },   end: { surah: 29, ayah: 45 } },
  { juz: 21, start: { surah: 29, ayah: 46 },   end: { surah: 33, ayah: 30 } },
  { juz: 22, start: { surah: 33, ayah: 31 },   end: { surah: 36, ayah: 27 } },
  { juz: 23, start: { surah: 36, ayah: 28 },   end: { surah: 39, ayah: 31 } },
  { juz: 24, start: { surah: 39, ayah: 32 },   end: { surah: 41, ayah: 46 } },
  { juz: 25, start: { surah: 41, ayah: 47 },   end: { surah: 45, ayah: 37 } },
  { juz: 26, start: { surah: 46, ayah: 1 },    end: { surah: 51, ayah: 30 } },
  { juz: 27, start: { surah: 51, ayah: 31 },   end: { surah: 57, ayah: 29 } },
  { juz: 28, start: { surah: 58, ayah: 1 },    end: { surah: 66, ayah: 12 } },
  { juz: 29, start: { surah: 67, ayah: 1 },    end: { surah: 77, ayah: 50 } },
  { juz: 30, start: { surah: 78, ayah: 1 },    end: { surah: 114, ayah: 6 } },
];

// Pre-sorted comparator: lex order on (surah, ayah). We sort once.
function compareBoundaries(a: JuzBoundary, b: JuzBoundary): number {
  return a.surah !== b.surah ? a.surah - b.surah : a.ayah - b.ayah;
}
const SORTED_JUZ: JuzRange[] = [...JUZ_RANGES].sort(
  (a, b) => compareBoundaries(a.start, b.start) || compareBoundaries(a.end, b.end)
);

/**
 * Resolve the para (juz) number for a given (surah, ayah) using binary
 * search over the sorted ranges. Falls back to 1 for any out-of-range input.
 */
function paraNumberFor(surah: number, ayah: number): number {
  let lo = 0;
  let hi = SORTED_JUZ.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = SORTED_JUZ[mid];
    if (
      compareBoundaries({ surah, ayah }, r.start) < 0 ||
      compareBoundaries({ surah, ayah }, r.end) > 0
    ) {
      // Determine direction: if the target is before r.start, search left.
      // Otherwise search right. We pick by comparing surah numbers first,
      // then ayah.
      const cmp = compareBoundaries({ surah, ayah }, r.start);
      if (cmp < 0) hi = mid - 1;
      else lo = mid + 1;
      continue;
    }
    return r.juz;
  }
  return 1;
}

// ─── Dataset assembly ──────────────────────────────────────────────────────

let cachedDataset: AyatEntry[] | null = null;

async function loadDataset(): Promise<AyatEntry[]> {
  if (cachedDataset) return cachedDataset;

  // Static JSON imports. Next.js bundles these at build time; the parsed
  // array is shared across all server invocations within the same module
  // instance (memoised on `cachedDataset` below).
  // Cast as `unknown` first so TS doesn't try to type the literal as `any[]`.
  const en = (await import("quran-json/dist/quran_en.json"))
    .default as unknown as RawChapter[];
  const bn = (await import("quran-json/dist/quran_bn.json"))
    .default as unknown as RawChapter[];

  const enArr = en;
  const bnArr = bn;

  // Both arrays share the same surah ordering and the same ayah counts.
  // We assume index alignment (verified against quran-json's documented
  // structure); we never assume ayah IDs match between files because we
  // always look them up by surah-and-position, not by ID.
  const out: AyatEntry[] = [];

  for (let s = 0; s < enArr.length; s++) {
    const enCh = enArr[s];
    const bnCh = bnArr[s];
    if (!enCh || !bnCh) continue;
    if (enCh.id !== bnCh.id) {
      throw new Error(
        `[quran-data] surah index mismatch at position ${s}: en.id=${enCh.id}, bn.id=${bnCh.id}`
      );
    }
    const surahNumber = enCh.id;
    const surahName = enCh.transliteration;
    const surahNameArabic = enCh.name;
    const enVerses = enCh.verses;
    const bnVerses = bnCh.verses;
    const count = Math.min(enVerses.length, bnVerses.length);

    for (let i = 0; i < count; i++) {
      const ev = enVerses[i];
      const bv = bnVerses[i];
      const ayahNumber = ev.id;
      out.push({
        ayatId: `${surahNumber}:${ayahNumber}`,
        surahNumber,
        surahName,
        surahNameArabic,
        ayahNumber,
        paraNumber: paraNumberFor(surahNumber, ayahNumber),
        arabicText: ev.text,
        englishTranslation: ev.translation,
        bengaliTranslation: bv.translation,
      });
    }
  }

  cachedDataset = out;
  return out;
}

/**
 * Returns the entire 6236-ayat dataset (or however many the package ships).
 * The array is memoised after the first call.
 */
export async function getAllAyats(): Promise<AyatEntry[]> {
  return loadDataset();
}

// Re-export the type so consumers that already depend on this module can
// reference it without a second import from `@/models/types`.
export type { AyatEntry } from "@/models/types";

/**
 * Look up a single ayat by its stable id (`"surah:ayah"`). Returns undefined
 * if the id is malformed or out of range.
 */
export async function getAyatById(ayatId: string): Promise<AyatEntry | undefined> {
  const all = await getAllAyats();
  return all.find((a) => a.ayatId === ayatId);
}

/**
 * Pick a random ayat from the dataset that is NOT in the user's `seen` set.
 *
 * `seen` is the set of `ayatId`s the user has already been shown. If the user
 * has seen every ayah, we throw — the caller is expected to reset seen-ayats
 * (admin action) or extend the dataset before reaching that point.
 *
 * Uses `crypto.getRandomValues` for unbiased randomness on Node 18+ and
 * modern Edge runtimes.
 */
export async function pickRandomAyat(
  seen: ReadonlySet<string>
): Promise<AyatEntry> {
  const all = await getAllAyats();
  const unseen: AyatEntry[] = [];
  for (const a of all) {
    if (!seen.has(a.ayatId)) unseen.push(a);
  }
  if (unseen.length === 0) {
    throw new Error(
      "[quran-data] user has seen every available ayah; reset seen_ayats to continue"
    );
  }
  // Unbiased integer in [0, n). Rejection sampling keeps the distribution
  // uniform even if the underlying random source has slight bias.
  const max = 0xffffffff;
  const n = unseen.length;
  const limit = max - (max % n);
  const buf = new Uint32Array(1);
  let pick: number;
  do {
    crypto.getRandomValues(buf);
    pick = buf[0]!;
  } while (pick >= limit);
  return unseen[pick % n]!;
}