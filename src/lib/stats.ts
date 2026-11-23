import type { ActivityEvent, LibraryEntry, LibraryStatus } from "@/types/media";

export interface GenreStatItem {
  genre: string;
  count: number;
  avgScore: number | null;
}

export interface StudioStatItem {
  name: string;
  count: number;
  avgScore: number | null;
}

export interface YearEvolutionPoint {
  year: string;
  count: number;
  animeCount: number;
  mangaCount: number;
  avgScore: number | null;
}

export interface MonthlyActivityPoint {
  key: string; // YYYY-MM
  label: string; // "Jan", "Fév"...
  count: number;
}

export interface LibraryAnalytics {
  totalTitles: number;
  animeStarted: number;
  animeWatching: number;
  animeCompleted: number;
  animeOnHold: number;
  animeDropped: number;
  animePlanToWatch: number;
  mangaRead: number;
  mangaCompleted: number;
  totalEpisodes: number;
  totalChapters: number;
  totalMinutes: number;
  totalHours: number;
  totalDays: number;
  unknownDurationCount: number;
  meanScore: number | null;
  scoredCount: number;
  completedCount: number;
  completionRate: number;
  scoreBuckets: { bucket: string; count: number }[];
  statusCounts: Record<LibraryStatus, number>;
  topGenres: GenreStatItem[];
  topStudios: StudioStatItem[];
  yearEvolution: YearEvolutionPoint[];
  monthlyActivity: MonthlyActivityPoint[];
  favorites: LibraryEntry[];
}

export interface ShioriWrappedSummary {
  year: number;
  availableYears: number[];
  titlesTracked: number;
  completedCount: number;
  animeCount: number;
  mangaCount: number;
  episodesWatched: number;
  chaptersRead: number;
  estimatedHours: number;
  estimatedDays: number;
  meanScore: number | null;
  topGenres: GenreStatItem[];
  topStudio: StudioStatItem | null;
  topTitles: LibraryEntry[];
  archetype: {
    title: string;
    subtitle: string;
  };
  busiestMonth: MonthlyActivityPoint | null;
}

const MONTH_LABELS_FR = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

function extractEntryDate(entry: LibraryEntry): Date | null {
  const raw = entry.completedAt || entry.startedAt || entry.updatedAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Pure analytics engine: computes every statistic strictly from the user's real library
 * and activity events, handling unknown durations/scores transparently without fabricating data.
 */
export function computeLibraryAnalytics(
  entries: LibraryEntry[],
  activity: ActivityEvent[] = [],
  referenceDate = new Date()
): LibraryAnalytics {
  const animeEntries = entries.filter((e) => e.type === "ANIME");
  const mangaEntries = entries.filter((e) => e.type === "MANGA");

  const statusCounts: Record<LibraryStatus, number> = {
    WATCHING: 0,
    COMPLETED: 0,
    ON_HOLD: 0,
    DROPPED: 0,
    PLAN_TO_WATCH: 0,
  };
  for (const e of entries) {
    statusCounts[e.status] = (statusCounts[e.status] ?? 0) + 1;
  }

  const animeWatching = animeEntries.filter((e) => e.status === "WATCHING").length;
  const animeCompleted = animeEntries.filter((e) => e.status === "COMPLETED").length;
  const animeOnHold = animeEntries.filter((e) => e.status === "ON_HOLD").length;
  const animeDropped = animeEntries.filter((e) => e.status === "DROPPED").length;
  const animePlanToWatch = animeEntries.filter((e) => e.status === "PLAN_TO_WATCH").length;
  const animeStarted = animeEntries.filter(
    (e) => e.status !== "PLAN_TO_WATCH" || e.progress > 0
  ).length;

  const mangaRead = mangaEntries.filter(
    (e) => e.status !== "PLAN_TO_WATCH" || e.progress > 0
  ).length;
  const mangaCompleted = mangaEntries.filter((e) => e.status === "COMPLETED").length;

  const totalEpisodes = animeEntries.reduce((sum, e) => sum + Math.max(0, e.progress), 0);
  let unknownDurationCount = 0;
  const totalMinutes = animeEntries.reduce((sum, e) => {
    const ep = Math.max(0, e.progress);
    if (ep === 0) return sum;
    if (typeof e.duration === "number" && e.duration > 0) {
      return sum + ep * e.duration;
    }
    unknownDurationCount += 1;
    // Standard TV episode fallback (24m), explicitly reported via unknownDurationCount
    return sum + ep * 24;
  }, 0);

  const totalHours = Math.round(totalMinutes / 60);
  const totalDays = Math.round((totalMinutes / 60 / 24) * 10) / 10;
  const totalChapters = mangaEntries.reduce((sum, e) => sum + Math.max(0, e.progress), 0);

  const scored = entries.filter((e) => typeof e.score === "number" && Number.isFinite(e.score));
  const meanScore = scored.length
    ? Math.round((scored.reduce((s, e) => s + (e.score ?? 0), 0) / scored.length) * 100) / 100
    : null;

  const completedCount = statusCounts.COMPLETED;
  const activeBase = entries.filter((e) => e.status !== "PLAN_TO_WATCH").length;
  const completionRate = activeBase ? Math.round((completedCount / activeBase) * 100) : 0;

  // Score distribution 1..10
  const scoreBuckets = Array.from({ length: 10 }, (_, idx) => ({
    bucket: String(idx + 1),
    count: 0,
  }));
  for (const e of scored) {
    const rounded = Math.min(10, Math.max(1, Math.round(e.score ?? 0)));
    scoreBuckets[rounded - 1].count += 1;
  }

  // Genre affinity
  const genreMap = new Map<string, { count: number; scoreSum: number; scoredCount: number }>();
  for (const e of entries) {
    for (const g of e.genres ?? []) {
      const cur = genreMap.get(g) ?? { count: 0, scoreSum: 0, scoredCount: 0 };
      cur.count += 1;
      if (e.score !== null) {
        cur.scoreSum += e.score;
        cur.scoredCount += 1;
      }
      genreMap.set(g, cur);
    }
  }
  const topGenres: GenreStatItem[] = Array.from(genreMap.entries())
    .map(([genre, info]) => ({
      genre,
      count: info.count,
      avgScore: info.scoredCount
        ? Math.round((info.scoreSum / info.scoredCount) * 10) / 10
        : null,
    }))
    .sort((a, b) => b.count - a.count || (b.avgScore ?? 0) - (a.avgScore ?? 0))
    .slice(0, 8);

  // Studio affinity
  const studioMap = new Map<string, { count: number; scoreSum: number; scoredCount: number }>();
  for (const e of entries) {
    if (!e.studio) continue;
    const cur = studioMap.get(e.studio) ?? { count: 0, scoreSum: 0, scoredCount: 0 };
    cur.count += 1;
    if (e.score !== null) {
      cur.scoreSum += e.score;
      cur.scoredCount += 1;
    }
    studioMap.set(e.studio, cur);
  }
  const topStudios: StudioStatItem[] = Array.from(studioMap.entries())
    .map(([name, info]) => ({
      name,
      count: info.count,
      avgScore: info.scoredCount
        ? Math.round((info.scoreSum / info.scoredCount) * 10) / 10
        : null,
    }))
    .sort((a, b) => b.count - a.count || (b.avgScore ?? 0) - (a.avgScore ?? 0))
    .slice(0, 8);

  // Annual evolution (grouped by real release seasonYear when known)
  const yearMap = new Map<
    number,
    { count: number; animeCount: number; mangaCount: number; scoreSum: number; scoredCount: number }
  >();
  for (const e of entries) {
    const yr = e.seasonYear;
    if (!yr || yr < 1960 || yr > 2035) continue;
    const cur = yearMap.get(yr) ?? {
      count: 0,
      animeCount: 0,
      mangaCount: 0,
      scoreSum: 0,
      scoredCount: 0,
    };
    cur.count += 1;
    if (e.type === "MANGA") cur.mangaCount += 1;
    else cur.animeCount += 1;
    if (e.score !== null) {
      cur.scoreSum += e.score;
      cur.scoredCount += 1;
    }
    yearMap.set(yr, cur);
  }
  const yearEvolution: YearEvolutionPoint[] = Array.from(yearMap.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-12)
    .map(([yr, info]) => ({
      year: String(yr),
      count: info.count,
      animeCount: info.animeCount,
      mangaCount: info.mangaCount,
      avgScore: info.scoredCount
        ? Math.round((info.scoreSum / info.scoredCount) * 10) / 10
        : null,
    }));

  // Monthly activity across the last 12 rolling months (using real timestamps only)
  const monthlyBuckets: MonthlyActivityPoint[] = [];
  const monthIndexMap = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthIndexMap.set(key, monthlyBuckets.length);
    monthlyBuckets.push({
      key,
      label: MONTH_LABELS_FR[d.getMonth()],
      count: 0,
    });
  }

  const countedKeys = new Set<string>();
  for (const e of entries) {
    const d = extractEntryDate(e);
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const idx = monthIndexMap.get(key);
    if (idx !== undefined) {
      monthlyBuckets[idx].count += 1;
      countedKeys.add(`entry:${e.mediaId}:${key}`);
    }
  }
  for (const ev of activity) {
    const d = new Date(ev.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const dedupe = `entry:${ev.mediaId}:${key}`;
    if (countedKeys.has(dedupe)) continue;
    const idx = monthIndexMap.get(key);
    if (idx !== undefined) {
      monthlyBuckets[idx].count += 1;
    }
  }

  return {
    totalTitles: entries.length,
    animeStarted,
    animeWatching,
    animeCompleted,
    animeOnHold,
    animeDropped,
    animePlanToWatch,
    mangaRead,
    mangaCompleted,
    totalEpisodes,
    totalChapters,
    totalMinutes,
    totalHours,
    totalDays,
    unknownDurationCount,
    meanScore,
    scoredCount: scored.length,
    completedCount,
    completionRate,
    scoreBuckets,
    statusCounts,
    topGenres,
    topStudios,
    yearEvolution,
    monthlyActivity: monthlyBuckets,
    favorites: entries.filter((e) => e.isFavorite),
  };
}

function resolveViewerArchetype(
  topGenre: string | undefined,
  meanScore: number | null,
  mangaCount: number,
  animeCount: number,
  episodes: number
): { title: string; subtitle: string } {
  if (mangaCount > animeCount && mangaCount >= 10) {
    return {
      title: "Bibliothécaire de l'Encre",
      subtitle: "Les planches et chapitres guident ton année autant que l'animation.",
    };
  }
  if (episodes >= 1500) {
    return {
      title: "Chroniqueur Infatigable",
      subtitle: "Un rythme de marathonien digne des plus grandes archives d'animation.",
    };
  }
  if (meanScore !== null && meanScore >= 8.5) {
    return {
      title: "Esthète des Chefs-d'Œuvre",
      subtitle: "Une sélection exigeante tournée vers les œuvres les plus marquantes.",
    };
  }
  switch (topGenre) {
    case "Fantasy":
      return {
        title: "Arpenteur d'Autres Mondes",
        subtitle: "Attiré par les grandes fresques imaginaires et les quêtes contemplatives.",
      };
    case "Psychological":
    case "Thriller":
    case "Mystery":
      return {
        title: "Détective du Nocturne",
        subtitle: "Les récits complexes, sombres et à énigmes dominent ta sélection.",
      };
    case "Romance":
    case "Slice of Life":
      return {
        title: "Poète du Quotidien",
        subtitle: "Sensible aux émotions justes, aux liens humains et aux récits chaleureux.",
      };
    case "Action":
    case "Adventure":
      return {
        title: "Stratège des Grandes Épopées",
        subtitle: "Adrénaline, sakuga et aventures d'envergure rythment tes soirées.",
      };
    default:
      return {
        title: "Curateur Shiori",
        subtitle: "Un profil éclectique qui navigue librement entre genres, studios et époques.",
      };
  }
}

/**
 * Generates an authentic, shareable Shiori Wrapped retrospective strictly from the user's
 * real library entries for the chosen year (or full collection if no entries carry that year's date).
 */
export function computeShioriWrapped(
  library: LibraryEntry[],
  activity: ActivityEvent[] = [],
  requestedYear?: number
): ShioriWrappedSummary {
  const currentYear = new Date().getFullYear();
  const yearsSet = new Set<number>([currentYear]);

  for (const e of library) {
    const d = extractEntryDate(e);
    if (d) {
      const y = d.getFullYear();
      if (y >= 2010 && y <= currentYear + 1) yearsSet.add(y);
    }
  }

  const availableYears = Array.from(yearsSet).sort((a, b) => b - a);
  const year =
    requestedYear && availableYears.includes(requestedYear)
      ? requestedYear
      : availableYears[0] ?? currentYear;

  const yearEntries = library.filter((e) => {
    const d = extractEntryDate(e);
    return d ? d.getFullYear() === year : false;
  });

  // Use entries dated in the selected year when available, otherwise gracefully summarize full library
  const scoped = yearEntries.length > 0 ? yearEntries : library;
  const stats = computeLibraryAnalytics(scoped, activity, new Date(year, 11, 15));

  const topTitles = [...scoped]
    .sort((a, b) => {
      const favDiff = Number(b.isFavorite) - Number(a.isFavorite);
      if (favDiff !== 0) return favDiff;
      const scoreDiff = (b.score ?? -1) - (a.score ?? -1);
      if (scoreDiff !== 0) return scoreDiff;
      return b.progress - a.progress;
    })
    .slice(0, 3);

  const busiestMonth =
    [...stats.monthlyActivity].sort((a, b) => b.count - a.count).find((m) => m.count > 0) ??
    null;

  const animeCount = scoped.filter((e) => e.type === "ANIME").length;
  const mangaCount = scoped.filter((e) => e.type === "MANGA").length;

  return {
    year,
    availableYears,
    titlesTracked: scoped.length,
    completedCount: stats.completedCount,
    animeCount,
    mangaCount,
    episodesWatched: stats.totalEpisodes,
    chaptersRead: stats.totalChapters,
    estimatedHours: stats.totalHours,
    estimatedDays: stats.totalDays,
    meanScore: stats.meanScore,
    topGenres: stats.topGenres.slice(0, 4),
    topStudio: stats.topStudios[0] ?? null,
    topTitles,
    archetype: resolveViewerArchetype(
      stats.topGenres[0]?.genre,
      stats.meanScore,
      mangaCount,
      animeCount,
      stats.totalEpisodes
    ),
    busiestMonth,
  };
}
