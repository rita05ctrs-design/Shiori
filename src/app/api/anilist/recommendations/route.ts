import { NextRequest, NextResponse } from "next/server";
import { getSeedData } from "@/lib/anilist";
import type { MediaItem, MediaType, PersonalizedRecommendation } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

const REC_MEDIA_FIELDS = `
  id
  type
  title { romaji english native }
  coverImage { extraLarge large color }
  bannerImage
  description(asHtml: false)
  format
  status
  episodes
  chapters
  volumes
  duration
  season
  seasonYear
  startDate { year month day }
  averageScore
  meanScore
  popularity
  favourites
  genres
  studios(isMain: true) { nodes { name } }
  trailer { id site }
  nextAiringEpisode { airingAt timeUntilAiring episode }
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRecMedia(raw: any): MediaItem {
  return {
    id: Number(raw.id),
    type: (raw.type === "MANGA" ? "MANGA" : "ANIME") as MediaType,
    title: {
      romaji: raw.title?.romaji ?? "Sans titre",
      english: raw.title?.english ?? null,
      native: raw.title?.native ?? null,
    },
    coverImage: {
      extraLarge: raw.coverImage?.extraLarge ?? raw.coverImage?.large ?? "",
      large: raw.coverImage?.large ?? raw.coverImage?.extraLarge ?? "",
      color: raw.coverImage?.color ?? null,
    },
    bannerImage: raw.bannerImage ?? null,
    description: raw.description ?? null,
    format: raw.format ?? null,
    status: raw.status ?? null,
    episodes: raw.episodes ?? null,
    chapters: raw.chapters ?? null,
    volumes: raw.volumes ?? null,
    duration: raw.duration ?? null,
    season: raw.season ?? null,
    seasonYear: raw.seasonYear ?? null,
    startYear: raw.startDate?.year ?? raw.seasonYear ?? null,
    startDate: raw.startDate ?? null,
    averageScore: raw.averageScore ?? null,
    meanScore: raw.meanScore ?? null,
    popularity: raw.popularity ?? null,
    favourites: raw.favourites ?? null,
    genres: Array.isArray(raw.genres) ? raw.genres : [],
    studio: raw.studios?.nodes?.[0]?.name ?? null,
    trailer: raw.trailer ?? null,
    nextAiringEpisode: raw.nextAiringEpisode ?? null,
  };
}

interface TopMediaSeedInput {
  id: number;
  title: string;
  type: MediaType;
  score: number | null;
  isFavorite?: boolean;
  genres?: string[];
}

/**
 * Analyzes the user's highest-rated / favorite anime & manga (titles, genres, scores)
 * and queries AniList's public GraphQL API for 6 tailored recommendations NOT already
 * in the user's library, each paired with an explicit reason ("Similaire à [Titre]"
 * or "Parce que tu aimes [Genre/Tag]").
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawSeeds: TopMediaSeedInput[] = Array.isArray(body?.topMedia) ? body.topMedia : [];
    const excludeSet = new Set<number>(
      (Array.isArray(body?.excludeIds) ? body.excludeIds : [])
        .map((n: unknown) => Number(n))
        .filter((n: number) => Number.isInteger(n) && n > 0)
    );
    const seedOffset =
      typeof body?.offset === "number" && Number.isFinite(body.offset)
        ? Math.max(0, Math.trunc(body.offset))
        : 0;

    // 1. Rank user's top seed titles by score + favorite bonus
    const rankedSeeds = [...rawSeeds]
      .filter((s) => Number.isInteger(s.id) && s.id > 0)
      .sort((a, b) => {
        const scoreA = (a.score ?? 7.5) + (a.isFavorite ? 1.5 : 0);
        const scoreB = (b.score ?? 7.5) + (b.isFavorite ? 1.5 : 0);
        return scoreB - scoreA;
      });

    // Pick 3 seeds (rotatable via offset when user clicks "Rafraîchir")
    const pickedSeeds: TopMediaSeedInput[] = [];
    if (rankedSeeds.length > 0) {
      for (let i = 0; i < Math.min(3, rankedSeeds.length); i++) {
        pickedSeeds.push(rankedSeeds[(seedOffset + i) % rankedSeeds.length]);
      }
    }

    // 2. Compute user's top weighted genres
    const genreWeights = new Map<string, number>();
    for (const s of rawSeeds) {
      const w = (s.score ?? 7.5) + (s.isFavorite ? 2 : 0);
      for (const g of s.genres ?? []) {
        if (!g) continue;
        genreWeights.set(g, (genreWeights.get(g) ?? 0) + w);
      }
    }
    const topGenres = Array.from(genreWeights.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([g]) => g);

    const dominantType: MediaType =
      rawSeeds.filter((s) => s.type === "MANGA").length >
      rawSeeds.filter((s) => s.type === "ANIME").length
        ? "MANGA"
        : "ANIME";

    const fallbackGenres = topGenres.length > 0 ? topGenres : ["Fantasy", "Action", "Drama"];

    // 3. Single batched GraphQL call to AniList (title-based recommendations + genre/tag discovery)
    const seedQueries = pickedSeeds
      .map(
        (s, idx) => `
      seed${idx}: Media(id: ${Math.trunc(s.id)}) {
        id
        title { english romaji }
        tags { name rank isMediaSpoiler }
        recommendations(sort: [RATING_DESC], perPage: 8) {
          nodes {
            rating
            mediaRecommendation {
              ${REC_MEDIA_FIELDS}
              isAdult
            }
          }
        }
      }`
      )
      .join("\n");

    const query = `
      query ($genres: [String], $type: MediaType, $page: Int) {
        ${seedQueries}
        byGenre: Page(page: $page, perPage: 18) {
          media(
            type: $type
            genre_in: $genres
            sort: [SCORE_DESC, POPULARITY_DESC]
            averageScore_greater: 76
            isAdult: false
          ) {
            ${REC_MEDIA_FIELDS}
          }
        }
      }
    `;

    const res = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          genres: fallbackGenres.slice(0, 2),
          type: dominantType,
          page: (seedOffset % 3) + 1,
        },
      }),
      cache: "no-store",
    });

    const recommendations: PersonalizedRecommendation[] = [];
    const seen = new Set<number>(excludeSet);

    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      const data = json?.data ?? {};

      // Collect top non-spoiler tags from user's favorite seeds for richer reasons
      const topTags: string[] = [];
      for (let i = 0; i < pickedSeeds.length; i++) {
        const seedNode = data[`seed${i}`];
        const seedTitle =
          pickedSeeds[i].title ||
          seedNode?.title?.english ||
          seedNode?.title?.romaji ||
          "tes coups de cœur";

        const rawTags = Array.isArray(seedNode?.tags) ? seedNode.tags : [];
        for (const t of rawTags) {
          if (!t?.isMediaSpoiler && (t?.rank ?? 0) >= 75 && t?.name && topTags.length < 4) {
            if (!topTags.includes(t.name)) topTags.push(t.name);
          }
        }

        const nodes = seedNode?.recommendations?.nodes ?? [];
        let addedForSeed = 0;
        for (const n of nodes) {
          const rec = n?.mediaRecommendation;
          if (!rec || rec.isAdult || seen.has(rec.id)) continue;
          seen.add(rec.id);
          recommendations.push({
            media: normalizeRecMedia(rec),
            reason: `Similaire à ${seedTitle}`,
            reasonKind: "similar",
            sourceTitle: seedTitle,
          });
          addedForSeed++;
          if (addedForSeed >= 2 || recommendations.length >= 4) break;
        }
      }

      // Fill remaining slots (up to 6) with Genre/Tag matches
      const genreCandidates = Array.isArray(data?.byGenre?.media) ? data.byGenre.media : [];
      for (const m of genreCandidates) {
        if (recommendations.length >= 6) break;
        if (!m || seen.has(m.id)) continue;
        seen.add(m.id);
        const normalized = normalizeRecMedia(m);
        const sharedGenres = normalized.genres.filter((g) => fallbackGenres.includes(g));
        const label =
          sharedGenres.length > 0
            ? sharedGenres.slice(0, 2).join(" · ")
            : topTags[0] || fallbackGenres[0];

        recommendations.push({
          media: normalized,
          reason: `Parce que tu aimes ${label}`,
          reasonKind: "genre",
          matchedTag: label,
        });
      }
    }

    // Fallback to verified local seed catalog if AniList returned < 6 or was offline
    if (recommendations.length < 6) {
      const seed = getSeedData();
      const pool = [...seed.topAnime, ...seed.trending, ...seed.manga];
      for (const m of pool) {
        if (recommendations.length >= 6) break;
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        const shared = m.genres.filter((g) => fallbackGenres.includes(g));
        const label = shared[0] || m.genres[0] || "les récits incontournables";
        recommendations.push({
          media: m,
          reason: `Parce que tu aimes ${label}`,
          reasonKind: "genre",
          matchedTag: label,
        });
      }
    }

    return NextResponse.json({
      recommendations: recommendations.slice(0, 6),
      analyzedGenres: fallbackGenres,
      analyzedSeeds: pickedSeeds.map((s) => s.title),
    });
  } catch {
    const seed = getSeedData();
    const fallback: PersonalizedRecommendation[] = seed.topAnime.slice(0, 6).map((m) => ({
      media: m,
      reason: `Parce que tu aimes ${m.genres[0] || "les chefs-d'œuvre"}`,
      reasonKind: "genre",
      matchedTag: m.genres[0] || "Anime",
    }));
    return NextResponse.json({
      recommendations: fallback,
      analyzedGenres: ["Action", "Fantasy", "Drama"],
      analyzedSeeds: [],
    });
  }
}
