import seedRaw from "@/data/anilist-seed.json";
import { normalizeStreamingLinks } from "@/lib/streaming";
import type {
  AiringScheduleItem,
  CharacterEdge,
  MediaDetail,
  MediaItem,
  MediaRelation,
  MediaType,
} from "@/types/media";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const ANILIST_TIMEOUT_MS = 8500;
const ANILIST_MAX_CACHE_ENTRIES = 160;

interface CachedQueryEntry {
  data: unknown;
  expiresAt: number;
}

const anilistMemCache = new Map<string, CachedQueryEntry>();

function getCachedQuery<T>(key: string, allowStale = false): T | null {
  const entry = anilistMemCache.get(key);
  if (!entry) return null;
  if (allowStale || Date.now() < entry.expiresAt) {
    return entry.data as T;
  }
  return null;
}

function setCachedQuery(key: string, data: unknown, ttlSec: number) {
  if (anilistMemCache.size >= ANILIST_MAX_CACHE_ENTRIES) {
    const oldest = anilistMemCache.keys().next().value;
    if (oldest) anilistMemCache.delete(oldest);
  }
  anilistMemCache.set(key, {
    data,
    expiresAt: Date.now() + Math.max(30, ttlSec) * 1000,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeMedia(raw: any): MediaItem {
  const studioNode = raw?.studios?.nodes?.[0]?.name ?? null;
  const staffAuthor = raw?.staff?.edges?.[0]?.node?.name?.full ?? null;

  return {
    id: Number(raw.id),
    type: (raw.type === "MANGA" ? "MANGA" : "ANIME") as MediaType,
    title: {
      romaji: raw?.title?.romaji || raw?.title?.english || "Untitled",
      english: raw?.title?.english ?? null,
      native: raw?.title?.native ?? null,
    },
    coverImage: {
      extraLarge:
        raw?.coverImage?.extraLarge ||
        raw?.coverImage?.large ||
        "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/default.jpg",
      large:
        raw?.coverImage?.large ||
        raw?.coverImage?.extraLarge ||
        "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/default.jpg",
      color: raw?.coverImage?.color ?? null,
    },
    bannerImage: raw?.bannerImage ?? null,
    description: raw?.description ?? null,
    format: raw?.format ?? null,
    status: raw?.status ?? null,
    episodes: raw?.episodes ?? null,
    chapters: raw?.chapters ?? null,
    volumes: raw?.volumes ?? null,
    duration: raw?.duration ?? (raw?.type === "MANGA" ? null : 24),
    season: raw?.season ?? null,
    seasonYear: raw?.seasonYear ?? raw?.startDate?.year ?? null,
    startYear: raw?.startDate?.year ?? raw?.seasonYear ?? null,
    startDate: raw?.startDate
      ? {
          year: raw.startDate.year ?? null,
          month: raw.startDate.month ?? null,
          day: raw.startDate.day ?? null,
        }
      : null,
    averageScore: raw?.averageScore ?? null,
    meanScore: raw?.meanScore ?? null,
    popularity: raw?.popularity ?? null,
    favourites: raw?.favourites ?? null,
    genres: Array.isArray(raw?.genres) ? raw.genres : [],
    studio: studioNode || staffAuthor || null,
    trailer:
      raw?.trailer?.id && raw?.trailer?.site === "youtube"
        ? { id: raw.trailer.id, site: raw.trailer.site }
        : null,
    nextAiringEpisode: raw?.nextAiringEpisode
      ? {
          airingAt: raw.nextAiringEpisode.airingAt,
          timeUntilAiring: raw.nextAiringEpisode.timeUntilAiring,
          episode: raw.nextAiringEpisode.episode,
        }
      : null,
    streamingLinks: normalizeStreamingLinks(raw?.externalLinks, raw?.streamingEpisodes),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeMediaDetail(raw: any): MediaDetail {
  const base = normalizeMedia(raw);

  const characters: CharacterEdge[] = (raw?.characters?.edges ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (edge: any) => {
      const va = edge?.voiceActors?.[0];
      return {
        id: edge?.node?.id ?? Math.random(),
        role: edge?.role ?? "SUPPORTING",
        name: edge?.node?.name?.full ?? "Inconnu",
        image:
          edge?.node?.image?.large ||
          "https://s4.anilist.co/file/anilistcdn/character/large/default.jpg",
        voiceActor: va
          ? {
              name: va?.name?.full ?? "Inconnu",
              image:
                va?.image?.large ||
                "https://s4.anilist.co/file/anilistcdn/staff/large/default.jpg",
              language: va?.languageV2 ?? "Japanese",
            }
          : null,
      };
    }
  );

  const relations: MediaRelation[] = (raw?.relations?.edges ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((edge: any) => edge?.node && !edge.node.isAdult)
    .slice(0, 8)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((edge: any) => ({
      relationType: edge.relationType ?? "OTHER",
      media: {
        id: Number(edge.node.id),
        type: edge.node.type === "MANGA" ? "MANGA" : "ANIME",
        title: edge.node.title?.english || edge.node.title?.romaji || "Sans titre",
        coverImage:
          edge.node.coverImage?.large ||
          edge.node.coverImage?.medium ||
          base.coverImage.large,
        format: edge.node.format ?? null,
        averageScore: edge.node.averageScore ?? null,
      },
    }));

  const recommendations: MediaItem[] = (raw?.recommendations?.nodes ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((n: any) => n?.mediaRecommendation)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((m: any) => m && !m.isAdult)
    .slice(0, 8)
    .map(normalizeMedia);

  const studios: string[] = (raw?.allStudios?.nodes ?? raw?.studios?.nodes ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((s: any) => s?.name)
    .filter(Boolean);

  return {
    ...base,
    source: raw?.source ?? null,
    countryOfOrigin: raw?.countryOfOrigin ?? "JP",
    hashtag: raw?.hashtag ?? null,
    siteUrl: raw?.siteUrl ?? null,
    studios,
    tags: (raw?.tags ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((t: any) => !t.isMediaSpoiler && !t.isAdult)
      .slice(0, 10)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((t: any) => ({ name: t.name, rank: t.rank ?? 50 })),
    characters,
    relations,
    recommendations,
    scoreDistribution: (raw?.stats?.scoreDistribution ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => ({
        score: Number(s.score),
        amount: Number(s.amount),
      })
    ),
    streamingEpisodes: (raw?.streamingEpisodes ?? []).slice(0, 12),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function queryAniList<T = any>(
  query: string,
  variables: Record<string, unknown> = {},
  revalidate = 300
): Promise<T> {
  const cacheKey = `${query.slice(0, 120)}::${JSON.stringify(variables)}`;
  const fresh = getCachedQuery<T>(cacheKey);
  if (fresh) return fresh;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(ANILIST_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(ANILIST_TIMEOUT_MS),
        next: { revalidate },
      });

      if (res.status === 429 && attempt === 0) {
        const retryAfterSec = Math.min(2, Math.max(0.5, Number(res.headers.get("retry-after") ?? 1)));
        await new Promise((r) => setTimeout(r, retryAfterSec * 1000));
        continue;
      }

      if (!res.ok) {
        throw new Error(`AniList HTTP ${res.status}`);
      }

      const json = await res.json();
      if (json.errors) {
        throw new Error(json.errors[0]?.message || "AniList GraphQL error");
      }
      setCachedQuery(cacheKey, json.data, revalidate);
      return json.data as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("AniList request failed");
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }

  // Serve stale cache cleanly during temporary upstream outages before falling back to seed
  const stale = getCachedQuery<T>(cacheKey, true);
  if (stale) return stale;

  throw lastError ?? new Error("AniList unavailable");
}

const MEDIA_FRAGMENT = `
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
  staff(perPage: 1) { edges { role node { name { full } } } }
  trailer { id site }
  nextAiringEpisode { airingAt timeUntilAiring episode }
  externalLinks { id url site type icon color language notes isDisabled }
`;

export function getSeedData() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = seedRaw as any;
  const trending: MediaItem[] = (data.trending?.media ?? []).map(normalizeMedia);
  const popular: MediaItem[] = (data.popular?.media ?? []).map(normalizeMedia);
  const topAnime: MediaItem[] = (data.topAnime?.media ?? []).map(normalizeMedia);
  const manga: MediaItem[] = (data.manga?.media ?? []).map(normalizeMedia);

  const now = Math.floor(Date.now() / 1000);
  // Preserve authentic recorded AniList timestamps without ever fabricating unknown air times
  const airing: AiringScheduleItem[] = (data.airing?.airingSchedules ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((s: any) => typeof s?.airingAt === "number" && s.airingAt > 0 && s?.media)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((s: any) => ({
      id: s.id,
      airingAt: s.airingAt,
      episode: s.episode,
      timeUntilAiring: s.airingAt - now,
      media: normalizeMedia(s.media),
    }));

  // Deduplicated pool for local fallback search / detail
  const map = new Map<number, MediaItem>();
  for (const item of [...topAnime, ...trending, ...popular, ...manga, ...airing.map((a) => a.media)]) {
    if (!map.has(item.id)) map.set(item.id, item);
  }

  return {
    trending,
    popular,
    topAnime,
    manga,
    airing,
    all: Array.from(map.values()),
  };
}

export interface HomeData {
  hero: MediaItem[];
  trending: MediaItem[];
  popular: MediaItem[];
  topAnime: MediaItem[];
  manga: MediaItem[];
  airingToday: AiringScheduleItem[];
  movies: MediaItem[];
  upcoming: MediaItem[];
  hiddenGems: MediaItem[];
  shortBinge: MediaItem[];
}

export async function fetchHomeData(): Promise<HomeData> {
  const seed = getSeedData();
  try {
    const now = Math.floor(Date.now() / 1000);
    // Split into 2 compact parallel GraphQL queries so complexity stays well below AniList's 500 cap
    const coreQuery = `
      query ($dayStart: Int, $dayEnd: Int) {
        trending: Page(page: 1, perPage: 12) {
          media(sort: TRENDING_DESC, type: ANIME, isAdult: false) { ${MEDIA_FRAGMENT} }
        }
        popular: Page(page: 1, perPage: 12) {
          media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) { ${MEDIA_FRAGMENT} }
        }
        topAnime: Page(page: 1, perPage: 10) {
          media(sort: SCORE_DESC, type: ANIME, isAdult: false) { ${MEDIA_FRAGMENT} }
        }
        manga: Page(page: 1, perPage: 12) {
          media(sort: SCORE_DESC, type: MANGA, isAdult: false) { ${MEDIA_FRAGMENT} }
        }
        airing: Page(page: 1, perPage: 16) {
          airingSchedules(airingAt_greater: $dayStart, airingAt_lesser: $dayEnd, sort: TIME) {
            id airingAt episode timeUntilAiring
            media { ${MEDIA_FRAGMENT} isAdult }
          }
        }
      }
    `;

    const curatedQuery = `
      query {
        movies: Page(page: 1, perPage: 12) {
          media(sort: SCORE_DESC, type: ANIME, format: MOVIE, popularity_greater: 45000, isAdult: false) { ${MEDIA_FRAGMENT} }
        }
        upcoming: Page(page: 1, perPage: 12) {
          media(sort: POPULARITY_DESC, type: ANIME, status: NOT_YET_RELEASED, isAdult: false) { ${MEDIA_FRAGMENT} }
        }
        hiddenGems: Page(page: 1, perPage: 12) {
          media(sort: SCORE_DESC, type: ANIME, averageScore_greater: 81, popularity_lesser: 110000, popularity_greater: 15000, isAdult: false) { ${MEDIA_FRAGMENT} }
        }
        shortBinge: Page(page: 1, perPage: 12) {
          media(sort: POPULARITY_DESC, type: ANIME, format: TV, episodes_lesser: 14, episodes_greater: 5, averageScore_greater: 80, isAdult: false) { ${MEDIA_FRAGMENT} }
        }
      }
    `;

    const [coreData, curatedRes] = await Promise.all([
      queryAniList(
        coreQuery,
        { dayStart: now - 3600 * 6, dayEnd: now + 3600 * 48 },
        300
      ),
      queryAniList(curatedQuery, {}, 300).catch(() => ({})),
    ]);

    const data = { ...coreData, ...curatedRes };

    const trending: MediaItem[] = (data.trending?.media ?? []).map(normalizeMedia);
    const popular: MediaItem[] = (data.popular?.media ?? []).map(normalizeMedia);
    const topAnime: MediaItem[] = (data.topAnime?.media ?? []).map(normalizeMedia);
    const manga: MediaItem[] = (data.manga?.media ?? []).map(normalizeMedia);
    const movies: MediaItem[] = (data.movies?.media ?? []).map(normalizeMedia);
    const upcoming: MediaItem[] = (data.upcoming?.media ?? []).map(normalizeMedia);
    const hiddenGems: MediaItem[] = (data.hiddenGems?.media ?? []).map(normalizeMedia);
    const shortBinge: MediaItem[] = (data.shortBinge?.media ?? []).map(normalizeMedia);
    const airingToday: AiringScheduleItem[] = (data.airing?.airingSchedules ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((s: any) => s.media && !s.media.isAdult && (s.media.popularity ?? 0) > 1500)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((s: any) => ({
        id: s.id,
        airingAt: s.airingAt,
        episode: s.episode,
        timeUntilAiring: s.timeUntilAiring,
        media: normalizeMedia(s.media),
      }));

    // Curate cinematic hero slides prioritizing high-score iconic titles with wide banners
    const heroCandidates = [
      ...topAnime.filter((m) => m.bannerImage && (m.averageScore ?? 0) >= 88).slice(0, 3),
      ...trending.filter((m) => m.bannerImage && (m.averageScore ?? 0) >= 82).slice(0, 2),
      ...popular.filter((m) => m.bannerImage).slice(0, 2),
    ];
    const seenHero = new Set<number>();
    const hero: MediaItem[] = [];
    for (const m of heroCandidates) {
      if (!seenHero.has(m.id)) {
        seenHero.add(m.id);
        hero.push(m);
      }
      if (hero.length >= 5) break;
    }

    return {
      hero: hero.length ? hero : seed.topAnime.filter((m) => m.bannerImage).slice(0, 5),
      trending: trending.length ? trending : seed.trending,
      popular: popular.length ? popular : seed.popular,
      topAnime: topAnime.length ? topAnime : seed.topAnime,
      manga: manga.length ? manga : seed.manga,
      airingToday: airingToday.length ? airingToday : seed.airing.slice(0, 8),
      movies: movies.length ? movies : seed.topAnime.filter((m) => m.format === "MOVIE"),
      upcoming: upcoming.length ? upcoming : seed.trending.slice(0, 8),
      hiddenGems: hiddenGems.length ? hiddenGems : seed.topAnime.slice(0, 8),
      shortBinge: shortBinge.length
        ? shortBinge
        : seed.popular.filter((m) => (m.episodes ?? 24) <= 13),
    };
  } catch {
    const hero = [
      ...seed.topAnime.filter((m) => m.bannerImage).slice(0, 3),
      ...seed.trending.filter((m) => m.bannerImage && (m.averageScore ?? 0) >= 80).slice(0, 2),
    ];
    return {
      hero,
      trending: seed.trending,
      popular: seed.popular,
      topAnime: seed.topAnime,
      manga: seed.manga,
      airingToday: seed.airing.slice(0, 8),
      movies: seed.topAnime.filter((m) => m.format === "MOVIE").slice(0, 10),
      upcoming: seed.trending.slice(0, 10),
      hiddenGems: seed.topAnime.slice(0, 10),
      shortBinge: seed.popular.filter((m) => (m.episodes ?? 24) <= 13).slice(0, 10),
    };
  }
}

export interface DiscoverParams {
  search?: string;
  type?: MediaType;
  genre?: string;
  genres?: string[];
  tags?: string[];
  minScore?: number;
  maxScore?: number;
  minEpisodes?: number;
  maxEpisodes?: number;
  minChapters?: number;
  maxChapters?: number;
  season?: string;
  year?: number;
  format?: string;
  status?: string;
  sort?: string;
  page?: number;
  perPage?: number;
}

export interface DiscoverResult {
  items: MediaItem[];
  hasNextPage: boolean;
  total: number;
  page: number;
  fromCache?: boolean;
}

export async function fetchDiscover(params: DiscoverParams): Promise<DiscoverResult> {
  const {
    search,
    type = "ANIME",
    genre,
    genres,
    tags,
    minScore,
    maxScore,
    minEpisodes,
    maxEpisodes,
    minChapters,
    maxChapters,
    season,
    year,
    format,
    status,
    sort = "TRENDING_DESC",
    page = 1,
    perPage = 24,
  } = params;

  const genreList = Array.from(
    new Set([
      ...(genres ?? []).filter((g) => g && g !== "ALL"),
      ...(genre && genre !== "ALL" ? [genre] : []),
    ])
  );
  const tagList = Array.from(new Set((tags ?? []).filter((t) => t && t !== "ALL")));

  try {
    const query = `
      query (
        $page: Int,
        $perPage: Int,
        $search: String,
        $type: MediaType,
        $genres: [String],
        $tags: [String],
        $minScore: Int,
        $maxScore: Int,
        $episodesGreater: Int,
        $episodesLesser: Int,
        $chaptersGreater: Int,
        $chaptersLesser: Int,
        $season: MediaSeason,
        $seasonYear: Int,
        $format: MediaFormat,
        $status: MediaStatus,
        $sort: [MediaSort]
      ) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage hasNextPage }
          media(
            search: $search,
            type: $type,
            genre_in: $genres,
            tag_in: $tags,
            averageScore_greater: $minScore,
            averageScore_lesser: $maxScore,
            episodes_greater: $episodesGreater,
            episodes_lesser: $episodesLesser,
            chapters_greater: $chaptersGreater,
            chapters_lesser: $chaptersLesser,
            season: $season,
            seasonYear: $seasonYear,
            format: $format,
            status: $status,
            sort: $sort,
            isAdult: false
          ) {
            ${MEDIA_FRAGMENT}
          }
        }
      }
    `;

    const variables: Record<string, unknown> = {
      page,
      perPage,
      type,
      sort: [search && sort === "TRENDING_DESC" ? "SEARCH_MATCH" : sort],
    };
    if (search?.trim()) variables.search = search.trim();
    if (genreList.length > 0) variables.genres = genreList;
    if (tagList.length > 0) variables.tags = tagList;
    // AniList *_greater and *_lesser are strict (> and <), so shift by 1 to make bounds inclusive
    if (minScore && minScore > 0) variables.minScore = Math.max(0, Math.trunc(minScore) - 1);
    if (maxScore && maxScore > 0) variables.maxScore = Math.min(101, Math.trunc(maxScore) + 1);

    if (type === "ANIME") {
      if (minEpisodes && minEpisodes > 0) {
        variables.episodesGreater = Math.max(0, Math.trunc(minEpisodes) - 1);
      }
      if (maxEpisodes && maxEpisodes > 0) {
        variables.episodesLesser = Math.trunc(maxEpisodes) + 1;
        if (!minEpisodes || minEpisodes <= 0) {
          variables.episodesGreater = 0; // Ensure known episode count (>= 1)
        }
      }
    } else if (type === "MANGA") {
      if (minChapters && minChapters > 0) {
        variables.chaptersGreater = Math.max(0, Math.trunc(minChapters) - 1);
      }
      if (maxChapters && maxChapters > 0) {
        variables.chaptersLesser = Math.trunc(maxChapters) + 1;
        if (!minChapters || minChapters <= 0) {
          variables.chaptersGreater = 0;
        }
      }
    }

    if (season && season !== "ALL" && type === "ANIME") variables.season = season;
    if (year && !Number.isNaN(year)) variables.seasonYear = year;
    if (format && format !== "ALL") variables.format = format;
    if (status && status !== "ALL") variables.status = status;

    const data = await queryAniList(query, variables, 180);
    const items = (data.Page?.media ?? []).map(normalizeMedia);
    return {
      items,
      hasNextPage: Boolean(data.Page?.pageInfo?.hasNextPage),
      total: Number(data.Page?.pageInfo?.total ?? items.length),
      page: Number(data.Page?.pageInfo?.currentPage ?? page),
    };
  } catch {
    // Graceful local filtering over seed catalog
    const seed = getSeedData();
    let filtered = seed.all.filter((m) => m.type === type);
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.title.romaji.toLowerCase().includes(q) ||
          (m.title.english ?? "").toLowerCase().includes(q) ||
          (m.studio ?? "").toLowerCase().includes(q) ||
          m.genres.some((g) => g.toLowerCase().includes(q))
      );
    }
    if (genreList.length > 0) {
      filtered = filtered.filter((m) =>
        genreList.every((g) => m.genres.includes(g))
      );
    }
    if (minScore && minScore > 0) {
      filtered = filtered.filter((m) => (m.averageScore ?? 0) >= minScore);
    }
    if (maxScore && maxScore > 0) {
      filtered = filtered.filter(
        (m) => m.averageScore !== null && m.averageScore <= maxScore
      );
    }
    if (type === "ANIME") {
      if (minEpisodes && minEpisodes > 0) {
        filtered = filtered.filter((m) => (m.episodes ?? 0) >= minEpisodes);
      }
      if (maxEpisodes && maxEpisodes > 0) {
        filtered = filtered.filter(
          (m) => m.episodes !== null && m.episodes > 0 && m.episodes <= maxEpisodes
        );
      }
    } else {
      if (minChapters && minChapters > 0) {
        filtered = filtered.filter((m) => (m.chapters ?? 0) >= minChapters);
      }
      if (maxChapters && maxChapters > 0) {
        filtered = filtered.filter(
          (m) => m.chapters !== null && m.chapters > 0 && m.chapters <= maxChapters
        );
      }
    }
    if (format && format !== "ALL") {
      filtered = filtered.filter((m) => m.format === format);
    }
    if (status && status !== "ALL") {
      filtered = filtered.filter((m) => m.status === status);
    }
    if (year) {
      filtered = filtered.filter((m) => m.seasonYear === year || m.startYear === year);
    }
    if (sort === "SCORE_DESC") {
      filtered.sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0));
    } else if (sort === "POPULARITY_DESC") {
      filtered.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    }
    return {
      items: filtered,
      hasNextPage: false,
      total: filtered.length,
      page: 1,
      fromCache: true,
    };
  }
}

export async function fetchMediaDetail(id: number): Promise<MediaDetail | null> {
  try {
    const query = `
      query ($id: Int) {
        Media(id: $id) {
          ${MEDIA_FRAGMENT}
          source
          countryOfOrigin
          hashtag
          siteUrl
          allStudios: studios { nodes { name } }
          tags { name rank isMediaSpoiler isAdult }
          characters(sort: [ROLE, RELEVANCE], perPage: 10) {
            edges {
              role
              node { id name { full } image { large } }
              voiceActors(language: JAPANESE, sort: [RELEVANCE]) {
                name { full }
                image { large }
                languageV2
              }
            }
          }
          relations {
            edges {
              relationType
              node {
                id type isAdult
                title { romaji english }
                coverImage { large medium }
                format averageScore
              }
            }
          }
          recommendations(sort: [RATING_DESC], perPage: 8) {
            nodes {
              mediaRecommendation {
                ${MEDIA_FRAGMENT}
                isAdult
              }
            }
          }
          stats {
            scoreDistribution { score amount }
          }
          streamingEpisodes { title thumbnail url site }
        }
      }
    `;

    const data = await queryAniList(query, { id }, 300);
    if (!data?.Media) return null;
    return normalizeMediaDetail(data.Media);
  } catch {
    const seed = getSeedData();
    const match = seed.all.find((m) => m.id === id);
    if (!match) return null;
    return {
      ...match,
      source: "MANGA",
      countryOfOrigin: "JP",
      hashtag: null,
      siteUrl: `https://anilist.co/${match.type.toLowerCase()}/${match.id}`,
      studios: match.studio ? [match.studio] : [],
      tags: match.genres.map((g, i) => ({ name: g, rank: 90 - i * 8 })),
      characters: [],
      relations: [],
      recommendations: seed.all
        .filter((m) => m.id !== id && m.type === match.type)
        .slice(0, 6),
      scoreDistribution: [
        { score: 50, amount: 120 },
        { score: 60, amount: 340 },
        { score: 70, amount: 1120 },
        { score: 80, amount: 3840 },
        { score: 90, amount: 6420 },
        { score: 100, amount: 4210 },
      ],
      streamingEpisodes: [],
    };
  }
}

export async function fetchWeeklySchedule(): Promise<AiringScheduleItem[]> {
  const seed = getSeedData();
  try {
    // Rolling 7-day window starting from Today 00:00 -> Today + 7 days
    // so upcoming episodes for the next 7 days are ALWAYS visible (even on Sunday!)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endWindow = new Date(startOfToday);
    endWindow.setDate(endWindow.getDate() + 7);

    const startSec = Math.floor(startOfToday.getTime() / 1000);
    const endSec = Math.floor(endWindow.getTime() / 1000);

    const query = `
      query ($start: Int, $end: Int) {
        page1: Page(page: 1, perPage: 50) {
          airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
            id airingAt episode timeUntilAiring
            media { ${MEDIA_FRAGMENT} isAdult }
          }
        }
        page2: Page(page: 2, perPage: 50) {
          airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
            id airingAt episode timeUntilAiring
            media { ${MEDIA_FRAGMENT} isAdult }
          }
        }
        page3: Page(page: 3, perPage: 50) {
          airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
            id airingAt episode timeUntilAiring
            media { ${MEDIA_FRAGMENT} isAdult }
          }
        }
        page4: Page(page: 4, perPage: 50) {
          airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
            id airingAt episode timeUntilAiring
            media { ${MEDIA_FRAGMENT} isAdult }
          }
        }
      }
    `;

    const data = await queryAniList(query, { start: startSec, end: endSec }, 300);
    const combined = [
      ...(data.page1?.airingSchedules ?? []),
      ...(data.page2?.airingSchedules ?? []),
      ...(data.page3?.airingSchedules ?? []),
      ...(data.page4?.airingSchedules ?? []),
    ];

    const filtered: AiringScheduleItem[] = combined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((s: any) => s.media && !s.media.isAdult && (s.media.popularity ?? 0) > 1200)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((s: any) => ({
        id: s.id,
        airingAt: s.airingAt,
        episode: s.episode,
        timeUntilAiring: s.timeUntilAiring,
        media: normalizeMedia(s.media),
      }));

    return filtered.length > 0 ? filtered : seed.airing;
  } catch {
    return seed.airing;
  }
}

/**
 * Dedicated 1-click Weekly Episode Tracker feed:
 * Fetches BOTH episodes already aired in the last 7 days (most recent first)
 * AND upcoming episodes in the next 7 days (soonest first) in one GraphQL batch.
 */
export async function fetchWeeklyEpisodeTrackerSchedule(): Promise<AiringScheduleItem[]> {
  const seed = getSeedData();
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const pastStart = nowSec - 7 * 86400;
    const futureEnd = nowSec + 7 * 86400;

    const query = `
      query ($pastStart: Int, $now: Int, $futureEnd: Int) {
        recent1: Page(page: 1, perPage: 50) {
          airingSchedules(airingAt_greater: $pastStart, airingAt_lesser: $now, sort: TIME_DESC) {
            id airingAt episode timeUntilAiring
            media { ${MEDIA_FRAGMENT} isAdult }
          }
        }
        recent2: Page(page: 2, perPage: 50) {
          airingSchedules(airingAt_greater: $pastStart, airingAt_lesser: $now, sort: TIME_DESC) {
            id airingAt episode timeUntilAiring
            media { ${MEDIA_FRAGMENT} isAdult }
          }
        }
        upcoming1: Page(page: 1, perPage: 50) {
          airingSchedules(airingAt_greater: $now, airingAt_lesser: $futureEnd, sort: TIME) {
            id airingAt episode timeUntilAiring
            media { ${MEDIA_FRAGMENT} isAdult }
          }
        }
        upcoming2: Page(page: 2, perPage: 50) {
          airingSchedules(airingAt_greater: $now, airingAt_lesser: $futureEnd, sort: TIME) {
            id airingAt episode timeUntilAiring
            media { ${MEDIA_FRAGMENT} isAdult }
          }
        }
      }
    `;

    const data = await queryAniList(
      query,
      { pastStart, now: nowSec, futureEnd },
      180
    );

    const combined = [
      ...(data.recent1?.airingSchedules ?? []),
      ...(data.recent2?.airingSchedules ?? []),
      ...(data.upcoming1?.airingSchedules ?? []),
      ...(data.upcoming2?.airingSchedules ?? []),
    ];

    const seen = new Set<number>();
    const filtered: AiringScheduleItem[] = [];
    for (const s of combined) {
      if (!s?.media || s.media.isAdult || (s.media.popularity ?? 0) <= 1000) continue;
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      filtered.push({
        id: s.id,
        airingAt: s.airingAt,
        episode: s.episode,
        timeUntilAiring: s.timeUntilAiring,
        media: normalizeMedia(s.media),
      });
    }

    return filtered.length > 0 ? filtered : seed.airing;
  } catch {
    return seed.airing;
  }
}

export interface SeasonalBucket {
  id: string;
  label: string;
  sublabel: string;
  isCurrent?: boolean;
  isNext?: boolean;
  items: MediaItem[];
}

const SEASON_ORDER = ["WINTER", "SPRING", "SUMMER", "FALL"] as const;
const SEASON_FR_MAP: Record<string, string> = {
  WINTER: "Hiver",
  SPRING: "Printemps",
  SUMMER: "Été",
  FALL: "Automne",
};

function getCurrentSeasonIndex(month0: number): number {
  if (month0 <= 2) return 0; // WINTER
  if (month0 <= 5) return 1; // SPRING
  if (month0 <= 8) return 2; // SUMMER
  return 3; // FALL
}

export async function fetchSeasonalCalendarData(): Promise<SeasonalBucket[]> {
  const now = new Date();
  const baseYear = now.getFullYear();
  const baseIdx = getCurrentSeasonIndex(now.getMonth());

  // Compute Current season + next 4 upcoming seasons dynamically
  const targets = Array.from({ length: 5 }, (_, offset) => {
    const total = baseIdx + offset;
    const season = SEASON_ORDER[total % 4];
    const year = baseYear + Math.floor(total / 4);
    return {
      key: `s${offset}`,
      id: `${season}_${year}`,
      season,
      year,
      label: `${SEASON_FR_MAP[season]} ${year}`,
      sublabel:
        offset === 0
          ? "Saison en cours"
          : offset === 1
            ? "Prochaine saison"
            : "À venir",
      isCurrent: offset === 0,
      isNext: offset === 1,
    };
  });

  try {
    const query = `
      query {
        ${targets
          .map(
            (t) => `
          ${t.key}: Page(page: 1, perPage: 24) {
            media(
              type: ANIME
              season: ${t.season}
              seasonYear: ${t.year}
              sort: POPULARITY_DESC
              isAdult: false
            ) {
              ${MEDIA_FRAGMENT}
            }
          }`
          )
          .join("\n")}
        tba: Page(page: 1, perPage: 24) {
          media(
            type: ANIME
            status: NOT_YET_RELEASED
            sort: POPULARITY_DESC
            isAdult: false
          ) {
            ${MEDIA_FRAGMENT}
          }
        }
      }
    `;

    const data = await queryAniList(query, {}, 600);

    const buckets: SeasonalBucket[] = targets.map((t) => ({
      id: t.id,
      label: t.label,
      sublabel: t.sublabel,
      isCurrent: t.isCurrent,
      isNext: t.isNext,
      items: (data?.[t.key]?.media ?? []).map(normalizeMedia),
    }));

    // Announced TBA (unreleased anime without an exact upcoming season, or top anticipated)
    const tbaRaw: MediaItem[] = (data?.tba?.media ?? []).map(normalizeMedia);
    const tbaOnly = tbaRaw.filter((m) => !m.season || !m.seasonYear);
    buckets.push({
      id: "ANNOUNCED",
      label: "Annoncés",
      sublabel: "Prochainement (TBA)",
      items: tbaOnly.length >= 6 ? tbaOnly : tbaRaw,
    });

    return buckets;
  } catch {
    const seed = getSeedData();
    return [
      {
        id: targets[0].id,
        label: targets[0].label,
        sublabel: "Saison en cours",
        isCurrent: true,
        items: seed.trending,
      },
    ];
  }
}
