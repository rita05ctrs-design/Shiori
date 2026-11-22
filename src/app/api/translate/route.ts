import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  decodeHtmlEntities,
  normalizeContentLanguage,
  sanitizeSynopsisHtml,
} from "@/lib/i18n";
import type { ContentLanguage } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MEMORY_ENTRIES = 1500;
const CHUNK_LIMIT = 1400;

const globalCache = globalThis as unknown as {
  __shioriTranslationCache?: Map<string, string>;
};

function getMemoryCache(): Map<string, string> {
  if (!globalCache.__shioriTranslationCache) {
    globalCache.__shioriTranslationCache = new Map<string, string>();
  }
  return globalCache.__shioriTranslationCache;
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
 * Splits a long synopsis along paragraph / sentence boundaries so Google Translate
 * never truncates text due to URL length limits.
 */
function splitIntoChunks(text: string, maxLen = CHUNK_LIMIT): string[] {
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
      // Split oversized paragraph by sentence boundary
      const sentences = para.match(/[^.!?]+[.!?]*\s*/g) ?? [para];
      let buf = "";
      for (const s of sentences) {
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
  return chunks;
}

/**
 * Calls Google Translate's free endpoint for a single chunk while preserving
 * basic formatting tags (`<br>`, `<i>`, `<b>`).
 */
async function translateChunk(
  chunk: string,
  targetLang: Exclude<ContentLanguage, "en">
): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(
    targetLang
  )}&dt=t&q=${encodeURIComponent(chunk)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Shiori/1.0)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(6500),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Translate HTTP ${res.status}`);
  }

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error("Invalid translate payload");
  }

  const parts: string[] = [];
  for (const seg of data[0] as unknown[]) {
    if (Array.isArray(seg) && typeof seg[0] === "string") {
      parts.push(seg[0]);
    }
  }

  const joined = parts.join("");
  if (!joined.trim()) {
    throw new Error("Empty translation");
  }
  return joined;
}

/**
 * Translates an AniList HTML synopsis from English to the requested target language
 * while keeping `<br>`, `<i>`, `<b>`, `<em>`, `<strong>` cleanly intact.
 */
async function translateSynopsisOnTheFly(
  rawHtml: string,
  targetLang: Exclude<ContentLanguage, "en">
): Promise<string> {
  // Normalize <br> -> newline and decode HTML entities while keeping <i>/<b> tags intact
  const prepared = decodeHtmlEntities(
    rawHtml
      .replace(/\r\n/g, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\s*(\/?)\s*(i|b|em|strong)\s*>/gi, "<$1$2>")
      .replace(/<(?!\/?(?:i|b|em|strong)>)[^>]+>/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );

  if (!prepared) return "";

  const chunks = splitIntoChunks(prepared, CHUNK_LIMIT);
  const translatedChunks: string[] = [];

  for (const chunk of chunks) {
    const out = await translateChunk(chunk, targetLang);
    translatedChunks.push(out);
  }

  // Re-join chunks, fix any spaces Google inserted inside tags (e.g. "< / i >"), and sanitize
  const merged = translatedChunks
    .join("\n\n")
    .replace(/<\s*(\/?)\s*(i|b|em|strong)\s*>/gi, "<$1$2>");

  return sanitizeSynopsisHtml(merged);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawText = typeof body?.text === "string" ? body.text.trim() : "";
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
    if (memHit) {
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
    if (supabase && mediaId > 0) {
      try {
        const { data: cachedRow, error } = await supabase
          .from("media_translations")
          .select("translated_description")
          .eq("media_id", mediaId)
          .eq("lang", targetLang)
          .maybeSingle();

        if (!error && cachedRow?.translated_description) {
          const cleanCached = sanitizeSynopsisHtml(String(cachedRow.translated_description));
          const seemsStaleShort =
            sanitizedOriginal.length > 260 &&
            cleanCached.length < sanitizedOriginal.length * 0.35;
          if (cleanCached && !seemsStaleShort) {
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

    // 3) On-the-fly translation via Google Translate free endpoint
    let translatedHtml: string;
    try {
      translatedHtml = await translateSynopsisOnTheFly(rawText, targetLang);
    } catch {
      // Fallback safely to original English text if upstream is unavailable
      return NextResponse.json({
        ok: true,
        translatedText: sanitizedOriginal,
        translated: false,
        cached: false,
        fallback: true,
        lang: "en",
      });
    }

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

    // 4) Persist to in-memory cache + Supabase `public.media_translations` for future visitors
    setMemoryCache(cacheKey, translatedHtml);

    if (supabase && mediaId > 0) {
      try {
        await supabase.from("media_translations").upsert(
          {
            media_id: mediaId,
            lang: targetLang,
            translated_description: translatedHtml,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "media_id,lang" }
        );
      } catch {
        // non-fatal if table hasn't been created in Supabase yet
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
