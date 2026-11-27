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
import type { ContentLanguage } from "@/types/media";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const FINISHED_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for finished anime
const RELEASING_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour (auto-busted immediately when episode changes!)
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
  expiresAt: number;
}

interface LiveAiringSnapshot {
  status: string | null;
  episodes: number | null;
  latestAiredEpisode: number | null;
  nextAiringEpisode: { episode: number; airingAt: number } | null;
  sourceChapters: number | null;
  sourceVolumes: number | null;
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

function getCached(key: string): MangaContinuationInfo | null {
  const hit = serverContinuationCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    serverContinuationCache.delete(key);
    return null;
  }
  return hit.data;
}

function setCached(key: string, data: MangaContinuationInfo, ttlMs: number): void {
  if (serverContinuationCache.size >= MAX_SERVER_CACHE) {
    const oldestKey = serverContinuationCache.keys().next().value;
    if (oldestKey) serverContinuationCache.delete(oldestKey);
  }
  serverContinuationCache.set(key, {
    data,
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
 * and source manga chapter/volume count) with a short 5-minute cache so releasing anime
 * always stay synced in real time as new episodes drop.
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
    const sourceType = body?.sourceType ? String(body.sourceType).trim() : null;
    const sourceMediaId =
      typeof body?.sourceMediaId === "number" && body.sourceMediaId > 0
        ? Math.floor(body.sourceMediaId)
        : null;
    const sourceTitle = body?.sourceTitle ? String(body.sourceTitle).trim().slice(0, 180) : null;
    const sourceCountry = body?.sourceCountry ? String(body.sourceCountry).trim() : null;
    const sourceFormat = body?.sourceFormat ? String(body.sourceFormat).trim() : null;
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

    // Tier 1: Curated verified database lookup
    const curated = getCuratedMangaContinuation(mediaId, lang);

    // For currently airing or ongoing curated shows, fetch live AniList airing episode
    const shouldCheckLiveAiring =
      statusHint === "RELEASING" ||
      Boolean(curated?.isOngoingAdaptation) ||
      Boolean(nextAiringHint);

    const liveSnap = shouldCheckLiveAiring
      ? await fetchLiveAniListAiringMeta(mediaId, sourceMediaId)
      : null;

    const effectiveStatus = liveSnap?.status ?? statusHint;
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
    const isReleasing =
      effectiveStatus === "RELEASING" || Boolean(curated?.isOngoingAdaptation);

    if (curated) {
      const adjusted =
        curated.liveAnchor || isReleasing
          ? applyLiveEpisodeAdjustment(curated, {
              liveAiredEpisode,
              totalEpisodes: effectiveTotalEpisodes,
              sourceTotalChapters: effectiveSourceChapters,
              sourceTotalVolumes: effectiveSourceVolumes,
              nextAiringEpisode: effectiveNextAiring,
            })
          : {
              ...curated,
              totalEpisodes: effectiveTotalEpisodes,
              syncedEpisode: effectiveTotalEpisodes,
            };

      return NextResponse.json(
        {
          data: {
            ...adjusted,
            updatedAt: new Date().toISOString(),
          },
          source: curated.liveAnchor && liveAiredEpisode ? "verified-live" : "verified",
          liveAiredEpisode,
          nextAiringEpisode: effectiveNextAiring,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const detectedKind: SourceMediumKind = detectSourceMediumKind(sourceType, {
      id: 0,
      type: "MANGA",
      title: sourceTitle ?? title,
      coverImage: "",
      format: sourceFormat,
      averageScore: null,
      countryOfOrigin: sourceCountry,
    });

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

    // Episode-aware cache key so a newly aired episode ALWAYS busts the previous episode's cache!
    const epTag = isReleasing ? `ep${liveAiredEpisode ?? "live"}` : "done";
    const cacheKey = `${mediaId}:${lang}:${epTag}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json(
        {
          data: {
            ...cached,
            nextAiringEpisode: effectiveNextAiring ?? cached.nextAiringEpisode ?? null,
          },
          source: "cache",
          liveAiredEpisode,
          nextAiringEpisode: effectiveNextAiring,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

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
    const prompt = `You are a precise real-time anime-to-manga/manhwa/light-novel adaptation guide (like MangaUpdates / Where Does the Anime End).
Given this exact anime season/entry:
- Title: "${title}"${romajiTitle && romajiTitle !== title ? ` (Romaji: "${romajiTitle}")` : ""}
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

Strict rules:
1. ${isReleasing && liveAiredEpisode ? `CRITICAL: This anime is STILL AIRING and ONLY ${liveAiredEpisode} episodes have aired so far! Give the exact chapter/volume adapted UP TO Episode ${liveAiredEpisode} (NOT the end of the future un-aired season!). Set "isOngoingAdaptation": true.` : `Give the exact chapter/volume where THIS SPECIFIC anime season stops and the chapter/volume where readers should continue in the ${detectedKind}.`}
2. Estimate "chaptersPerEpisode" as a decimal (e.g. 2.5 or 3.0) representing the adaptation pacing of this series if known, else null.
3. If the anime adapts the entire source completely to the final chapter, set "isFullyAdapted": true and "continueAtChapter": null.
4. If this is a Light Novel adaptation where chapters aren't numbered continuously, use "endedAtVolume" and "continueAtVolume" (and "coveredRange" like "Vol. 1 – 3") and set chapter numbers to null unless a manga adaptation has clear chapters.
5. NEVER fabricate numbers if you are unsure. If you don't reliably know where this anime is at, set "confidence": "low" and set numbers to null.
6. Write "note" as ONE short helpful sentence (max 150 chars) in ${LANGUAGE_NAMES[lang]} mentioning the episode/chapter breakpoint or restart tip, or null if nothing special.`;

    let rawText = "";
    let lastModelErr: unknown = null;
    for (const modelName of getGeminiModelCandidates()) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.1,
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
    const confidence: MangaContinuationInfo["confidence"] =
      confidenceRaw === "high"
        ? "high"
        : confidenceRaw === "medium"
          ? "medium"
          : "low";

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
      endedAtChapter: confidence === "low" ? null : endedAtChapter,
      continueAtChapter: confidence === "low" ? null : continueAtChapter,
      endedAtVolume: confidence === "low" ? null : endedAtVolume,
      continueAtVolume: confidence === "low" ? null : continueAtVolume,
      chaptersPerEpisode,
      coveredRange:
        confidence !== "low" && typeof parsed.coveredRange === "string" && parsed.coveredRange.trim()
          ? parsed.coveredRange.trim().slice(0, 60)
          : null,
      adaptedArc:
        typeof parsed.adaptedArc === "string" && parsed.adaptedArc.trim()
          ? parsed.adaptedArc.trim().slice(0, 80)
          : null,
      isFullyAdapted: Boolean(parsed.isFullyAdapted),
      isOngoingAdaptation: Boolean(parsed.isOngoingAdaptation) || isReleasing,
      verified: false,
      confidence,
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

    if (confidence !== "low") {
      setCached(
        cacheKey,
        data,
        isReleasing ? RELEASING_CACHE_TTL_MS : FINISHED_CACHE_TTL_MS
      );
    }

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
