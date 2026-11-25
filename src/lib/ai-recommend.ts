import type { LibraryStatus, MediaItem, MediaType } from "@/types/media";

export const AI_RECS_START = "<<<SHIORI_RECS>>>";
export const AI_RECS_END = "<<<END_SHIORI_RECS>>>";

const AI_RECS_START_RE = /<{1,4}\s*SHIORI_RECS\s*>{0,4}/i;
const AI_RECS_END_RE = /<{1,4}\s*\/?\s*END_SHIORI_RECS\s*>{0,4}|<\/\s*SHIORI_RECS\s*>/i;

export interface TasteLibraryEntry {
  mediaId: number;
  type: MediaType;
  title: string;
  status: LibraryStatus;
  score: number | null;
  isFavorite: boolean;
  genres: string[];
}

export interface UserTasteSummary {
  favorites: { mediaId: number; title: string; score: number | null; genres: string[] }[];
  topRated: { mediaId: number; title: string; score: number; genres: string[] }[];
  watching: { mediaId: number; title: string }[];
  topGenres: string[];
  seenIds: Set<number>;
  seenTitles: string[];
  seenNormalizedTitles: Set<string>;
  totalAnimeCount: number;
}

export interface AiRawRecommendation {
  title: string;
  reason: string;
  matchTag?: string;
}

export interface AiResolvedRecommendation {
  media: MediaItem;
  reason: string;
  matchTag?: string;
}

export function normalizeTitleKey(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function buildUserTasteSummary(entries: TasteLibraryEntry[]): UserTasteSummary {
  const animeEntries = entries.filter((e) => e.type === "ANIME");
  const pool = animeEntries.length > 0 ? animeEntries : entries;

  const seenIds = new Set<number>();
  const seenTitles: string[] = [];
  const seenNormalizedTitles = new Set<string>();

  for (const e of entries) {
    if (Number.isInteger(e.mediaId) && e.mediaId > 0) {
      seenIds.add(e.mediaId);
    }
    const cleanTitle = e.title?.trim();
    if (cleanTitle) {
      const norm = normalizeTitleKey(cleanTitle);
      if (norm && !seenNormalizedTitles.has(norm)) {
        seenNormalizedTitles.add(norm);
        seenTitles.push(cleanTitle);
      }
    }
  }

  const favorites = pool
    .filter((e) => e.isFavorite)
    .sort((a, b) => (b.score ?? 8) - (a.score ?? 8))
    .slice(0, 15)
    .map((e) => ({
      mediaId: e.mediaId,
      title: e.title,
      score: e.score,
      genres: e.genres.slice(0, 3),
    }));

  const topRated = pool
    .filter((e) => typeof e.score === "number" && e.score >= 8)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 20)
    .map((e) => ({
      mediaId: e.mediaId,
      title: e.title,
      score: e.score as number,
      genres: e.genres.slice(0, 3),
    }));

  const watching = pool
    .filter((e) => e.status === "WATCHING")
    .slice(0, 12)
    .map((e) => ({ mediaId: e.mediaId, title: e.title }));

  const genreWeights = new Map<string, number>();
  for (const e of pool) {
    if (e.status === "DROPPED") continue;
    const weight = (e.score ?? 7.2) + (e.isFavorite ? 3 : 0);
    for (const g of e.genres) {
      const genre = g.trim();
      if (!genre) continue;
      genreWeights.set(genre, (genreWeights.get(genre) ?? 0) + weight);
    }
  }

  const topGenres = Array.from(genreWeights.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([g]) => g);

  return {
    favorites,
    topRated,
    watching,
    topGenres,
    seenIds,
    seenTitles: seenTitles.slice(0, 220),
    seenNormalizedTitles,
    totalAnimeCount: animeEntries.length,
  };
}

export function buildShioriSystemPrompt(
  summary: UserTasteSummary,
  displayName?: string | null
): string {
  const userLabel = displayName?.trim() ? displayName.trim() : "l'utilisateur";

  const favLine =
    summary.favorites.length > 0
      ? summary.favorites
          .map((f) => `${f.title}${f.score !== null ? ` (${f.score}/10)` : ""}`)
          .join(", ")
      : "Aucun favori renseigné pour le moment";

  const topLine =
    summary.topRated.length > 0
      ? summary.topRated
          .map((t) => `${t.title} (${t.score}/10)`)
          .join(", ")
      : "Aucune note élevée enregistrée";

  const watchingLine =
    summary.watching.length > 0
      ? summary.watching.map((w) => w.title).join(", ")
      : "Aucun anime en cours";

  const genresLine =
    summary.topGenres.length > 0
      ? summary.topGenres.join(", ")
      : "Pas encore de genres dominants";

  const excludeList =
    summary.seenTitles.length > 0
      ? summary.seenTitles.join(" | ")
      : "Aucun titre déjà vu enregistré";

  return [
    `Tu es Shiori IA, l'assistant personnel d'anime de ${userLabel} dans l'application Shiori.`,
    `Ton style est naturel, passionné, précis et concis (réponds en français sauf si l'utilisateur écrit dans une autre langue).`,
    ``,
    `## Profil de goûts de ${userLabel}`,
    `- Favoris : ${favLine}`,
    `- Mieux notés : ${topLine}`,
    `- En cours de visionnage : ${watchingLine}`,
    `- Genres dominants : ${genresLine}`,
    ``,
    `## RÈGLE ABSOLUE D'EXCLUSION (TITRES DÉJÀ VUS / DANS LA LISTE)`,
    `Ne recommande JAMAIS un anime déjà présent dans cette liste (ni une de ses saisons déjà listées) :`,
    excludeList,
    ``,
    `## Format de réponse`,
    `1. Réponds de manière fluide et conversationnelle à la demande (3 à 4 titres recommandés idéalement, sauf si l'utilisateur en demande un nombre précis).`,
    `2. Explique brièvement en quoi chaque anime correspond aux goûts de ${userLabel} et à sa demande, sans spoiler.`,
    `3. À la toute fin de ta réponse, lorsque tu recommandes des animés, ajoute OBLIGATOIREMENT le bloc JSON structuré suivant sur une ligne dédiée, entouré des balises exactes :`,
    `${AI_RECS_START}[{"title":"Titre exact AniList/Romaji ou Anglais","reason":"Raison concise en 1 phrase","matchTag":"Genre ou ambiance"}]${AI_RECS_END}`,
    `N'écris rien après ${AI_RECS_END}. N'ajoute pas de bloc markdown \`\`\` autour du JSON.`,
  ].join("\n");
}

/**
 * Strips any complete, malformed, or in-progress <<<SHIORI_RECS>>> block so text
 * displayed to the user stays 100% clean natural language with zero JSON leakage.
 */
export function stripRecommendationsMarkerForDisplay(rawText: string): string {
  const startMatch = AI_RECS_START_RE.exec(rawText);
  if (startMatch) {
    return rawText
      .slice(0, startMatch.index)
      .replace(/(?:```(?:json)?\s*)$/i, "")
      .trimEnd();
  }

  // Guard against partial marker arriving at the tail of a stream chunk (e.g. "<<<SHIOR")
  for (let len = Math.min(AI_RECS_START.length - 1, rawText.length); len >= 3; len--) {
    if (rawText.endsWith(AI_RECS_START.slice(0, len))) {
      return rawText.slice(0, rawText.length - len);
    }
  }

  return rawText;
}

/**
 * Extracts natural-language reply text and parsed structured recommendations from
 * the completed model output (tolerant to minor delimiter typos like `<<<SHIORI_RECS>`).
 */
export function extractAiRecommendationsBlock(fullText: string): {
  cleanText: string;
  recommendations: AiRawRecommendation[];
} {
  const startMatch = AI_RECS_START_RE.exec(fullText);
  if (!startMatch) {
    return { cleanText: fullText.trim(), recommendations: [] };
  }

  const cleanText = fullText
    .slice(0, startMatch.index)
    .replace(/(?:```(?:json)?\s*)$/i, "")
    .trim();
  const afterStart = fullText.slice(startMatch.index + startMatch[0].length);
  const endMatch = AI_RECS_END_RE.exec(afterStart);
  let jsonSlice = (endMatch ? afterStart.slice(0, endMatch.index) : afterStart)
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const firstBracket = jsonSlice.indexOf("[");
  const lastBracket = jsonSlice.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    jsonSlice = jsonSlice.slice(firstBracket, lastBracket + 1);
  }

  if (!jsonSlice) {
    return { cleanText, recommendations: [] };
  }

  try {
    const parsed = JSON.parse(jsonSlice);
    if (!Array.isArray(parsed)) {
      return { cleanText, recommendations: [] };
    }

    const recommendations: AiRawRecommendation[] = [];
    const seenTitleKeys = new Set<string>();

    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const title =
        typeof (item as { title?: unknown }).title === "string"
          ? (item as { title: string }).title.trim()
          : "";
      if (!title || title.length > 140) continue;

      const norm = normalizeTitleKey(title);
      if (!norm || seenTitleKeys.has(norm)) continue;
      seenTitleKeys.add(norm);

      const reason =
        typeof (item as { reason?: unknown }).reason === "string"
          ? (item as { reason: string }).reason.trim().slice(0, 220)
          : "Recommandé selon vos goûts";
      const matchTag =
        typeof (item as { matchTag?: unknown }).matchTag === "string"
          ? (item as { matchTag: string }).matchTag.trim().slice(0, 40)
          : undefined;

      recommendations.push({ title, reason, matchTag });
      if (recommendations.length >= 6) break;
    }

    return { cleanText, recommendations };
  } catch {
    return { cleanText, recommendations: [] };
  }
}

export function isMediaAlreadySeen(
  media: Pick<MediaItem, "id" | "title">,
  seenIds: Set<number>,
  seenNormalizedTitles: Set<string>
): boolean {
  if (seenIds.has(media.id)) return true;
  const candidates = [media.title.romaji, media.title.english, media.title.native];
  for (const t of candidates) {
    const norm = normalizeTitleKey(t);
    if (norm && seenNormalizedTitles.has(norm)) return true;
  }
  return false;
}

export function filterUnseenResolvedRecommendations(
  items: AiResolvedRecommendation[],
  seenIds: Set<number>,
  seenNormalizedTitles: Set<string>
): AiResolvedRecommendation[] {
  const out: AiResolvedRecommendation[] = [];
  const emittedIds = new Set<number>();

  for (const item of items) {
    if (emittedIds.has(item.media.id)) continue;
    if (isMediaAlreadySeen(item.media, seenIds, seenNormalizedTitles)) continue;
    emittedIds.add(item.media.id);
    out.push(item);
  }

  return out;
}

/**
 * Extracts explicit genre hints from a natural French/English prompt so fallback
 * AniList discovery matches what the user actually asked for.
 */
export function inferGenresFromPrompt(prompt: string, fallbackGenres: string[]): string[] {
  const p = normalizeTitleKey(prompt);
  const matched: string[] = [];

  const rules: [RegExp, string][] = [
    [/\b(action|baston|combat|shonen|shonen|shonen|shonen)\b/, "Action"],
    [/\b(aventure|adventure|voyage|quete)\b/, "Adventure"],
    [/\b(comedie|comedy|drole|humour|rire|marrant)\b/, "Comedy"],
    [/\b(drame|drama|triste|emouvant|emotion|pleurer)\b/, "Drama"],
    [/\b(fantasy|fantaisie|magie|isekai|medieval)\b/, "Fantasy"],
    [/\b(horreur|horror|peur|effrayant|gore|sombre)\b/, "Horror"],
    [/\b(mystere|mystery|enquete|detective|policier)\b/, "Mystery"],
    [/\b(psychologique|psychological|seinen|sombre|mindfuck|cerebral)\b/, "Psychological"],
    [/\b(romance|amour|romantique|shojo)\b/, "Romance"],
    [/\b(sci fi|science fiction|sf|cyberpunk|espace|futuriste|mecha)\b/, "Sci-Fi"],
    [/\b(slice of life|tranche de vie|calme|chill|reposant|cozy)\b/, "Slice of Life"],
    [/\b(sport|sports|foot|basket|volley|boxe)\b/, "Sports"],
    [/\b(surnaturel|supernatural|fantome|demon|yokai)\b/, "Supernatural"],
    [/\b(thriller|suspense|tension)\b/, "Thriller"],
  ];

  for (const [regex, genre] of rules) {
    if (regex.test(p) && !matched.includes(genre)) {
      matched.push(genre);
    }
  }

  if (matched.length > 0) return matched.slice(0, 2);
  if (fallbackGenres.length > 0) return fallbackGenres.slice(0, 2);
  return ["Action", "Drama"];
}
