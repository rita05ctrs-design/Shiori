"use client";

import { useSyncExternalStore } from "react";
import type { UserSuggestionRecord } from "@/types/media";

export const SUGGESTIONS_REALTIME_CHANNEL = "shiori:creator-suggestions";
export const SUGGESTIONS_REALTIME_EVENT = "suggestion_created";
export const SUGGESTIONS_BROADCAST_NAME = "shiori_suggestions_v1";
export const SUGGESTIONS_LOCAL_EVENT = "shiori:suggestion-created-local";

export interface CreatorSuggestionsSnapshot {
  suggestions: UserSuggestionRecord[];
  newCount: number;
  liveConnected: boolean;
  initialized: boolean;
}

const OVERLAY_TTL_MS = 45_000;

let snapshot: CreatorSuggestionsSnapshot = {
  suggestions: [],
  newCount: 0,
  liveConnected: false,
  initialized: false,
};

const listeners = new Set<() => void>();
const knownIds = new Set<string>();
const deletedIds = new Set<string>();
const realtimeOverlay = new Map<
  string,
  { item: UserSuggestionRecord; receivedAt: number }
>();

function emit(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore subscriber errors
    }
  });
}

function sortNewestFirst(items: UserSuggestionRecord[]): UserSuggestionRecord[] {
  return [...items].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime() || 0;
    const tb = new Date(b.createdAt).getTime() || 0;
    return tb - ta;
  });
}

function buildMerged(serverItems: UserSuggestionRecord[]): UserSuggestionRecord[] {
  const now = Date.now();
  const byId = new Map<string, UserSuggestionRecord>();

  for (const item of serverItems) {
    if (!item?.id || deletedIds.has(item.id)) continue;
    byId.set(item.id, item);
  }

  // Keep recently received Realtime items even if a concurrent poll returned a slightly older snapshot
  for (const [id, entry] of realtimeOverlay.entries()) {
    if (deletedIds.has(id) || now - entry.receivedAt > OVERLAY_TTL_MS) {
      realtimeOverlay.delete(id);
      continue;
    }
    if (!byId.has(id)) {
      byId.set(id, entry.item);
    }
  }

  return sortNewestFirst(Array.from(byId.values()));
}

export function getCreatorSuggestionsSnapshot(): CreatorSuggestionsSnapshot {
  return snapshot;
}

export function subscribeCreatorSuggestions(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCreatorSuggestionsState(): CreatorSuggestionsSnapshot {
  return useSyncExternalStore(
    subscribeCreatorSuggestions,
    getCreatorSuggestionsSnapshot,
    getCreatorSuggestionsSnapshot
  );
}

/**
 * Replaces the bus list with an authoritative server response while preserving
 * any brand-new Realtime items received in the last few seconds.
 * Returns any newly discovered `"new"` suggestions that weren't known yet
 * (empty on the very first hydration so page load never spams toasts).
 */
export function applyServerSuggestions(
  serverItems: UserSuggestionRecord[]
): UserSuggestionRecord[] {
  const wasInitialized = snapshot.initialized;
  const newlyDiscovered: UserSuggestionRecord[] = [];

  for (const item of serverItems) {
    if (!item?.id || deletedIds.has(item.id)) continue;
    if (!knownIds.has(item.id)) {
      knownIds.add(item.id);
      if (wasInitialized && item.status === "new") {
        newlyDiscovered.push(item);
      }
    }
  }

  const merged = buildMerged(serverItems);
  snapshot = {
    ...snapshot,
    suggestions: merged,
    newCount: merged.filter((s) => s.status === "new").length,
    initialized: true,
  };
  emit();
  return newlyDiscovered;
}

/**
 * Ingests a single live incoming suggestion (from Supabase Realtime, BroadcastChannel,
 * or same-tab submission). Returns `true` if this suggestion is genuinely new.
 */
export function ingestLiveSuggestion(incoming: UserSuggestionRecord): boolean {
  if (!incoming?.id || deletedIds.has(incoming.id)) return false;
  const isNew = !knownIds.has(incoming.id);
  knownIds.add(incoming.id);
  realtimeOverlay.set(incoming.id, { item: incoming, receivedAt: Date.now() });

  const merged = buildMerged([incoming, ...snapshot.suggestions]);
  snapshot = {
    ...snapshot,
    suggestions: merged,
    newCount: merged.filter((s) => s.status === "new").length,
    initialized: true,
  };
  emit();
  return isNew;
}

export function markSuggestionDeletedInBus(id: string): void {
  if (!id) return;
  deletedIds.add(id);
  realtimeOverlay.delete(id);
  const next = snapshot.suggestions.filter((s) => s.id !== id);
  snapshot = {
    ...snapshot,
    suggestions: next,
    newCount: next.filter((s) => s.status === "new").length,
  };
  emit();
}

export function setSuggestionsLiveConnected(connected: boolean): void {
  if (snapshot.liveConnected === connected) return;
  snapshot = { ...snapshot, liveConnected: connected };
  emit();
}

export function resetCreatorSuggestionsBus(): void {
  knownIds.clear();
  deletedIds.clear();
  realtimeOverlay.clear();
  snapshot = {
    suggestions: [],
    newCount: 0,
    liveConnected: false,
    initialized: false,
  };
  emit();
}

/**
 * Fires instant local same-tab & same-browser notifications when a suggestion is submitted.
 * Cross-device worldwide delivery is handled directly by the server via Supabase Realtime REST.
 */
export function notifyLocalSuggestionCreated(suggestion: UserSuggestionRecord): void {
  if (typeof window === "undefined") return;

  try {
    window.dispatchEvent(
      new CustomEvent<UserSuggestionRecord>(SUGGESTIONS_LOCAL_EVENT, {
        detail: suggestion,
      })
    );
  } catch {
    // ignore
  }

  try {
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel(SUGGESTIONS_BROADCAST_NAME);
      bc.postMessage({ type: SUGGESTIONS_REALTIME_EVENT, suggestion });
      bc.close();
    }
  } catch {
    // ignore
  }
}
