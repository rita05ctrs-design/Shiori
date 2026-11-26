import type {
  CustomCollection,
  LibraryEntry,
  LibraryStatus,
  MediaType,
} from "@/types/media";
import { matchesYearFilter } from "./year-eras.ts";

export type ProgressFilter =
  | "ALL"
  | "STARTED"
  | "NOT_STARTED"
  | "ALMOST_DONE"
  | "COMPLETE";

export type ScoreFilter = "ALL" | "9" | "8" | "7" | "6" | "UNRATED";

export type LibrarySortKey =
  | "UPDATED"
  | "FAVORITE_RANK"
  | "SCORE"
  | "TITLE"
  | "PROGRESS"
  | "YEAR";

export interface LibraryFilterState {
  status: "ALL" | LibraryStatus;
  mediaType: "ALL" | MediaType;
  genre: string; // "ALL" or genre name
  year: string; // "ALL" or YYYY
  season: string; // "ALL" | "WINTER" | "SPRING" | "SUMMER" | "FALL"
  studio: string; // "ALL" or studio name
  format: string; // "ALL" or format
  scoreFilter: ScoreFilter;
  progressFilter: ProgressFilter;
  favoritesOnly: boolean;
  collectionId: string; // "ALL" or collection.id
  search: string;
}

export const DEFAULT_LIBRARY_FILTERS: LibraryFilterState = {
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

/**
 * Strictly clamps progress so it is always a safe non-negative integer
 * and never exceeds known episode/chapter limits (`totalUnits`).
 * When `totalUnits` is null/unknown (ongoing series or manga with unknown chapters),
 * allows unbounded non-negative progress cleanly.
 */
export function clampProgress(rawProgress: number, totalUnits: number | null): number {
  const safe = Number.isFinite(rawProgress) ? Math.floor(rawProgress) : 0;
  const nonNegative = Math.max(0, safe);
  if (typeof totalUnits === "number" && Number.isFinite(totalUnits) && totalUnits > 0) {
    return Math.min(Math.floor(totalUnits), nonNegative);
  }
  return nonNegative;
}

/**
 * Computes the next progress, status, and completion metadata when incrementing
 * or decrementing an entry's episode/chapter counter.
 */
export function computeProgressStep(
  entry: Pick<LibraryEntry, "progress" | "totalUnits" | "status" | "completedAt" | "startedAt">,
  delta: number,
  todayIso = new Date().toISOString().slice(0, 10)
): {
  changed: boolean;
  progress: number;
  status: LibraryStatus;
  reachedEnd: boolean;
  startedAt: string | null | undefined;
  completedAt: string | null | undefined;
} {
  const nextProgress = clampProgress(entry.progress + delta, entry.totalUnits);
  if (nextProgress === entry.progress) {
    return {
      changed: false,
      progress: entry.progress,
      status: entry.status,
      reachedEnd: false,
      startedAt: entry.startedAt,
      completedAt: entry.completedAt,
    };
  }

  const reachedEnd = Boolean(
    entry.totalUnits && entry.totalUnits > 0 && nextProgress >= entry.totalUnits
  );

  let nextStatus: LibraryStatus = entry.status;
  if (reachedEnd) {
    nextStatus = "COMPLETED";
  } else if (entry.status === "PLAN_TO_WATCH" && nextProgress > 0) {
    nextStatus = "WATCHING";
  } else if (entry.status === "COMPLETED" && delta < 0 && entry.totalUnits && nextProgress < entry.totalUnits) {
    nextStatus = "WATCHING";
  }

  const startedAt =
    entry.startedAt ?? (nextProgress > 0 && entry.progress === 0 ? todayIso : entry.startedAt);
  const completedAt = reachedEnd ? entry.completedAt ?? todayIso : entry.completedAt;

  return {
    changed: true,
    progress: nextProgress,
    status: nextStatus,
    reachedEnd,
    startedAt,
    completedAt,
  };
}

/**
 * Computes safe percentage progress for display. Returns null when totalUnits is unknown
 * and the title is not yet marked COMPLETED.
 */
export function getProgressPercent(entry: Pick<LibraryEntry, "progress" | "totalUnits" | "status">): number | null {
  if (entry.totalUnits && entry.totalUnits > 0) {
    return Math.min(100, Math.round((entry.progress / entry.totalUnits) * 100));
  }
  if (entry.status === "COMPLETED") return 100;
  return null;
}

/**
 * Applies all combined Library filters & sorting deterministically.
 */
export function filterAndSortLibrary(
  library: LibraryEntry[],
  filters: LibraryFilterState,
  sortBy: LibrarySortKey,
  options?: {
    favoriteRankMap?: Map<number, number>;
    collections?: CustomCollection[];
  }
): LibraryEntry[] {
  const q = filters.search.trim().toLowerCase();
  const activeCollection =
    filters.collectionId !== "ALL"
      ? options?.collections?.find((c) => c.id === filters.collectionId) ?? null
      : null;
  const collectionSet = activeCollection ? new Set(activeCollection.mediaIds) : null;
  const favMap = options?.favoriteRankMap ?? new Map<number, number>();

  return library
    .filter((e) => (filters.status === "ALL" ? true : e.status === filters.status))
    .filter((e) => (filters.mediaType === "ALL" ? true : e.type === filters.mediaType))
    .filter((e) => (filters.favoritesOnly ? e.isFavorite : true))
    .filter((e) => (collectionSet ? collectionSet.has(e.mediaId) : true))
    .filter((e) => (filters.genre === "ALL" ? true : e.genres.includes(filters.genre)))
    .filter((e) => matchesYearFilter(e.seasonYear, filters.year))
    .filter((e) =>
      filters.season === "ALL"
        ? true
        : (e.season ?? "").toUpperCase() === filters.season.toUpperCase()
    )
    .filter((e) =>
      filters.studio === "ALL" ? true : (e.studio ?? "") === filters.studio
    )
    .filter((e) =>
      filters.format === "ALL" ? true : (e.format ?? "") === filters.format
    )
    .filter((e) => {
      if (filters.scoreFilter === "ALL") return true;
      if (filters.scoreFilter === "UNRATED") return e.score === null;
      const min = Number(filters.scoreFilter);
      return e.score !== null && e.score >= min;
    })
    .filter((e) => {
      if (filters.progressFilter === "ALL") return true;
      if (filters.progressFilter === "NOT_STARTED") return e.progress === 0;
      if (filters.progressFilter === "STARTED") return e.progress > 0;
      if (filters.progressFilter === "COMPLETE") {
        return (
          e.status === "COMPLETED" ||
          Boolean(e.totalUnits && e.totalUnits > 0 && e.progress >= e.totalUnits)
        );
      }
      if (filters.progressFilter === "ALMOST_DONE") {
        if (!e.totalUnits || e.totalUnits <= 0) return false;
        const ratio = e.progress / e.totalUnits;
        return ratio >= 0.75 && ratio < 1;
      }
      return true;
    })
    .filter((e) => {
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        (e.nativeTitle ?? "").toLowerCase().includes(q) ||
        (e.studio ?? "").toLowerCase().includes(q) ||
        (e.notes ?? "").toLowerCase().includes(q) ||
        e.genres.some((g) => g.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === "FAVORITE_RANK") {
        const ra = favMap.get(a.mediaId) ?? Number.MAX_SAFE_INTEGER;
        const rb = favMap.get(b.mediaId) ?? Number.MAX_SAFE_INTEGER;
        if (ra !== rb) return ra - rb;
        return (b.score ?? -1) - (a.score ?? -1);
      }
      if (sortBy === "SCORE") return (b.score ?? -1) - (a.score ?? -1);
      if (sortBy === "TITLE") return a.title.localeCompare(b.title);
      if (sortBy === "PROGRESS") return b.progress - a.progress;
      if (sortBy === "YEAR") return (b.seasonYear ?? 0) - (a.seasonYear ?? 0);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
}

function escapeCsvCell(val: unknown): string {
  const s = String(val ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Generates an RFC-4180 CSV export of the user's library.
 */
export function libraryToCsv(entries: LibraryEntry[]): string {
  const headers = [
    "mediaId",
    "type",
    "title",
    "status",
    "progress",
    "totalUnits",
    "score",
    "isFavorite",
    "format",
    "season",
    "seasonYear",
    "studio",
    "genres",
    "startedAt",
    "completedAt",
    "notes",
  ];
  const rows = entries.map((e) =>
    [
      e.mediaId,
      e.type,
      e.title,
      e.status,
      e.progress,
      e.totalUnits ?? "",
      e.score ?? "",
      e.isFavorite ? "true" : "false",
      e.format ?? "",
      e.season ?? "",
      e.seasonYear ?? "",
      e.studio ?? "",
      e.genres.join(" | "),
      e.startedAt ?? "",
      e.completedAt ?? "",
      e.notes ?? "",
    ]
      .map(escapeCsvCell)
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}
