import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  decodeHtmlEntities,
  normalizeContentLanguage,
  sanitizeSynopsisHtml,
  synopsisHtmlToPlainText,
} from "@/lib/i18n";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/server/rate-limit";
import type { ContentLanguage } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MEMORY_ENTRIES = 1500;
const GOOGLE_CHUNK_LIMIT = 1400;
const MYMEMORY_CHUNK_LIMIT = 450;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const globalCache = globalThis as unknown as {
  __shioriTranslationCache?: Map<string, string>;
  __shioriTranslationInFlight?: Map<string, Promise<string | null>>;
};

function getMemoryCache(): Map<string, string> {
  if (!globalCache.__shioriTranslationCache) {
    globalCache.__shioriTranslationCache = new Map<string, string>();
  }
  return globalCache.__shioriTranslationCache;
}

function getInFlightMap(): Map<string, Promise<string | null>> {
  if (!globalCache.__shioriTranslationInFlight) {
    globalCache.__shioriTranslationInFlight = new Map<string, Promise<string | null>>();
  }
  return globalCache.__shioriTranslationInFlight;
}

function setMemoryCache(key: string, value: string) {
  const cache = getMemoryCache();
  if (cache.size >= MAX_MEMORY_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, value);
}

/**
 * Splits a long synopsis along paragraph / sentence boundaries cleanly.
 */
function splitIntoChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (para.length > maxLen) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      const sentences = para.match(/[^.!?]+[.!?]*\s*/g) ?? [para];
      let buf = "";
      for (const s of sentences) {
        if (s.length > maxLen) {
          if (buf.trim()) {
            chunks.push(buf.trim());
            buf = "";
          }
          for (let i = 0; i < s.length; i += maxLen) {
            chunks.push(s.slice(i, i + maxLen).trim());
          }
          continue;
        }
        if ((buf + s).length > maxLen && buf) {
          chunks.push(buf.trim());
          buf = s;
        } else {
          buf += s;
        }
      }
      if (buf.trim()) chunks.push(buf.trim());
      continue;
    }

    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length > maxLen) {
      chunks.push(current);
      current = para;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks.filter(Boolean);
}

function normalizeForComparison(text: string): string {
  return synopsisHtmlToPlainText(text).toLowerCase().replace(/\s+/g, " ").trim();
}

function isValidTranslation(originalHtml: string, translatedHtml: string): boolean {
  const cleanTranslated = normalizeForComparison(translatedHtml);
  if (!cleanTranslated) return false;
  if (
    cleanTranslated.includes("mymemory warning") ||
    cleanTranslated.includes("query length limit") ||
    cleanTranslated.includes("please select two distinct languages")
  ) {
    return false;
  }
  const cleanOriginal = normalizeForComparison(originalHtml);
  if (cleanOriginal.length >= 45 && cleanTranslated === cleanOriginal) {
    return false;
  }
  if (cleanOriginal.length > 260 && cleanTranslated.length < cleanOriginal.length * 0.3) {
    return false;
  }
  return true;
}

/**
 * Provider 1: Google Translate `gtx` via POST (avoids URL length HTTP 414 errors).
 */
async function translateChunkGoogleGtx(
  chunk: string,
  targetLang: Exclude<ContentLanguage, "en">
): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(
    targetLang
  )}&dt=t`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": BROWSER_UA,
      Accept: "application/json",
    },
    body: new URLSearchParams({ q: chunk }).toString(),
    signal: AbortSignal.timeout(6500),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`GTX HTTP ${res.status}`);
  }

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error("Invalid GTX payload");
  }

  const parts: string[] = [];
  for (const seg of data[0] as unknown[]) {
    if (Array.isArray(seg) && typeof seg[0] === "string") {
      parts.push(seg[0]);
    }
  }

  const joined = parts.join("");
  if (!joined.trim()) {
    throw new Error("Empty GTX translation");
  }
  return joined;
}

/**
 * Provider 2: Google Translate `clients5` extension endpoint via POST (independent quota pool).
 */
async function translateChunkGoogleClients5(
  chunk: string,
  targetLang: Exclude<ContentLanguage, "en">
): Promise<string> {
  const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=${encodeURIComponent(
    targetLang
  )}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": BROWSER_UA,
      Accept: "application/json",
    },
    body: new URLSearchParams({ q: chunk }).toString(),
    signal: AbortSignal.timeout(6500),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Clients5 HTTP ${res.status}`);
  }

  const data = (await res.json()) as unknown;
  if (Array.isArray(data)) {
    const parts: string[] = [];
    for (const item of data) {
      if (typeof item === "string") {
        parts.push(item);
      } else if (Array.isArray(item) && typeof item[0] === "string") {
        parts.push(item[0]);
      }
    }
    const joined = parts.join("");
    if (joined.trim()) return joined;
  }

  throw new Error("Invalid Clients5 payload");
}

/**
 * Provider 3: MyMemory Translation API (non-Google fallback, ideal for serverless cloud IPs).
 */
async function translateWithMyMemory(
  prepared: string,
  targetLang: Exclude<ContentLanguage, "en">
): Promise<string> {
  const chunks = splitIntoChunks(prepared, MYMEMORY_CHUNK_LIMIT);
  const outChunks: string[] = [];

  for (const chunk of chunks) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      chunk
    )}&langpair=${encodeURIComponent(`en|${targetLang}`)}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(6500),
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`MyMemory HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      responseStatus?: number;
      responseData?: { translatedText?: string };
    };
    const translated = data?.responseData?.translatedText;
    if (
      typeof translated !== "string" ||
      !translated.trim() ||
      (typeof data?.responseStatus === "number" && data.responseStatus >= 400)
    ) {
      throw new Error("Invalid MyMemory payload");
    }
    outChunks.push(translated);
  }

  return outChunks.join("\n\n");
}

function finalizeTranslatedHtml(merged: string): string {
  const normalizedTags = merged.replace(
    /<\s*(\/?)\s*(i|b|em|strong)\s*>/gi,
    "<$1$2>"
  );
  return sanitizeSynopsisHtml(normalizedTags);
}

/**
 * Translates an AniList HTML synopsis from English to the requested target language
 * using a 3-provider waterfall (Google GTX POST -> Google Clients5 POST -> MyMemory),
 * while keeping `<br>`, `<i>`, `<b>`, `<em>`, `<strong>` cleanly intact.
 */
async function translateSynopsisOnTheFly(
  rawHtml: string,
  sanitizedOriginal: string,
  targetLang: Exclude<ContentLanguage, "en">
): Promise<string | null> {
  const prepared = decodeHtmlEntities(
    rawHtml
      .replace(/\r\n/g, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\s*(\/?)\s*(i|b|em|strong)\s*>/gi, "<$1$2>")
      .replace(/<(?!\/?(?:i|b|em|strong)>)[^>]+>/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );

  if (!prepared) return null;

  const googleChunks = splitIntoChunks(prepared, GOOGLE_CHUNK_LIMIT);

  const providers: Array<() => Promise<string>> = [
    async () => {
      const parts: string[] = [];
      for (const chunk of googleChunks) {
        parts.push(await translateChunkGoogleGtx(chunk, targetLang));
      }
      return parts.join("\n\n");
    },
    async () => {
      const parts: string[] = [];
      for (const chunk of googleChunks) {
        parts.push(await translateChunkGoogleClients5(chunk, targetLang));
      }
      return parts.join("\n\n");
    },
    async () => translateWithMyMemory(prepared, targetLang),
  ];

  for (const runProvider of providers) {
    try {
      const merged = await runProvider();
      const finalized = finalizeTranslatedHtml(merged);
      if (isValidTranslation(sanitizedOriginal, finalized)) {
        return finalized;
      }
    } catch {
      // Try next provider in waterfall
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    // Generous ceiling so cache hits while scrolling /calendar or / never block /media/[id]
    const readLimit = checkRateLimit(`translate:read:${ip}`, 180, 60_000);
    if (!readLimit.ok) {
      return rateLimitResponse(readLimit.retryAfterSec);
    }

    const body = await request.json();
    const rawText = typeof body?.text === "string" ? body.text.trim() : "";
    if (rawText.length > 12_000) {
      return NextResponse.json(
        { ok: false, error: "Texte trop long pour la traduction (max 12 000 caractères)." },
        { status: 400 }
      );
    }
    const mediaId =
      typeof body?.mediaId === "number" && Number.isFinite(body.mediaId) && body.mediaId > 0
        ? Math.floor(body.mediaId)
        : 0;
    const targetLang = normalizeContentLanguage(body?.targetLang);

    const sanitizedOriginal = sanitizeSynopsisHtml(rawText);

    if (!sanitizedOriginal || targetLang === "en") {
      return NextResponse.json({
        ok: true,
        translatedText: sanitizedOriginal,
        translated: false,
        cached: false,
        lang: "en",
      });
    }

    const cacheKey =
      mediaId > 0
        ? `media:${mediaId}:${targetLang}:${sanitizedOriginal.length}`
        : `hash:${crypto
            .createHash("sha256")
            .update(`${targetLang}:${rawText}`)
            .digest("hex")
            .slice(0, 20)}`;

    // 1) Fast server in-memory cache
    const memHit = getMemoryCache().get(cacheKey);
    if (memHit && isValidTranslation(sanitizedOriginal, memHit)) {
      return NextResponse.json({
        ok: true,
        translatedText: memHit,
        translated: true,
        cached: true,
        lang: targetLang,
      });
    }

    // 2) Shared Supabase `public.media_translations` cache
    const supabase = await getSupabaseServerClient();
    let hadExistingDbRow = false;
    if (supabase && mediaId > 0) {
      try {
        const { data: cachedRow, error } = await supabase
          .from("media_translations")
          .select("translated_description")
          .eq("media_id", mediaId)
          .eq("lang", targetLang)
          .maybeSingle();

        if (!error && cachedRow?.translated_description) {
          hadExistingDbRow = true;
          const cleanCached = sanitizeSynopsisHtml(String(cachedRow.translated_description));
          if (isValidTranslation(sanitizedOriginal, cleanCached)) {
            setMemoryCache(cacheKey, cleanCached);
            return NextResponse.json({
              ok: true,
              translatedText: cleanCached,
              translated: true,
              cached: true,
              lang: targetLang,
            });
          }
        }
      } catch {
        // graceful fallback if table isn't migrated yet
      }
    }

    // Separate upstream quota for cache misses
    const upstreamLimit = checkRateLimit(`translate:upstream:${ip}`, 90, 60_000);
    if (!upstreamLimit.ok) {
      return rateLimitResponse(upstreamLimit.retryAfterSec);
    }

    // 3) Deduplicated on-the-fly translation across 3 providers
    const inFlight = getInFlightMap();
    let task = inFlight.get(cacheKey);
    if (!task) {
      task = translateSynopsisOnTheFly(rawText, sanitizedOriginal, targetLang).finally(() => {
        inFlight.delete(cacheKey);
      });
      inFlight.set(cacheKey, task);
    }

    const translatedHtml = await task;
    if (!translatedHtml) {
      return NextResponse.json({
        ok: true,
        translatedText: sanitizedOriginal,
        translated: false,
        cached: false,
        fallback: true,
        lang: "en",
      });
    }

    // 4) Persist to in-memory cache + Supabase `public.media_translations`
    setMemoryCache(cacheKey, translatedHtml);

    if (supabase && mediaId > 0) {
      try {
        if (!hadExistingDbRow) {
          // Insert works cleanly for both anon and authenticated under hardened RLS
          await supabase.from("media_translations").insert({
            media_id: mediaId,
            lang: targetLang,
            translated_description: translatedHtml,
            updated_at: new Date().toISOString(),
          });
        } else {
          await supabase
            .from("media_translations")
            .update({
              translated_description: translatedHtml,
              updated_at: new Date().toISOString(),
            })
            .eq("media_id", mediaId)
            .eq("lang", targetLang);
        }
      } catch {
        // non-fatal if table hasn't been created or row already exists
      }
    }

    return NextResponse.json({
      ok: true,
      translatedText: translatedHtml,
      translated: true,
      cached: false,
      lang: targetLang,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Payload de traduction invalide." },
      { status: 400 }
    );
  }
}
