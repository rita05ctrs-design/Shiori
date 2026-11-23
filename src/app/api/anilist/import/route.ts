import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { syncAniListImportWithClient } from "@/lib/supabase/sync";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/server/rate-limit";
import type {
  AniListAnimeStatistics,
  AniListImportResponse,
  AniListMangaStatistics,
  AniListUserStatsSnapshot,
  LibraryEntry,
  LibraryStatus,
  MediaType,
} from "@/types/media";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

const USER_AND_STATS_QUERY = `
  query ($userName: String!) {
    User(name: $userName) {
      id
      name
      avatar { large }
      bannerImage
      siteUrl
      favourites {
        anime(page: 1, perPage: 50) { nodes { id } }
        manga(page: 1, perPage: 50) { nodes { id } }
      }
      statistics {
        anime {
          count
          meanScore
          standardDeviation
          minutesWatched
          episodesWatched
          genres(limit: 12, sort: COUNT_DESC) {
            genre
            count
            meanScore
            minutesWatched
          }
          statuses {
            status
            count
            meanScore
            minutesWatched
          }
          formats {
            format
            count
            meanScore
            minutesWatched
          }
          scores(sort: MEAN_SCORE_DESC) {
            score
            count
          }
        }
        manga {
          count
          meanScore
          standardDeviation
          chaptersRead
          volumesRead
          genres(limit: 12, sort: COUNT_DESC) {
            genre
            count
            meanScore
            chaptersRead
          }
          statuses {
            status
            count
            meanScore
            chaptersRead
          }
          formats {
            format
            count
            meanScore
            chaptersRead
          }
          scores(sort: MEAN_SCORE_DESC) {
            score
            count
          }
        }
      }
    }
  }
`;

const MEDIA_LIST_CHUNK_QUERY = `
  query ($userName: String!, $type: MediaType!, $chunk: Int!) {
    MediaListCollection(
      userName: $userName
      type: $type
      chunk: $chunk
      perChunk: 500
      forceSingleCompletedList: false
    ) {
      hasNextChunk
      lists {
        name
        isCustomList
        status
        entries {
          id
          mediaId
          status
          score(format: POINT_10_DECIMAL)
          progress
          repeat
          notes
          updatedAt
          startedAt { year month day }
          completedAt { year month day }
          media {
            id
            type
            title { romaji english native }
            coverImage { extraLarge large }
            bannerImage
            episodes
            chapters
            duration
            genres
            format
            seasonYear
            startDate { year }
            averageScore
            studios(isMain: true) { nodes { name } }
            staff(perPage: 1) { edges { node { name { full } } } }
          }
        }
      }
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function postAniList(query: string, variables: Record<string, unknown>): Promise<any> {
  const res = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));

  if (res.status === 429) {
    throw Object.assign(
      new Error("Limite de requêtes AniList atteinte. Patientez quelques secondes et réessayez."),
      { status: 429 }
    );
  }

  if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
    const firstMsg: string = json.errors[0]?.message || "Erreur AniList";
    if (firstMsg.toLowerCase().includes("private")) {
      throw Object.assign(
        new Error(
          "Ce profil AniList est privé. Rendez votre profil public dans AniList → Settings → Account pour l'importer."
        ),
        { status: 403 }
      );
    }
    if (firstMsg.toLowerCase().includes("not found") || json.errors[0]?.status === 404) {
      throw Object.assign(
        new Error("Utilisateur AniList introuvable. Vérifiez l'orthographe du nom d'utilisateur."),
        { status: 404 }
      );
    }
    throw Object.assign(new Error(firstMsg), { status: 400 });
  }

  if (!res.ok) {
    throw Object.assign(new Error(`Erreur HTTP AniList (${res.status})`), { status: res.status });
  }

  return json.data;
}

function mapAniListStatus(status: string | null | undefined): LibraryStatus {
  switch (status) {
    case "CURRENT":
    case "REPEATING":
      return "WATCHING";
    case "COMPLETED":
      return "COMPLETED";
    case "PAUSED":
      return "ON_HOLD";
    case "DROPPED":
      return "DROPPED";
    case "PLANNING":
    default:
      return "PLAN_TO_WATCH";
  }
}

function formatFuzzyDate(d?: { year?: number | null; month?: number | null; day?: number | null } | null): string | null {
  if (!d || !d.year || !d.month || !d.day) return null;
  const y = String(d.year).padStart(4, "0");
  const m = String(d.month).padStart(2, "0");
  const day = String(d.day).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function fetchAllCollectionEntries(
  userName: string,
  type: MediaType,
  favoriteIds: Set<number>
): Promise<LibraryEntry[]> {
  const byMediaId = new Map<number, { entry: LibraryEntry; fromCustom: boolean; rawUpdated: number }>();
  const MAX_CHUNKS = 12; // Up to 6,000 entries per type

  for (let chunk = 1; chunk <= MAX_CHUNKS; chunk += 1) {
    const data = await postAniList(MEDIA_LIST_CHUNK_QUERY, {
      userName,
      type,
      chunk,
    });

    const collection = data?.MediaListCollection;
    const lists = Array.isArray(collection?.lists) ? collection.lists : [];

    // Merge EVERY lists[].entries array across standard & custom lists
    for (const list of lists) {
      const isCustom = Boolean(list?.isCustomList);
      const rawEntries = Array.isArray(list?.entries) ? list.entries : [];

      for (const raw of rawEntries) {
        const media = raw?.media;
        const mediaId = Number(raw?.mediaId ?? media?.id);
        if (!media || !mediaId || Number.isNaN(mediaId)) continue;

        const rawScore = Number(raw.score ?? 0);
        const normalizedScore =
          rawScore > 0 ? Math.max(0, Math.min(10, Math.round(rawScore * 10) / 10)) : null;

        const studio =
          media?.studios?.nodes?.[0]?.name ??
          media?.staff?.edges?.[0]?.node?.name?.full ??
          null;

        const updatedSec = Number(raw.updatedAt ?? 0);
        const updatedIso =
          updatedSec > 0 ? new Date(updatedSec * 1000).toISOString() : new Date().toISOString();

        const entry: LibraryEntry = {
          mediaId,
          type,
          title: media?.title?.english || media?.title?.romaji || media?.title?.native || "Sans titre",
          nativeTitle: media?.title?.native ?? null,
          coverImage:
            media?.coverImage?.extraLarge ||
            media?.coverImage?.large ||
            "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/default.jpg",
          bannerImage: media?.bannerImage ?? null,
          totalUnits: type === "MANGA" ? (media?.chapters ?? null) : (media?.episodes ?? null),
          duration: type === "ANIME" ? (media?.duration ?? 24) : null,
          genres: Array.isArray(media?.genres) ? media.genres : [],
          studio,
          format: media?.format ?? null,
          seasonYear: media?.seasonYear ?? media?.startDate?.year ?? null,
          averageScore: media?.averageScore ?? null,
          status: mapAniListStatus(raw?.status ?? list?.status),
          progress: Math.max(0, Number(raw?.progress ?? 0)),
          score: normalizedScore,
          isFavorite: favoriteIds.has(mediaId),
          notes: typeof raw?.notes === "string" ? raw.notes : "",
          updatedAt: updatedIso,
          startedAt: formatFuzzyDate(raw?.startedAt),
          completedAt: formatFuzzyDate(raw?.completedAt),
        };

        const prev = byMediaId.get(mediaId);
        // Prefer standard (non-custom) list entry or more recently updated entry
        if (!prev || (prev.fromCustom && !isCustom) || updatedSec > prev.rawUpdated) {
          byMediaId.set(mediaId, { entry, fromCustom: isCustom, rawUpdated: updatedSec });
        }
      }
    }

    if (!collection?.hasNextChunk) break;
  }

  return Array.from(byMediaId.values())
    .map((v) => v.entry)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limit = checkRateLimit(`anilist:import:${ip}`, 10, 5 * 60_000);
    if (!limit.ok) {
      return rateLimitResponse(limit.retryAfterSec);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Requête JSON invalide." }, { status: 400 });
    }
    const rawUsername = String(body.username ?? "").trim().replace(/^@/, "");
    const includeAnime = body.includeAnime !== false;
    const includeManga = body.includeManga !== false;
    const mode: "merge" | "replace" = body.mode === "replace" ? "replace" : "merge";

    if (!rawUsername || rawUsername.length < 2 || rawUsername.length > 50) {
      return NextResponse.json(
        { error: "Veuillez saisir un nom d'utilisateur AniList valide." },
        { status: 400 }
      );
    }

    // 1. Fetch public User profile + favourites + User.statistics (anime & manga)
    const userData = await postAniList(USER_AND_STATS_QUERY, { userName: rawUsername });
    const u = userData?.User;
    if (!u) {
      return NextResponse.json(
        { error: "Utilisateur AniList introuvable." },
        { status: 404 }
      );
    }

    const favAnimeIds = new Set<number>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (u.favourites?.anime?.nodes ?? []).map((n: any) => Number(n.id)).filter(Boolean)
    );
    const favMangaIds = new Set<number>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (u.favourites?.manga?.nodes ?? []).map((n: any) => Number(n.id)).filter(Boolean)
    );

    // 2. Fetch ALL MediaListCollection entries (merging all lists[].entries across chunks)
    const [animeEntries, mangaEntries] = await Promise.all([
      includeAnime
        ? fetchAllCollectionEntries(u.name, "ANIME", favAnimeIds)
        : Promise.resolve([]),
      includeManga
        ? fetchAllCollectionEntries(u.name, "MANGA", favMangaIds)
        : Promise.resolve([]),
    ]);

    // Merge anime + manga entries cleanly (deduplicated by mediaId)
    const combinedMap = new Map<number, LibraryEntry>();
    for (const e of [...animeEntries, ...mangaEntries]) {
      combinedMap.set(e.mediaId, e);
    }
    const allEntries = Array.from(combinedMap.values());

    // Normalize User.statistics (anime & manga)
    const rawAnimeStats = u.statistics?.anime ?? {};
    const rawMangaStats = u.statistics?.manga ?? {};

    const animeStats: AniListAnimeStatistics = {
      count: Number(rawAnimeStats.count ?? animeEntries.length),
      meanScore: Number(rawAnimeStats.meanScore ?? 0),
      standardDeviation: Number(rawAnimeStats.standardDeviation ?? 0),
      minutesWatched: Number(rawAnimeStats.minutesWatched ?? 0),
      episodesWatched: Number(rawAnimeStats.episodesWatched ?? 0),
      genres: Array.isArray(rawAnimeStats.genres) ? rawAnimeStats.genres : [],
      statuses: Array.isArray(rawAnimeStats.statuses) ? rawAnimeStats.statuses : [],
      formats: Array.isArray(rawAnimeStats.formats) ? rawAnimeStats.formats : [],
      scores: Array.isArray(rawAnimeStats.scores) ? rawAnimeStats.scores : [],
    };

    const mangaStats: AniListMangaStatistics = {
      count: Number(rawMangaStats.count ?? mangaEntries.length),
      meanScore: Number(rawMangaStats.meanScore ?? 0),
      standardDeviation: Number(rawMangaStats.standardDeviation ?? 0),
      chaptersRead: Number(rawMangaStats.chaptersRead ?? 0),
      volumesRead: Number(rawMangaStats.volumesRead ?? 0),
      genres: Array.isArray(rawMangaStats.genres) ? rawMangaStats.genres : [],
      statuses: Array.isArray(rawMangaStats.statuses) ? rawMangaStats.statuses : [],
      formats: Array.isArray(rawMangaStats.formats) ? rawMangaStats.formats : [],
      scores: Array.isArray(rawMangaStats.scores) ? rawMangaStats.scores : [],
    };

    const statistics: AniListUserStatsSnapshot = {
      anilistUsername: u.name,
      anilistUserId: Number(u.id) || null,
      anilistAvatarUrl: u.avatar?.large ?? null,
      anilistBannerUrl: u.bannerImage ?? null,
      anilistSiteUrl: u.siteUrl ?? `https://anilist.co/user/${encodeURIComponent(u.name)}`,
      anime: animeStats,
      manga: mangaStats,
      syncedAt: new Date().toISOString(),
    };

    // 3. Persist directly into Supabase tables for the authenticated Supabase user
    let supabaseSync: AniListImportResponse["supabaseSync"] = {
      authenticated: false,
      entriesSaved: 0,
      statsSaved: false,
    };

    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        const res = await syncAniListImportWithClient(
          supabase,
          authData.user,
          allEntries,
          statistics,
          mode
        );
        supabaseSync = {
          authenticated: true,
          ...res,
        };
      }
    }

    const payload: AniListImportResponse = {
      user: {
        id: Number(u.id),
        name: u.name,
        avatarUrl: u.avatar?.large ?? null,
        bannerUrl: u.bannerImage ?? null,
        siteUrl: statistics.anilistSiteUrl,
      },
      entries: allEntries,
      counts: {
        anime: animeEntries.length,
        manga: mangaEntries.length,
        favorites: allEntries.filter((e) => e.isFavorite).length,
        total: allEntries.length,
      },
      statistics,
      supabaseSync,
    };

    return NextResponse.json(payload);
  } catch (err) {
    const error = err as Error & { status?: number };
    const status = error.status && error.status >= 400 ? error.status : 500;
    return NextResponse.json(
      { error: error.message || "Échec de l'importation AniList." },
      { status }
    );
  }
}
