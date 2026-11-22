import seedRaw from "@/data/anilist-seed.json";
import type {
  AiringScheduleItem,
  CharacterEdge,
  MediaDetail,
  MediaItem,
  MediaRelation,
  MediaType,
} from "@/types/media";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

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
  const res = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate },
  });

  if (!res.ok) {
    throw new Error(`AniList HTTP ${res.status}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || "AniList GraphQL error");
  }
  return json.data as T;
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
  startDate { year }
  averageScore
  meanScore
  popularity
  favourites
  genres
  studios(isMain: true) { nodes { name } }
  staff(perPage: 1) { edges { role node { name { full } } } }
  trailer { id site }
  nextAiringEpisode { airingAt timeUntilAiring episode }
`;

export function getSeedData() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = seedRaw as any;
  const trending: MediaItem[] = (data.trending?.media ?? []).map(normalizeMedia);
  const popular: MediaItem[] = (data.popular?.media ?? []).map(normalizeMedia);
  const topAnime: MediaItem[] = (data.topAnime?.media ?? []).map(normalizeMedia);
  const manga: MediaItem[] = (data.manga?.media ?? []).map(normalizeMedia);

  const now = Math.floor(Date.now() / 1000);
  const airing: AiringScheduleItem[] = (data.airing?.airingSchedules ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((s: any, idx: number) => {
      // If seed timestamps are slightly in the past, keep them mapped onto the current week cleanly
      const baseTime =
        s.airingAt < now - 2 * 86400
          ? now + ((idx % 7) * 86400 + (idx % 6) * 7200)
          : s.airingAt;
      return {
        id: s.id,
        airingAt: baseTime,
        episode: s.episode,
        timeUntilAiring: baseTime - now,
        media: normalizeMedia(s.media),
      };
    });

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
}

export async function fetchHomeData(): Promise<HomeData> {
  const seed = getSeedData();
  try {
    const now = Math.floor(Date.now() / 1000);
    const query = `
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

    const data = await queryAniList(
      query,
      { dayStart: now - 3600 * 6, dayEnd: now + 3600 * 48 },
      300
    );

    const trending: MediaItem[] = (data.trending?.media ?? []).map(normalizeMedia);
    const popular: MediaItem[] = (data.popular?.media ?? []).map(normalizeMedia);
    const topAnime: MediaItem[] = (data.topAnime?.media ?? []).map(normalizeMedia);
    const manga: MediaItem[] = (data.manga?.media ?? []).map(normalizeMedia);
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
    };
  }
}

export interface DiscoverParams {
  search?: string;
  type?: MediaType;
  genre?: string;
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
    season,
    year,
    format,
    status,
    sort = "TRENDING_DESC",
    page = 1,
    perPage = 24,
  } = params;

  try {
    const query = `
      query (
        $page: Int,
        $perPage: Int,
        $search: String,
        $type: MediaType,
        $genre: String,
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
            genre: $genre,
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
    if (genre && genre !== "ALL") variables.genre = genre;
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
    if (genre && genre !== "ALL") {
      filtered = filtered.filter((m) => m.genres.includes(genre));
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
    const now = new Date();
    // Monday 00:00 of the current week to Sunday 23:59
    const day = now.getDay(); // 0=Sun..6=Sat
    const diffToMon = (day + 6) % 7;
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - diffToMon);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const startSec = Math.floor(startOfWeek.getTime() / 1000);
    const endSec = Math.floor(endOfWeek.getTime() / 1000);

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
      }
    `;

    const data = await queryAniList(query, { start: startSec, end: endSec }, 300);
    const combined = [
      ...(data.page1?.airingSchedules ?? []),
      ...(data.page2?.airingSchedules ?? []),
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
