import type { MangaContinuationInfo, SourceMediumKind } from "./manga-continuation.ts";
import type { ContentLanguage } from "../types/media.ts";

export interface MangaUpdatesAnimeSegment {
  raw: string;
  volume: number | null;
  chapter: number | null;
  /** For manhwa with per-season numbering like `S2, Chap 110` */
  manhwaSeason: number | null;
  /** Live airing episode tag like `(As of EP 1180)` */
  asOfEpisode: number | null;
  /** Extracted parenthetical selector like `S1`, `S2`, `S3P2`, `Reze Movie`, `TYBW P3` */
  tag: string | null;
  /** Extracted skip/abridged/original-ending note */
  extraNote: string | null;
}

export interface MangaUpdatesSeriesInput {
  title: string;
  type?: string | null; // "Manga" | "Manhwa" | "Manhua" | "Novel" | etc.
  latestChapter?: number | null;
  completed?: boolean;
  animeStart?: string | null;
  animeEnd?: string | null;
}

export interface TargetAnimeDescriptor {
  title: string;
  romajiTitle?: string | null;
  format?: string | null; // "TV" | "MOVIE" | "OVA" | "ONA" | "SPECIAL"
  seasonYear?: number | null;
  status?: string | null; // "FINISHED" | "RELEASING" | "NOT_YET_RELEASED"
  totalEpisodes?: number | null;
  liveAiredEpisode?: number | null;
  nextAiringEpisode?: { episode: number; airingAt: number } | null;
  /** Official total chapter count from AniList source manga (for accurate full-adaptation detection) */
  sourceTotalChapters?: number | null;
  /** Official source publication status from AniList (e.g. "FINISHED", "RELEASING") */
  sourceStatus?: string | null;
}

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Parses a single MangaUpdates segment such as:
 * - "Vol 113, Chap 1150 (As of EP 1180)"
 * - "Vol 21, Chap 181 Page 14 (S3)"
 * - "Vol 11, Chap 82 (S2) Partly skips Chap 79, Skips 80-81"
 * - "S2, Chap 110 (S2)"
 * - "Vol 18, Chap 156 (Infinity Castle Movie 1)"
 */
export function parseMangaUpdatesSegment(raw: string): MangaUpdatesAnimeSegment | null {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned || /^tba$/i.test(cleaned) || /^n\/a$/i.test(cleaned)) {
    return null;
  }

  // Extract parenthetical annotations
  const parens: string[] = [];
  const parenRe = /\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = parenRe.exec(cleaned)) !== null) {
    parens.push(m[1].trim());
  }

  let asOfEpisode: number | null = null;
  let tag: string | null = null;
  const noteParts: string[] = [];

  for (const p of parens) {
    const asOfMatch = /(?:as\s+of|up\s+to|through)?\s*(?:ep|episode)\.?\s*(\d+)/i.exec(p);
    if (asOfMatch && /as\s+of|up\s+to|through/i.test(p)) {
      const ep = Number(asOfMatch[1]);
      if (Number.isFinite(ep) && ep > 0) {
        asOfEpisode = ep;
        continue;
      }
    }
    if (/original\s+ending|adapted\s+in|filler|some\s+differences/i.test(p)) {
      noteParts.push(p);
      continue;
    }
    if (!tag) {
      tag = p;
    } else {
      noteParts.push(p);
    }
  }

  // Remove parentheticals before extracting Vol / Chap numbers so "(As of EP 1180)" doesn't collide
  const withoutParens = cleaned.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();

  // Extract trailing skip/abridged text (after the Vol/Chap/Page prefix)
  const trailingMatch =
    /(partly\s+skips[^/]*|skips\s+[^/]*|abridged[^/]*|anime\s+different[^/]*|some\s+differences[^/]*|also\s+adapted[^/]*)/i.exec(
      withoutParens
    );
  if (trailingMatch) {
    noteParts.push(trailingMatch[1].trim());
  }

  // Extract Volume ("Vol 113", "Vol. 7", "Vol18")
  let volume: number | null = null;
  const volMatch = /\bVol\.?\s*(\d+)\b/i.exec(withoutParens);
  if (volMatch) {
    const v = Number(volMatch[1]);
    if (Number.isFinite(v) && v >= 0 && v < 500) volume = v;
  }

  // Extract Manhwa season prefix ("S2, Chap 110")
  let manhwaSeason: number | null = null;
  const msMatch = /\bS(\d+)\s*,\s*(?:Chap|Ch\.?)/i.exec(withoutParens);
  if (msMatch) {
    const s = Number(msMatch[1]);
    if (Number.isFinite(s) && s > 0) manhwaSeason = s;
  }

  // Extract Chapter ("Chap 1150", "Ch. 45", "Chap 0-1", "Chap 181.5") — use integer part for chapter number
  // Ignore chapter numbers that only appear inside "Skips Chap ..."
  const headForChapter = trailingMatch
    ? withoutParens.slice(0, trailingMatch.index)
    : withoutParens;

  let chapter: number | null = null;
  const chapMatch = /\b(?:Chap(?:ter)?s?\.?|Ch\.?)\s*(\d+)(?:\.\d+)?/i.exec(headForChapter);
  if (chapMatch) {
    const c = Number(chapMatch[1]);
    if (Number.isFinite(c) && c >= 0 && c < 20000) chapter = c;
  }

  if (volume === null && chapter === null) return null;

  return {
    raw: cleaned,
    volume,
    chapter,
    manhwaSeason,
    asOfEpisode,
    tag,
    extraNote: noteParts.length > 0 ? noteParts.join(" · ").slice(0, 180) : null,
  };
}

export function parseMangaUpdatesField(
  field: string | null | undefined
): MangaUpdatesAnimeSegment[] {
  if (!field || typeof field !== "string") return [];
  // Split on "/" (except inside year-like or fraction-like tokens such as "1998/1999/2011")
  const parts = field.split(/\s*\/\s*(?![0-9]{4}\b)/);
  const out: MangaUpdatesAnimeSegment[] = [];
  for (const part of parts) {
    const seg = parseMangaUpdatesSegment(part);
    if (seg) out.push(seg);
  }
  return out;
}

interface ParsedAnimeSelector {
  season: number | null;
  part: number | null;
  isMovie: boolean;
  isOva: boolean;
  isFinal: boolean;
  year: number | null;
  tokens: Set<string>;
}

/**
 * Extracts structured season/part/movie/arc hints from an AniList anime title & metadata
 * so we match the exact corresponding segment in MangaUpdates `anime.end` / `anime.start`.
 */
export function extractAnimeSelector(target: TargetAnimeDescriptor): ParsedAnimeSelector {
  const combined = `${target.title ?? ""} ${target.romajiTitle ?? ""}`;
  const norm = normalizeText(combined);

  let season: number | null = null;
  const sPatterns = [
    /\bseason\s*(\d+)\b/i,
    /\b(\d+)(?:st|nd|rd|th)\s*season\b/i,
    /\bs(\d+)\b/i,
    /\b([2-9])\s*$/i,
  ];
  for (const re of sPatterns) {
    const m = re.exec(norm);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 1 && n <= 20) {
        season = n;
        break;
      }
    }
  }
  if (season === null) {
    if (/\biii\b/.test(norm)) season = 3;
    else if (/\bii\b/.test(norm)) season = 2;
    else if (/\biv\b/.test(norm)) season = 4;
  }

  let part: number | null = null;
  const pMatch = /\b(?:part|cour)\s*(\d+)\b/i.exec(norm);
  if (pMatch) {
    const p = Number(pMatch[1]);
    if (Number.isFinite(p) && p >= 1 && p <= 5) part = p;
  }

  const isMovie =
    target.format === "MOVIE" || /\b(?:movie|film|gekijouban)\b/i.test(norm);
  const isOva = target.format === "OVA" || /\bova\b/i.test(norm);
  const isFinal = /\bfinal(?:\s+season|\s+chapters)?\b/i.test(norm);

  // Stopwords removed to leave distinct arc/movie keywords ("reze", "infinity", "castle", "dumpster", "separation", "conflict", "calamity", "ryuusui")
  const STOP = new Set([
    "the",
    "of",
    "and",
    "to",
    "in",
    "no",
    "wa",
    "ga",
    "wo",
    "ni",
    "de",
    "season",
    "part",
    "cour",
    "movie",
    "film",
    "arc",
    "tv",
    "special",
    "ova",
    "1st",
    "2nd",
    "3rd",
    "4th",
    "1",
    "2",
    "3",
    "4",
    "5",
  ]);
  const tokens = new Set(
    norm
      .split(" ")
      .filter((w) => w.length >= 3 && !STOP.has(w))
  );

  return {
    season,
    part,
    isMovie,
    isOva,
    isFinal,
    year: target.seasonYear ?? null,
    tokens,
  };
}

function scoreSegmentMatch(
  seg: MangaUpdatesAnimeSegment,
  sel: ParsedAnimeSelector,
  totalSegments: number
): number {
  const tag = seg.tag ? normalizeText(seg.tag) : "";

  // Single untagged segment (e.g. One Piece "Vol 113, Chap 1150 (As of EP 1180)" or NANA "Vol 12, Chap 42")
  if (!tag) {
    if (seg.asOfEpisode !== null) return 95;
    return totalSegments === 1 && !sel.isMovie && (sel.season === null || sel.season === 1)
      ? 80
      : 10;
  }

  let score = 0;

  // Parse S<n>P<p> or S<n> from the MangaUpdates tag
  const tagSeasonPart = /\bs(\d+)\s*p(\d+)\b/i.exec(tag);
  const tagSeasonOnly = !tagSeasonPart ? /\bs(\d+)\b/i.exec(tag) : null;
  const tagPartOnly = !tagSeasonPart ? /\bp(\d+)\b/i.exec(tag) : null;
  const tagSeason = tagSeasonPart
    ? Number(tagSeasonPart[1])
    : tagSeasonOnly
      ? Number(tagSeasonOnly[1])
      : null;
  const tagPart = tagSeasonPart
    ? Number(tagSeasonPart[2])
    : tagPartOnly
      ? Number(tagPartOnly[1])
      : null;
  const tagIsMovie = /\bmovie\b/i.test(tag);
  const tagYearMatch = /\b(19\d{2}|20\d{2})\b/.exec(tag);
  const tagYear = tagYearMatch ? Number(tagYearMatch[1]) : null;

  // Year match (crucial for Hunter x Hunter 2011 vs 1999, Berserk 1997 vs 2016)
  if (tagYear !== null && sel.year !== null) {
    if (tagYear === sel.year) score += 90;
    else score -= 80;
  }

  // Movie match
  if (sel.isMovie) {
    if (tagIsMovie) score += 45;
    else if (tagSeason !== null) score -= 50;
  } else if (tagIsMovie) {
    score -= 60;
  }

  // Exact season + part matching
  const targetSeason = sel.season ?? (sel.isMovie ? null : 1);
  if (targetSeason !== null && tagSeason !== null) {
    if (tagSeason === targetSeason) {
      score += 70;
      if (sel.part !== null && tagPart !== null) {
        score += tagPart === sel.part ? 35 : -45;
      } else if (sel.part === null && tagPart !== null) {
        // E.g. AniList "Season 3" vs MU "S3P2" (prefer the latest part if no part specified)
        score += tagPart === 1 ? 5 : 12;
      } else if (sel.part !== null && tagPart === null) {
        // AniList specifies Part 1, MU only has "S2" (whole season) -> mild penalty so Part 1 doesn't spoil Part 2!
        if (sel.part === 1) score -= 25;
        else score += 10;
      }
    } else {
      score -= 80;
    }
  } else if (sel.part !== null && tagPart !== null && tagSeason === null) {
    score += tagPart === sel.part ? 35 : -35;
  }

  // Distinct keyword overlap (e.g. "reze", "infinity", "castle", "dumpster", "ryuusui", "tybw")
  const tagWords = tag.split(" ").filter((w) => w.length >= 3);
  let keywordHits = 0;
  for (const w of tagWords) {
    if (sel.tokens.has(w)) keywordHits += 1;
  }
  if (keywordHits > 0) {
    score += keywordHits * 40;
  }

  return score;
}

export function mapMangaUpdatesType(
  muType: string | null | undefined,
  fallback: SourceMediumKind
): SourceMediumKind {
  const norm = (muType ?? "").trim().toLowerCase();
  if (norm === "manhwa") return "MANHWA";
  if (norm === "manhua") return "MANHUA";
  if (norm === "novel") return "NOVEL";
  if (norm === "manga") return "MANGA";
  return fallback;
}

function buildLocalizedMuNote(
  seg: MangaUpdatesAnimeSegment,
  lang: ContentLanguage
): string | null {
  const parts: string[] = [];
  if (seg.asOfEpisode) {
    const epTxt: Record<ContentLanguage, string> = {
      fr: `Synchronisé jusqu'à l'épisode ${seg.asOfEpisode} (données communautaires MangaUpdates).`,
      en: `Synced through Episode ${seg.asOfEpisode} (verified MangaUpdates data).`,
      es: `Sincronizado hasta el episodio ${seg.asOfEpisode} (datos verificados de MangaUpdates).`,
      de: `Synchronisiert bis Folge ${seg.asOfEpisode} (verifizierte MangaUpdates-Daten).`,
      it: `Sincronizzato fino all'episodio ${seg.asOfEpisode} (dati verificati MangaUpdates).`,
      pt: `Sincronizado até o episódio ${seg.asOfEpisode} (dados verificados do MangaUpdates).`,
      ja: `第${seg.asOfEpisode}話まで同期済み（MangaUpdates検証データ）。`,
    };
    parts.push(epTxt[lang] ?? epTxt.en);
  }
  if (seg.extraNote) {
    parts.push(seg.extraNote);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Resolves a verified `MangaContinuationInfo` from a live MangaUpdates series payload
 * for the given target anime season/movie/ongoing series.
 * Returns `null` if no reliable segment matches this exact season (never misattributes
 * Season 1's ending to Season 3!).
 */
export function resolveFromMangaUpdatesSeries(
  series: MangaUpdatesSeriesInput,
  target: TargetAnimeDescriptor,
  fallbackKind: SourceMediumKind,
  lang: ContentLanguage = "fr"
): MangaContinuationInfo | null {
  const endSegments = parseMangaUpdatesField(series.animeEnd);
  if (endSegments.length === 0) return null;

  const startSegments = parseMangaUpdatesField(series.animeStart);
  const sel = extractAnimeSelector(target);

  // Score every end segment and pick the highest match above threshold
  let bestSeg: MangaUpdatesAnimeSegment | null = null;
  let bestScore = -Infinity;
  for (const seg of endSegments) {
    const s = scoreSegmentMatch(seg, sel, endSegments.length);
    if (s > bestScore) {
      bestScore = s;
      bestSeg = seg;
    }
  }

  // Require positive confidence match so e.g. an unindexed Season 3 never gets Season 1's chapter
  if (!bestSeg || bestScore < 40) {
    return null;
  }

  // Find matching start segment (for coveredRange)
  let matchedStart: MangaUpdatesAnimeSegment | null = null;
  if (startSegments.length > 0) {
    let bestStartScore = -Infinity;
    for (const seg of startSegments) {
      const s = scoreSegmentMatch(seg, sel, startSegments.length);
      if (s > bestStartScore) {
        bestStartScore = s;
        matchedStart = seg;
      }
    }
    if (bestStartScore < 30) matchedStart = null;
  }

  const sourceKind = mapMangaUpdatesType(series.type, fallbackKind);
  const endedAtChapter = bestSeg.chapter;
  const endedAtVolume = bestSeg.volume;
  const officialTotalCh =
    typeof target.sourceTotalChapters === "number" && target.sourceTotalChapters > 0
      ? target.sourceTotalChapters
      : null;

  const isOngoing =
    target.status === "RELEASING" || bestSeg.asOfEpisode !== null;

  // Determine whether the entire completed manga/manhwa has been adapted using AniList's
  // official published total chapter count (never MangaUpdates scanlation latest_chapter).
  const sourceCompleted =
    target.sourceStatus === "FINISHED" || Boolean(series.completed && officialTotalCh !== null);
  const isFullyAdapted = Boolean(
    !isOngoing &&
      sourceCompleted &&
      endedAtChapter !== null &&
      officialTotalCh !== null &&
      endedAtChapter >= officialTotalCh
  );

  // Check if a subsequent season's start in `startSegments` gives the exact continue chapter/volume
  let continueAtChapter: number | null = isFullyAdapted
    ? null
    : endedAtChapter !== null
      ? endedAtChapter + 1
      : null;
  let continueAtVolume: number | null = isFullyAdapted ? null : endedAtVolume;

  if (!isFullyAdapted && endedAtChapter !== null && startSegments.length > 1) {
    const nextStart = startSegments.find(
      (s) =>
        s.chapter !== null &&
        s.chapter >= endedAtChapter &&
        s.chapter <= endedAtChapter + 3 &&
        s !== matchedStart &&
        (bestSeg!.manhwaSeason === null || s.manhwaSeason === bestSeg!.manhwaSeason)
    );
    if (nextStart) {
      if (nextStart.chapter !== null && nextStart.chapter > endedAtChapter) {
        continueAtChapter = nextStart.chapter;
      }
      if (nextStart.volume !== null) {
        continueAtVolume = nextStart.volume;
      }
    }
  }

  // Format coveredRange cleanly
  let coveredRange: string | null = null;
  if (endedAtChapter !== null) {
    const startCh = matchedStart?.chapter ?? (sel.season === null || sel.season === 1 ? 1 : null);
    if (bestSeg.manhwaSeason !== null) {
      coveredRange = `S${bestSeg.manhwaSeason} Ch. ${startCh ?? 1} – ${endedAtChapter}`;
    } else if (startCh !== null && startCh <= endedAtChapter) {
      coveredRange = `Ch. ${startCh} – ${endedAtChapter}`;
    } else {
      coveredRange = `→ Ch. ${endedAtChapter}`;
    }
    if (bestSeg.asOfEpisode) {
      coveredRange += ` (Ép. ${bestSeg.asOfEpisode})`;
    }
  } else if (endedAtVolume !== null) {
    const startVol = matchedStart?.volume ?? 1;
    coveredRange = `Vol. ${startVol} – ${endedAtVolume}`;
  }

  const syncedEpisode =
    bestSeg.asOfEpisode ??
    (target.status === "FINISHED" ? target.totalEpisodes ?? null : target.liveAiredEpisode ?? null);

  return {
    sourceKind,
    endedAtChapter,
    continueAtChapter,
    endedAtVolume,
    continueAtVolume,
    coveredRange,
    adaptedArc: bestSeg.tag && !/^s\d+(?:p\d+)?$/i.test(bestSeg.tag) ? bestSeg.tag : null,
    isFullyAdapted,
    isOngoingAdaptation: isOngoing,
    verified: true,
    confidence: "verified",
    note: buildLocalizedMuNote(bestSeg, lang),
    syncedEpisode,
    totalEpisodes: target.totalEpisodes ?? null,
    nextAiringEpisode: target.nextAiringEpisode ?? null,
    liveSynced: Boolean(isOngoing && syncedEpisode),
    liveAnchor:
      bestSeg.asOfEpisode !== null && endedAtChapter !== null
        ? {
            anchorEpisode: bestSeg.asOfEpisode,
            anchorChapter: endedAtChapter,
            chaptersPerEpisode: 1.0,
            chaptersPerVolume: 10,
          }
        : null,
  };
}
