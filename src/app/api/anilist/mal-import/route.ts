import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/server/rate-limit";
import type { MalParsedItem } from "@/lib/mal-import";
import type { LibraryEntry, MediaType } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const BATCH_SIZE = 50;
const MAX_ITEMS = 600;

const MAL_RESOLVE_QUERY = `
  query ($ids: [Int], $type: MediaType) {
    Page(page: 1, perPage: 50) {
      media(idMal_in: $ids, type: $type) {
        id
        idMal
        type
        format
        episodes
        chapters
        volumes
        duration
        averageScore
        season
        seasonYear
        startDate { year }
        genres
        title { romaji english native }
        coverImage { extraLarge large }
        bannerImage
        studios(isMain: true) {
          nodes { name }
        }
      }
    }
  }
`;

interface AniListMalNode {
  id: number;
  idMal: number;
  type: MediaType;
  format: string | null;
  episodes: number | null;
  chapters: number | null;
  volumes: number | null;
  duration: number | null;
  averageScore: number | null;
  season: string | null;
  seasonYear: number | null;
  startDate?: { year: number | null } | null;
  genres: string[];
  title: { romaji: string; english: string | null; native: string | null };
  coverImage: { extraLarge: string; large: string };
  bannerImage: string | null;
  studios?: { nodes?: { name: string }[] } | null;
}

async function resolveBatchByMalIds(
  malIds: number[],
  type: MediaType
): Promise<Map<number, AniListMalNode>> {
  const result = new Map<number, AniListMalNode>();
  if (malIds.length === 0) return result;

  for (let i = 0; i < malIds.length; i += BATCH_SIZE) {
    const chunk = malIds.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(ANILIST_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query: MAL_RESOLVE_QUERY,
          variables: { ids: chunk, type },
        }),
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        data?: { Page?: { media?: AniListMalNode[] } };
      };
      const nodes = json?.data?.Page?.media ?? [];
      for (const node of nodes) {
        if (node?.idMal && node?.id) {
          result.set(node.idMal, node);
        }
      }
    } catch {
      // Keep already resolved batches cleanly
    }
  }

  return result;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`mal-import:${ip}`, 10, 60_000);
  if (!limit.ok) {
    return rateLimitResponse(limit.retryAfterSec);
  }

  try {
    const body = (await request.json()) as { items?: MalParsedItem[] };
    const rawItems = Array.isArray(body?.items) ? body.items.slice(0, MAX_ITEMS) : [];
    if (rawItems.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Aucune œuvre valide à importer." },
        { status: 400 }
      );
    }

    const animeIds = Array.from(
      new Set(
        rawItems
          .filter((i) => i.type === "ANIME" && Number.isInteger(i.malId) && i.malId > 0)
          .map((i) => i.malId)
      )
    );
    const mangaIds = Array.from(
      new Set(
        rawItems
          .filter((i) => i.type === "MANGA" && Number.isInteger(i.malId) && i.malId > 0)
          .map((i) => i.malId)
      )
    );

    const [animeMap, mangaMap] = await Promise.all([
      resolveBatchByMalIds(animeIds, "ANIME"),
      resolveBatchByMalIds(mangaIds, "MANGA"),
    ]);

    const entries: LibraryEntry[] = [];
    let matched = 0;
    let unmatched = 0;
    const nowIso = new Date().toISOString();

    for (const item of rawItems) {
      const resolved =
        item.type === "ANIME" ? animeMap.get(item.malId) : mangaMap.get(item.malId);

      if (!resolved) {
        unmatched++;
        continue;
      }

      matched++;
      const totalUnits =
        item.type === "MANGA"
          ? resolved.chapters ?? item.totalUnits ?? null
          : resolved.episodes ?? item.totalUnits ?? null;
      const totalVolumes =
        item.type === "MANGA" ? resolved.volumes ?? item.totalVolumes ?? null : null;

      entries.push({
        mediaId: resolved.id,
        type: resolved.type,
        title: resolved.title.english || resolved.title.romaji || item.title,
        nativeTitle: resolved.title.native ?? null,
        coverImage: resolved.coverImage.extraLarge || resolved.coverImage.large,
        bannerImage: resolved.bannerImage ?? null,
        totalUnits,
        totalVolumes,
        duration: resolved.duration ?? null,
        genres: Array.isArray(resolved.genres) ? resolved.genres : [],
        studio: resolved.studios?.nodes?.[0]?.name ?? null,
        format: resolved.format ?? null,
        season: resolved.season ?? null,
        seasonYear: resolved.seasonYear ?? resolved.startDate?.year ?? null,
        averageScore: resolved.averageScore ?? null,
        status: item.status,
        progress: Math.max(0, Math.floor(item.progress || 0)),
        progressVolumes:
          item.type === "MANGA"
            ? Math.max(0, Math.floor(item.progressVolumes || 0))
            : undefined,
        score: item.score,
        isFavorite: false,
        notes: item.notes ?? "",
        updatedAt: nowIso,
        startedAt: item.startedAt,
        completedAt: item.completedAt,
      });
    }

    return NextResponse.json({
      ok: true,
      entries,
      matched,
      unmatched,
      totalReceived: rawItems.length,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Impossible de traiter le fichier MyAnimeList." },
      { status: 400 }
    );
  }
}
