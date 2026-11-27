"use client";

import { useEffect, useMemo, useState } from "react";
import type { WatchingAiringItem } from "@/app/api/anilist/watching-airing/route";
import type { LibraryEntry } from "@/types/media";

const CACHE_TTL_MS = 3 * 60 * 1000;

interface CacheBucket {
  fetchedAt: number;
  items: Map<number, WatchingAiringItem>;
}

const airingCache = new Map<string, CacheBucket>();
const inflightRequests = new Map<string, Promise<Map<number, WatchingAiringItem>>>();

async function fetchWatchingAiringMap(
  key: string,
  ids: number[]
): Promise<Map<number, WatchingAiringItem>> {
  const cached = airingCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.items;
  }

  const existing = inflightRequests.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await fetch("/api/anilist/watching-airing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) return new Map<number, WatchingAiringItem>();
      const data = await res.json().catch(() => null);
      const map = new Map<number, WatchingAiringItem>();
      if (Array.isArray(data?.items)) {
        for (const item of data.items as WatchingAiringItem[]) {
          if (item && typeof item.mediaId === "number") {
            map.set(item.mediaId, item);
          }
        }
      }
      airingCache.set(key, { fetchedAt: Date.now(), items: map });
      return map;
    } catch {
      return new Map<number, WatchingAiringItem>();
    } finally {
      inflightRequests.delete(key);
    }
  })();

  inflightRequests.set(key, promise);
  return promise;
}

export interface LiveAiringMetrics {
  latestAiredEpisode: number;
  behindCount: number;
  isCaughtUp: boolean;
  totalKnown: number | null;
  watchedPct: number;
  airedPct: number | null;
  nextEpisode: number | null;
  timeUntilNextSec: number | null;
}

/**
 * Computes watched vs. currently aired episode metrics for a library entry.
 */
export function computeLiveAiringMetrics(
  entry: Pick<LibraryEntry, "progress" | "totalUnits" | "type" | "status">,
  airing: WatchingAiringItem | undefined
): LiveAiringMetrics | null {
  if (entry.type !== "ANIME" || !airing) return null;
  const latestAired = Math.max(0, airing.latestAiredEpisode || 0);
  const nextEp = airing.nextAiringEpisode?.episode ?? null;
  const timeUntilNextSec = airing.nextAiringEpisode?.timeUntilAiring ?? null;

  if (latestAired <= 0 && !nextEp) return null;

  const behindCount = Math.max(0, latestAired - entry.progress);
  const isCaughtUp = latestAired > 0 && entry.progress >= latestAired;
  const totalKnown = entry.totalUnits ?? airing.episodes ?? null;

  const denominator = Math.max(
    totalKnown ?? 0,
    latestAired,
    entry.progress,
    nextEp ?? 1,
    1
  );

  const watchedPct = Math.min(100, Math.max(0, Math.round((entry.progress / denominator) * 100)));
  const airedPct =
    latestAired > 0
      ? Math.min(100, Math.max(watchedPct, Math.round((latestAired / denominator) * 100)))
      : null;

  return {
    latestAiredEpisode: latestAired,
    behindCount,
    isCaughtUp,
    totalKnown,
    watchedPct,
    airedPct,
    nextEpisode: nextEp,
    timeUntilNextSec,
  };
}

export function formatShortAiringCountdown(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days >= 1) return `${days}j ${hours}h`;
  const mins = Math.max(1, Math.floor((seconds % 3600) / 60));
  if (hours >= 1) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/**
 * Fetches live AniList airing status for all active `WATCHING` anime in the user's library,
 * deduplicated and cached for 3 minutes across Resume Watching & Library views.
 */
export function useWatchingAiring(library: LibraryEntry[]) {
  const watchingAnimeIds = useMemo(() => {
    const ids = library
      .filter((e) => e.type === "ANIME" && e.status === "WATCHING")
      .map((e) => e.mediaId)
      .filter((id) => Number.isInteger(id) && id > 0);
    return Array.from(new Set(ids)).sort((a, b) => a - b).slice(0, 50);
  }, [library]);

  const idsKey = useMemo(() => watchingAnimeIds.join(","), [watchingAnimeIds]);

  const [airingMap, setAiringMap] = useState<Map<number, WatchingAiringItem>>(() => {
    if (!idsKey) return new Map();
    const cached = airingCache.get(idsKey);
    return cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS
      ? cached.items
      : new Map();
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!idsKey || watchingAnimeIds.length === 0) {
      setAiringMap(new Map());
      setLoading(false);
      return;
    }

    let cancelled = false;
    const cached = airingCache.get(idsKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setAiringMap(cached.items);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchWatchingAiringMap(idsKey, watchingAnimeIds).then((map) => {
      if (cancelled) return;
      setAiringMap(map);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [idsKey, watchingAnimeIds]);

  return { airingMap, loading };
}
