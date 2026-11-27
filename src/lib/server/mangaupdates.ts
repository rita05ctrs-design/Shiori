import {
  resolveFromMangaUpdatesSeries,
  type MangaUpdatesSeriesInput,
  type TargetAnimeDescriptor,
} from "@/lib/mangaupdates-parser";
import type { MangaContinuationInfo, SourceMediumKind } from "@/lib/manga-continuation";
import type { ContentLanguage } from "@/types/media";

const MU_API_BASE = "https://api.mangaupdates.com/v1";
const MU_CACHE_TTL_FINISHED_MS = 6 * 60 * 60 * 1000; // 6 hours
const MU_CACHE_TTL_RELEASING_MS = 15 * 60 * 1000; // 15 minutes for airing shows (e.g. One Piece!)
const MAX_MU_CACHE = 300;

interface CachedMuSeries {
  series: MangaUpdatesSeriesInput | null;
  expiresAt: number;
}

const muSeriesCache = new Map<string, CachedMuSeries>();

function normTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Strips season/part/movie suffixes from an anime title to obtain the clean base franchise title
 * for searching MangaUpdates (e.g. "JUJUTSU KAISEN Season 3: The Culling Game" -> "JUJUTSU KAISEN").
 */
export function stripSeasonSuffixForSearch(raw: string): string {
  return raw
    .replace(/\s*[:\-–—]\s*(?:the\s+)?(?:movie|final\s+season|season\s+\d+|part\s+\d+|cour\s+\d+|arise\s+from\s+the\s+shadow|the\s+culling\s+game|infinity\s+castle|entertainment\s+district|swordsmith\s+village|hashira\s+training|mugen\s+train|thousand-year\s+blood\s+war|to\s+the\s+top|stone\s+wars|new\s+world|science\s+future).*$/i, "")
    .replace(/\s+(?:season\s*\d+|\d+(?:st|nd|rd|th)\s+season|part\s*\d+|cour\s*\d+|final\s+season|ii|iii|iv|movie\s*\d*)$/i, "")
    .trim();
}

function scoreMuCandidate(
  candidate: {
    title?: string;
    type?: string;
    year?: string;
  },
  queryNorms: string[],
  expectedKind: SourceMediumKind
): number {
  const titleNorm = normTitle(candidate.title ?? "");
  const typeNorm = (candidate.type ?? "").toLowerCase();

  // Never pick Doujinshi or Drama CD
  if (typeNorm === "doujinshi" || typeNorm === "drama cd") return -1000;

  let score = 0;

  // Medium match
  if (expectedKind === "MANHWA") {
    score += typeNorm === "manhwa" ? 50 : typeNorm === "manga" ? -10 : -30;
  } else if (expectedKind === "MANHUA") {
    score += typeNorm === "manhua" ? 50 : -20;
  } else if (expectedKind === "NOVEL" || expectedKind === "WEB_NOVEL") {
    score += typeNorm === "novel" ? 40 : typeNorm === "manga" ? 25 : -10;
  } else {
    score += typeNorm === "manga" ? 45 : typeNorm === "manhwa" ? -10 : -25;
  }

  // Title similarity
  let bestTitleScore = 0;
  for (const q of queryNorms) {
    if (!q) continue;
    if (titleNorm === q) {
      bestTitleScore = Math.max(bestTitleScore, 100);
    } else if (titleNorm.startsWith(q) || q.startsWith(titleNorm)) {
      const lenDiff = Math.abs(titleNorm.length - q.length);
      bestTitleScore = Math.max(bestTitleScore, Math.max(45, 85 - lenDiff));
    } else if (titleNorm.includes(q) || q.includes(titleNorm)) {
      bestTitleScore = Math.max(bestTitleScore, 55);
    } else {
      const qWords = new Set(q.split(" ").filter((w) => w.length >= 2));
      const tWords = titleNorm.split(" ").filter((w) => w.length >= 2);
      const overlap = tWords.filter((w) => qWords.has(w)).length;
      if (qWords.size > 0 && overlap > 0) {
        bestTitleScore = Math.max(
          bestTitleScore,
          Math.round((overlap / Math.max(qWords.size, tWords.length)) * 75)
        );
      }
    }
  }

  // Penalize obvious spin-offs / anthologies / official fanbooks
  if (/\b(?:anthology|fanbook|dj|parody|4-koma|spin-off|gaiden|side\s+story|novel)\b/i.test(candidate.title ?? "")) {
    if (expectedKind !== "NOVEL") score -= 35;
  }

  return score + bestTitleScore;
}

async function fetchMuJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches live MangaUpdates series adaptation metadata (`anime.start` & `anime.end`)
 * for a source manga/manhwa/manhua/novel title with smart caching.
 */
export async function fetchMangaUpdatesSeriesLive(input: {
  sourceTitle?: string | null;
  animeTitle: string;
  romajiTitle?: string | null;
  expectedKind: SourceMediumKind;
  isReleasing: boolean;
}): Promise<MangaUpdatesSeriesInput | null> {
  const rawQueries = [
    input.sourceTitle?.trim(),
    stripSeasonSuffixForSearch(input.romajiTitle ?? ""),
    stripSeasonSuffixForSearch(input.animeTitle),
  ].filter((q): q is string => Boolean(q && q.length >= 2));

  const uniqueQueries = Array.from(new Set(rawQueries));
  if (uniqueQueries.length === 0) return null;

  const cacheKey = `${input.expectedKind}:${normTitle(uniqueQueries[0])}`;
  const cached = muSeriesCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.series;
  }

  const queryNorms = uniqueQueries.map(normTitle);
  let resolved: MangaUpdatesSeriesInput | null = null;

  for (const query of uniqueQueries.slice(0, 2)) {
    const searchJson = await fetchMuJson<{
      results?: Array<{
        record?: {
          series_id?: number;
          title?: string;
          type?: string;
          year?: string;
        };
      }>;
    }>(`${MU_API_BASE}/series/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ search: query, perpage: 8 }),
    });

    const candidates = (searchJson?.results ?? [])
      .map((r) => r.record)
      .filter((r): r is NonNullable<typeof r> => Boolean(r?.series_id))
      .map((c) => ({ c, score: scoreMuCandidate(c, queryNorms, input.expectedKind) }))
      .filter((x) => x.score >= 55)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    for (const { c } of candidates) {
      const detail = await fetchMuJson<{
        title?: string;
        type?: string;
        latest_chapter?: number;
        completed?: boolean;
        anime?: { start?: string | null; end?: string | null } | null;
      }>(`${MU_API_BASE}/series/${c.series_id}`);

      if (detail?.anime && (detail.anime.end || detail.anime.start)) {
        resolved = {
          title: detail.title ?? c.title ?? query,
          type: detail.type ?? c.type ?? null,
          latestChapter:
            typeof detail.latest_chapter === "number" ? detail.latest_chapter : null,
          completed: Boolean(detail.completed),
          animeStart: detail.anime.start ?? null,
          animeEnd: detail.anime.end ?? null,
        };
        break;
      }
    }

    if (resolved) break;
  }

  if (muSeriesCache.size >= MAX_MU_CACHE) {
    const oldest = muSeriesCache.keys().next().value;
    if (oldest) muSeriesCache.delete(oldest);
  }
  muSeriesCache.set(cacheKey, {
    series: resolved,
    expiresAt:
      Date.now() +
      (input.isReleasing ? MU_CACHE_TTL_RELEASING_MS : MU_CACHE_TTL_FINISHED_MS),
  });

  return resolved;
}

/**
 * End-to-end live MangaUpdates resolution for any anime entry.
 */
export async function lookupLiveMangaUpdatesContinuation(input: {
  sourceTitle?: string | null;
  target: TargetAnimeDescriptor;
  fallbackKind: SourceMediumKind;
  lang: ContentLanguage;
  isReleasing: boolean;
}): Promise<MangaContinuationInfo | null> {
  const series = await fetchMangaUpdatesSeriesLive({
    sourceTitle: input.sourceTitle,
    animeTitle: input.target.title,
    romajiTitle: input.target.romajiTitle,
    expectedKind: input.fallbackKind,
    isReleasing: input.isReleasing,
  });
  if (!series) return null;

  return resolveFromMangaUpdatesSeries(series, input.target, input.fallbackKind, input.lang);
}
