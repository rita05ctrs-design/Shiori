import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { normalizeContentLanguage } from "@/lib/i18n";
import {
  applyLiveEpisodeAdjustment,
  detectSourceMediumKind,
  getCuratedMangaContinuation,
  resolveLatestAiredEpisode,
  type MangaContinuationInfo,
  type SourceMediumKind,
} from "@/lib/manga-continuation";
import { lookupLiveMangaUpdatesContinuation } from "@/lib/server/mangaupdates";
import type { ContentLanguage } from "@/types/media";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const FINISHED_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours for finished anime
const RELEASING_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes for airing shows (auto-busted when episode changes)
const LIVE_AIRING_TTL_MS = 5 * 60 * 1000; // 5 min AniList live episode check
const MAX_SERVER_CACHE = 450;

const DEFAULT_GEMINI_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.8-flash",
] as const;

function getGeminiModelCandidates(): string[] {
  const custom = process.env.GEMINI_MODEL?.trim();
  const ordered = custom
    ? [custom, ...DEFAULT_GEMINI_MODELS]
    : [...DEFAULT_GEMINI_MODELS];
  return Array.from(new Set(ordered));
}

function sanitizeApiKey(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

interface CachedLookup {
  data: MangaContinuationInfo;
  source: string;
  expiresAt: number;
}

interface LiveAiringSnapshot {
  status: string | null;
  format: string | null;
  episodes: number | null;
  latestAiredEpisode: number | null;
  nextAiringEpisode: { episode: number; airingAt: number } | null;
  sourceChapters: number | null;
  sourceVolumes: number | null;
  sourceStatus: string | null;
  expiresAt: number;
}

const serverContinuationCache = new Map<string, CachedLookup>();
const liveAiringCache = new Map<number, LiveAiringSnapshot>();

const LANGUAGE_NAMES: Record<ContentLanguage, string> = {
  fr: "French",
  en: "English",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ja: "Japanese",
};

function getCached(key: string): CachedLookup | null {
  const hit = serverContinuationCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    serverContinuationCache.delete(key);
    return null;
  }
  return hit;
}

function setCached(
  key: string,
  data: MangaContinuationInfo,
  source: string,
  ttlMs: number
): void {
  if (serverContinuationCache.size >= MAX_SERVER_CACHE) {
    const oldestKey = serverContinuationCache.keys().next().value;
    if (oldestKey) serverContinuationCache.delete(oldestKey);
  }
  serverContinuationCache.set(key, {
    data,
    source,
    expiresAt: Date.now() + ttlMs,
  });
}

function toPositiveIntOrNull(val: unknown): number | null {
  if (typeof val !== "number" || !Number.isFinite(val)) return null;
  const n = Math.round(val);
  return n > 0 && n < 20000 ? n : null;
}

function toPacingOrNull(val: unknown): number | null {
  if (typeof val !== "number" || !Number.isFinite(val)) return null;
  return val >= 0.4 && val <= 8 ? Number(val.toFixed(2)) : null;
}

/**
 * Fetches live AniList airing state (exact latest aired episode, next airing timestamp,
 * and source manga official chapter/volume count & status) with a short 5-minute cache.
 */
async function fetchLiveAniListAiringMeta(
  mediaId: number,
  sourceMediaId?: number | null
): Promise<LiveAiringSnapshot | null> {
  const cached = liveAiringCache.get(mediaId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const query = `
      query ($id: Int, $now: Int, $hasSource: Boolean!, $sourceId: Int) {
        anime: Media(id: $id, type: ANIME) {
          status
          format
          episodes
          nextAiringEpisode { episode airingAt }
        }
        latestAired: Page(page: 1, perPage: 1) {
          airingSchedules(mediaId: $id, airingAt_lesser: $now, sort: EPISODE_DESC) {
            episode
            airingAt
          }
        }
        sourceMedia: Media(id: $sourceId, type: MANGA) @include(if: $hasSource) {
          status
          chapters
          volumes
        }
      }
    `;

    const hasSource = Boolean(sourceMediaId && sourceMediaId > 0);
    const res = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          id: mediaId,
          now: nowSec,
          hasSource,
          sourceId: hasSource ? sourceMediaId : 0,
        },
      }),
      cache: "no-store",
    });

    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    const anime = json?.data?.anime;
    if (!anime) return null;

    const latestSlot = json?.data?.latestAired?.airingSchedules?.[0];
    const nextEp =
      anime.nextAiringEpisode && Number.isFinite(Number(anime.nextAiringEpisode.episode))
        ? {
            episode: Number(anime.nextAiringEpisode.episode),
            airingAt: Number(anime.nextAiringEpisode.airingAt),
          }
        : null;

    const latestAiredEpisode = resolveLatestAiredEpisode({
      status: anime.status ?? null,
      episodes: typeof anime.episodes === "number" ? anime.episodes : null,
      nextAiringEpisode: nextEp,
      latestAiredEpisode:
        latestSlot && Number.isFinite(Number(latestSlot.episode))
          ? Number(latestSlot.episode)
          : null,
    });

    const snap: LiveAiringSnapshot = {
      status: anime.status ?? null,
      format: anime.format ?? null,
      episodes: typeof anime.episodes === "number" ? anime.episodes : null,
      latestAiredEpisode,
      nextAiringEpisode: nextEp,
      sourceChapters:
        typeof json?.data?.sourceMedia?.chapters === "number"
          ? json.data.sourceMedia.chapters
          : null,
      sourceVolumes:
        typeof json?.data?.sourceMedia?.volumes === "number"
          ? json.data.sourceMedia.volumes
          : null,
      sourceStatus:
        typeof json?.data?.sourceMedia?.status === "string"
          ? json.data.sourceMedia.status
          : null,
      expiresAt: Date.now() + LIVE_AIRING_TTL_MS,
    };

    if (liveAiringCache.size >= 300) {
      const oldest = liveAiringCache.keys().next().value;
      if (oldest !== undefined) liveAiringCache.delete(oldest);
    }
    liveAiringCache.set(mediaId, snap);
    return snap;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mediaId = Number(body?.mediaId);
    const title = String(body?.title ?? "").trim().slice(0, 180);
    const romajiTitle = String(body?.romajiTitle ?? "").trim().slice(0, 180);
    const formatHint = body?.format ? String(body.format).trim() : null;
    const sourceType = body?.sourceType ? String(body.sourceType).trim() : null;
    const sourceMediaId =
      typeof body?.sourceMediaId === "number" && body.sourceMediaId > 0
        ? Math.floor(body.sourceMediaId)
        : null;
    const sourceTitle = body?.sourceTitle ? String(body.sourceTitle).trim().slice(0, 180) : null;
    const sourceCountry = body?.sourceCountry ? String(body.sourceCountry).trim() : null;
    const sourceFormat = body?.sourceFormat ? String(body.sourceFormat).trim() : null;
    const sourceStatusHint = body?.sourceStatus ? String(body.sourceStatus).trim() : null;
    const sourceChaptersHint = toPositiveIntOrNull(body?.sourceChapters);
    const sourceVolumesHint = toPositiveIntOrNull(body?.sourceVolumes);
    const episodesHint = typeof body?.episodes === "number" ? body.episodes : null;
    const statusHint = body?.status ? String(body.status).trim() : null;
    const airedEpisodesHint = toPositiveIntOrNull(body?.airedEpisodes);
    const nextAiringHint =
      body?.nextAiringEpisode &&
      typeof body.nextAiringEpisode.episode === "number" &&
      typeof body.nextAiringEpisode.airingAt === "number"
        ? {
            episode: Math.floor(body.nextAiringEpisode.episode),
            airingAt: Math.floor(body.nextAiringEpisode.airingAt),
          }
        : null;
    const seasonYear = typeof body?.seasonYear === "number" ? body.seasonYear : null;
    const lang = normalizeContentLanguage(body?.language);

    if (!Number.isFinite(mediaId) || mediaId <= 0 || !title) {
      return NextResponse.json({ error: "Invalid anime metadata" }, { status: 400 });
    }

    const curated = getCuratedMangaContinuation(mediaId, lang);

    const detectedKind: SourceMediumKind =
      curated?.sourceKind ??
      detectSourceMediumKind(sourceType, {
        id: 0,
        type: "MANGA",
        title: sourceTitle ?? title,
        coverImage: "",
        format: sourceFormat,
        averageScore: null,
        countryOfOrigin: sourceCountry,
      });

    // Fetch live AniList airing metadata for releasing/ongoing anime or when source totals are unknown
    const shouldCheckLiveAiring =
      statusHint === "RELEASING" ||
      Boolean(curated?.isOngoingAdaptation) ||
      Boolean(nextAiringHint) ||
      (!curated && sourceMediaId !== null && sourceChaptersHint === null);

    const liveSnap = shouldCheckLiveAiring
      ? await fetchLiveAniListAiringMeta(mediaId, sourceMediaId)
      : null;

    const effectiveStatus = liveSnap?.status ?? statusHint;
    const effectiveFormat = liveSnap?.format ?? formatHint;
    const effectiveTotalEpisodes = liveSnap?.episodes ?? episodesHint;
    const effectiveNextAiring = liveSnap?.nextAiringEpisode ?? nextAiringHint;
    const liveAiredEpisode =
      liveSnap?.latestAiredEpisode ??
      resolveLatestAiredEpisode({
        status: effectiveStatus,
        episodes: effectiveTotalEpisodes,
        nextAiringEpisode: effectiveNextAiring,
        latestAiredEpisode: airedEpisodesHint,
      });
    const effectiveSourceChapters = liveSnap?.sourceChapters ?? sourceChaptersHint;
    const effectiveSourceVolumes = liveSnap?.sourceVolumes ?? sourceVolumesHint;
    const effectiveSourceStatus = liveSnap?.sourceStatus ?? sourceStatusHint;
    const isReleasing =
      effectiveStatus === "RELEASING" || Boolean(curated?.isOngoingAdaptation);

    // Unreleased anime has no chapter ending yet
    if (effectiveStatus === "NOT_YET_RELEASED") {
      const unreleased: MangaContinuationInfo = {
        sourceKind: detectedKind,
        endedAtChapter: null,
        continueAtChapter: 1,
        endedAtVolume: null,
        continueAtVolume: 1,
        coveredRange: null,
        adaptedArc: null,
        isFullyAdapted: false,
        isOngoingAdaptation: false,
        verified: false,
        confidence: "low",
        note: null,
        nextAiringEpisode: effectiveNextAiring,
      };
      return NextResponse.json({ data: unreleased, source: "unreleased" });
    }

    // Finished curated entries (100% audited against MangaUpdates & AniList) resolve in 0ms
    if (curated && !isReleasing && !curated.liveAnchor) {
      return NextResponse.json(
        {
          data: {
            ...curated,
            dataSource: "curated",
            totalEpisodes: effectiveTotalEpisodes,
            syncedEpisode: effectiveTotalEpisodes,
            updatedAt: new Date().toISOString(),
          },
          source: "verified",
          liveAiredEpisode,
          nextAiringEpisode: effectiveNextAiring,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Episode-aware cache key so a newly aired episode ALWAYS busts the previous episode's cache
    const epTag = isReleasing ? `ep${liveAiredEpisode ?? "live"}` : "done";
    const cacheKey = `v3:${mediaId}:${lang}:${epTag}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json(
        {
          data: {
            ...cached.data,
            nextAiringEpisode: effectiveNextAiring ?? cached.data.nextAiringEpisode ?? null,
          },
          source: cached.source,
          liveAiredEpisode,
          nextAiringEpisode: effectiveNextAiring,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Tier 1 (LIVE REAL-TIME COMMUNITY DATABASE): Query MangaUpdates API v1 first!
    // Covers ongoing shows (e.g. One Piece "Vol 113, Chap 1150 (As of EP 1180)") AND
    // thousands of non-curated Manga, Manhwa, Manhua, and Light Novel adaptations with REAL data.
    const muLive = await lookupLiveMangaUpdatesContinuation({
      sourceTitle,
      fallbackKind: detectedKind,
      lang,
      isReleasing,
      target: {
        title,
        romajiTitle,
        format: effectiveFormat,
        seasonYear,
        status: effectiveStatus,
        totalEpisodes: effectiveTotalEpisodes,
        liveAiredEpisode,
        nextAiringEpisode: effectiveNextAiring,
        sourceTotalChapters: effectiveSourceChapters,
        sourceStatus: effectiveSourceStatus,
      },
    });

    if (muLive && (muLive.endedAtChapter !== null || muLive.endedAtVolume !== null)) {
      let finalMu: MangaContinuationInfo = {
        ...muLive,
        dataSource: "mangaupdates",
        adaptedArc: muLive.adaptedArc ?? curated?.adaptedArc ?? null,
        updatedAt: new Date().toISOString(),
      };

      // If AniList reports an even newer aired episode than MangaUpdates' "(As of EP N)",
      // advance smoothly from MangaUpdates' fresh live anchor (never from a stale hardcoded anchor!).
      if (
        isReleasing &&
        finalMu.liveAnchor &&
        liveAiredEpisode !== null &&
        liveAiredEpisode > finalMu.liveAnchor.anchorEpisode
      ) {
        finalMu = applyLiveEpisodeAdjustment(finalMu, {
          liveAiredEpisode,
          totalEpisodes: effectiveTotalEpisodes,
          sourceTotalChapters: effectiveSourceChapters,
          sourceTotalVolumes: effectiveSourceVolumes,
          nextAiringEpisode: effectiveNextAiring,
        });
      }

      setCached(
        cacheKey,
        finalMu,
        isReleasing ? "mangaupdates-live" : "mangaupdates",
        isReleasing ? RELEASING_CACHE_TTL_MS : FINISHED_CACHE_TTL_MS
      );

      return NextResponse.json(
        {
          data: finalMu,
          source: isReleasing ? "mangaupdates-live" : "mangaupdates",
          liveAiredEpisode,
          nextAiringEpisode: effectiveNextAiring,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Tier 2 (Ongoing Curated Anchor Fallback if MangaUpdates was unreachable)
    if (curated) {
      const adjusted: MangaContinuationInfo = {
        ...applyLiveEpisodeAdjustment(curated, {
          liveAiredEpisode,
          totalEpisodes: effectiveTotalEpisodes,
          sourceTotalChapters: effectiveSourceChapters,
          sourceTotalVolumes: effectiveSourceVolumes,
          nextAiringEpisode: effectiveNextAiring,
        }),
        dataSource: "curated",
        updatedAt: new Date().toISOString(),
      };

      setCached(cacheKey, adjusted, "verified-live", RELEASING_CACHE_TTL_MS);

      return NextResponse.json(
        {
          data: adjusted,
          source: "verified-live",
          liveAiredEpisode,
          nextAiringEpisode: effectiveNextAiring,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Tier 3 (Strict Anti-Hallucination Gemini Fallback — ONLY when MangaUpdates had no data)
    // Only accepts `confidence === "high"`; medium/low guesses are discarded so we never display fake chapters.
    const apiKey = sanitizeApiKey(process.env.GEMINI_API_KEY);
    if (!apiKey) {
      return NextResponse.json({ data: null, source: "unavailable" });
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const liveEpisodeContext =
      isReleasing && liveAiredEpisode
        ? `- CURRENTLY AIRING (Live as of ${todayIso}): EXACTLY Episode ${liveAiredEpisode}${effectiveTotalEpisodes ? ` out of ${effectiveTotalEpisodes}` : ""} has aired so far.${effectiveNextAiring ? ` Episode ${effectiveNextAiring.episode} has NOT aired yet.` : ""}`
        : `- Total Episodes: ${effectiveTotalEpisodes ?? "unknown"}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = `You are a strict anime-to-manga/manhwa/light-novel adaptation fact-checker (like MangaUpdates).
Given this exact anime entry:
- Title: "${title}"${romajiTitle && romajiTitle !== title ? ` (Romaji: "${romajiTitle}")` : ""}
- Format: ${effectiveFormat ?? "TV"}
- Year: ${seasonYear ?? "unknown"}
- Airing Status: ${effectiveStatus ?? "unknown"}
${liveEpisodeContext}
- Source Medium: ${detectedKind}${sourceTitle ? ` ("${sourceTitle}")` : ""}${effectiveSourceChapters ? ` (Total published chapters: ${effectiveSourceChapters})` : ""}${effectiveSourceVolumes ? ` (Total volumes: ${effectiveSourceVolumes})` : ""}

Return ONLY valid JSON matching this exact schema:
{
  "endedAtChapter": number | null,
  "continueAtChapter": number | null,
  "endedAtVolume": number | null,
  "continueAtVolume": number | null,
  "chaptersPerEpisode": number | null,
  "coveredRange": string | null,
  "adaptedArc": string | null,
  "isFullyAdapted": boolean,
  "isOngoingAdaptation": boolean,
  "confidence": "high" | "medium" | "low",
  "note": string | null
}

CRITICAL ANTI-HALLUCINATION RULES:
1. NEVER guess or invent chapter numbers! Only set "confidence": "high" if you are 100% certain of the exact verified ending chapter/volume for THIS SPECIFIC season/movie.
2. If you are even slightly unsure, or if the anime is still airing and you don't know the exact chapter for Episode ${liveAiredEpisode ?? "?"}, you MUST set "confidence": "low" and set endedAtChapter/continueAtChapter/endedAtVolume/continueAtVolume to null.
3. If the anime adapts the entire source to its final chapter, set "isFullyAdapted": true and "continueAtChapter": null.
4. For Light Novels without continuous chapter numbers, use endedAtVolume / continueAtVolume and set chapter numbers to null.
5. Write "note" as ONE short helpful sentence (max 150 chars) in ${LANGUAGE_NAMES[lang]} or null.`;

    let rawText = "";
    let lastModelErr: unknown = null;
    for (const modelName of getGeminiModelCandidates()) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.05,
            maxOutputTokens: 512,
            responseMimeType: "application/json",
          },
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        if (text) {
          rawText = text;
          break;
        }
      } catch (err) {
        lastModelErr = err;
      }
    }

    if (!rawText) {
      if (lastModelErr) {
        console.error("[api/manga-continuation] All Gemini models failed:", lastModelErr);
      }
      return NextResponse.json({ data: null, source: "unavailable" });
    }

    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ data: null, source: "parse-error" });
    }

    const confidenceRaw = String(parsed.confidence ?? "low").toLowerCase();
    // Strict anti-hallucination gate: only display AI numbers if confidence === "high"
    if (confidenceRaw !== "high") {
      return NextResponse.json(
        { data: null, source: "low-confidence-suppressed", liveAiredEpisode },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    let endedAtChapter = toPositiveIntOrNull(parsed.endedAtChapter);
    if (endedAtChapter !== null && effectiveSourceChapters !== null) {
      endedAtChapter = Math.min(endedAtChapter, effectiveSourceChapters);
    }
    const continueAtChapter = Boolean(parsed.isFullyAdapted)
      ? null
      : toPositiveIntOrNull(parsed.continueAtChapter) ??
        (endedAtChapter !== null ? endedAtChapter + 1 : null);
    const endedAtVolume = toPositiveIntOrNull(parsed.endedAtVolume);
    const continueAtVolume = Boolean(parsed.isFullyAdapted)
      ? null
      : toPositiveIntOrNull(parsed.continueAtVolume);
    const chaptersPerEpisode = toPacingOrNull(parsed.chaptersPerEpisode);

    const data: MangaContinuationInfo = {
      sourceKind: detectedKind,
      endedAtChapter,
      continueAtChapter,
      endedAtVolume,
      continueAtVolume,
      chaptersPerEpisode,
      coveredRange:
        typeof parsed.coveredRange === "string" && parsed.coveredRange.trim()
          ? parsed.coveredRange.trim().slice(0, 60)
          : null,
      adaptedArc:
        typeof parsed.adaptedArc === "string" && parsed.adaptedArc.trim()
          ? parsed.adaptedArc.trim().slice(0, 80)
          : null,
      isFullyAdapted: Boolean(parsed.isFullyAdapted),
      isOngoingAdaptation: Boolean(parsed.isOngoingAdaptation) || isReleasing,
      verified: false,
      confidence: "high",
      dataSource: "estimated",
      note:
        typeof parsed.note === "string" && parsed.note.trim()
          ? parsed.note.trim().slice(0, 220)
          : null,
      syncedEpisode: isReleasing ? liveAiredEpisode : effectiveTotalEpisodes,
      totalEpisodes: effectiveTotalEpisodes,
      nextAiringEpisode: effectiveNextAiring,
      liveSynced: Boolean(isReleasing && liveAiredEpisode),
      updatedAt: new Date().toISOString(),
    };

    setCached(
      cacheKey,
      data,
      isReleasing ? "gemini-live" : "gemini",
      isReleasing ? RELEASING_CACHE_TTL_MS : FINISHED_CACHE_TTL_MS
    );

    return NextResponse.json(
      {
        data,
        source: isReleasing ? "gemini-live" : "gemini",
        liveAiredEpisode,
        nextAiringEpisode: effectiveNextAiring,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[api/manga-continuation] Error:", err);
    return NextResponse.json({ data: null, source: "error" }, { status: 200 });
  }
}
