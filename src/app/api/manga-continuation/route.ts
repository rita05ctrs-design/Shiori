import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { normalizeContentLanguage } from "@/lib/i18n";
import {
  detectSourceMediumKind,
  getCuratedMangaContinuation,
  type MangaContinuationInfo,
  type SourceMediumKind,
} from "@/lib/manga-continuation";
import type { ContentLanguage } from "@/types/media";

const SERVER_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_SERVER_CACHE = 400;

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

const serverContinuationCache = new Map<string, CachedLookup>();

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

function setCached(key: string, data: MangaContinuationInfo): void {
  if (serverContinuationCache.size >= MAX_SERVER_CACHE) {
    const oldestKey = serverContinuationCache.keys().next().value;
    if (oldestKey) serverContinuationCache.delete(oldestKey);
  }
  serverContinuationCache.set(key, {
    data,
    expiresAt: Date.now() + SERVER_CACHE_TTL_MS,
  });
}

function toPositiveIntOrNull(val: unknown): number | null {
  if (typeof val !== "number" || !Number.isFinite(val)) return null;
  const n = Math.round(val);
  return n > 0 && n < 20000 ? n : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mediaId = Number(body?.mediaId);
    const title = String(body?.title ?? "").trim().slice(0, 180);
    const romajiTitle = String(body?.romajiTitle ?? "").trim().slice(0, 180);
    const sourceType = body?.sourceType ? String(body.sourceType).trim() : null;
    const sourceTitle = body?.sourceTitle ? String(body.sourceTitle).trim().slice(0, 180) : null;
    const sourceCountry = body?.sourceCountry ? String(body.sourceCountry).trim() : null;
    const sourceFormat = body?.sourceFormat ? String(body.sourceFormat).trim() : null;
    const episodes = typeof body?.episodes === "number" ? body.episodes : null;
    const status = body?.status ? String(body.status).trim() : null;
    const seasonYear = typeof body?.seasonYear === "number" ? body.seasonYear : null;
    const lang = normalizeContentLanguage(body?.language);

    if (!Number.isFinite(mediaId) || mediaId <= 0 || !title) {
      return NextResponse.json({ error: "Invalid anime metadata" }, { status: 400 });
    }

    // Tier 1: Instant 0ms verified database lookup
    const curated = getCuratedMangaContinuation(mediaId, lang);
    if (curated) {
      return NextResponse.json({ data: curated, source: "verified" });
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
    if (status === "NOT_YET_RELEASED") {
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
      };
      return NextResponse.json({ data: unreleased, source: "unreleased" });
    }

    const cacheKey = `${mediaId}:${lang}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json({ data: cached, source: "cache" });
    }

    const apiKey = sanitizeApiKey(process.env.GEMINI_API_KEY);
    if (!apiKey) {
      return NextResponse.json({ data: null, source: "unavailable" });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = `You are a precise anime-to-manga/manhwa/light-novel adaptation guide (like MangaUpdates / Where Does the Anime End).
Given this exact anime season/entry:
- Title: "${title}"${romajiTitle && romajiTitle !== title ? ` (Romaji: "${romajiTitle}")` : ""}
- Year: ${seasonYear ?? "unknown"}
- Episodes: ${episodes ?? "unknown"}
- Airing Status: ${status ?? "unknown"}
- Source Medium: ${detectedKind}${sourceTitle ? ` ("${sourceTitle}")` : ""}

Return ONLY valid JSON matching this exact schema:
{
  "endedAtChapter": number | null,
  "continueAtChapter": number | null,
  "endedAtVolume": number | null,
  "continueAtVolume": number | null,
  "coveredRange": string | null,
  "adaptedArc": string | null,
  "isFullyAdapted": boolean,
  "isOngoingAdaptation": boolean,
  "confidence": "high" | "medium" | "low",
  "note": string | null
}

Strict rules:
1. Give the exact chapter/volume where THIS SPECIFIC anime season stops and the chapter/volume where readers should continue in the ${detectedKind}.
2. If the anime adapts the entire source completely to the final chapter, set "isFullyAdapted": true and "continueAtChapter": null.
3. If this is a Light Novel adaptation where chapters aren't numbered continuously, use "endedAtVolume" and "continueAtVolume" (and "coveredRange" like "Vol. 1 – 3") and set chapter numbers to null unless a manga adaptation has clear chapters.
4. NEVER fabricate numbers if you are unsure. If you don't reliably know where this specific anime stops, set "confidence": "low" and set numbers to null.
5. Write "note" as ONE short helpful sentence (max 150 chars) in ${LANGUAGE_NAMES[lang]} (e.g., skipped chapters or best restart tip), or null if nothing special.`;

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

    const endedAtChapter = toPositiveIntOrNull(parsed.endedAtChapter);
    const continueAtChapter =
      Boolean(parsed.isFullyAdapted)
        ? null
        : toPositiveIntOrNull(parsed.continueAtChapter) ??
          (endedAtChapter !== null ? endedAtChapter + 1 : null);
    const endedAtVolume = toPositiveIntOrNull(parsed.endedAtVolume);
    const continueAtVolume =
      Boolean(parsed.isFullyAdapted)
        ? null
        : toPositiveIntOrNull(parsed.continueAtVolume);

    const data: MangaContinuationInfo = {
      sourceKind: detectedKind,
      endedAtChapter: confidence === "low" ? null : endedAtChapter,
      continueAtChapter: confidence === "low" ? null : continueAtChapter,
      endedAtVolume: confidence === "low" ? null : endedAtVolume,
      continueAtVolume: confidence === "low" ? null : continueAtVolume,
      coveredRange:
        confidence !== "low" && typeof parsed.coveredRange === "string" && parsed.coveredRange.trim()
          ? parsed.coveredRange.trim().slice(0, 60)
          : null,
      adaptedArc:
        typeof parsed.adaptedArc === "string" && parsed.adaptedArc.trim()
          ? parsed.adaptedArc.trim().slice(0, 80)
          : null,
      isFullyAdapted: Boolean(parsed.isFullyAdapted),
      isOngoingAdaptation: Boolean(parsed.isOngoingAdaptation) || status === "RELEASING",
      verified: false,
      confidence,
      note:
        typeof parsed.note === "string" && parsed.note.trim()
          ? parsed.note.trim().slice(0, 220)
          : null,
    };

    if (confidence !== "low") {
      setCached(cacheKey, data);
    }

    return NextResponse.json({ data, source: "gemini" });
  } catch (err) {
    console.error("[api/manga-continuation] Error:", err);
    return NextResponse.json({ data: null, source: "error" }, { status: 200 });
  }
}
