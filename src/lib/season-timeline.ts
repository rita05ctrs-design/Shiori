import type { MediaType, SeasonTimelineEntry } from "@/types/media";

export interface RawRelationMediaNode {
  id: number;
  type: MediaType;
  title: { romaji: string; english: string | null };
  coverImage: string;
  format: string | null;
  episodes: number | null;
  chapters: number | null;
  seasonYear: number | null;
  startDate: { year: number | null; month: number | null; day: number | null } | null;
  averageScore: number | null;
  relations: {
    relationType: string;
    node: {
      id: number;
      type: MediaType;
      isAdult?: boolean;
      title: { romaji: string; english: string | null };
      coverImage: string;
      format: string | null;
      episodes: number | null;
      chapters: number | null;
      seasonYear: number | null;
      startDate: { year: number | null; month: number | null; day: number | null } | null;
      averageScore: number | null;
    };
  }[];
}

export interface BuiltSeasonChronology {
  timeline: SeasonTimelineEntry[];
  prevSeason: SeasonTimelineEntry | null;
  nextSeason: SeasonTimelineEntry | null;
}

const CANON_MAIN_FORMATS = new Set(["TV", "TV_SHORT", "ONA", "MANGA", "NOVEL"]);
const CANON_EXTRA_FORMATS = new Set(["MOVIE", "OVA", "SPECIAL"]);

function getDateSortKey(node: {
  startDate: { year: number | null; month: number | null; day: number | null } | null;
  seasonYear: number | null;
}): number {
  const y = node.startDate?.year ?? node.seasonYear;
  if (!y || y <= 0) return 99999999;
  const m = node.startDate?.month ?? 12;
  const d = node.startDate?.day ?? 31;
  return y * 10000 + m * 100 + d;
}

function detectExplicitSeasonLabel(title: string): string | null {
  const partMatch = /Season\s*(\d+)\s*Part\s*(\d+)/i.exec(title);
  if (partMatch) return `Saison ${partMatch[1]} · P.${partMatch[2]}`;

  const finalPartMatch = /Final\s+Season.*Part\s*(\d+)/i.exec(title);
  if (finalPartMatch) return `Saison Finale · P.${finalPartMatch[1]}`;

  if (/Final\s+Season/i.test(title)) return "Saison Finale";

  const seasonMatch = /(?:Season|Saison)\s*(\d+)/i.exec(title);
  if (seasonMatch) return `Saison ${seasonMatch[1]}`;

  const courMatch = /(?:Part|Cour)\s*(\d+)/i.exec(title);
  if (courMatch) return `Partie ${courMatch[1]}`;

  return null;
}

/**
 * Builds an ordered, clean "Saisons & Chronologie" timeline from traversed AniList
 * PREQUEL / SEQUEL / canon SIDE_STORY graph nodes for the currently viewed media.
 * Returns empty timeline if the title is a standalone work with no linked seasons.
 */
export function buildSeasonChronology(
  currentId: number,
  nodesById: Map<number, RawRelationMediaNode>
): BuiltSeasonChronology {
  const currentNode = nodesById.get(currentId);
  if (!currentNode) {
    return { timeline: [], prevSeason: null, nextSeason: null };
  }

  const targetType = currentNode.type;
  const mainChainIds = new Set<number>([currentId]);
  const sideMovieIds = new Set<number>();

  // Walk PREQUEL & SEQUEL graph edges of the same MediaType to collect the complete main season chain
  const queue: number[] = [currentId];
  const visited = new Set<number>([currentId]);

  while (queue.length > 0 && mainChainIds.size < 16) {
    const id = queue.shift()!;
    const node = nodesById.get(id);
    if (!node) continue;

    for (const edge of node.relations) {
      const target = edge.node;
      if (!target || target.isAdult || target.type !== targetType) continue;

      if (edge.relationType === "PREQUEL" || edge.relationType === "SEQUEL") {
        mainChainIds.add(target.id);
        if (!visited.has(target.id)) {
          visited.add(target.id);
          queue.push(target.id);
        }
      } else if (
        edge.relationType === "SIDE_STORY" &&
        target.format === "MOVIE" &&
        sideMovieIds.size < 3
      ) {
        sideMovieIds.add(target.id);
      }
    }
  }

  // Also capture direct PREQUEL / SEQUEL from currentNode explicitly for prev/next buttons
  let directPrevId: number | null = null;
  let directNextId: number | null = null;
  for (const edge of currentNode.relations) {
    if (!edge.node || edge.node.isAdult || edge.node.type !== targetType) continue;
    if (edge.relationType === "PREQUEL" && directPrevId === null) {
      directPrevId = edge.node.id;
    }
    if (edge.relationType === "SEQUEL" && directNextId === null) {
      directNextId = edge.node.id;
    }
  }

  // Merge main chain + up to 3 canon movies (excluding duplicates)
  const collectedIds = new Set<number>([...mainChainIds, ...sideMovieIds]);
  if (collectedIds.size <= 1) {
    return { timeline: [], prevSeason: null, nextSeason: null };
  }

  // Assemble candidate entries from nodesById OR direct relation edge snapshots
  const rawEntries = new Map<
    number,
    {
      id: number;
      type: MediaType;
      title: string;
      format: string | null;
      episodes: number | null;
      chapters: number | null;
      seasonYear: number | null;
      startDate: { year: number | null; month: number | null; day: number | null } | null;
      coverImage: string;
      averageScore: number | null;
      isMainChain: boolean;
    }
  >();

  for (const node of nodesById.values()) {
    if (collectedIds.has(node.id)) {
      rawEntries.set(node.id, {
        id: node.id,
        type: node.type,
        title: node.title.english || node.title.romaji || "Sans titre",
        format: node.format,
        episodes: node.episodes,
        chapters: node.chapters,
        seasonYear: node.seasonYear ?? node.startDate?.year ?? null,
        startDate: node.startDate,
        coverImage: node.coverImage,
        averageScore: node.averageScore,
        isMainChain: mainChainIds.has(node.id),
      });
    }
    for (const edge of node.relations) {
      const t = edge.node;
      if (!t || !collectedIds.has(t.id) || rawEntries.has(t.id)) continue;
      rawEntries.set(t.id, {
        id: t.id,
        type: t.type,
        title: t.title.english || t.title.romaji || "Sans titre",
        format: t.format,
        episodes: t.episodes,
        chapters: t.chapters,
        seasonYear: t.seasonYear ?? t.startDate?.year ?? null,
        startDate: t.startDate,
        coverImage: t.coverImage,
        averageScore: t.averageScore,
        isMainChain: mainChainIds.has(t.id),
      });
    }
  }

  // Chronological sort by release date (startDate -> seasonYear -> id)
  const sorted = Array.from(rawEntries.values()).sort((a, b) => {
    const da = getDateSortKey(a);
    const db = getDateSortKey(b);
    if (da !== db) return da - db;
    return a.id - b.id;
  });

  let seasonCounter = 0;
  let movieCounter = 0;

  const timeline: SeasonTimelineEntry[] = sorted.map((item) => {
    const isMovie = item.format === "MOVIE";
    const isOva = item.format === "OVA" || item.format === "SPECIAL";

    let shortLabel: string;
    if (isMovie) {
      movieCounter++;
      shortLabel = movieCounter > 1 ? `Film ${movieCounter}` : "Film";
    } else if (isOva && !CANON_MAIN_FORMATS.has(item.format ?? "")) {
      shortLabel = item.format === "OVA" ? "OAV" : "Spécial";
    } else {
      seasonCounter++;
      const explicit = detectExplicitSeasonLabel(item.title);
      if (explicit) {
        shortLabel = explicit;
      } else {
        shortLabel =
          targetType === "MANGA" ? `Partie ${seasonCounter}` : `Saison ${seasonCounter}`;
      }
    }

    const relationKind: SeasonTimelineEntry["relationKind"] =
      item.id === currentId
        ? "CURRENT"
        : isMovie
          ? "MOVIE"
          : item.isMainChain
            ? "MAIN_CHAIN"
            : CANON_EXTRA_FORMATS.has(item.format ?? "")
              ? "SIDE_STORY"
              : "MAIN_CHAIN";

    return {
      id: item.id,
      type: item.type,
      title: item.title,
      shortLabel,
      format: item.format,
      episodes: item.episodes,
      chapters: item.chapters,
      seasonYear: item.seasonYear,
      startDate: item.startDate,
      coverImage: item.coverImage,
      averageScore: item.averageScore,
      relationKind,
    };
  });

  // Resolve prevSeason / nextSeason prioritizing direct PREQUEL/SEQUEL, falling back to adjacent main-chain entry
  const currentIdx = timeline.findIndex((t) => t.id === currentId);
  const prevSeason =
    (directPrevId ? timeline.find((t) => t.id === directPrevId) : null) ??
    (currentIdx > 0 ? timeline[currentIdx - 1] : null);
  const nextSeason =
    (directNextId ? timeline.find((t) => t.id === directNextId) : null) ??
    (currentIdx >= 0 && currentIdx < timeline.length - 1
      ? timeline[currentIdx + 1]
      : null);

  return {
    timeline,
    prevSeason,
    nextSeason,
  };
}
