import type {
  LibraryFilterState,
  LibrarySortKey,
  ProgressFilter,
  ScoreFilter,
} from "@/lib/library-utils";
import type { SituationGroupId, TagCategory } from "@/lib/discover-taxonomy";
import type { CommunityActivityKind, LibraryStatus, MediaType } from "@/types/media";
import {
  normalizeGenreMinRanks,
  parseGenreMinRanks,
  serializeGenreMinRanks,
} from "./genre-intensity.ts";

interface MoodPresetLike {
  id: string;
  genres: string[];
  tags: string[];
  minScore?: string;
  sort?: string;
}

const EMPTY_LIBRARY_FILTERS: LibraryFilterState = {
  status: "ALL",
  mediaType: "ALL",
  genre: "ALL",
  year: "ALL",
  season: "ALL",
  studio: "ALL",
  format: "ALL",
  scoreFilter: "ALL",
  progressFilter: "ALL",
  favoritesOnly: false,
  collectionId: "ALL",
  search: "",
};

/* -------------------------------------------------------------------------- */
/* Safe Storage & Next.js-Compatible URL Sync                                 */
/* -------------------------------------------------------------------------- */

export const FILTER_STORAGE_KEYS = {
  library: "shiori_library_filters_v1",
  libraryScroll: "shiori_library_scroll_v1",
  discover: "shiori_discover_filters_v1",
  discoverScroll: "shiori_discover_scroll_v1",
  calendar: "shiori_calendar_filters_v1",
  community: "shiori_community_filters_v1",
} as const;

export interface DiscoverScrollSnapshot {
  queryKey: string;
  scrollY: number;
  page: number;
  itemCount: number;
  savedAt: number;
}

export interface LibraryScrollSnapshot {
  scrollY: number;
  visibleCount: number;
  savedAt: number;
}

export const SCROLL_SNAPSHOT_TTL_MS = 15 * 60 * 1000;

export function isFreshScrollSnapshot(
  snapshot: { savedAt?: number; scrollY?: number } | null | undefined,
  now = Date.now(),
  ttlMs = SCROLL_SNAPSHOT_TTL_MS
): boolean {
  if (!snapshot || typeof snapshot !== "object") return false;
  if (typeof snapshot.savedAt !== "number" || !Number.isFinite(snapshot.savedAt)) return false;
  if (typeof snapshot.scrollY !== "number" || !Number.isFinite(snapshot.scrollY)) return false;
  return snapshot.scrollY >= 0 && now - snapshot.savedAt <= ttlMs;
}

/**
 * Deduplicates paginated media lists while preserving exact rank order when appending
 * subsequent pages ("Charger plus de titres").
 */
export function mergeUniqueMediaItems<T extends { id: number; type?: string }>(
  existing: readonly T[],
  incoming: readonly T[]
): T[] {
  if (existing.length === 0) return [...incoming];
  if (incoming.length === 0) return [...existing];
  const seen = new Set<string>(existing.map((item) => `${item.type ?? "M"}:${item.id}`));
  const merged = [...existing];
  for (const item of incoming) {
    const key = `${item.type ?? "M"}:${item.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}

export function readSessionState<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeSessionState<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / private browsing errors
  }
}

export function clearSessionState(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Updates the browser URL query string without polluting Back/Forward history
 * and while preserving Next.js App Router's internal `window.history.state`.
 * Returns the normalized query string (without leading `?`).
 */
export function syncUrlSearchParams(pathname: string, params: URLSearchParams): string {
  const qs = params.toString();
  if (typeof window === "undefined") return qs;
  const currentQs = window.location.search.replace(/^\?/, "");
  if (currentQs === qs && window.location.pathname === pathname) {
    return qs;
  }
  const nextUrl = qs ? `${pathname}?${qs}` : pathname;
  try {
    window.history.replaceState(window.history.state, "", nextUrl);
  } catch {
    // Ignore history API restrictions
  }
  return qs;
}

/* -------------------------------------------------------------------------- */
/* Library Filter Persistence                                                 */
/* -------------------------------------------------------------------------- */

export type LibraryViewMode = "grid" | "list" | "table";

export interface PersistedLibraryState {
  filters: LibraryFilterState;
  sortBy: LibrarySortKey;
  view: LibraryViewMode;
  showAdvancedFilters: boolean;
}

const VALID_LIBRARY_STATUSES = new Set<string>([
  "ALL",
  "WATCHING",
  "COMPLETED",
  "ON_HOLD",
  "DROPPED",
  "PLAN_TO_WATCH",
]);
const VALID_SCORE_FILTERS = new Set<string>(["ALL", "9", "8", "7", "6", "UNRATED"]);
const VALID_PROGRESS_FILTERS = new Set<string>([
  "ALL",
  "STARTED",
  "NOT_STARTED",
  "ALMOST_DONE",
  "COMPLETE",
]);
const VALID_LIBRARY_SORTS = new Set<string>([
  "UPDATED",
  "FAVORITE_RANK",
  "SCORE",
  "TITLE",
  "PROGRESS",
  "YEAR",
]);
const VALID_LIBRARY_VIEWS = new Set<string>(["grid", "list", "table"]);
const VALID_SEASONS = new Set<string>(["ALL", "WINTER", "SPRING", "SUMMER", "FALL"]);

export function sanitizeLibraryState(
  raw: Partial<PersistedLibraryState> | null | undefined
): PersistedLibraryState {
  const f = raw?.filters;
  const status =
    f?.status && VALID_LIBRARY_STATUSES.has(f.status)
      ? (f.status as "ALL" | LibraryStatus)
      : "ALL";
  const mediaType =
    f?.mediaType === "ANIME" || f?.mediaType === "MANGA" ? f.mediaType : "ALL";
  const season = f?.season && VALID_SEASONS.has(f.season) ? f.season : "ALL";
  const scoreFilter =
    f?.scoreFilter && VALID_SCORE_FILTERS.has(f.scoreFilter)
      ? (f.scoreFilter as ScoreFilter)
      : "ALL";
  const progressFilter =
    f?.progressFilter && VALID_PROGRESS_FILTERS.has(f.progressFilter)
      ? (f.progressFilter as ProgressFilter)
      : "ALL";

  const filters: LibraryFilterState = {
    status,
    mediaType,
    genre: typeof f?.genre === "string" && f.genre.trim() ? f.genre : "ALL",
    year: typeof f?.year === "string" && f.year.trim() ? f.year : "ALL",
    season,
    studio: typeof f?.studio === "string" && f.studio.trim() ? f.studio : "ALL",
    format: typeof f?.format === "string" && f.format.trim() ? f.format : "ALL",
    scoreFilter,
    progressFilter,
    favoritesOnly: Boolean(f?.favoritesOnly),
    collectionId:
      typeof f?.collectionId === "string" && f.collectionId.trim()
        ? f.collectionId
        : "ALL",
    search: typeof f?.search === "string" ? f.search : "",
  };

  const sortBy =
    raw?.sortBy && VALID_LIBRARY_SORTS.has(raw.sortBy)
      ? (raw.sortBy as LibrarySortKey)
      : filters.favoritesOnly
        ? "FAVORITE_RANK"
        : "UPDATED";

  const view =
    raw?.view && VALID_LIBRARY_VIEWS.has(raw.view)
      ? (raw.view as LibraryViewMode)
      : "grid";

  return {
    filters,
    sortBy,
    view,
    showAdvancedFilters: Boolean(raw?.showAdvancedFilters),
  };
}

export function libraryStateToSearchParams(state: PersistedLibraryState): URLSearchParams {
  const params = new URLSearchParams();
  const { filters, sortBy, view } = state;

  if (filters.status !== "ALL") params.set("status", filters.status);
  if (filters.mediaType !== "ALL") params.set("type", filters.mediaType);
  if (filters.favoritesOnly) params.set("favorites", "1");
  if (filters.genre !== "ALL") params.set("genre", filters.genre);
  if (filters.year !== "ALL") params.set("year", filters.year);
  if (filters.season !== "ALL") params.set("season", filters.season);
  if (filters.studio !== "ALL") params.set("studio", filters.studio);
  if (filters.format !== "ALL") params.set("format", filters.format);
  if (filters.scoreFilter !== "ALL") params.set("score", filters.scoreFilter);
  if (filters.progressFilter !== "ALL") params.set("progress", filters.progressFilter);
  if (filters.collectionId !== "ALL") params.set("collection", filters.collectionId);
  if (filters.search.trim()) params.set("q", filters.search);
  if (sortBy !== "UPDATED" && !(filters.favoritesOnly && sortBy === "FAVORITE_RANK")) {
    params.set("sort", sortBy);
  }
  if (view !== "grid") params.set("view", view);

  return params;
}

export function searchParamsToLibraryState(
  params: URLSearchParams,
  fallbackUi?: { showAdvancedFilters?: boolean; view?: LibraryViewMode }
): PersistedLibraryState {
  const favParam = params.get("favorites");
  const favoritesOnly = favParam === "1" || favParam === "true";

  const filters: LibraryFilterState = {
    ...EMPTY_LIBRARY_FILTERS,
    status: (params.get("status") as "ALL" | LibraryStatus) || "ALL",
    mediaType: (params.get("type") as "ALL" | MediaType) || "ALL",
    genre: params.get("genre") || "ALL",
    year: params.get("year") || "ALL",
    season: params.get("season") || "ALL",
    studio: params.get("studio") || "ALL",
    format: params.get("format") || "ALL",
    scoreFilter: (params.get("score") as ScoreFilter) || "ALL",
    progressFilter: (params.get("progress") as ProgressFilter) || "ALL",
    favoritesOnly,
    collectionId: params.get("collection") || "ALL",
    search: params.get("q") || params.get("search") || "",
  };

  const sortParam = params.get("sort");
  const sortBy = (sortParam as LibrarySortKey) || (favoritesOnly ? "FAVORITE_RANK" : "UPDATED");
  const viewParam = params.get("view") as LibraryViewMode | null;

  return sanitizeLibraryState({
    filters,
    sortBy,
    view: viewParam ?? fallbackUi?.view ?? "grid",
    showAdvancedFilters: fallbackUi?.showAdvancedFilters ?? false,
  });
}

/* -------------------------------------------------------------------------- */
/* Discover Filter Persistence                                                */
/* -------------------------------------------------------------------------- */

export interface PersistedDiscoverState {
  type: MediaType;
  search: string;
  selectedGenres: string[];
  genreMinRanks: Record<string, number>;
  selectedTags: string[];
  activeMoodId: string | null;
  activeCategory: TagCategory["id"];
  situationGroup: SituationGroupId;
  year: string;
  season: string;
  format: string;
  status: string;
  minScore: string;
  maxScore: string;
  minUnits: string;
  maxUnits: string;
  sort: string;
  hideInLibrary: boolean;
  showFilters: boolean;
  showMoods: boolean;
}

const VALID_DISCOVER_CATEGORIES = new Set<string>([
  "genres",
  "situations",
  "universes",
  "themes",
  "demographics",
]);

export const DEFAULT_DISCOVER_STATE: PersistedDiscoverState = {
  type: "ANIME",
  search: "",
  selectedGenres: [],
  genreMinRanks: {},
  selectedTags: [],
  activeMoodId: null,
  activeCategory: "situations",
  situationGroup: "ALL",
  year: "ALL",
  season: "ALL",
  format: "ALL",
  status: "ALL",
  minScore: "ALL",
  maxScore: "ALL",
  minUnits: "",
  maxUnits: "",
  sort: "TRENDING_DESC",
  hideInLibrary: false,
  showFilters: false,
  showMoods: false,
};

function uniqueStrings(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of arr) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (trimmed && trimmed !== "ALL" && !seen.has(trimmed)) {
        seen.add(trimmed);
        out.push(trimmed);
      }
    }
  }
  return out;
}

export function sanitizeDiscoverState(
  raw: Partial<PersistedDiscoverState> | null | undefined,
  moodPresets: readonly MoodPresetLike[] = []
): PersistedDiscoverState {
  const type: MediaType = raw?.type === "MANGA" ? "MANGA" : "ANIME";
  const activeMoodId =
    typeof raw?.activeMoodId === "string" &&
    (moodPresets.length === 0 || moodPresets.some((m) => m.id === raw.activeMoodId))
      ? raw.activeMoodId
      : null;

  const sanitizedGenres = uniqueStrings(raw?.selectedGenres);
  // Gracefully migrate legacy single `minGenreRank` from older sessionStorage snapshots if present
  const legacyRank =
    raw &&
    "minGenreRank" in raw &&
    typeof (raw as { minGenreRank?: unknown }).minGenreRank === "number"
      ? Number((raw as { minGenreRank?: number }).minGenreRank)
      : 0;
  let initialMap: Record<string, unknown> | undefined =
    raw?.genreMinRanks && typeof raw.genreMinRanks === "object"
      ? raw.genreMinRanks
      : undefined;
  if (!initialMap && legacyRank > 0 && sanitizedGenres.length > 0) {
    initialMap = Object.fromEntries(sanitizedGenres.map((g) => [g, legacyRank]));
  }
  const genreMinRanks = normalizeGenreMinRanks(initialMap, sanitizedGenres);

  return {
    type,
    search: typeof raw?.search === "string" ? raw.search : "",
    selectedGenres: sanitizedGenres,
    genreMinRanks,
    selectedTags: uniqueStrings(raw?.selectedTags),
    activeMoodId,
    activeCategory:
      raw?.activeCategory && VALID_DISCOVER_CATEGORIES.has(raw.activeCategory)
        ? raw.activeCategory
        : "situations",
    situationGroup: (raw?.situationGroup as SituationGroupId) || "ALL",
    year: typeof raw?.year === "string" && raw.year.trim() ? raw.year : "ALL",
    season:
      type === "ANIME" && typeof raw?.season === "string" && raw.season.trim()
        ? raw.season
        : "ALL",
    format: typeof raw?.format === "string" && raw.format.trim() ? raw.format : "ALL",
    status: typeof raw?.status === "string" && raw.status.trim() ? raw.status : "ALL",
    minScore: typeof raw?.minScore === "string" && raw.minScore.trim() ? raw.minScore : "ALL",
    maxScore: typeof raw?.maxScore === "string" && raw.maxScore.trim() ? raw.maxScore : "ALL",
    minUnits: typeof raw?.minUnits === "string" ? raw.minUnits : "",
    maxUnits: typeof raw?.maxUnits === "string" ? raw.maxUnits : "",
    sort: typeof raw?.sort === "string" && raw.sort.trim() ? raw.sort : "TRENDING_DESC",
    hideInLibrary: Boolean(raw?.hideInLibrary),
    showFilters: Boolean(raw?.showFilters),
    showMoods: Boolean(raw?.showMoods),
  };
}

export function discoverStateToSearchParams(state: PersistedDiscoverState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.type !== "ANIME") params.set("type", state.type);
  if (state.search.trim()) params.set("search", state.search.trim());
  if (state.activeMoodId) params.set("mood", state.activeMoodId);
  if (state.selectedGenres.length > 0) {
    params.set("genres", state.selectedGenres.join(","));
    const encodedRanks = serializeGenreMinRanks(state.genreMinRanks, state.selectedGenres);
    if (encodedRanks) {
      params.set("genreRanks", encodedRanks);
    }
  }
  if (state.selectedTags.length > 0) params.set("tags", state.selectedTags.join(","));
  if (state.year !== "ALL") params.set("year", state.year);
  if (state.season !== "ALL" && state.type === "ANIME") params.set("season", state.season);
  if (state.format !== "ALL") params.set("format", state.format);
  if (state.status !== "ALL") params.set("status", state.status);
  if (state.minScore !== "ALL") params.set("minScore", state.minScore);
  if (state.maxScore !== "ALL") params.set("maxScore", state.maxScore);
  if (state.minUnits.trim()) {
    params.set(state.type === "ANIME" ? "minEpisodes" : "minChapters", state.minUnits.trim());
  }
  if (state.maxUnits.trim()) {
    params.set(state.type === "ANIME" ? "maxEpisodes" : "maxChapters", state.maxUnits.trim());
  }
  if (state.sort !== "TRENDING_DESC") params.set("sort", state.sort);
  if (state.hideInLibrary) params.set("hideInLibrary", "1");
  return params;
}

export function searchParamsToDiscoverState(
  params: URLSearchParams,
  fallbackUi?: Partial<
    Pick<PersistedDiscoverState, "showFilters" | "showMoods" | "activeCategory" | "situationGroup">
  >,
  moodPresets: readonly MoodPresetLike[] = []
): PersistedDiscoverState {
  const moodParam = params.get("mood");
  const moodPreset = moodParam ? moodPresets.find((m) => m.id === moodParam) ?? null : null;

  const genresParam = params.get("genres");
  const singleGenre = params.get("genre");
  const tagsParam = params.get("tags");

  const parsedGenres = genresParam
    ? genresParam.split(",").filter(Boolean)
    : singleGenre && singleGenre !== "ALL"
      ? [singleGenre]
      : moodPreset
        ? moodPreset.genres
        : [];

  const parsedTags = tagsParam
    ? tagsParam.split(",").filter(Boolean)
    : moodPreset
      ? moodPreset.tags
      : [];

  const hasAdvancedParams = Boolean(
    params.get("year") ||
      params.get("season") ||
      params.get("format") ||
      params.get("status") ||
      params.get("minScore") ||
      params.get("maxScore") ||
      params.get("minEpisodes") ||
      params.get("maxEpisodes") ||
      params.get("minChapters") ||
      params.get("maxChapters") ||
      parsedTags.length > 0
  );

  const genreRanksParam = params.get("genreRanks");
  const legacyMinRank = Number(params.get("minGenreRank") ?? 0) || 0;
  const parsedGenreMinRanks = genreRanksParam
    ? parseGenreMinRanks(genreRanksParam, parsedGenres)
    : legacyMinRank > 0
      ? normalizeGenreMinRanks(
          Object.fromEntries(parsedGenres.map((g) => [g, legacyMinRank])),
          parsedGenres
        )
      : normalizeGenreMinRanks(undefined, parsedGenres);

  return sanitizeDiscoverState({
    type: params.get("type") === "MANGA" ? "MANGA" : "ANIME",
    search: params.get("search") ?? "",
    selectedGenres: parsedGenres,
    genreMinRanks: parsedGenreMinRanks,
    selectedTags: parsedTags,
    activeMoodId: moodPreset ? moodPreset.id : null,
    activeCategory: fallbackUi?.activeCategory ?? "situations",
    situationGroup: fallbackUi?.situationGroup ?? "ALL",
    year: params.get("year") ?? "ALL",
    season: params.get("season") ?? "ALL",
    format: params.get("format") ?? "ALL",
    status: params.get("status") ?? "ALL",
    minScore: params.get("minScore") ?? moodPreset?.minScore ?? "ALL",
    maxScore: params.get("maxScore") ?? "ALL",
    minUnits: params.get("minEpisodes") ?? params.get("minChapters") ?? "",
    maxUnits: params.get("maxEpisodes") ?? params.get("maxChapters") ?? "",
    sort: params.get("sort") ?? moodPreset?.sort ?? "TRENDING_DESC",
    hideInLibrary: params.get("hideInLibrary") === "1",
    showFilters: fallbackUi?.showFilters ?? hasAdvancedParams,
    showMoods: fallbackUi?.showMoods ?? Boolean(moodPreset),
  }, moodPresets);
}

/* -------------------------------------------------------------------------- */
/* Calendar & Community Persistence                                           */
/* -------------------------------------------------------------------------- */

export interface PersistedCalendarState {
  tzMode: "local" | "jst";
  viewMode: "day" | "week" | "month";
  scheduleOnlyMyList: boolean;
  selectedSeasonId: string;
  seasonFormat: "ALL" | "TV" | "MOVIE" | "ONA_OVA" | "MYLIST";
  seasonSearch: string;
}

export interface PersistedCommunityState {
  tab: "feed" | "friends" | "members";
  feedSource: "shiori" | "anilist";
  kindFilter: "ALL" | CommunityActivityKind;
  memberQuery: string;
}
