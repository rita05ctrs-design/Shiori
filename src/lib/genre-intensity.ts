import type { MediaItem } from "@/types/media";

export interface MediaTagItem {
  name: string;
  rank: number;
  category?: string;
}

export interface GenreIntensityBadge {
  genre: string;
  intensity: number | null;
  source: "exact_tag" | "category_tag" | "none";
}

function normKey(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Secondary homonym / AniList category mappings when AniList does not expose
 * a tag with the exact same name as a genre (e.g. "Action" -> Theme-Action).
 */
const GENRE_CATEGORY_MAP: Record<string, string[]> = {
  action: ["theme action"],
  adventure: ["theme adventure", "theme fantasy"],
  comedy: ["theme comedy"],
  drama: ["theme drama"],
  ecchi: ["sexual content"],
  fantasy: ["theme fantasy", "setting universe"],
  horror: ["theme horror"],
  "mahou shoujo": ["theme fantasy"],
  mecha: ["theme sci fi"],
  music: ["theme arts music"],
  mystery: ["theme mystery"],
  psychological: ["theme psychological"],
  romance: ["theme romance"],
  "sci fi": ["theme sci fi"],
  "slice of life": ["theme slice of life"],
  sports: ["theme game sport"],
  supernatural: ["theme supernatural"],
  thriller: ["theme thriller", "theme psychological"],
};

const GENRE_SYNONYM_TAGS: Record<string, string[]> = {
  action: ["action", "battle royale", "martial arts", "swordplay", "super power"],
  adventure: ["adventure", "travel", "survival", "exploration"],
  comedy: ["comedy", "parody", "slapstick", "satire", "surreal comedy"],
  drama: ["drama", "tragedy", "coming of age", "family life", "revenge"],
  fantasy: ["fantasy", "magic", "urban fantasy", "dark fantasy", "isekai", "high fantasy"],
  horror: ["horror", "gore", "body horror", "cosmic horror"],
  "mahou shoujo": ["mahou shoujo", "magical girl", "henshin"],
  mecha: ["mecha", "super robot", "real robot"],
  music: ["music", "band", "idol", "musical"],
  mystery: ["mystery", "detective", "conspiracy", "crime"],
  psychological: ["psychological", "philosophy", "denpa", "memory manipulation"],
  romance: ["romance", "love triangle", "heterosexual", "boys love", "yuri", "school"],
  "sci fi": ["sci fi", "cyberpunk", "space", "time manipulation", "dystopian", "artificial intelligence"],
  "slice of life": ["slice of life", "iyashikei", "cute girls doing cute things", "work", "school"],
  sports: ["sports", "basketball", "football", "volleyball", "boxing", "baseball", "cycling"],
  supernatural: ["supernatural", "youkai", "demons", "ghost", "angels", "vampire"],
  thriller: ["thriller", "survival", "death game", "espionage", "crime"],
};

/**
 * Resolves the AniList percentage intensity (`rank`, 0-100) for a single genre:
 * 1. Exact case-insensitive homonymous tag match in `tags` (primary rule).
 * 2. Clean AniList category / direct sub-tag fallback (`Theme-<Genre>`).
 * 3. Returns `null` cleanly if no real AniList tag signal exists.
 */
export function resolveSingleGenreIntensity(
  genre: string,
  tags: readonly MediaTagItem[] | undefined | null
): GenreIntensityBadge {
  const gNorm = normKey(genre);
  if (!gNorm || !Array.isArray(tags) || tags.length === 0) {
    return { genre, intensity: null, source: "none" };
  }

  // 1. Exact case-insensitive homonymous tag match
  for (const tag of tags) {
    if (normKey(tag.name) === gNorm && Number.isFinite(tag.rank)) {
      return {
        genre,
        intensity: Math.max(0, Math.min(100, Math.round(tag.rank))),
        source: "exact_tag",
      };
    }
  }

  // 2. Category or canonical sub-tag match (authentic AniList rank, never fabricated)
  const expectedCategories = GENRE_CATEGORY_MAP[gNorm] ?? [];
  const expectedSynonyms = GENRE_SYNONYM_TAGS[gNorm] ?? [];
  let bestCategoryRank: number | null = null;

  for (const tag of tags) {
    if (!Number.isFinite(tag.rank)) continue;
    const tName = normKey(tag.name);
    const tCat = normKey(tag.category);
    const isCatMatch =
      expectedCategories.length > 0 &&
      expectedCategories.some((cat) => tCat === cat || tCat.startsWith(cat));
    const isSynMatch = expectedSynonyms.includes(tName);

    if (isCatMatch || isSynMatch) {
      const r = Math.max(0, Math.min(100, Math.round(tag.rank)));
      if (bestCategoryRank === null || r > bestCategoryRank) {
        bestCategoryRank = r;
      }
    }
  }

  if (bestCategoryRank !== null) {
    return { genre, intensity: bestCategoryRank, source: "category_tag" };
  }

  return { genre, intensity: null, source: "none" };
}

export function computeGenreIntensities(
  genres: readonly string[],
  tags: readonly MediaTagItem[] | undefined | null
): GenreIntensityBadge[] {
  return genres.map((genre) => resolveSingleGenreIntensity(genre, tags));
}

/**
 * Normalizes a per-genre minimum threshold map (`Record<string, number>`),
 * clamping values to 0..100 (5% increments) and keeping only active genres if specified.
 */
export function normalizeGenreMinRanks(
  raw: Record<string, unknown> | null | undefined,
  activeGenres?: readonly string[]
): Record<string, number> {
  const out: Record<string, number> = {};
  const allowed = activeGenres ? new Set(activeGenres) : null;

  if (raw && typeof raw === "object") {
    for (const [genre, val] of Object.entries(raw)) {
      const g = genre.trim();
      if (!g || (allowed && !allowed.has(g))) continue;
      const num = typeof val === "number" ? val : Number(val);
      if (!Number.isFinite(num)) continue;
      out[g] = Math.max(0, Math.min(100, Math.round(num / 5) * 5));
    }
  }

  if (activeGenres) {
    for (const g of activeGenres) {
      if (!(g in out)) out[g] = 0;
    }
  }

  return out;
}

/**
 * Encodes non-zero per-genre thresholds cleanly for URL query params:
 * `{ Romance: 80, Comedy: 30, Drama: 0 }` -> `"Romance:80,Comedy:30"`.
 */
export function serializeGenreMinRanks(
  ranks: Record<string, number>,
  activeGenres?: readonly string[]
): string {
  const keys = activeGenres ?? Object.keys(ranks);
  const parts: string[] = [];
  for (const genre of keys) {
    const val = ranks[genre];
    if (typeof val === "number" && Number.isFinite(val) && val > 0) {
      const clamped = Math.max(5, Math.min(100, Math.round(val / 5) * 5));
      parts.push(`${genre}:${clamped}`);
    }
  }
  return parts.join(",");
}

/**
 * Parses URL `genreRanks` param (`"Romance:80,Comedy:30"`) into a clean map.
 */
export function parseGenreMinRanks(
  raw: string | null | undefined,
  activeGenres?: readonly string[]
): Record<string, number> {
  const parsed: Record<string, number> = {};
  if (raw && typeof raw === "string") {
    for (const part of raw.split(",")) {
      const sep = part.lastIndexOf(":");
      if (sep <= 0) continue;
      const genre = part.slice(0, sep).trim();
      const val = Number(part.slice(sep + 1).trim());
      if (genre && Number.isFinite(val) && val >= 0) {
        parsed[genre] = Math.max(0, Math.min(100, Math.round(val / 5) * 5));
      }
    }
  }
  return normalizeGenreMinRanks(parsed, activeGenres);
}

/**
 * Checks whether a MediaItem meets EVERY selected genre's independent minimum
 * intensity threshold (e.g. `Romance >= 80%` AND `Comedy >= 30%`).
 */
export function mediaMatchesGenreMinRanks(
  media: Pick<MediaItem, "genres" | "tags">,
  requiredGenres: readonly string[],
  genreMinRanks: Record<string, number>
): boolean {
  if (requiredGenres.length === 0) return true;

  const activeCutoffs = requiredGenres
    .map((genre) => ({
      genre,
      minRank: Math.max(0, Math.min(100, Math.round(genreMinRanks[genre] ?? 0))),
    }))
    .filter((entry) => entry.minRank > 0);

  if (activeCutoffs.length === 0) return true;
  if (!media.tags || media.tags.length === 0) return false;

  return activeCutoffs.every(({ genre, minRank }) => {
    const resolved = resolveSingleGenreIntensity(genre, media.tags);
    return resolved.intensity !== null && resolved.intensity >= minRank;
  });
}

/**
 * Backwards-compatible wrapper applying a single threshold across all genres.
 */
export function mediaMatchesMinGenreIntensity(
  media: Pick<MediaItem, "genres" | "tags">,
  requiredGenres: readonly string[],
  minRank: number
): boolean {
  if (minRank <= 0 || requiredGenres.length === 0) return true;
  const map: Record<string, number> = {};
  for (const g of requiredGenres) map[g] = minRank;
  return mediaMatchesGenreMinRanks(media, requiredGenres, map);
}
