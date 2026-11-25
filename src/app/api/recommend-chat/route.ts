import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  readAccountDb,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/server/auth-store";
import { getAniListConnection } from "@/lib/server/anilist-oauth";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/server/rate-limit";
import { getSeedData } from "@/lib/anilist";
import { normalizeStreamingLinks } from "@/lib/streaming";
import {
  buildShioriSystemPrompt,
  buildUserTasteSummary,
  extractAiRecommendationsBlock,
  filterUnseenResolvedRecommendations,
  inferGenresFromPrompt,
  isMediaAlreadySeen,
  stripRecommendationsMarkerForDisplay,
  type AiRawRecommendation,
  type AiResolvedRecommendation,
  type TasteLibraryEntry,
} from "@/lib/ai-recommend";
import type { LibraryStatus, MediaItem, MediaType } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
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

function redactSecret(text: string, secret: string): string {
  if (!secret || !text) return text;
  return text.split(secret).join("[REDACTED]");
}

/**
 * Ensures multi-turn conversation history strictly satisfies Gemini's role rules:
 * - Never starts with a "model" turn
 * - Strictly alternates "user" / "model" (merging consecutive same-role messages)
 */
function buildNormalizedGeminiContents(
  messages: ChatHistoryMessage[]
): { role: "user" | "model"; parts: { text: string }[] }[] {
  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const m of messages) {
    const role: "user" | "model" = m.role === "assistant" ? "model" : "user";
    if (contents.length === 0 && role === "model") {
      continue;
    }
    const prev = contents[contents.length - 1];
    if (prev && prev.role === role) {
      prev.parts[0].text = `${prev.parts[0].text}\n\n${m.content}`;
    } else {
      contents.push({ role, parts: [{ text: m.content }] });
    }
  }
  return contents;
}

type GeminiDiagnostic = {
  status: number | null;
  shortReason: string;
  rawMessage: string;
  isFatalKeyError: boolean;
  priority: number;
};

function classifyGeminiError(
  err: unknown,
  apiKey: string,
  attemptedModels: string[]
): GeminiDiagnostic {
  const status =
    typeof (err as { status?: unknown })?.status === "number"
      ? ((err as { status: number }).status)
      : null;
  const raw = redactSecret(
    err instanceof Error ? err.message : String(err ?? "Erreur inconnue"),
    apiKey
  );
  const lower = raw.toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    /api_key_invalid|api key not valid|permission_denied|unauthenticated/i.test(lower)
  ) {
    return {
      status,
      shortReason: "Clé API Gemini invalide ou refusée (vérifiez `GEMINI_API_KEY` dans `.env.local` / Vercel)",
      rawMessage: raw,
      isFatalKeyError: true,
      priority: 100,
    };
  }

  if (status === 429 || /resource_exhausted|quota|rate limit/i.test(lower)) {
    return {
      status,
      shortReason: "Quota Gemini dépassé (limite de requêtes atteinte sur cette clé API)",
      rawMessage: raw,
      isFatalKeyError: false,
      priority: 80,
    };
  }

  if (status === 503 || /high demand|overloaded|service unavailable/i.test(lower)) {
    return {
      status,
      shortReason: "Serveurs Google Gemini momentanément surchargés (503)",
      rawMessage: raw,
      isFatalKeyError: false,
      priority: 70,
    };
  }

  if (status === 400 || /failed_precondition|location is not supported|invalid_argument/i.test(lower)) {
    const snippet = raw.replace(/^\[GoogleGenerativeAI Error\]:\s*/i, "").slice(0, 140);
    return {
      status,
      shortReason: `Requête refusée par Gemini (${snippet})`,
      rawMessage: raw,
      isFatalKeyError: false,
      priority: 60,
    };
  }

  if (/fetch failed|enotfound|econnrefused|etimedout|aborted|network/i.test(lower)) {
    return {
      status,
      shortReason: "Erreur réseau lors de la connexion à Google Gemini",
      rawMessage: raw,
      isFatalKeyError: false,
      priority: 50,
    };
  }

  if (status === 404 || /not_found|is not found|no longer available/i.test(lower)) {
    return {
      status,
      shortReason: `Modèle Gemini indisponible (${attemptedModels.join(", ")})`,
      rawMessage: raw,
      isFatalKeyError: false,
      priority: 20,
    };
  }

  const concise = raw.replace(/^\[GoogleGenerativeAI Error\]:\s*/i, "").slice(0, 140);
  return {
    status,
    shortReason: status ? `Erreur Gemini HTTP ${status} (${concise})` : `Erreur Gemini (${concise})`,
    rawMessage: raw,
    isFatalKeyError: false,
    priority: 40,
  };
}

function selectPrimaryDiagnostic(diagnostics: GeminiDiagnostic[]): GeminiDiagnostic {
  return [...diagnostics].sort((a, b) => b.priority - a.priority)[0];
}

const CHAT_MEDIA_FIELDS = `
  id
  type
  title { romaji english native }
  coverImage { extraLarge large color }
  bannerImage
  description(asHtml: false)
  format
  status
  episodes
  chapters
  volumes
  duration
  season
  seasonYear
  startDate { year month day }
  averageScore
  meanScore
  popularity
  favourites
  genres
  studios(isMain: true) { nodes { name } }
  trailer { id site }
  nextAiringEpisode { airingAt timeUntilAiring episode }
  externalLinks { id url site type icon color language notes isDisabled }
`;

interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeAniListItem(raw: any): MediaItem {
  return {
    id: Number(raw.id),
    type: (raw.type === "MANGA" ? "MANGA" : "ANIME") as MediaType,
    title: {
      romaji: raw.title?.romaji ?? "Sans titre",
      english: raw.title?.english ?? null,
      native: raw.title?.native ?? null,
    },
    coverImage: {
      extraLarge: raw.coverImage?.extraLarge ?? raw.coverImage?.large ?? "",
      large: raw.coverImage?.large ?? raw.coverImage?.extraLarge ?? "",
      color: raw.coverImage?.color ?? null,
    },
    bannerImage: raw.bannerImage ?? null,
    description: raw.description ?? null,
    format: raw.format ?? null,
    status: raw.status ?? null,
    episodes: raw.episodes ?? null,
    chapters: raw.chapters ?? null,
    volumes: raw.volumes ?? null,
    duration: raw.duration ?? null,
    season: raw.season ?? null,
    seasonYear: raw.seasonYear ?? null,
    startYear: raw.startDate?.year ?? raw.seasonYear ?? null,
    startDate: raw.startDate ?? null,
    averageScore: raw.averageScore ?? null,
    meanScore: raw.meanScore ?? null,
    popularity: raw.popularity ?? null,
    favourites: raw.favourites ?? null,
    genres: Array.isArray(raw.genres) ? raw.genres : [],
    studio: raw.studios?.nodes?.[0]?.name ?? null,
    trailer: raw.trailer ?? null,
    nextAiringEpisode: raw.nextAiringEpisode ?? null,
    streamingLinks: normalizeStreamingLinks(raw.externalLinks, undefined, {
      title: raw.title?.english || raw.title?.romaji || null,
    }),
  };
}

function normalizeStatus(raw: unknown): LibraryStatus {
  const s = String(raw ?? "").toUpperCase();
  if (s === "WATCHING" || s === "CURRENT" || s === "REPEATING") return "WATCHING";
  if (s === "COMPLETED") return "COMPLETED";
  if (s === "ON_HOLD" || s === "PAUSED") return "ON_HOLD";
  if (s === "DROPPED") return "DROPPED";
  return "PLAN_TO_WATCH";
}

function sanitizeClientLibrary(raw: unknown): TasteLibraryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: TasteLibraryEntry[] = [];
  for (const item of raw.slice(0, 300)) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const mediaId = Number(obj.mediaId);
    const title = typeof obj.title === "string" ? obj.title.trim().slice(0, 140) : "";
    if (!Number.isInteger(mediaId) || mediaId <= 0 || !title) continue;

    const rawScore =
      typeof obj.score === "number" && Number.isFinite(obj.score)
        ? Math.max(0, Math.min(10, obj.score))
        : null;
    const genres = Array.isArray(obj.genres)
      ? obj.genres
          .filter((g): g is string => typeof g === "string" && g.trim().length > 0)
          .slice(0, 6)
      : [];

    out.push({
      mediaId,
      type: obj.type === "MANGA" ? "MANGA" : "ANIME",
      title,
      status: normalizeStatus(obj.status),
      score: rawScore,
      isFavorite: Boolean(obj.isFavorite),
      genres,
    });
  }
  return out;
}

async function fetchServerUserLibraryContext(clientFallback: TasteLibraryEntry[]): Promise<{
  entries: TasteLibraryEntry[];
  displayName: string | null;
  source: "supabase" | "anilist" | "account" | "local" | "discovery";
}> {
  const merged = new Map<number, TasteLibraryEntry>();
  let displayName: string | null = null;
  let source: "supabase" | "anilist" | "account" | "local" | "discovery" = "discovery";

  // 1. Authenticated Supabase user library & profile
  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const [profileRes, libRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("display_name, username")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("library_entries")
            .select("media_id, media_type, title, status, score, is_favorite, genres")
            .eq("user_id", user.id)
            .limit(400),
        ]);

        if (profileRes.data) {
          displayName =
            profileRes.data.display_name || profileRes.data.username || null;
        }

        if (!libRes.error && Array.isArray(libRes.data) && libRes.data.length > 0) {
          source = "supabase";
          for (const row of libRes.data) {
            const mediaId = Number(row.media_id);
            if (!Number.isInteger(mediaId) || mediaId <= 0) continue;
            merged.set(mediaId, {
              mediaId,
              type: row.media_type === "MANGA" ? "MANGA" : "ANIME",
              title: String(row.title ?? "Sans titre"),
              status: normalizeStatus(row.status),
              score: typeof row.score === "number" ? row.score : null,
              isFavorite: Boolean(row.is_favorite),
              genres: Array.isArray(row.genres) ? row.genres.map(String) : [],
            });
          }
        }
      }
    }
  } catch {
    // non-fatal, continue checking server account / AniList
  }

  // 2. Built-in Shiori server account store
  if (merged.size === 0) {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      const uid = verifySessionToken(token);
      if (uid) {
        const db = readAccountDb();
        const acct = db.users.find((u) => u.id === uid);
        if (acct) {
          displayName = displayName || acct.displayName || acct.username;
          if (Array.isArray(acct.library) && acct.library.length > 0) {
            source = "account";
            for (const entry of acct.library.slice(0, 400)) {
              merged.set(entry.mediaId, {
                mediaId: entry.mediaId,
                type: entry.type,
                title: entry.title,
                status: entry.status,
                score: entry.score,
                isFavorite: entry.isFavorite,
                genres: entry.genres ?? [],
              });
            }
          }
        }
      }
    } catch {
      // non-fatal
    }
  }

  // 3. Connected AniList OAuth user — enrich/load directly from AniList server-side
  try {
    const anilistConn = await getAniListConnection();
    if (anilistConn && anilistConn.userId > 0) {
      displayName = displayName || anilistConn.username;
      const query = `
        query ($userId: Int!) {
          MediaListCollection(userId: $userId, type: ANIME) {
            lists {
              entries {
                status
                score(format: POINT_10_DECIMAL)
                media {
                  id
                  title { romaji english }
                  genres
                }
              }
            }
          }
          User(id: $userId) {
            favourites {
              anime(perPage: 25) {
                nodes {
                  id
                  title { romaji english }
                  genres
                }
              }
            }
          }
        }
      `;

      const res = await fetch(ANILIST_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${anilistConn.accessToken}`,
        },
        body: JSON.stringify({ query, variables: { userId: anilistConn.userId } }),
        signal: AbortSignal.timeout(5500),
        cache: "no-store",
      });

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        const favIds = new Set<number>();
        const favNodes = json?.data?.User?.favourites?.anime?.nodes ?? [];
        for (const node of favNodes) {
          if (node?.id) favIds.add(Number(node.id));
        }

        const lists = json?.data?.MediaListCollection?.lists ?? [];
        let addedFromAniList = 0;
        for (const list of lists) {
          for (const entry of list?.entries ?? []) {
            const media = entry?.media;
            if (!media?.id) continue;
            const mediaId = Number(media.id);
            const title = media.title?.english || media.title?.romaji || "Sans titre";
            const score =
              typeof entry.score === "number" && entry.score > 0 ? entry.score : null;
            const isFav = favIds.has(mediaId);
            const existing = merged.get(mediaId);
            if (!existing) {
              merged.set(mediaId, {
                mediaId,
                type: "ANIME",
                title,
                status: normalizeStatus(entry.status),
                score,
                isFavorite: isFav,
                genres: Array.isArray(media.genres) ? media.genres : [],
              });
              addedFromAniList++;
            } else if (isFav && !existing.isFavorite) {
              existing.isFavorite = true;
            }
          }
        }

        if (addedFromAniList > 0 && source === "discovery") {
          source = "anilist";
        }
      }
    }
  } catch {
    // AniList OAuth fetch is best-effort
  }

  // 4. Guest / local browser library fallback when not signed in
  if (merged.size === 0 && clientFallback.length > 0) {
    source = "local";
    for (const item of clientFallback) {
      merged.set(item.mediaId, item);
    }
  }

  return {
    entries: Array.from(merged.values()),
    displayName,
    source,
  };
}

/**
 * Resolves Gemini's recommended titles into real clickable AniList MediaItems
 * in a single compact GraphQL batch query, strictly filtering out already-seen anime.
 */
async function resolveTitlesOnAniList(
  rawRecs: AiRawRecommendation[],
  seenIds: Set<number>,
  seenNormalizedTitles: Set<string>
): Promise<AiResolvedRecommendation[]> {
  if (rawRecs.length === 0) return [];
  const subset = rawRecs.slice(0, 5);

  const varDefs = subset.map((_, idx) => `$q${idx}: String`).join(", ");
  const aliases = subset
    .map(
      (_, idx) => `
      r${idx}: Page(page: 1, perPage: 3) {
        media(search: $q${idx}, type: ANIME, isAdult: false, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
          ${CHAT_MEDIA_FIELDS}
        }
      }`
    )
    .join("\n");

  const variables: Record<string, string> = {};
  subset.forEach((rec, idx) => {
    variables[`q${idx}`] = rec.title;
  });

  try {
    const res = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: `query (${varDefs}) { ${aliases} }`,
        variables,
      }),
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });

    if (!res.ok) return [];
    const json = await res.json().catch(() => ({}));
    const data = json?.data ?? {};

    const resolved: AiResolvedRecommendation[] = [];
    subset.forEach((rec, idx) => {
      const candidates = Array.isArray(data[`r${idx}`]?.media) ? data[`r${idx}`].media : [];
      for (const raw of candidates) {
        if (!raw?.id) continue;
        const normalized = normalizeAniListItem(raw);
        if (!isMediaAlreadySeen(normalized, seenIds, seenNormalizedTitles)) {
          resolved.push({
            media: normalized,
            reason: rec.reason,
            matchTag: rec.matchTag || normalized.genres[0],
          });
          break;
        }
      }
    });

    return filterUnseenResolvedRecommendations(resolved, seenIds, seenNormalizedTitles);
  } catch {
    return [];
  }
}

/**
 * Taste-matched unseen AniList discovery used cleanly when GEMINI_API_KEY
 * is not configured yet or Gemini is temporarily unavailable.
 */
async function fetchFallbackUnseenRecommendations(
  userPrompt: string,
  topGenres: string[],
  seenIds: Set<number>,
  seenNormalizedTitles: Set<string>
): Promise<{ genresUsed: string[]; items: AiResolvedRecommendation[] }> {
  const genresUsed = inferGenresFromPrompt(userPrompt, topGenres);
  const wantsShort = /\b(court|courte|short|12|13|rapide|binge|weekend)\b/i.test(userPrompt);

  try {
    const query = `
      query ($genres: [String], $maxEp: Int) {
        Page(page: 1, perPage: 20) {
          media(
            type: ANIME
            genre_in: $genres
            episodes_lesser: $maxEp
            sort: [SCORE_DESC, POPULARITY_DESC]
            averageScore_greater: 76
            isAdult: false
          ) {
            ${CHAT_MEDIA_FIELDS}
          }
        }
      }
    `;

    const res = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          genres: genresUsed,
          maxEp: wantsShort ? 15 : undefined,
        },
      }),
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });

    const out: AiResolvedRecommendation[] = [];
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      const mediaList = json?.data?.Page?.media ?? [];
      for (const raw of mediaList) {
        if (out.length >= 4) break;
        const media = normalizeAniListItem(raw);
        if (isMediaAlreadySeen(media, seenIds, seenNormalizedTitles)) continue;
        const shared = media.genres.filter((g) => genresUsed.includes(g));
        const tag = shared[0] || media.genres[0] || "Sélection";
        out.push({
          media,
          reason: `Correspond à votre demande (${tag}${media.averageScore ? ` · ${(media.averageScore / 10).toFixed(1)}/10` : ""}) et absent de votre liste.`,
          matchTag: tag,
        });
      }
    }

    if (out.length < 3) {
      const seed = getSeedData();
      for (const media of [...seed.topAnime, ...seed.trending]) {
        if (out.length >= 4) break;
        if (isMediaAlreadySeen(media, seenIds, seenNormalizedTitles)) continue;
        if (out.some((x) => x.media.id === media.id)) continue;
        const tag = media.genres[0] || "Incontournable";
        out.push({
          media,
          reason: `Incontournable ${tag} qui ne figure pas encore dans votre liste.`,
          matchTag: tag,
        });
      }
    }

    return {
      genresUsed,
      items: filterUnseenResolvedRecommendations(out, seenIds, seenNormalizedTitles),
    };
  } catch {
    const seed = getSeedData();
    const items = seed.topAnime
      .filter((m) => !isMediaAlreadySeen(m, seenIds, seenNormalizedTitles))
      .slice(0, 4)
      .map((media) => ({
        media,
        reason: `Pépite ${media.genres[0] || "acclamée"} non encore vue.`,
        matchTag: media.genres[0] || "Sélection",
      }));
    return { genresUsed, items };
  }
}

function encodeSseEvent(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`recommend-chat:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    return rateLimitResponse(rl.retryAfterSec);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide." }, { status: 400 });
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const messages: ChatHistoryMessage[] = rawMessages
    .filter(
      (m): m is ChatHistoryMessage =>
        Boolean(m) &&
        typeof m === "object" &&
        ((m as { role?: unknown }).role === "user" ||
          (m as { role?: unknown }).role === "assistant") &&
        typeof (m as { content?: unknown }).content === "string" &&
        (m as { content: string }).content.trim().length > 0
    )
    .slice(-10)
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, 1200),
    }));

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) {
    return NextResponse.json(
      { ok: false, error: "Veuillez saisir une question ou une envie d'anime." },
      { status: 400 }
    );
  }

  const clientLibrary = sanitizeClientLibrary(body.clientLibrary);
  const preferredLang =
    typeof body.language === "string" ? body.language.trim().toLowerCase() : "fr";
  const { entries, displayName, source } = await fetchServerUserLibraryContext(clientLibrary);
  const tasteSummary = buildUserTasteSummary(entries);
  const systemPrompt = buildShioriSystemPrompt(tasteSummary, displayName, preferredLang);
  const geminiKey = sanitizeApiKey(process.env.GEMINI_API_KEY);
  const candidateModels = getGeminiModelCandidates();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        try {
          controller.enqueue(encodeSseEvent(event, payload));
        } catch {
          // stream closed by client
        }
      };

      send("meta", {
        source,
        totalSeen: tasteSummary.seenIds.size,
        favoritesCount: tasteSummary.favorites.length,
        topGenres: tasteSummary.topGenres.slice(0, 4),
        geminiConfigured: Boolean(geminiKey),
      });

      const streamTextSmoothly = async (text: string) => {
        const words = text.split(/(\s+)/);
        let acc = "";
        for (let i = 0; i < words.length; i++) {
          acc += words[i];
          if (i % 6 === 5 || i === words.length - 1) {
            send("delta", { text: acc });
            acc = "";
            await new Promise((r) => setTimeout(r, 12));
          }
        }
      };

      const runFallbackReply = async (notice?: string) => {
        const { genresUsed, items } = await fetchFallbackUnseenRecommendations(
          lastUserMsg.content,
          tasteSummary.topGenres,
          tasteSummary.seenIds,
          tasteSummary.seenNormalizedTitles
        );

        const introParts: string[] = [];
        if (notice) {
          introParts.push(notice);
        }
        const titlesList = items
          .map(
            (r, i) =>
              `${i + 1}. **${r.media.title.english || r.media.title.romaji}** — ${r.reason}`
          )
          .join("\n");

        const fallbackText = [
          ...introParts,
          `Voici ${items.length} animés **non vus** sélectionnés d'après votre profil (${genresUsed.join(" · ")}) et votre demande :`,
          "",
          titlesList,
          "",
          "Cliquez sur une affiche ci-dessous pour ouvrir sa fiche complète ou l'ajouter en 1 clic à votre liste.",
        ].join("\n");

        await streamTextSmoothly(fallbackText);

        if (items.length > 0) {
          send("recommendations", { items });
        }
        send("done", { fallback: true });
      };

      if (!geminiKey) {
        await runFallbackReply(
          "💡 *Mode sélection intelligente AniList actif* — ajoutez `GEMINI_API_KEY` dans `.env.local` pour activer les réponses conversationnelles complètes de Google Gemini.\n"
        );
        controller.close();
        return;
      }

      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const contents = buildNormalizedGeminiContents(messages);

        let fullRawText = "";
        let usedModel: string | null = null;
        const attemptedModels: string[] = [];
        const diagnostics: GeminiDiagnostic[] = [];

        const tryModel = async (modelName: string): Promise<boolean> => {
          attemptedModels.push(modelName);
          try {
            const model = genAI.getGenerativeModel({
              model: modelName,
              systemInstruction: systemPrompt,
              generationConfig: {
                temperature: 0.78,
                maxOutputTokens: 2048,
              },
            });

            const result = await model.generateContent({ contents });
            const text = result.response.text();
            if (text && text.trim().length > 0) {
              fullRawText = text;
              usedModel = modelName;
              return true;
            }
            throw new Error(`Réponse vide renvoyée par ${modelName}`);
          } catch (err) {
            const diag = classifyGeminiError(err, geminiKey, attemptedModels);
            diagnostics.push(diag);
            console.error("[/api/recommend-chat] Échec appel Gemini :", {
              model: modelName,
              status: diag.status,
              reason: diag.shortReason,
              detail: diag.rawMessage,
            });
            return false;
          }
        };

        // Use generateContent() (complete UTF-8 JSON) to avoid @google/generative-ai@0.24.1's
        // SSE multi-byte chunk parser crashes on French text, then stream cleanly to the client.
        for (const modelName of candidateModels) {
          const ok = await tryModel(modelName);
          if (ok) break;
          if (diagnostics[diagnostics.length - 1]?.isFatalKeyError) {
            // No point trying other models if the API key itself is rejected
            break;
          }
        }

        // Single brief retry on the primary model if failures were transient 503 spikes
        if (
          !fullRawText &&
          candidateModels.length > 0 &&
          diagnostics.some((d) => d.status === 503) &&
          !diagnostics.some((d) => d.isFatalKeyError)
        ) {
          await new Promise((r) => setTimeout(r, 600));
          await tryModel(candidateModels[0]);
        }

        if (!fullRawText) {
          const primaryDiag =
            diagnostics.length > 0
              ? selectPrimaryDiagnostic(diagnostics)
              : classifyGeminiError(new Error("Aucune réponse Gemini"), geminiKey, attemptedModels);
          await runFallbackReply(
            `⚠️ *Gemini indisponible — ${primaryDiag.shortReason}.* Voici tout de même des suggestions basées sur votre profil AniList :\n`
          );
          controller.close();
          return;
        }

        const { cleanText, recommendations } = extractAiRecommendationsBlock(fullRawText);
        const safeText = stripRecommendationsMarkerForDisplay(cleanText || fullRawText);

        // Resolve AniList clickable posters in parallel while streaming prose smoothly to the UI
        const resolvePromise =
          recommendations.length > 0
            ? resolveTitlesOnAniList(
                recommendations,
                tasteSummary.seenIds,
                tasteSummary.seenNormalizedTitles
              )
            : Promise.resolve([]);

        const [, resolved] = await Promise.all([
          streamTextSmoothly(safeText),
          resolvePromise,
        ]);

        if (resolved.length > 0) {
          send("recommendations", { items: resolved });
        }

        send("done", { fallback: false, model: usedModel });
        controller.close();
      } catch (err) {
        const diag = classifyGeminiError(err, geminiKey, candidateModels);
        console.error("[/api/recommend-chat] Erreur inattendue Gemini :", {
          status: diag.status,
          reason: diag.shortReason,
          detail: diag.rawMessage,
        });
        await runFallbackReply(
          `⚠️ *Gemini indisponible — ${diag.shortReason}.* Voici tout de même des recommandations non vues basées sur vos goûts :\n`
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
