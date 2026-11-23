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
