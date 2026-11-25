import { normalizeSearchText, resolveSearchAlias } from "./searchAliases.ts";
import type { LibraryEntry, MediaItem } from "@/types/media";

/**
 * Optimal String Alignment (Damerau-Levenshtein) distance handling adjacent
 * character transpositions (e.g. "frierne" -> "frieren", "atack" -> "attack").
 */
export function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const dp: number[][] = Array.from({ length: la + 1 }, () =>
    new Array<number>(lb + 1).fill(0)
  );
  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        val = Math.min(val, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = val;
    }
  }

  return dp[la][lb];
}

function tokenSimilarity(qTok: string, fTok: string): number {
  if (qTok === fTok) return 1;
  if (fTok.startsWith(qTok)) {
    return 0.9 + Math.min(0.08, (qTok.length / Math.max(1, fTok.length)) * 0.08);
  }
  if (qTok.length >= 3 && fTok.includes(qTok)) return 0.82;
  const maxLen = Math.max(qTok.length, fTok.length);
  if (maxLen <= 2) return 0;
  const dist = damerauLevenshtein(qTok, fTok);
  const sim = 1 - dist / maxLen;
  // Tolerate 1 edit for tokens >= 4 chars, up to 2 edits for tokens >= 7 chars
  const maxAllowedDist = maxLen >= 7 ? 2 : maxLen >= 4 ? 1 : 0;
  return dist <= maxAllowedDist ? Math.max(0, sim * 0.86) : 0;
}

/**
 * Computes a normalized 0..1 similarity score between a user query and a single
 * candidate field (Romaji, English, Native, or Synonym).
 */
export function computeFuzzyFieldScore(
  rawQuery: string,
  rawCandidate: string | null | undefined
): number {
  if (!rawCandidate) return 0;
  const qNorm = normalizeSearchText(rawQuery);
  const cNorm = normalizeSearchText(rawCandidate);

  // Native Japanese / non-Latin exact/substring fallback (when ASCII stripping empties it)
  if (!qNorm || !cNorm) {
    const qLower = rawQuery.trim().toLowerCase();
    const cLower = rawCandidate.trim().toLowerCase();
    if (!qLower || !cLower) return 0;
    if (cLower === qLower) return 1;
    if (cLower.startsWith(qLower)) return 0.94;
    if (cLower.includes(qLower)) return 0.85;
    return 0;
  }

  if (cNorm === qNorm) return 1;
  if (cNorm.startsWith(qNorm)) return 0.95;
  if (cNorm.includes(qNorm)) {
    const ratio = qNorm.length / Math.max(1, cNorm.length);
    return 0.84 + Math.min(0.09, ratio * 0.1);
  }

  // Token-by-token fuzzy comparison (handles word swaps + typos across multi-word titles)
  const qTokens = qNorm.split(" ").filter(Boolean);
  const cTokens = cNorm.split(" ").filter(Boolean);
  if (qTokens.length === 0 || cTokens.length === 0) return 0;

  let tokenSum = 0;
  let matchedCount = 0;
  for (const qt of qTokens) {
    let bestTok = 0;
    for (const ct of cTokens) {
      const s = tokenSimilarity(qt, ct);
      if (s > bestTok) bestTok = s;
    }
    if (bestTok >= 0.52) {
      matchedCount++;
      tokenSum += bestTok;
    }
  }

  const tokenScore =
    matchedCount > 0
      ? (tokenSum / qTokens.length) * (matchedCount / qTokens.length)
      : 0;

  // Whole-string fuzzy check (catches concatenated words like "shingekinokyojin" or minor typos)
  let wholeScore = 0;
  if (Math.abs(qNorm.length - cNorm.length) <= Math.max(3, Math.floor(cNorm.length * 0.35))) {
    const maxLen = Math.max(qNorm.length, cNorm.length);
    const dist = damerauLevenshtein(qNorm, cNorm);
    const sim = 1 - dist / maxLen;
    if (sim >= 0.68) wholeScore = sim * 0.88;
  }

  return Math.max(tokenScore, wholeScore);
}

/**
 * Indexes and compares `title.romaji`, `title.english`, `title.native`, and `synonyms`
 * (plus studio as a light secondary signal) against both the raw query and resolved alias.
 */
export function scoreMediaFuzzyMatch(
  media: Pick<MediaItem, "title" | "synonyms" | "studio" | "popularity">,
  rawQuery: string,
  resolvedQuery?: string
): number {
  const queries = [rawQuery.trim()];
  if (resolvedQuery && resolvedQuery.trim() && resolvedQuery.trim() !== rawQuery.trim()) {
    queries.push(resolvedQuery.trim());
  }

  const fields: { text: string | null | undefined; weight: number }[] = [
    { text: media.title.english, weight: 1.0 },
    { text: media.title.romaji, weight: 1.0 },
    { text: media.title.native, weight: 0.98 },
    ...(media.synonyms ?? []).slice(0, 12).map((syn) => ({ text: syn, weight: 0.94 })),
    { text: media.studio, weight: 0.55 },
  ];

  let best = 0;
  for (const q of queries) {
    for (const f of fields) {
      const s = computeFuzzyFieldScore(q, f.text) * f.weight;
      if (s > best) best = s;
    }
  }

  return best;
}

/**
 * Ranks an array of AniList MediaItems so the closest multilingual & typo-tolerant
 * matches appear first, using popularity gently as a tie-breaker among equal matches.
 */
export function rankMediaByFuzzySearch(
  items: MediaItem[],
  rawQuery: string,
  resolvedQuery?: string,
  minThreshold = 0
): MediaItem[] {
  const trimmed = rawQuery.trim();
  if (!trimmed) return items;

  const scored = items.map((item, idx) => {
    const fuzzy = scoreMediaFuzzyMatch(item, trimmed, resolvedQuery);
    // Tiny log-popularity tiebreaker (max +0.06) so Season 1 / flagship wins ties
    const popBoost = item.popularity
      ? Math.min(0.06, Math.log10(Math.max(10, item.popularity)) * 0.01)
      : 0;
    return {
      item,
      idx,
      fuzzy,
      combined: fuzzy + popBoost,
    };
  });

  const filtered =
    minThreshold > 0 ? scored.filter((s) => s.fuzzy >= minThreshold) : scored;

  filtered.sort((a, b) => {
    if (Math.abs(b.combined - a.combined) > 0.015) {
      return b.combined - a.combined;
    }
    return a.idx - b.idx;
  });

  return filtered.map((s) => s.item);
}

/**
 * Multilingual + alias + typo-tolerant matcher for the user's personal library.
 */
export function searchLibraryEntriesFuzzy(
  entries: LibraryEntry[],
  rawQuery: string,
  limit = 4
): LibraryEntry[] {
  const trimmed = rawQuery.trim();
  if (!trimmed) return [];

  const alias = resolveSearchAlias(trimmed);
  const queries = alias.didExpand ? [trimmed, alias.resolvedQuery] : [trimmed];

  const scored: { entry: LibraryEntry; score: number }[] = [];
  for (const entry of entries) {
    let best = 0;
    for (const q of queries) {
      best = Math.max(
        best,
        computeFuzzyFieldScore(q, entry.title),
        computeFuzzyFieldScore(q, entry.nativeTitle),
        computeFuzzyFieldScore(q, entry.studio) * 0.65
      );
    }
    if (best >= 0.45) {
      scored.push({ entry, score: best });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

/**
 * Generates clean fallback query candidates if a typo'd query returns 0 live hits
 * from AniList's strict search endpoint (e.g. "frierne" -> "frier").
 */
export function buildTypoFallbackQueries(rawQuery: string): string[] {
  const norm = normalizeSearchText(rawQuery);
  if (norm.length < 4) return [];

  const candidates: string[] = [];
  const words = norm.split(" ").filter((w) => w.length >= 3);

  // 1. Trim last 2 chars of the query (catches tail typos like "frierne" -> "frier", "kaisn" -> "kai")
  if (norm.length >= 6) {
    candidates.push(norm.slice(0, norm.length - 2).trim());
  } else if (norm.length >= 4) {
    candidates.push(norm.slice(0, norm.length - 1).trim());
  }

  // 2. Longest distinctive word (or prefix of it) for multi-word typos ("atack on titan" -> "titan")
  if (words.length >= 2) {
    const longest = [...words].sort((a, b) => b.length - a.length)[0];
    if (longest && longest.length >= 4 && !candidates.includes(longest)) {
      candidates.push(longest);
    }
  }

  return candidates.filter((c) => c.length >= 3 && c !== norm).slice(0, 2);
}
