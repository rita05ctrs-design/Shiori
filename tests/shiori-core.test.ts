import test from "node:test";
import assert from "node:assert/strict";

import {
  clampProgress,
  computeProgressStep,
  getProgressPercent,
  filterAndSortLibrary,
  libraryToCsv,
  DEFAULT_LIBRARY_FILTERS,
} from "../src/lib/library-utils.ts";
import { computeLibraryAnalytics, computeShioriWrapped } from "../src/lib/stats.ts";
import {
  formatDateKeyInTimezone,
  formatTimeInTimezone,
  buildMonthCalendarGrid,
} from "../src/lib/calendar-utils.ts";
import { computeProfileAffinity } from "../src/lib/affinity.ts";
import { evaluateAllBadges, extractBadgeMetrics } from "../src/lib/badges.ts";
import { normalizeContentLanguage } from "../src/lib/i18n.ts";
import {
  DEFAULT_DISCOVER_STATE,
  discoverStateToSearchParams,
  libraryStateToSearchParams,
  searchParamsToDiscoverState,
  searchParamsToLibraryState,
} from "../src/lib/filter-persistence.ts";
import { parseMalXml } from "../src/lib/mal-import.ts";
import { BoundedClientCache } from "../src/lib/client-cache.ts";
import {
  buildRegionalSearchLinks,
  normalizeStreamingLinks,
} from "../src/lib/streaming.ts";
import {
  AI_RECS_END,
  AI_RECS_START,
  buildShioriSystemPrompt,
  buildUserTasteSummary,
  extractAiRecommendationsBlock,
  filterUnseenResolvedRecommendations,
  inferGenresFromPrompt,
  stripRecommendationsMarkerForDisplay,
} from "../src/lib/ai-recommend.ts";
import {
  normalizeSearchText,
  resolveSearchAlias,
} from "../src/lib/searchAliases.ts";
import {
  buildTypoFallbackQueries,
  rankMediaByFuzzySearch,
} from "../src/lib/fuzzy-search.ts";
import {
  computeGenreIntensities,
  mediaMatchesGenreMinRanks,
  mediaMatchesMinGenreIntensity,
} from "../src/lib/genre-intensity.ts";
import {
  buildSeasonChronology,
  type RawRelationMediaNode,
} from "../src/lib/season-timeline.ts";
import {
  deleteSavedAiChat,
  deriveAiChatTitle,
  upsertSavedAiChat,
} from "../src/lib/ai-chat-storage.ts";
import {
  mapMediaDeviceErrorToFrench,
  mapSpeechErrorToFrench,
  mergeTranscriptWithDraft,
  resolveSpeechLocale,
  sanitizeTextForSpeech,
} from "../src/lib/ai-voice.ts";
import type {
  AiringScheduleItem,
  CustomCollection,
  LibraryEntry,
  MediaItem,
  PublicUserProfile,
} from "../src/types/media.ts";

function makeEntry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    mediaId: 1001,
    type: "ANIME",
    title: "Frieren: Beyond Journey's End",
    nativeTitle: "葬送のフリーレン",
    coverImage: "https://example.com/frieren.jpg",
    bannerImage: null,
    status: "COMPLETED",
    progress: 28,
    totalUnits: 28,
    score: 9.5,
    averageScore: 93,
    isFavorite: true,
    notes: "Chef-d'œuvre absolu, émotion pure",
    genres: ["Adventure", "Drama", "Fantasy"],
    format: "TV",
    season: "FALL",
    seasonYear: 2023,
    studio: "Madhouse",
    duration: 24,
    startedAt: "2025-01-10T10:00:00.000Z",
    completedAt: "2025-03-20T21:00:00.000Z",
    updatedAt: "2025-03-20T21:00:00.000Z",
    ...overrides,
  };
}

test("library-utils: clampProgress enforces non-negative and totalUnits upper bound", () => {
  assert.equal(clampProgress(-5, 12), 0);
  assert.equal(clampProgress(0, 12), 0);
  assert.equal(clampProgress(7.8, 12), 7);
  assert.equal(clampProgress(99, 12), 12);
  assert.equal(clampProgress(450, null), 450);
  assert.equal(clampProgress(Number.NaN, 24), 0);
});

test("library-utils: computeProgressStep auto-completes on last episode & promotes PLAN_TO_WATCH", () => {
  const watching = makeEntry({ status: "WATCHING", progress: 11, totalUnits: 12, completedAt: null });
  const finished = computeProgressStep(watching, 1);
  assert.equal(finished.progress, 12);
  assert.equal(finished.status, "COMPLETED");
  assert.ok(finished.completedAt, "completedAt should be set when reaching totalUnits");

  const planned = makeEntry({ status: "PLAN_TO_WATCH", progress: 0, totalUnits: 24, startedAt: null });
  const started = computeProgressStep(planned, 1);
  assert.equal(started.progress, 1);
  assert.equal(started.status, "WATCHING");
  assert.ok(started.startedAt, "startedAt should be populated on first progress");

  const atZero = computeProgressStep(planned, -1);
  assert.equal(atZero.progress, 0);
  assert.equal(atZero.changed, false);
});

test("library-utils: getProgressPercent handles known and unknown totalUnits safely", () => {
  assert.equal(getProgressPercent({ progress: 12, totalUnits: 24, status: "WATCHING" }), 50);
  assert.equal(getProgressPercent({ progress: 28, totalUnits: 28, status: "COMPLETED" }), 100);
  assert.equal(getProgressPercent({ progress: 15, totalUnits: null, status: "WATCHING" }), null);
  assert.equal(getProgressPercent({ progress: 15, totalUnits: null, status: "COMPLETED" }), 100);
});

test("library-utils: filterAndSortLibrary combines genre, year, collection, score & sort", () => {
  const e1 = makeEntry({ mediaId: 1, title: "Frieren", score: 9.5, seasonYear: 2023, studio: "Madhouse" });
  const e2 = makeEntry({
    mediaId: 2,
    type: "MANGA",
    title: "Berserk",
    score: 9.8,
    genres: ["Action", "Dark Fantasy"],
    format: "MANGA",
    season: null,
    seasonYear: 1989,
    studio: "Kentaro Miura",
    status: "WATCHING",
    progress: 320,
    totalUnits: null,
    isFavorite: false,
  });
  const e3 = makeEntry({
    mediaId: 3,
    title: "Solo Leveling",
    score: 8.2,
    genres: ["Action", "Fantasy"],
    seasonYear: 2024,
    season: "WINTER",
    studio: "A-1 Pictures",
    status: "WATCHING",
    progress: 10,
    totalUnits: 12,
    isFavorite: false,
  });

  const col: CustomCollection = {
    id: "col-1",
    name: "Incontournables",
    description: "",
    color: "#E5484D",
    mediaIds: [1, 3],
    isPublic: true,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };

  const filtered = filterAndSortLibrary(
    [e1, e2, e3],
    {
      ...DEFAULT_LIBRARY_FILTERS,
      genre: "Fantasy",
      collectionId: "col-1",
      scoreFilter: "8",
    },
    "SCORE",
    { collections: [col], favoriteRankMap: new Map([[1, 0]]) }
  );

  assert.deepEqual(
    filtered.map((x) => x.mediaId),
    [1, 3]
  );

  const almostDone = filterAndSortLibrary(
    [e1, e2, e3],
    { ...DEFAULT_LIBRARY_FILTERS, progressFilter: "ALMOST_DONE" },
    "TITLE"
  );
  assert.deepEqual(
    almostDone.map((x) => x.mediaId),
    [3]
  );
});

test("library-utils: libraryToCsv escapes commas and quotes per RFC-4180", () => {
  const entry = makeEntry({
    title: 'Kaguya-sama: "Love is War", S3',
    notes: 'Incroyable, "drôle" et touchant',
  });
  const csv = libraryToCsv([entry]);
  const lines = csv.split("\n");
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith("mediaId,type,title,"));
  assert.ok(lines[1].includes('"Kaguya-sama: ""Love is War"", S3"'));
  assert.ok(lines[1].includes('"Incroyable, ""drôle"" et touchant"'));
});

test("stats: computeLibraryAnalytics reports accurate lifecycle counts & unknown durations", () => {
  const library: LibraryEntry[] = [
    makeEntry({ mediaId: 1, status: "COMPLETED", progress: 28, duration: 24, score: 9.5, seasonYear: 2023 }),
    makeEntry({ mediaId: 2, status: "WATCHING", progress: 5, duration: null, score: 8.0, seasonYear: 2024 }),
    makeEntry({ mediaId: 3, status: "DROPPED", progress: 2, duration: 24, score: 5.0, seasonYear: 2024 }),
    makeEntry({
      mediaId: 4,
      type: "MANGA",
      status: "COMPLETED",
      progress: 139,
      totalUnits: 139,
      duration: null,
      score: 9.0,
      seasonYear: 2021,
      genres: ["Action", "Drama"],
      studio: "Hajime Isayama",
    }),
  ];

  const analytics = computeLibraryAnalytics(library, [], new Date("2025-05-01T00:00:00.000Z"));
  assert.equal(analytics.totalTitles, 4);
  assert.equal(analytics.animeStarted, 3);
  assert.equal(analytics.animeCompleted, 1);
  assert.equal(analytics.animeWatching, 1);
  assert.equal(analytics.animeDropped, 1);
  assert.equal(analytics.mangaRead, 1);
  assert.equal(analytics.mangaCompleted, 1);
  assert.equal(analytics.totalEpisodes, 35);
  assert.equal(analytics.totalChapters, 139);
  assert.equal(analytics.unknownDurationCount, 1);
  assert.equal(analytics.meanScore, 7.88);
  assert.equal(analytics.yearEvolution.length, 3);
  assert.equal(analytics.monthlyActivity.length, 12);
});

test("stats: computeShioriWrapped builds real year summary and ranks top titles", () => {
  const library: LibraryEntry[] = [
    makeEntry({ mediaId: 1, title: "Frieren", score: 10, isFavorite: true, completedAt: "2025-02-15T12:00:00.000Z" }),
    makeEntry({ mediaId: 2, title: "Vinland Saga", score: 9.2, isFavorite: false, completedAt: "2025-06-10T12:00:00.000Z" }),
  ];

  const wrapped = computeShioriWrapped(library, [], 2025);
  assert.equal(wrapped.year, 2025);
  assert.equal(wrapped.titlesTracked, 2);
  assert.equal(wrapped.topTitles[0].mediaId, 1);
  assert.equal(wrapped.topStudio?.name, "Madhouse");
  assert.ok(wrapped.archetype.title.length > 0);
});

test("calendar-utils: timezone conversion distinguishes UTC and JST across midnight", () => {
  // 2026-04-05 16:30 UTC == 2026-04-06 01:30 JST (Asia/Tokyo)
  const dt = new Date("2026-04-05T16:30:00.000Z");
  assert.equal(formatDateKeyInTimezone(dt, "UTC"), "2026-04-05");
  assert.equal(formatDateKeyInTimezone(dt, "Asia/Tokyo"), "2026-04-06");
  assert.equal(formatTimeInTimezone(Math.floor(dt.getTime() / 1000), "Asia/Tokyo"), "01:30");

  const media: MediaItem = {
    id: 1001,
    type: "ANIME",
    format: "TV",
    status: "RELEASING",
    title: { romaji: "Test Show", english: "Test Show", native: null },
    coverImage: { extraLarge: "", large: "", color: null },
    bannerImage: null,
    description: null,
    episodes: 12,
    chapters: null,
    volumes: null,
    duration: 24,
    averageScore: 84,
    meanScore: 84,
    popularity: 1000,
    favourites: 100,
    season: "SPRING",
    seasonYear: 2026,
    startYear: 2026,
    genres: ["Action"],
    studio: "MAPPA",
    trailer: null,
    nextAiringEpisode: null,
    startDate: { year: 2026, month: 4, day: 1 },
  };

  const slot: AiringScheduleItem = {
    id: 900,
    episode: 4,
    airingAt: Math.floor(dt.getTime() / 1000),
    timeUntilAiring: 3600,
    media,
  };

  const grid = buildMonthCalendarGrid(2026, 3, [slot], [media], {
    timeZone: "Asia/Tokyo",
    today: dt,
  });
  assert.equal(grid.cells.length % 7, 0);
  const apr6 = grid.cells.find((c) => c.dateKey === "2026-04-06");
  const apr1 = grid.cells.find((c) => c.dateKey === "2026-04-01");
  assert.equal(apr6?.airingCount, 1);
  assert.equal(apr6?.isToday, true);
  assert.equal(apr1?.premiereCount, 1);
});

test("affinity: computes common titles, shared favorites, and non-duplicate recommendations", () => {
  const viewerLibrary: LibraryEntry[] = [
    makeEntry({ mediaId: 10, title: "Frieren", score: 9.5, isFavorite: true, genres: ["Fantasy", "Drama"] }),
    makeEntry({ mediaId: 20, title: "Monster", score: 9.0, isFavorite: false, genres: ["Mystery", "Drama"] }),
  ];

  const targetProfile: PublicUserProfile = {
    id: "u-target",
    username: "sora_kyoto",
    displayName: "Sora",
    avatarUrl: null,
    avatarInitials: "SO",
    bio: "",
    accentColor: "#E5484D",
    isActivityPublic: true,
    joinedAt: "2025-01-01T00:00:00.000Z",
    favoriteStaff: [],
    favoriteMedia: [
      { mediaId: 10, type: "ANIME", title: "Frieren", coverImage: "", score: 9.5 },
      { mediaId: 30, type: "ANIME", title: "Mushishi", coverImage: "", score: 9.6 },
    ],
    libraryPreview: [
      { mediaId: 10, type: "ANIME", title: "Frieren", coverImage: "", score: 9.5, isFavorite: true, genres: ["Fantasy", "Drama"] },
      { mediaId: 20, type: "ANIME", title: "Monster", coverImage: "", score: 9.2, genres: ["Mystery", "Drama"] },
      { mediaId: 30, type: "ANIME", title: "Mushishi", coverImage: "", score: 9.6, isFavorite: true, genres: ["Fantasy", "Mystery"] },
    ],
    stats: {
      totalEntries: 3,
      animeCount: 3,
      mangaCount: 0,
      episodesWatched: 120,
      chaptersRead: 0,
      completedCount: 3,
      meanScore: 9.4,
    },
  };

  const result = computeProfileAffinity({
    viewerLibrary,
    viewerFavoriteStaff: [],
    targetProfile,
  });

  assert.equal(result.commonTitles.length, 2);
  assert.equal(result.sharedFavorites.length, 1);
  assert.equal(result.sharedFavorites[0].mediaId, 10);
  assert.ok(result.compatibilityPct >= 75, `Expected high affinity >= 75, got ${result.compatibilityPct}`);
  assert.ok(result.recommendationsFromTarget.some((r) => r.mediaId === 30));
  assert.ok(!result.recommendationsFromTarget.some((r) => r.mediaId === 10 || r.mediaId === 20));
});

test("badges & i18n: badge evaluation and language normalization behave deterministically", () => {
  const emptyMetrics = extractBadgeMetrics({
    library: [],
    favoriteStaff: [],
    profile: { avatarUrl: null },
    socialInteractionsCount: 0,
  });
  const emptyBadges = evaluateAllBadges(emptyMetrics, []);
  assert.equal(emptyBadges.filter((b) => b.unlocked).length, 0);

  const activeLibrary = [makeEntry({ status: "COMPLETED", progress: 28, score: 10 })];
  const activeMetrics = extractBadgeMetrics({
    library: activeLibrary,
    favoriteStaff: [],
    profile: { avatarUrl: "https://example.com/a.png" },
    socialInteractionsCount: 1,
  });
  const activeBadges = evaluateAllBadges(activeMetrics, []);
  assert.ok(activeBadges.some((b) => b.unlocked), "Expected at least one unlocked milestone badge");

  assert.equal(normalizeContentLanguage("fr"), "fr");
  assert.equal(normalizeContentLanguage("EN"), "en");
  assert.equal(normalizeContentLanguage("es"), "es");
  assert.equal(normalizeContentLanguage("invalid-lang"), "fr");
});

test("stress & missing data: 2,000-entry library stays fast, coherent & NaN-safe", () => {
  const genres = ["Action", "Drama", "Fantasy", "Sci-Fi", "Mystery", "Romance"];
  const statuses: LibraryEntry["status"][] = ["WATCHING", "COMPLETED", "ON_HOLD", "DROPPED", "PLAN_TO_WATCH"];
  const large: LibraryEntry[] = Array.from({ length: 2000 }, (_, idx) => {
    const i = idx + 1;
    const isManga = i % 3 === 0;
    const status = statuses[i % statuses.length];
    const totalUnits = i % 7 === 0 ? null : isManga ? 120 : 12;
    const progress =
      status === "COMPLETED" ? (totalUnits ?? 12) : status === "PLAN_TO_WATCH" ? 0 : (i % 10) + 1;
    return makeEntry({
      mediaId: 500000 + i,
      type: isManga ? "MANGA" : "ANIME",
      title: `Large Item #${i}`,
      status,
      progress,
      totalUnits,
      duration: isManga || i % 8 === 0 ? null : 24,
      score: status === "PLAN_TO_WATCH" || i % 5 === 0 ? null : Number((6 + (i % 41) * 0.1).toFixed(1)),
      isFavorite: i <= 40,
      genres: i % 13 === 0 ? [] : [genres[i % genres.length]],
      seasonYear: i % 17 === 0 ? null : 2010 + (i % 16),
      studio: i % 6 === 0 ? null : "Madhouse",
      updatedAt: i === 1 ? "invalid-date" : "2026-04-10T10:00:00.000Z",
    });
  });

  const analytics = computeLibraryAnalytics(large, [], new Date("2026-11-23T00:00:00.000Z"));
  assert.equal(analytics.totalTitles, 2000);
  assert.equal(analytics.favorites.length, 40);
  assert.ok(analytics.unknownDurationCount > 0);
  assert.ok(!Number.isNaN(analytics.totalHours));
  assert.ok(!Number.isNaN(analytics.completionRate));

  const filtered = filterAndSortLibrary(
    large,
    { ...DEFAULT_LIBRARY_FILTERS, genre: "Fantasy", scoreFilter: "8" },
    "SCORE"
  );
  assert.ok(filtered.length > 0);
  assert.equal(libraryToCsv(large).split("\n").length, 2001);
});

test("filter-persistence: round-trips Library and Discover filters cleanly via URL params", () => {
  const libState = {
    filters: {
      ...DEFAULT_LIBRARY_FILTERS,
      status: "WATCHING" as const,
      mediaType: "ANIME" as const,
      genre: "Action",
      year: "2024",
      season: "FALL",
      studio: "Madhouse",
      format: "TV",
      scoreFilter: "8" as const,
      progressFilter: "STARTED" as const,
      favoritesOnly: true,
      search: "frieren",
    },
    sortBy: "SCORE" as const,
    view: "list" as const,
    showAdvancedFilters: true,
  };
  const libParams = libraryStateToSearchParams(libState);
  const libRestored = searchParamsToLibraryState(libParams, { showAdvancedFilters: true });
  assert.deepEqual(libRestored.filters, libState.filters);
  assert.equal(libRestored.sortBy, "SCORE");
  assert.equal(libRestored.view, "list");
  assert.equal(libRestored.showAdvancedFilters, true);

  const discState = {
    ...DEFAULT_DISCOVER_STATE,
    type: "MANGA" as const,
    search: "berserk",
    selectedGenres: ["Action", "Drama"],
    selectedTags: ["Seinen"],
    year: "1989",
    format: "MANGA",
    minScore: "85",
    minUnits: "100",
    sort: "SCORE_DESC",
    hideInLibrary: true,
    showFilters: true,
  };
  const discParams = discoverStateToSearchParams(discState);
  const discRestored = searchParamsToDiscoverState(discParams);
  assert.equal(discRestored.type, "MANGA");
  assert.equal(discRestored.search, "berserk");
  assert.deepEqual(discRestored.selectedGenres, ["Action", "Drama"]);
  assert.deepEqual(discRestored.selectedTags, ["Seinen"]);
  assert.equal(discRestored.format, "MANGA");
  assert.equal(discRestored.minScore, "85");
  assert.equal(discRestored.minUnits, "100");
  assert.equal(discRestored.hideInLibrary, true);
  assert.equal(discRestored.showFilters, true);
});

test("mal-import: parses MyAnimeList Anime & Manga XML with CDATA, entities, dates, and volumes", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <myanimelist>
    <myinfo>
      <user_name>kuro_shiori</user_name>
    </myinfo>
    <anime>
      <series_animedb_id>52991</series_animedb_id>
      <series_title><![CDATA[Sousou no Frieren & Beyond]]></series_title>
      <series_episodes>28</series_episodes>
      <my_watched_episodes>28</my_watched_episodes>
      <my_start_date>2024-01-10</my_start_date>
      <my_finish_date>2024-03-22</my_finish_date>
      <my_score>10</my_score>
      <my_status>Completed</my_status>
      <my_comments><![CDATA[Chef-d'oeuvre absolu]]></my_comments>
    </anime>
    <manga>
      <manga_mangadb_id>2</manga_mangadb_id>
      <manga_title>Berserk &amp; Co</manga_title>
      <manga_volumes>42</manga_volumes>
      <manga_chapters>376</manga_chapters>
      <my_read_volumes>18</my_read_volumes>
      <my_read_chapters>150</my_read_chapters>
      <my_start_date>0000-00-00</my_start_date>
      <my_finish_date>0000-00-00</my_finish_date>
      <my_score>0</my_score>
      <my_status>Reading</my_status>
      <my_comments></my_comments>
    </manga>
  </myanimelist>`;

  const parsed = parseMalXml(xml);
  assert.equal(parsed.username, "kuro_shiori");
  assert.equal(parsed.mediaType, "MIXED");
  assert.equal(parsed.items.length, 2);

  const anime = parsed.items[0];
  assert.equal(anime.malId, 52991);
  assert.equal(anime.type, "ANIME");
  assert.equal(anime.title, "Sousou no Frieren & Beyond");
  assert.equal(anime.status, "COMPLETED");
  assert.equal(anime.progress, 28);
  assert.equal(anime.score, 10);
  assert.equal(anime.startedAt, "2024-01-10");
  assert.equal(anime.completedAt, "2024-03-22");
  assert.equal(anime.notes, "Chef-d'oeuvre absolu");

  const manga = parsed.items[1];
  assert.equal(manga.malId, 2);
  assert.equal(manga.type, "MANGA");
  assert.equal(manga.title, "Berserk & Co");
  assert.equal(manga.status, "WATCHING");
  assert.equal(manga.progress, 150);
  assert.equal(manga.progressVolumes, 18);
  assert.equal(manga.totalVolumes, 42);
  assert.equal(manga.score, null);
  assert.equal(manga.startedAt, null);
});

test("client-cache: enforces TTL expiration and LRU eviction cleanly", () => {
  const backing = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => {
      backing.set(k, v);
    },
    removeItem: (k: string) => {
      backing.delete(k);
    },
  };

  const cache = new BoundedClientCache<string>({
    storageKey: "test_cache",
    maxEntries: 4,
    ttlMs: 5000,
    storage: mockStorage,
  });

  cache.set("a", "1", 1000);
  cache.set("b", "2", 1001);
  cache.set("c", "3", 1002);
  cache.set("d", "4", 1003);
  // Touch "a" so "b" becomes least recently used
  assert.equal(cache.get("a", 1010), "1");
  cache.set("e", "5", 1011);

  assert.equal(cache.size, 4);
  assert.equal(cache.get("b", 1020), null);
  assert.equal(cache.get("a", 1020), "1");
  assert.equal(cache.get("e", 1020), "5");
  // Expire after TTL
  assert.equal(cache.get("a", 7000), null);
});

test("affinity: surfaces shared genres, agreements, and score debates", () => {
  const viewerLibrary: LibraryEntry[] = [
    makeEntry({ mediaId: 10, title: "Frieren", score: 9.5, isFavorite: true, genres: ["Fantasy", "Drama"] }),
    makeEntry({ mediaId: 20, title: "Divisive Show", score: 9.0, isFavorite: false, genres: ["Action"] }),
  ];
  const targetProfile: PublicUserProfile = {
    id: "u-friend",
    username: "hana",
    displayName: "Hana",
    avatarUrl: null,
    avatarInitials: "HA",
    bio: "",
    accentColor: "#E5484D",
    isActivityPublic: true,
    joinedAt: "2025-01-01T00:00:00.000Z",
    favoriteStaff: [],
    favoriteMedia: [
      { mediaId: 10, type: "ANIME", title: "Frieren", coverImage: "", score: 9.5 },
    ],
    libraryPreview: [
      { mediaId: 10, type: "ANIME", title: "Frieren", coverImage: "", score: 9.5, isFavorite: true, genres: ["Fantasy", "Drama"] },
      { mediaId: 20, type: "ANIME", title: "Divisive Show", coverImage: "", score: 6.0, genres: ["Action"] },
    ],
    stats: {
      totalEntries: 2,
      animeCount: 2,
      mangaCount: 0,
      episodesWatched: 40,
      chaptersRead: 0,
      completedCount: 2,
      meanScore: 7.8,
    },
  };

  const aff = computeProfileAffinity({
    viewerLibrary,
    viewerFavoriteStaff: [],
    targetProfile,
  });

  assert.ok(aff.sharedGenres.some((g) => g.genre === "Fantasy"));
  assert.equal(aff.biggestAgreements[0]?.mediaId, 10);
  assert.equal(aff.biggestDebates[0]?.mediaId, 20);
  assert.equal(aff.biggestDebates[0]?.scoreDiff, 3);
});

test("streaming: prioritizes EU-working platforms, repairs legacy Crunchyroll/Netflix/Amazon URLs, and filters dead/geo-locked links", () => {
  const links = normalizeStreamingLinks(
    [
      // Geo-locked / dead / promo-channel links that must be dropped
      { id: 1, site: "Bilibili TV", url: "https://www.bilibili.tv/en/media/1", type: "STREAMING", isDisabled: false },
      { id: 2, site: "Hulu", url: "https://www.hulu.com/attack-on-titan", type: "STREAMING", isDisabled: false },
      { id: 3, site: "Tubi TV", url: "https://tubitv.com/series/1630/death_note", type: "STREAMING", isDisabled: false },
      { id: 4, site: "Wakanim", url: "https://www.wakanim.tv/fr/v2/catalogue/show/1", type: "STREAMING", isDisabled: false },
      { id: 5, site: "Netflix", url: "https://www.netflix.com/title/81215627", type: "STREAMING", notes: "IN", isDisabled: false },
      { id: 6, site: "YouTube", url: "https://www.youtube.com/@AniOneAsia", type: "STREAMING", notes: "Ani-One Asia", isDisabled: false },
      { id: 7, site: "Twitter", url: "https://twitter.com/anime", type: "SOCIAL", isDisabled: false },
      { id: 8, site: "Evil", url: "javascript:alert(1)", type: "STREAMING", isDisabled: false },
      // Valid & repairable links
      { id: 9, site: "Netflix", url: "http://www.netflix.com/watch/81726714", type: "STREAMING", isDisabled: false },
      { id: 10, site: "Crunchyroll", url: "http://www.crunchyroll.com/frieren", type: "STREAMING", isDisabled: false },
      { id: 11, site: "Amazon Prime Video", url: "https://www.amazon.com/Frieren/dp/B0EXAMPLE", type: "STREAMING", isDisabled: false },
    ],
    [{ site: "ADN", url: "https://animedigitalnetwork.fr/video/frieren" }],
    { title: "Frieren: Beyond Journey's End" }
  );

  assert.deepEqual(
    links.map((l) => l.site),
    ["Crunchyroll", "ADN", "Netflix", "Amazon Prime Video"]
  );
  // Legacy Crunchyroll slug repaired cleanly to FR search
  assert.equal(
    links[0].url,
    "https://www.crunchyroll.com/fr/search?q=Frieren%3A%20Beyond%20Journey's%20End"
  );
  assert.equal(links[0].isSearchFallback, true);
  // Old animedigitalnetwork.fr domain migrated to animationdigitalnetwork.com
  assert.equal(links[1].url, "https://animationdigitalnetwork.com/video/frieren");
  // Netflix /watch/<id> normalized to /title/<id>
  assert.equal(links[2].url, "https://www.netflix.com/title/81726714");
  // Amazon US dp link repaired to EU Prime Video search
  assert.equal(
    links[3].url,
    "https://www.primevideo.com/search?phrase=Frieren%3A%20Beyond%20Journey's%20End"
  );
  assert.equal(links[3].isSearchFallback, true);

  // Modern Crunchyroll /series/<ID> URL must stay direct (not search fallback)
  const modernCr = normalizeStreamingLinks(
    [
      {
        id: 20,
        site: "Crunchyroll",
        url: "https://crunchyroll.com/series/GG5H5XQX4/frieren-beyond-journeys-end",
        type: "STREAMING",
        isDisabled: false,
      },
    ],
    undefined,
    { title: "Frieren" }
  );
  assert.equal(
    modernCr[0].url,
    "https://www.crunchyroll.com/series/GG5H5XQX4/frieren-beyond-journeys-end"
  );
  assert.equal(modernCr[0].isSearchFallback, undefined);

  const frAnimeLinks = buildRegionalSearchLinks("Frieren", "ANIME");
  assert.equal(frAnimeLinks.length, 4);
  assert.ok(frAnimeLinks[0].url.includes("justwatch.com/fr"));

  const frMangaLinks = buildRegionalSearchLinks("One Piece", "MANGA");
  assert.equal(frMangaLinks.length, 3);
  assert.ok(frMangaLinks.some((l) => l.url.includes("mangas.io/catalogue")));
  assert.ok(!frMangaLinks.some((l) => l.url.includes("izneo.com/fr/search")));
});

test("ai-recommend: builds taste summary, strips streaming JSON cleanly, and excludes already-seen anime", () => {
  const summary = buildUserTasteSummary([
    {
      mediaId: 154587,
      type: "ANIME",
      title: "Frieren: Beyond Journey's End",
      status: "COMPLETED",
      score: 9.5,
      isFavorite: true,
      genres: ["Fantasy", "Drama"],
    },
    {
      mediaId: 19,
      type: "ANIME",
      title: "Monster",
      status: "COMPLETED",
      score: 9.0,
      isFavorite: false,
      genres: ["Mystery", "Psychological"],
    },
  ]);

  assert.equal(summary.favorites.length, 1);
  assert.equal(summary.topRated.length, 2);
  assert.ok(summary.seenIds.has(154587));
  assert.ok(summary.seenIds.has(19));

  const prompt = buildShioriSystemPrompt(summary, "Rita");
  assert.ok(prompt.includes("Frieren: Beyond Journey's End"));
  assert.ok(prompt.includes("Monster"));
  assert.ok(prompt.includes(AI_RECS_START));

  // Partial marker during streaming must never leak to display
  assert.equal(
    stripRecommendationsMarkerForDisplay("Voici mes conseils ! <<<SHIORI"),
    "Voici mes conseils ! "
  );

  const rawOutput = `Je te recommande ces deux pépites !\n${AI_RECS_START}[{"title":"Mushishi","reason":"Poétique et contemplatif","matchTag":"Fantasy"},{"title":"Pluto","reason":"Thriller psychologique magistral","matchTag":"Mystery"}]${AI_RECS_END}`;
  const parsed = extractAiRecommendationsBlock(rawOutput);
  assert.equal(parsed.cleanText, "Je te recommande ces deux pépites !");
  assert.equal(parsed.recommendations.length, 2);
  assert.equal(parsed.recommendations[0].title, "Mushishi");

  // Malformed marker emitted by Gemini (single `>` instead of `>>>`) must still parse & strip cleanly
  const malformedOutput = `Voici trois thrillers intenses !\n<<<SHIORI_RECS>[{"title":"ID:Invaded","reason":"Enquête mentale captivante","matchTag":"Thriller"},{"title":"Erased","reason":"Suspense haletant en 12 épisodes","matchTag":"Mystery"}]<<<END_SHIORI_RECS>>>`;
  const parsedMalformed = extractAiRecommendationsBlock(malformedOutput);
  assert.equal(parsedMalformed.cleanText, "Voici trois thrillers intenses !");
  assert.equal(parsedMalformed.recommendations.length, 2);
  assert.equal(parsedMalformed.recommendations[0].title, "ID:Invaded");
  assert.equal(
    stripRecommendationsMarkerForDisplay(malformedOutput),
    "Voici trois thrillers intenses !"
  );

  const makeMedia = (id: number, romaji: string): MediaItem => ({
    id,
    type: "ANIME",
    title: { romaji, english: romaji, native: null },
    coverImage: { extraLarge: "", large: "", color: null },
    bannerImage: null,
    description: null,
    format: "TV",
    status: "FINISHED",
    episodes: 12,
    chapters: null,
    volumes: null,
    duration: 24,
    season: null,
    seasonYear: 2023,
    startYear: 2023,
    averageScore: 86,
    meanScore: 86,
    popularity: 50000,
    favourites: 1000,
    genres: ["Fantasy"],
    studio: null,
    trailer: null,
    nextAiringEpisode: null,
  });

  const filtered = filterUnseenResolvedRecommendations(
    [
      { media: makeMedia(19, "Monster"), reason: "Déjà vu par ID" },
      { media: makeMedia(999999, "Frieren: Beyond Journey's End"), reason: "Déjà vu par titre" },
      { media: makeMedia(457, "Mushishi"), reason: "Inédit" },
    ],
    summary.seenIds,
    summary.seenNormalizedTitles
  );

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].media.id, 457);

  assert.deepEqual(inferGenresFromPrompt("Un anime sombre et psychologique", ["Action"]), [
    "Horror",
    "Psychological",
  ]);
});

test("searchAliases & fuzzy-search: resolves FR titles/abbreviations and ranks typo/synonym matches first", () => {
  assert.equal(normalizeSearchText("L'Attaque des Titans : Saison 1"), "l attaque des titans saison 1");

  const snk = resolveSearchAlias("snk");
  assert.equal(snk.didExpand, true);
  assert.equal(snk.resolvedQuery, "Shingeki no Kyojin");

  const jjk = resolveSearchAlias("JJK");
  assert.equal(jjk.resolvedQuery, "Jujutsu Kaisen");

  const slimeFr = resolveSearchAlias("Moi quand je me réincarne en Slime");
  assert.equal(slimeFr.didExpand, true);
  assert.equal(slimeFr.resolvedQuery, "Tensei Shitara Slime Datta Ken");

  const aotFr = resolveSearchAlias("L'Attaque des Titans");
  assert.equal(aotFr.resolvedQuery, "Shingeki no Kyojin");

  const makeItem = (
    id: number,
    romaji: string,
    english: string | null,
    native: string | null,
    synonyms: string[]
  ): MediaItem => ({
    id,
    type: "ANIME",
    title: { romaji, english, native },
    synonyms,
    coverImage: { extraLarge: "", large: "", color: null },
    bannerImage: null,
    description: null,
    format: "TV",
    status: "FINISHED",
    episodes: 24,
    chapters: null,
    volumes: null,
    duration: 24,
    season: null,
    seasonYear: 2023,
    startYear: 2023,
    averageScore: 85,
    meanScore: 85,
    popularity: 100000,
    favourites: 5000,
    genres: ["Fantasy"],
    studio: "Madhouse",
    trailer: null,
    nextAiringEpisode: null,
  });

  const pool = [
    makeItem(1, "Bocchi the Rock!", "BOCCHI THE ROCK!", "ぼっち・ざ・ろっく！", []),
    makeItem(2, "Sousou no Frieren", "Frieren: Beyond Journey's End", "葬送のフリーレン", ["Frieren"]),
    makeItem(3, "Shingeki no Kyojin", "Attack on Titan", "進撃の巨人", ["AoT", "L'Attaque des Titans"]),
  ];

  // Typo tolerance: "frierne" -> Frieren first
  const typoRanked = rankMediaByFuzzySearch(pool, "frierne");
  assert.equal(typoRanked[0].id, 2);

  // Native Japanese search
  const jpRanked = rankMediaByFuzzySearch(pool, "進撃の巨人");
  assert.equal(jpRanked[0].id, 3);

  // Synonym match
  const synRanked = rankMediaByFuzzySearch(pool, "AoT");
  assert.equal(synRanked[0].id, 3);

  assert.ok(buildTypoFallbackQueries("frierne").includes("frier"));
});

test("genre-intensity: matches homonymous AniList tags case-insensitively and filters Discover minGenreRank", () => {
  const tags = [
    { name: "drama", rank: 85, category: "Theme-Drama" },
    { name: "Romance", rank: 78, category: "Theme-Romance" },
    { name: "Cyberpunk", rank: 90, category: "Theme-Sci-Fi" },
  ];

  const badges = computeGenreIntensities(["Drama", "Romance", "Sci-Fi", "Sports"], tags);
  assert.equal(badges[0].intensity, 85);
  assert.equal(badges[0].source, "exact_tag");
  assert.equal(badges[1].intensity, 78);
  assert.equal(badges[1].source, "exact_tag");
  assert.equal(badges[2].intensity, 90);
  assert.equal(badges[2].source, "category_tag");
  assert.equal(badges[3].intensity, null);

  assert.equal(
    mediaMatchesMinGenreIntensity({ genres: ["Drama", "Romance"], tags }, ["Romance"], 70),
    true
  );
  assert.equal(
    mediaMatchesMinGenreIntensity({ genres: ["Drama", "Romance"], tags }, ["Romance"], 85),
    false
  );

  // Independent per-genre thresholds: Romance >= 80% AND Comedy >= 30%
  const multiTagsPass = [
    { name: "Romance", rank: 85, category: "Theme-Romance" },
    { name: "Comedy", rank: 45, category: "Theme-Comedy" },
  ];
  const multiTagsFailRomance = [
    { name: "Romance", rank: 75, category: "Theme-Romance" },
    { name: "Comedy", rank: 60, category: "Theme-Comedy" },
  ];
  const multiTagsFailComedy = [
    { name: "Romance", rank: 90, category: "Theme-Romance" },
    { name: "Comedy", rank: 20, category: "Theme-Comedy" },
  ];

  const thresholds = { Romance: 80, Comedy: 30 };
  assert.equal(
    mediaMatchesGenreMinRanks(
      { genres: ["Romance", "Comedy"], tags: multiTagsPass },
      ["Romance", "Comedy"],
      thresholds
    ),
    true
  );
  assert.equal(
    mediaMatchesGenreMinRanks(
      { genres: ["Romance", "Comedy"], tags: multiTagsFailRomance },
      ["Romance", "Comedy"],
      thresholds
    ),
    false
  );
  assert.equal(
    mediaMatchesGenreMinRanks(
      { genres: ["Romance", "Comedy"], tags: multiTagsFailComedy },
      ["Romance", "Comedy"],
      thresholds
    ),
    false
  );

  // Verify independent genreMinRanks round-trip via URL params (`genreRanks=Romance:80,Comedy:30`)
  const qs = discoverStateToSearchParams({
    ...DEFAULT_DISCOVER_STATE,
    selectedGenres: ["Romance", "Comedy"],
    genreMinRanks: { Romance: 80, Comedy: 30, Action: 90 },
  });
  assert.equal(qs.get("genreRanks"), "Romance:80,Comedy:30");
  const parsed = searchParamsToDiscoverState(qs);
  assert.deepEqual(parsed.genreMinRanks, { Romance: 80, Comedy: 30 });
});

test("season-timeline: reconstructs full chronological PREQUEL/SEQUEL chain and hides standalone titles", () => {
  const mkNode = (
    id: number,
    title: string,
    year: number,
    format: string,
    relations: { relationType: string; toId: number; toTitle: string; toYear: number; toFormat: string }[]
  ): RawRelationMediaNode => ({
    id,
    type: "ANIME",
    title: { romaji: title, english: title },
    coverImage: "",
    format,
    episodes: format === "MOVIE" ? 1 : 12,
    chapters: null,
    seasonYear: year,
    startDate: { year, month: 4, day: 1 },
    averageScore: 86,
    relations: relations.map((r) => ({
      relationType: r.relationType,
      node: {
        id: r.toId,
        type: "ANIME",
        title: { romaji: r.toTitle, english: r.toTitle },
        coverImage: "",
        format: r.toFormat,
        episodes: r.toFormat === "MOVIE" ? 1 : 12,
        chapters: null,
        seasonYear: r.toYear,
        startDate: { year: r.toYear, month: 4, day: 1 },
        averageScore: 86,
      },
    })),
  });

  const graph = new Map<number, RawRelationMediaNode>([
    [
      1,
      mkNode(1, "Example Anime", 2020, "TV", [
        { relationType: "SEQUEL", toId: 2, toTitle: "Example Anime Season 2", toYear: 2022, toFormat: "TV" },
      ]),
    ],
    [
      2,
      mkNode(2, "Example Anime Season 2", 2022, "TV", [
        { relationType: "PREQUEL", toId: 1, toTitle: "Example Anime", toYear: 2020, toFormat: "TV" },
        { relationType: "SEQUEL", toId: 3, toTitle: "Example Anime Season 3", toYear: 2024, toFormat: "TV" },
      ]),
    ],
    [
      3,
      mkNode(3, "Example Anime Season 3", 2024, "TV", [
        { relationType: "PREQUEL", toId: 2, toTitle: "Example Anime Season 2", toYear: 2022, toFormat: "TV" },
      ]),
    ],
  ]);

  // Viewing Season 2 should reconstruct S1 -> S2 -> S3 with prev=S1 and next=S3
  const res = buildSeasonChronology(2, graph);
  assert.deepEqual(
    res.timeline.map((t) => t.id),
    [1, 2, 3]
  );
  assert.equal(res.prevSeason?.id, 1);
  assert.equal(res.nextSeason?.id, 3);
  assert.equal(res.timeline[1].relationKind, "CURRENT");

  // Standalone anime should return empty timeline
  const standalone = new Map<number, RawRelationMediaNode>([
    [99, mkNode(99, "Standalone Gem", 2023, "MOVIE", [])],
  ]);
  const emptyRes = buildSeasonChronology(99, standalone);
  assert.equal(emptyRes.timeline.length, 0);
  assert.equal(emptyRes.prevSeason, null);
  assert.equal(emptyRes.nextSeason, null);
});

test("ai-chat-storage: saves, updates, extracts recommended covers, and deletes AI chats", () => {
  const recMedia: MediaItem = {
    id: 5114,
    type: "ANIME",
    title: { romaji: "Fullmetal Alchemist: Brotherhood", english: "Fullmetal Alchemist: Brotherhood", native: null },
    coverImage: { extraLarge: "https://example.com/fma.jpg", large: "https://example.com/fma.jpg", color: null },
    bannerImage: null,
    description: "Long description stripped on save",
    format: "TV",
    status: "FINISHED",
    episodes: 64,
    chapters: null,
    volumes: null,
    duration: 24,
    season: "SPRING",
    seasonYear: 2009,
    startYear: 2009,
    averageScore: 90,
    meanScore: 90,
    popularity: 500000,
    favourites: 100000,
    genres: ["Action", "Adventure"],
    studio: "Bones",
    trailer: null,
    nextAiringEpisode: null,
  };

  const msgs = [
    { id: "u1", role: "user" as const, content: "Un anime d'aventure culte pour ce week-end" },
    {
      id: "a1",
      role: "assistant" as const,
      content: "Je te conseille Fullmetal Alchemist: Brotherhood.",
      recommendations: [{ media: recMedia, reason: "Chef-d'œuvre absolu", matchTag: "Action" }],
    },
  ];

  assert.equal(deriveAiChatTitle(msgs), "Un anime d'aventure culte pour ce week-end");

  const first = upsertSavedAiChat([], { messages: msgs, nowIso: "2026-11-25T14:00:00.000Z" });
  assert.equal(first.list.length, 1);
  assert.equal(first.saved.recommendedCount, 1);
  assert.deepEqual(first.saved.previewCovers, ["https://example.com/fma.jpg"]);
  assert.equal(first.saved.messages[1].recommendations?.[0].media.description, null);

  // Updating existing saved chat keeps same id & updates messages without duplicating
  const updated = upsertSavedAiChat(first.list, {
    id: first.saved.id,
    messages: [...msgs, { id: "u2", role: "user", content: "Encore un autre ?" }],
    nowIso: "2026-11-25T14:05:00.000Z",
  });
  assert.equal(updated.list.length, 1);
  assert.equal(updated.saved.id, first.saved.id);
  assert.equal(updated.saved.messages.length, 3);

  const afterDelete = deleteSavedAiChat(updated.list, first.saved.id);
  assert.equal(afterDelete.length, 0);
});

test("ai-voice: resolves locales, merges voice transcripts, cleans markdown for TTS, and maps errors", () => {
  assert.equal(resolveSpeechLocale("fr"), "fr-FR");
  assert.equal(resolveSpeechLocale("en"), "en-US");
  assert.equal(resolveSpeechLocale("es"), "es-ES");
  assert.equal(resolveSpeechLocale("it"), "it-IT");
  assert.equal(resolveSpeechLocale(null), "fr-FR");

  assert.equal(
    mergeTranscriptWithDraft("", "conseille moi un anime sombre"),
    "conseille moi un anime sombre"
  );
  assert.equal(
    mergeTranscriptWithDraft("Je cherche", "un thriller court  en 12 épisodes"),
    "Je cherche un thriller court en 12 épisodes"
  );

  const cleaned = sanitizeTextForSpeech(
    "✨ Voici **Erased** et *Pluto* (`12 ép.`) !\n- Très intense\n<<<SHIORI_RECS>>>[{\"title\":\"Erased\"}]"
  );
  assert.ok(cleaned.includes("Voici Erased et Pluto (12 ép.) !"));
  assert.ok(!cleaned.includes("**"));
  assert.ok(!cleaned.includes("SHIORI_RECS"));

  assert.ok(mapSpeechErrorToFrench("not-allowed").includes("microphone"));
  assert.ok(mapSpeechErrorToFrench("no-speech").includes("Aucune voix"));
  assert.equal(mapSpeechErrorToFrench("aborted"), "");

  assert.ok(
    mapMediaDeviceErrorToFrench({ name: "NotAllowedError" }).includes("refusé ou bloqué")
  );
  assert.ok(
    mapMediaDeviceErrorToFrench({ name: "NotFoundError" }).includes("Aucun microphone détecté")
  );
  assert.ok(
    mapMediaDeviceErrorToFrench({ name: "NotReadableError" }).includes("autre application")
  );
  assert.ok(
    mapMediaDeviceErrorToFrench({ name: "SecurityError" }).includes("HTTPS")
  );
});
