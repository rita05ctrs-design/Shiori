"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Check,
  Clock,
  Star,
  ListChecks,
  Search,
  Sparkles,
  CalendarDays,
  Plus,
  Bookmark,
  ArrowLeftRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Tv,
  Flame,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { getSettingsCopy } from "@/lib/settings-translations";
import {
  cn,
  formatCountdown,
  formatScore,
  getDisplayTitle,
} from "@/lib/utils";
import { formatStreamingDisplayName } from "@/lib/streaming";
import type { AiringScheduleItem, MediaItem } from "@/types/media";
import type { WatchingAiringItem } from "@/app/api/anilist/watching-airing/route";

type ScopeMode = "mylist" | "all";
type FilterTab = "unwatched" | "today" | "all" | "watched" | "upcoming";

interface WeeklyEpisodeRow {
  mediaId: number;
  media: MediaItem;
  latestAiredEpisode: number;
  latestAiredAt: number | null;
  nextEpisode: { episode: number; airingAt: number } | null;
  inUserList: boolean;
  isWatching: boolean;
  userProgress: number;
  isWatched: boolean;
  behindCount: number;
  airedToday: boolean;
}

interface DayGroup {
  id: string;
  title: string;
  subtitle: string;
  priority?: boolean;
  sortKey: number;
  rows: WeeklyEpisodeRow[];
}

function getLocalDayStartMs(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function isSameLocalDay(unixSec: number | null, nowMs: number): boolean {
  if (!unixSec) return false;
  const dt = new Date(unixSec * 1000);
  const now = new Date(nowMs);
  return (
    dt.getFullYear() === now.getFullYear() &&
    dt.getMonth() === now.getMonth() &&
    dt.getDate() === now.getDate()
  );
}

function formatDayBucketInfo(
  unixSec: number | null,
  nowMs: number,
  locale: string,
  tr: (k: string) => string,
  isUpcoming = false
): { key: string; title: string; subtitle: string; sortKey: number } {
  if (!unixSec) {
    return {
      key: isUpcoming ? "upcoming-tbd" : "this-week",
      title: isUpcoming ? tr("Prochainement cette semaine") : tr("Cette semaine"),
      subtitle: tr("Diffusion récente"),
      sortKey: isUpcoming ? Number.MAX_SAFE_INTEGER : 0,
    };
  }

  const now = new Date(nowMs);
  const dt = new Date(unixSec * 1000);
  const startToday = getLocalDayStartMs(now);
  const startTarget = getLocalDayStartMs(dt);
  const diffDays = Math.round((startTarget - startToday) / 86400000);

  const fullDate = dt.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const capDate = fullDate.charAt(0).toUpperCase() + fullDate.slice(1);

  if (diffDays === 0) {
    return {
      key: "day-today",
      title: tr("Aujourd'hui"),
      subtitle: capDate,
      sortKey: startTarget,
    };
  }
  if (diffDays === -1) {
    return {
      key: "day-yesterday",
      title: tr("Hier"),
      subtitle: capDate,
      sortKey: startTarget,
    };
  }
  if (diffDays === 1) {
    return {
      key: "day-tomorrow",
      title: tr("Demain"),
      subtitle: capDate,
      sortKey: startTarget,
    };
  }

  const weekdayTitle = dt.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  const capTitle = weekdayTitle.charAt(0).toUpperCase() + weekdayTitle.slice(1);

  return {
    key: `day-${startTarget}`,
    title: capTitle,
    subtitle: isUpcoming ? tr("Diffusion à venir") : tr("Diffusé cette semaine"),
    sortKey: startTarget,
  };
}

function formatRelativeTimeStamp(
  unixSec: number | null,
  nowMs: number,
  locale: string,
  tr: (k: string) => string
): string {
  if (!unixSec) return tr("Cette semaine");
  const dt = new Date(unixSec * 1000);
  const now = new Date(nowMs);
  const diffDays = Math.round(
    (getLocalDayStartMs(dt) - getLocalDayStartMs(now)) / 86400000
  );
  const timeStr = dt.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (diffDays === 0) return `${tr("Aujourd'hui")} · ${timeStr}`;
  if (diffDays === -1) return `${tr("Hier")} · ${timeStr}`;
  if (diffDays === 1) return `${tr("Demain")} · ${timeStr}`;
  const dayStr = dt.toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${dayStr.charAt(0).toUpperCase() + dayStr.slice(1)} · ${timeStr}`;
}

interface WeeklyEpisodeTrackerProps {
  initialSchedule: AiringScheduleItem[];
  renderedAtMs?: number;
}

export function WeeklyEpisodeTracker({
  initialSchedule,
  renderedAtMs,
}: WeeklyEpisodeTrackerProps) {
  const {
    library,
    hydrated,
    getEntry,
    upsertEntry,
    removeEntry,
    incrementProgress,
    anilistConnection,
    anilistAutoSync,
    contentLanguage,
    toast,
  } = useShiori();
  const quickCopy = getSettingsCopy(contentLanguage).quickEp;
  const { t, tr, locale } = useTranslation();

  const [watchingLive, setWatchingLive] = useState<WatchingAiringItem[]>([]);
  const [loadingMyAiring, setLoadingMyAiring] = useState(false);
  const [scope, setScope] = useState<ScopeMode>("mylist");
  const [scopeInitialized, setScopeInitialized] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [flashId, setFlashId] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => renderedAtMs ?? 1764000000000);

  useEffect(() => {
    setMounted(true);
    setNowMs(Date.now());
  }, []);

  const nowSec = Math.floor(nowMs / 1000);

  // Collect user's active Watching / Plan to Watch / On Hold anime IDs
  const trackedAnimeIds = useMemo(
    () =>
      library
        .filter(
          (e) =>
            e.type === "ANIME" &&
            (e.status === "WATCHING" || e.status === "PLAN_TO_WATCH" || e.status === "ON_HOLD")
        )
        .slice(0, 50)
        .map((e) => e.mediaId),
    [library]
  );

  const trackedIdsKey = trackedAnimeIds.join(",");

  // Fetch live RELEASING status for user's own Watching/Plan to Watch anime from AniList
  useEffect(() => {
    if (!hydrated || trackedAnimeIds.length === 0) {
      setWatchingLive([]);
      return;
    }
    let cancelled = false;
    setLoadingMyAiring(true);
    fetch("/api/anilist/watching-airing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: trackedAnimeIds }),
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.items)) {
          setWatchingLive(data.items);
        }
      })
      .catch(() => {
        // graceful fallback to initialSchedule
      })
      .finally(() => {
        if (!cancelled) setLoadingMyAiring(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, trackedIdsKey]);

  // Build unified deduplicated rows combining user's live RELEASING shows + 7-day schedule
  const allRows = useMemo<WeeklyEpisodeRow[]>(() => {
    const map = new Map<
      number,
      {
        media: MediaItem;
        latestAiredEpisode: number;
        latestAiredAt: number | null;
        nextEpisode: { episode: number; airingAt: number } | null;
      }
    >();

    // 1. Seed from initialSchedule (past 7 days + next 7 days)
    for (const slot of initialSchedule) {
      const m = slot.media;
      const existing = map.get(m.id) ?? {
        media: m,
        latestAiredEpisode: 0,
        latestAiredAt: null,
        nextEpisode: m.nextAiringEpisode
          ? {
              episode: m.nextAiringEpisode.episode,
              airingAt: m.nextAiringEpisode.airingAt,
            }
          : null,
      };

      if (slot.airingAt <= nowSec) {
        if (
          slot.episode > existing.latestAiredEpisode ||
          (slot.episode === existing.latestAiredEpisode &&
            slot.airingAt > (existing.latestAiredAt ?? 0))
        ) {
          existing.latestAiredEpisode = slot.episode;
          existing.latestAiredAt = slot.airingAt;
        }
      } else {
        if (!existing.nextEpisode || slot.airingAt < existing.nextEpisode.airingAt) {
          existing.nextEpisode = { episode: slot.episode, airingAt: slot.airingAt };
        }
        if (existing.latestAiredEpisode === 0 && slot.episode > 1) {
          existing.latestAiredEpisode = slot.episode - 1;
          existing.latestAiredAt =
            slot.airingAt - 7 * 86400 <= nowSec ? slot.airingAt - 7 * 86400 : null;
        }
      }

      map.set(m.id, existing);
    }

    // 2. Merge live RELEASING data for user's own Watching / Plan to Watch anime
    for (const item of watchingLive) {
      const existing = map.get(item.mediaId);
      const mediaObj: MediaItem = existing?.media ?? {
        id: item.mediaId,
        type: "ANIME",
        title: item.title,
        coverImage: item.coverImage,
        bannerImage: item.bannerImage,
        description: null,
        format: item.format,
        status: "RELEASING",
        episodes: item.episodes,
        chapters: null,
        volumes: null,
        duration: 24,
        season: null,
        seasonYear: null,
        startYear: null,
        averageScore: item.averageScore,
        meanScore: item.averageScore,
        popularity: null,
        favourites: null,
        genres: item.genres,
        studio: item.studio,
        trailer: null,
        nextAiringEpisode: item.nextAiringEpisode,
      };

      const latestAiredEpisode = Math.max(
        existing?.latestAiredEpisode ?? 0,
        item.latestAiredEpisode
      );
      const latestAiredAt =
        item.latestAiredAt && (!existing?.latestAiredAt || item.latestAiredAt > existing.latestAiredAt)
          ? item.latestAiredAt
          : existing?.latestAiredAt ?? item.latestAiredAt;

      const nextEpisode = item.nextAiringEpisode
        ? {
            episode: item.nextAiringEpisode.episode,
            airingAt: item.nextAiringEpisode.airingAt,
          }
        : existing?.nextEpisode ?? null;

      map.set(item.mediaId, {
        media: mediaObj,
        latestAiredEpisode,
        latestAiredAt,
        nextEpisode,
      });
    }

    // 3. Enrich with user's live library entry
    const rows: WeeklyEpisodeRow[] = [];
    for (const [mediaId, info] of map.entries()) {
      const entry = getEntry(mediaId);
      const isWatching = entry?.status === "WATCHING";
      const inUserList = Boolean(
        entry &&
          (entry.status === "WATCHING" ||
            entry.status === "PLAN_TO_WATCH" ||
            entry.status === "ON_HOLD")
      );
      const userProgress = entry?.progress ?? 0;
      const isWatched =
        info.latestAiredEpisode > 0 && userProgress >= info.latestAiredEpisode;
      const behindCount =
        info.latestAiredEpisode > 0
          ? Math.max(0, info.latestAiredEpisode - userProgress)
          : 0;
      const airedToday =
        isSameLocalDay(info.latestAiredAt, nowMs) ||
        isSameLocalDay(info.nextEpisode?.airingAt ?? null, nowMs);

      rows.push({
        mediaId,
        media: info.media,
        latestAiredEpisode: info.latestAiredEpisode,
        latestAiredAt: info.latestAiredAt,
        nextEpisode: info.nextEpisode,
        inUserList,
        isWatching,
        userProgress,
        isWatched,
        behindCount,
        airedToday,
      });
    }

    // Priority sort: Watching + unwatched (today first) -> other unwatched -> watched -> upcoming
    rows.sort((a, b) => {
      const aPriority = a.isWatching && a.latestAiredEpisode > 0 && !a.isWatched ? 1 : 0;
      const bPriority = b.isWatching && b.latestAiredEpisode > 0 && !b.isWatched ? 1 : 0;
      if (aPriority !== bPriority) return bPriority - aPriority;

      if (a.airedToday !== b.airedToday && !a.isWatched && !b.isWatched) {
        return a.airedToday ? -1 : 1;
      }

      const aAired = a.latestAiredEpisode > 0;
      const bAired = b.latestAiredEpisode > 0;
      if (aAired !== bAired) return aAired ? -1 : 1;
      if (aAired && bAired && a.isWatched !== b.isWatched) {
        return a.isWatched ? 1 : -1;
      }

      const aTime = a.latestAiredAt ?? a.nextEpisode?.airingAt ?? 0;
      const bTime = b.latestAiredAt ?? b.nextEpisode?.airingAt ?? 0;
      return bTime - aTime;
    });

    return rows;
  }, [initialSchedule, watchingLive, getEntry, nowSec, nowMs]);

  const myListRows = useMemo(() => allRows.filter((r) => r.inUserList), [allRows]);

  // Priority Watching rows with new episodes aired today or still unwatched
  const priorityWatchingRows = useMemo(
    () =>
      allRows.filter(
        (r) =>
          r.isWatching &&
          ((r.latestAiredEpisode > 0 && !r.isWatched) || r.airedToday)
      ),
    [allRows]
  );

  // Smart default scope: "Mes animés" if user has tracked releasing shows, else "Toutes les sorties"
  useEffect(() => {
    if (!hydrated || loadingMyAiring || scopeInitialized) return;
    setScope(myListRows.length > 0 ? "mylist" : "all");
    setScopeInitialized(true);
  }, [hydrated, loadingMyAiring, myListRows.length, scopeInitialized]);

  const scopedRows = scope === "mylist" ? myListRows : allRows;

  // Weekly progress KPIs
  const stats = useMemo(() => {
    const aired = scopedRows.filter((r) => r.latestAiredEpisode > 0);
    const watched = aired.filter((r) => r.isWatched);
    const unwatched = aired.filter((r) => !r.isWatched);
    const today = scopedRows.filter((r) => r.airedToday);
    const upcoming = scopedRows.filter(
      (r) => r.nextEpisode !== null && r.nextEpisode.airingAt > nowSec
    );
    const pct = aired.length > 0 ? Math.round((watched.length / aired.length) * 100) : 0;
    return {
      airedCount: aired.length,
      watchedCount: watched.length,
      unwatchedCount: unwatched.length,
      todayCount: today.length,
      upcomingCount: upcoming.length,
      totalCount: scopedRows.length,
      pct,
    };
  }, [scopedRows, nowSec]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedRows.filter((row) => {
      if (q) {
        const title = getDisplayTitle(row.media).toLowerCase();
        const studio = (row.media.studio ?? "").toLowerCase();
        if (!title.includes(q) && !studio.includes(q)) return false;
      }
      if (filterTab === "unwatched") {
        return row.latestAiredEpisode > 0 && !row.isWatched;
      }
      if (filterTab === "today") {
        return row.airedToday;
      }
      if (filterTab === "watched") {
        return row.latestAiredEpisode > 0 && row.isWatched;
      }
      if (filterTab === "upcoming") {
        return row.nextEpisode !== null && row.nextEpisode.airingAt > nowSec;
      }
      return true;
    });
  }, [scopedRows, search, filterTab, nowSec]);

  /**
   * Direct "+1 Vu" action — ZERO modal!
   * Immediately updates Shiori + Supabase + AniList and displays an Undo toast ("Annuler").
   */
  const handlePlusOneWatched = (row: WeeklyEpisodeRow) => {
    const existing = getEntry(row.mediaId);
    setFlashId(row.mediaId);
    setTimeout(() => setFlashId((prev) => (prev === row.mediaId ? null : prev)), 700);

    if (existing) {
      incrementProgress(row.mediaId, 1);
      return;
    }

    // Not yet in library -> add directly as WATCHING with progress = 1 (or latest aired if ep 1)
    const targetEp = Math.max(1, Math.min(row.latestAiredEpisode || 1, 1));
    const total = row.media.episodes;
    const isFinished = Boolean(total && targetEp >= total);
    upsertEntry(row.media, {
      status: isFinished ? "COMPLETED" : "WATCHING",
      progress: targetEp,
    });

    toast({
      title: tr("+1 épisode vu"),
      description: `${getDisplayTitle(row.media)} · ${t("common.epShort")} ${targetEp}${total ? `/${total}` : ""}`,
      variant: "info",
      coverImage: row.media.coverImage.large || row.media.coverImage.extraLarge,
      status: isFinished ? "COMPLETED" : "WATCHING",
      mediaId: row.mediaId,
      durationMs: 5500,
      action: {
        label: tr("Annuler"),
        onClick: () => removeEntry(row.mediaId),
      },
    });
  };

  // Direct "-1" quick undo directly on a caught-up card
  const handleDecrementOne = (row: WeeklyEpisodeRow) => {
    const existing = getEntry(row.mediaId);
    if (!existing || existing.progress <= 0) return;
    incrementProgress(row.mediaId, -1);
  };

  // Group rows strictly by broadcast day (with Watching priority section at top when relevant)
  const grouped = useMemo<DayGroup[]>(() => {
    const groups: DayGroup[] = [];
    const showPriorityBanner =
      !search.trim() &&
      (filterTab === "all" || filterTab === "unwatched" || filterTab === "today") &&
      priorityWatchingRows.length > 0;

    const priorityIds = new Set<number>();
    if (showPriorityBanner) {
      const matchingPriority = priorityWatchingRows.filter((r) => {
        if (filterTab === "today") return r.airedToday;
        if (filterTab === "unwatched") return r.latestAiredEpisode > 0 && !r.isWatched;
        return true;
      });
      if (matchingPriority.length > 0) {
        matchingPriority.forEach((r) => priorityIds.add(r.mediaId));
        groups.push({
          id: "priority-watching",
          title: tr("À regarder en priorité · Mes animés en cours"),
          subtitle: tr("Épisodes sortis aujourd'hui ou non encore vus"),
          priority: true,
          sortKey: Number.MAX_SAFE_INTEGER,
          rows: matchingPriority,
        });
      }
    }

    const dayMap = new Map<string, DayGroup>();
    const isUpcomingView = filterTab === "upcoming";

    for (const row of filteredRows) {
      if (priorityIds.has(row.mediaId) && scope === "mylist") continue;

      const ts = isUpcomingView
        ? row.nextEpisode?.airingAt ?? null
        : row.latestAiredAt ?? row.nextEpisode?.airingAt ?? null;
      const bucket = formatDayBucketInfo(
        ts,
        nowMs,
        locale,
        tr,
        isUpcomingView || row.latestAiredEpisode === 0
      );

      const existing = dayMap.get(bucket.key);
      if (existing) {
        existing.rows.push(row);
      } else {
        dayMap.set(bucket.key, {
          id: bucket.key,
          title: bucket.title,
          subtitle: bucket.subtitle,
          sortKey: bucket.sortKey,
          rows: [row],
        });
      }
    }

    const sortedDays = Array.from(dayMap.values()).sort((a, b) =>
      isUpcomingView ? a.sortKey - b.sortKey : b.sortKey - a.sortKey
    );

    return [...groups, ...sortedDays];
  }, [filteredRows, filterTab, locale, nowMs, priorityWatchingRows, search, scope, tr]);

  return (
    <div className="pt-[calc(4.75rem+env(safe-area-inset-top))] sm:pt-24 pb-24 md:pb-16 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent mb-1.5 flex items-center gap-1.5">
            <ListChecks className="w-3.5 h-3.5" />
            <span>{tr("Semaine / Aujourd'hui · Suivi Rapide")}</span>
          </p>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-gradient-editorial">
            {t("episodes.title")}
          </h1>
          <p className="text-xs sm:text-sm text-[#8A8FA4] mt-1 max-w-2xl">
            {t("episodes.subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {anilistConnection.connected && anilistAutoSync && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/12 border border-emerald-500/30 text-[11px] font-mono text-emerald-300">
              <ArrowLeftRight className="w-3 h-3" />
              <span>{tr("Sync AniList auto")}</span>
            </span>
          )}
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-white transition-colors"
          >
            <CalendarDays className="w-3.5 h-3.5 text-kinpaku" />
            <span>{t("calendar.title")}</span>
          </Link>
        </div>
      </div>

      {/* Live Weekly Progress Dashboard Card */}
      <div className="rounded-2xl card-surface border border-accent/25 p-4 sm:p-6 space-y-4 sm:space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-sm sm:text-base font-semibold text-white">
                {scope === "mylist"
                  ? tr("Mes sorties cette semaine")
                  : tr("Toutes les sorties de la semaine")}
              </span>
              {loadingMyAiring && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#8E93A6]">
                  <Loader2 className="w-3 h-3 animate-spin text-accent" />
                  {tr("Actualisation AniList...")}
                </span>
              )}
              {stats.airedCount > 0 && stats.unwatchedCount === 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-[11px] font-semibold text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t("episodes.allCaughtUp")}
                </span>
              )}
            </div>
            <p className="text-xs text-[#8E93A6] font-mono">
              <strong className="text-white">{stats.watchedCount}</strong> / {stats.airedCount}{" "}
              {tr("épisodes sortis vus ({pct}%)", { pct: stats.pct })} ·{" "}
              <span
                className={
                  stats.unwatchedCount > 0 ? "text-kinpaku font-semibold" : "text-emerald-400"
                }
              >
                {tr("{n} à voir", { n: stats.unwatchedCount })}
              </span>
            </p>
          </div>

          {/* Scope Toggle: Mes animés vs Toutes les sorties */}
          <div className="inline-flex items-center p-1 rounded-full bg-obsidian/80 border border-white/[0.09] self-start md:self-auto">
            <button
              type="button"
              onClick={() => setScope("mylist")}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5",
                scope === "mylist"
                  ? "bg-accent text-accent-fg shadow-accent"
                  : "text-[#9A9EAE] hover:text-white"
              )}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>{tr("Mes animés ({n})", { n: myListRows.length })}</span>
            </button>
            <button
              type="button"
              onClick={() => setScope("all")}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5",
                scope === "all"
                  ? "bg-accent text-accent-fg shadow-accent"
                  : "text-[#9A9EAE] hover:text-white"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{tr("Toutes les sorties ({n})", { n: allRows.length })}</span>
            </button>
          </div>
        </div>

        {/* Animated Weekly Completion Bar */}
        <div className="h-2 w-full rounded-full bg-white/[0.07] overflow-hidden">
          <motion.div
            initial={false}
            animate={{ width: `${stats.pct}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
            className="h-full rounded-full bg-gradient-to-r from-accent via-accent-hover to-emerald-400"
          />
        </div>

        {/* Filter Pills + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto touch-rail no-scrollbar pb-0.5">
            {[
              { id: "today" as const, label: t("episodes.today"), count: stats.todayCount },
              { id: "all" as const, label: t("nav.week"), count: stats.totalCount },
              { id: "unwatched" as const, label: t("nav.toWatch"), count: stats.unwatchedCount },
              { id: "watched" as const, label: `${t("common.saved")} ✓`, count: stats.watchedCount },
              { id: "upcoming" as const, label: t("nav.releases"), count: stats.upcomingCount },
            ].map((tab) => {
              const active = filterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={cn(
                    "relative px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 active:scale-95",
                    active
                      ? "text-[#090A0F] border-white"
                      : "bg-obsidian/70 border-white/[0.08] text-[#A2A6B8] hover:text-white hover:border-white/[0.16]"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="weekly-filter-pill"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-full bg-white shadow-[0_4px_14px_rgba(255,255,255,0.25)]"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                  <span
                    className={cn(
                      "relative z-10 font-mono text-[10.5px] px-1.5 py-0.2 rounded-full",
                      active ? "bg-black/15 text-[#090A0F]" : "bg-white/[0.08] text-[#B8BCCB]"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#7D8296] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr("Filtrer un anime...")}
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-obsidian/80 border border-white/[0.09] text-base sm:text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      </div>

      {/* Day-Grouped Episode Cards */}
      {grouped.length === 0 ? (
        <div className="rounded-2xl card-surface p-10 sm:p-12 text-center space-y-3">
          {scope === "mylist" && myListRows.length === 0 ? (
            <>
              <p className="text-base font-semibold text-white">
                {tr("Aucun anime en cours de diffusion dans votre liste pour l'instant.")}
              </p>
              <p className="text-xs text-[#858A9E] max-w-md mx-auto">
                {tr("Affichez toutes les sorties et cliquez sur +1 pour ajouter instantanément les animés de la saison.")}
              </p>
              <button
                type="button"
                onClick={() => setScope("all")}
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold cursor-pointer shadow-accent"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{tr("Voir toutes les sorties de la semaine")}</span>
              </button>
            </>
          ) : filterTab === "unwatched" ? (
            <>
              <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto" />
              <p className="text-base font-semibold text-white">
                {tr("Bravo, aucun épisode en retard !")}
              </p>
              <p className="text-xs text-[#858A9E]">
                {tr("Tous les épisodes sortis cette semaine dans cette vue sont déjà à jour.")}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-[#A5A9BB]">{tr("Aucun épisode ne correspond à ce filtre.")}</p>
              <button
                type="button"
                onClick={() => {
                  setFilterTab("all");
                  setSearch("");
                }}
                className="text-xs text-accent-soft hover:underline cursor-pointer"
              >
                {tr("Réinitialiser les filtres")}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.id} className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    {group.priority && (
                      <Flame className="w-4 h-4 text-accent shrink-0" />
                    )}
                    <span>{group.title}</span>
                    <span
                      className={cn(
                        "font-mono text-xs px-2 py-0.5 rounded-full border",
                        group.priority
                          ? "bg-accent/18 border-accent/40 text-accent-soft"
                          : "bg-white/[0.06] border-white/[0.08] text-[#B8BCCB]"
                      )}
                    >
                      {group.rows.length}
                    </span>
                  </h2>
                  <p className="text-xs text-[#7D8296]">{group.subtitle}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {group.rows.map((row) => {
                  const title = getDisplayTitle(row.media);
                  const isFlashing = flashId === row.mediaId;
                  const hasAired = row.latestAiredEpisode > 0;
                  const nextStepEp = row.userProgress + 1;
                  const canIncrement =
                    !row.media.episodes || row.userProgress < row.media.episodes;
                  const primaryStream = row.media.streamingLinks?.[0] ?? null;

                  return (
                    <div
                      key={`${group.id}-${row.mediaId}`}
                      className={cn(
                        "group rounded-2xl p-3 sm:p-3.5 card-surface border transition-all flex items-center gap-3 sm:gap-4",
                        hasAired && row.isWatched
                          ? "border-emerald-500/35 bg-emerald-500/[0.04]"
                          : hasAired && row.isWatching
                            ? "border-accent/40 bg-accent/[0.04]"
                            : "border-white/[0.08] hover:border-white/[0.18]",
                        isFlashing && "ring-2 ring-emerald-400/75"
                      )}
                    >
                      {/* Thumbnail Poster */}
                      <Link href={`/media/${row.mediaId}`} className="relative shrink-0">
                        <img
                          src={row.media.coverImage.large || row.media.coverImage.extraLarge}
                          alt={title}
                          loading="lazy"
                          decoding="async"
                          className={cn(
                            "w-14 h-20 sm:w-16 sm:h-24 rounded-xl object-cover border transition-transform duration-300 group-hover:scale-105",
                            row.isWatched ? "border-emerald-400/50" : "border-white/15"
                          )}
                        />
                        {hasAired && row.isWatched && (
                          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-[#07080C] flex items-center justify-center shadow-md">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </Link>

                      {/* Info */}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {hasAired ? (
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-md font-mono text-[10.5px] font-bold border",
                                row.isWatched
                                  ? "bg-emerald-500/18 border-emerald-400/40 text-emerald-300"
                                  : "bg-accent/18 border-accent/45 text-accent-soft"
                              )}
                            >
                              {tr("{unit} {n} sorti", { unit: t("common.epShort"), n: row.latestAiredEpisode })}
                            </span>
                          ) : (
                            row.nextEpisode && (
                              <span className="px-2 py-0.5 rounded-md font-mono text-[10.5px] font-bold bg-kinpaku/18 border border-kinpaku/40 text-kinpaku">
                                {tr("{unit} {n} bientôt", { unit: t("common.epShort"), n: row.nextEpisode.episode })}
                              </span>
                            )
                          )}

                          {hasAired && row.inUserList && row.behindCount >= 2 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/18 border border-amber-400/40 font-mono text-[10px] font-semibold text-amber-300">
                              <AlertCircle className="w-3 h-3" />
                              {tr("{n} ép. à voir", { n: row.behindCount })}
                            </span>
                          )}

                          {row.media.averageScore && (
                            <span className="inline-flex items-center gap-0.5 font-mono text-[10.5px] text-kinpaku">
                              <Star className="w-3 h-3 fill-current" />
                              {formatScore(row.media.averageScore)}
                            </span>
                          )}
                        </div>

                        <Link
                          href={`/media/${row.mediaId}`}
                          className="block text-sm sm:text-[15px] font-semibold text-[#F4F3EE] hover:text-accent-hover transition-colors line-clamp-1"
                        >
                          {title}
                        </Link>

                        <div className="flex items-center gap-2 flex-wrap text-[11px] text-[#8A8FA4]">
                          {hasAired && row.latestAiredAt && (
                            <span suppressHydrationWarning className="font-mono text-[#A6AAB8]">
                              {mounted
                                ? formatRelativeTimeStamp(row.latestAiredAt, nowMs, locale, tr)
                                : tr("Cette semaine")}
                            </span>
                          )}
                          {row.inUserList && (
                            <>
                              <span className="text-white/20">·</span>
                              <span className="font-mono text-white/85">
                                {tr("Vu : {unit} {n}", { unit: t("common.epShort"), n: row.userProgress })}
                                {row.media.episodes ? `/${row.media.episodes}` : ""}
                              </span>
                            </>
                          )}
                          {primaryStream && (
                            <>
                              <span className="text-white/20">·</span>
                              <span className="inline-flex items-center gap-1 text-[#C5C9DA]">
                                <Tv className="w-3 h-3 text-accent-soft" />
                                {formatStreamingDisplayName(primaryStream.site)}
                              </span>
                            </>
                          )}
                          {mounted && row.nextEpisode && row.nextEpisode.airingAt > nowSec && (
                            <>
                              <span className="text-white/20">·</span>
                              <span suppressHydrationWarning className="inline-flex items-center gap-1 font-mono text-kinpaku/90">
                                <Clock className="w-3 h-3" />
                                {t("common.epShort")} {row.nextEpisode.episode} ·{" "}
                                {formatCountdown(row.nextEpisode.airingAt, nowSec, contentLanguage)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Prominent Direct "+1 Vu" Button (NO modal, instant Supabase/AniList sync + Undo toast) */}
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        {hasAired ? (
                          row.isWatched ? (
                            <div className="flex items-center gap-1.5">
                              <span className="h-10 sm:h-11 px-3 sm:px-3.5 rounded-xl bg-emerald-500/18 border border-emerald-400/40 text-emerald-300 text-xs font-bold inline-flex items-center gap-1.5 shadow-[0_4px_14px_rgba(16,185,129,0.2)]">
                                <Check className="w-4 h-4 stroke-[2.8]" />
                                <span>{quickCopy.watched}</span>
                              </span>
                              {row.userProgress > 0 && (
                                <motion.button
                                  type="button"
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleDecrementOne(row)}
                                  title={`${quickCopy.notWatched} (-1)`}
                                  aria-label={`${quickCopy.notWatched} · ${title}`}
                                  className="h-10 sm:h-11 px-2.5 rounded-xl bg-white/[0.045] hover:bg-rose-500/18 border border-white/[0.09] hover:border-rose-400/40 flex items-center justify-center gap-1 text-[11px] font-semibold text-[#9A9EAE] hover:text-rose-200 transition-colors cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">{quickCopy.notWatched}</span>
                                </motion.button>
                              )}
                            </div>
                          ) : (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.93 }}
                              disabled={!canIncrement}
                              onClick={() => handlePlusOneWatched(row)}
                              aria-label={`${tr("Marquer +1 épisode vu")} · ${title} (${t("common.epShort")} ${nextStepEp})`}
                              className="min-h-[44px] px-4 sm:px-5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-45 text-accent-fg font-bold text-xs sm:text-[13px] inline-flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 shadow-[0_10px_26px_rgba(229,72,77,0.38)] border border-white/15 transition-all cursor-pointer"
                            >
                              <span className="inline-flex items-center gap-1">
                                <Plus className="w-4 h-4 stroke-[2.8]" />
                                <span>{t("episodes.markWatched")}</span>
                              </span>
                              <span className="font-mono text-[10px] opacity-85">
                                {t("common.epShort")} {nextStepEp}
                              </span>
                            </motion.button>
                          )
                        ) : (
                          /* Upcoming Episode 1 -> 1-click Follow */
                          <button
                            type="button"
                            onClick={() =>
                              upsertEntry(row.media, {
                                status: row.inUserList ? "WATCHING" : "PLAN_TO_WATCH",
                              })
                            }
                            className={cn(
                              "min-h-[40px] px-3.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer inline-flex items-center gap-1.5",
                              row.inUserList
                                ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                                : "bg-white/[0.06] hover:bg-accent border-white/[0.1] hover:border-accent text-white hover:text-accent-fg"
                            )}
                          >
                            {row.inUserList ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>{tr("Suivi")}</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>{tr("Suivre")}</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
