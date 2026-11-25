import type { AiResolvedRecommendation } from "./ai-recommend.ts";
import type { MediaItem } from "@/types/media";

export const AI_SAVED_CHATS_STORAGE_KEY = "shiori_ai_saved_chats_v1";
export const AI_ACTIVE_CHAT_STORAGE_KEY = "shiori_ai_active_chat_v1";
export const AI_CHATS_SYNC_EVENT = "shiori-ai-chats-updated";
export const MAX_SAVED_AI_CHATS = 25;

export interface StoredAiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  recommendations?: AiResolvedRecommendation[];
}

export interface SavedAiChat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredAiMessage[];
  recommendedCount: number;
  previewCovers: string[];
}

export interface ActiveAiChatSnapshot {
  savedChatId: string | null;
  messages: StoredAiMessage[];
  updatedAt: string;
}

function compactMediaForStorage(media: MediaItem): MediaItem {
  return {
    id: media.id,
    type: media.type,
    title: {
      romaji: media.title.romaji,
      english: media.title.english,
      native: media.title.native,
    },
    coverImage: {
      extraLarge: media.coverImage.extraLarge || media.coverImage.large,
      large: media.coverImage.large || media.coverImage.extraLarge,
      color: media.coverImage.color ?? null,
    },
    bannerImage: media.bannerImage ?? null,
    description: null,
    format: media.format ?? null,
    status: media.status ?? null,
    episodes: media.episodes ?? null,
    chapters: media.chapters ?? null,
    volumes: media.volumes ?? null,
    duration: media.duration ?? null,
    season: media.season ?? null,
    seasonYear: media.seasonYear ?? null,
    startYear: media.startYear ?? null,
    averageScore: media.averageScore ?? null,
    meanScore: media.meanScore ?? null,
    popularity: media.popularity ?? null,
    favourites: media.favourites ?? null,
    genres: Array.isArray(media.genres) ? media.genres.slice(0, 5) : [],
    studio: media.studio ?? null,
    trailer: null,
    nextAiringEpisode: null,
    streamingLinks: Array.isArray(media.streamingLinks)
      ? media.streamingLinks.slice(0, 3)
      : undefined,
  };
}

export function sanitizeMessagesForStorage(
  messages: {
    id: string;
    role: "user" | "assistant";
    content: string;
    recommendations?: AiResolvedRecommendation[];
  }[]
): StoredAiMessage[] {
  return messages
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-40)
    .map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      recommendations: Array.isArray(m.recommendations)
        ? m.recommendations.slice(0, 6).map((r) => ({
            media: compactMediaForStorage(r.media),
            reason: r.reason,
            matchTag: r.matchTag,
          }))
        : undefined,
    }));
}

export function deriveAiChatTitle(messages: readonly StoredAiMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user" && m.content.trim());
  if (!firstUser) return "Conversation Shiori IA";
  const singleLine = firstUser.content.replace(/\s+/g, " ").trim();
  if (singleLine.length <= 62) return singleLine;
  return `${singleLine.slice(0, 59).trimEnd()}…`;
}

export function extractChatRecSummary(messages: readonly StoredAiMessage[]): {
  recommendedCount: number;
  previewCovers: string[];
} {
  const seenIds = new Set<number>();
  const covers: string[] = [];

  for (const msg of messages) {
    for (const rec of msg.recommendations ?? []) {
      const id = rec?.media?.id;
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      const img = rec.media.coverImage?.large || rec.media.coverImage?.extraLarge;
      if (img && covers.length < 3) {
        covers.push(img);
      }
    }
  }

  return {
    recommendedCount: seenIds.size,
    previewCovers: covers,
  };
}

export function upsertSavedAiChat(
  existing: readonly SavedAiChat[],
  input: {
    id?: string | null;
    title?: string;
    messages: StoredAiMessage[];
    nowIso?: string;
  }
): { saved: SavedAiChat; list: SavedAiChat[] } {
  const cleanMessages = sanitizeMessagesForStorage(input.messages);
  const nowIso = input.nowIso ?? new Date().toISOString();
  const existingMatch = input.id
    ? existing.find((c) => c.id === input.id) ?? null
    : null;
  const id =
    existingMatch?.id ??
    input.id ??
    `ai-chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const summary = extractChatRecSummary(cleanMessages);
  const title =
    input.title?.trim() ||
    existingMatch?.title ||
    deriveAiChatTitle(cleanMessages);

  const saved: SavedAiChat = {
    id,
    title,
    createdAt: existingMatch?.createdAt ?? nowIso,
    updatedAt: nowIso,
    messages: cleanMessages,
    recommendedCount: summary.recommendedCount,
    previewCovers: summary.previewCovers,
  };

  const nextList = [
    saved,
    ...existing.filter((c) => c.id !== id),
  ].slice(0, MAX_SAVED_AI_CHATS);

  return { saved, list: nextList };
}

export function deleteSavedAiChat(
  existing: readonly SavedAiChat[],
  chatId: string
): SavedAiChat[] {
  return existing.filter((c) => c.id !== chatId);
}

/* -------------------------------------------------------------------------- */
/* Browser localStorage Persistence + Cross-Instance Sync                     */
/* -------------------------------------------------------------------------- */

function notifyAiChatListeners() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(AI_CHATS_SYNC_EVENT));
  } catch {
    // ignore
  }
}

export function readSavedAiChats(): SavedAiChat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(AI_SAVED_CHATS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is SavedAiChat =>
        Boolean(c) &&
        typeof c === "object" &&
        typeof c.id === "string" &&
        Array.isArray(c.messages)
    );
  } catch {
    return [];
  }
}

export function writeSavedAiChats(chats: SavedAiChat[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      AI_SAVED_CHATS_STORAGE_KEY,
      JSON.stringify(chats.slice(0, MAX_SAVED_AI_CHATS))
    );
    notifyAiChatListeners();
  } catch {
    // ignore storage quota errors
  }
}

export function readActiveAiChat(): ActiveAiChatSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AI_ACTIVE_CHAT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveAiChatSnapshot>;
    if (!parsed || !Array.isArray(parsed.messages)) return null;
    return {
      savedChatId: typeof parsed.savedChatId === "string" ? parsed.savedChatId : null,
      messages: sanitizeMessagesForStorage(parsed.messages),
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeActiveAiChat(snapshot: ActiveAiChatSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    const clean = sanitizeMessagesForStorage(snapshot.messages);
    if (clean.length === 0) {
      window.localStorage.removeItem(AI_ACTIVE_CHAT_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      AI_ACTIVE_CHAT_STORAGE_KEY,
      JSON.stringify({
        savedChatId: snapshot.savedChatId,
        messages: clean,
        updatedAt: snapshot.updatedAt,
      })
    );
  } catch {
    // ignore storage errors
  }
}

export function clearActiveAiChat(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AI_ACTIVE_CHAT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
