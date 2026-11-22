"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Check,
  X,
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
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import {
  cn,
  formatCountdown,
  formatScore,
  getDisplayTitle,
} from "@/lib/utils";
import type { AiringScheduleItem, MediaItem } from "@/types/media";
import type { WatchingAiringItem } from "@/app/api/anilist/watching-airing/route";

type ScopeMode = "mylist" | "all";
type FilterTab = "unwatched" | "watched" | "upcoming" | "all";

interface WeeklyEpisodeRow {
  mediaId: number;
  media: MediaItem;
  latestAiredEpisode: number;
  latestAiredAt: number | null;
  nextEpisode: { episode: number; airingAt: number } | null;
  inUserList: boolean;
  userProgress: number;
  isWatched: boolean;
  behindCount: number;
}

function formatRelativeDayLabel(unixSec: number | null): string {
  if (!unixSec) return "Cette semaine";
  const now = new Date();
  const dt = new Date(unixSec * 1000);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startTarget = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diffDays = Math.round((startTarget - startToday) / 86400000);
  const timeStr = dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  if (diffDays === 0) return `Aujourd'hui · ${timeStr}`;
  if (diffDays === -1) return `Hier · ${timeStr}`;
  if (diffDays === 1) return `Demain · ${timeStr}`;
  const dayName = dt.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} · ${timeStr}`;
}

function getBucketGroup(row: WeeklyEpisodeRow, nowMs: number): "today" | "recent" | "upcoming" {
  if (row.latestAiredEpisode <= 0) return "upcoming";
  if (!row.latestAiredAt) return "recent";
  const dt = new Date(row.latestAiredAt * 1000);
  const now = new Date(nowMs);
  const isSameDay =
    dt.getFullYear() === now.getFullYear() &&
    dt.getMonth() === now.getMonth() &&
    dt.getDate() === now.getDate();
  return isSameDay ? "today" : "recent";
}

interface WeeklyEpisodeTrackerProps {
  initialSchedule: AiringScheduleItem[];
}

export function WeeklyEpisodeTracker({ initialSchedule }: WeeklyEpisodeTrackerProps) {
  const {
    library,
    hydrated,
    getEntry,
    upsertEntry,
    incrementProgress,
    anilistConnection,
    anilistAutoSync,
  } = useShiori();

  const [watchingLive, setWatchingLive] = useState<WatchingAiringItem[]>([]);
  const [loadingMyAiring, setLoadingMyAiring] = useState(false);
  const [scope, setScope] = useState<ScopeMode>("mylist");
  const [scopeInitialized, setScopeInitialized] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [flashId, setFlashId] = useState<number | null>(null);

  const nowMs = Date.now();
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
        // If we know ep N is airing next and we don't have a past slot yet, ep N-1 already aired
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

      const nextEpisode =
        item.nextAiringEpisode
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

      rows.push({
        mediaId,
        media: info.media,
        latestAiredEpisode: info.latestAiredEpisode,
        latestAiredAt: info.latestAiredAt,
        nextEpisode: info.nextEpisode,
        inUserList,
        userProgress,
        isWatched,
        behindCount,
      });
    }

    // Sort: unwatched newly-aired first (most recent release at top), then watched, then upcoming
    rows.sort((a, b) => {
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
  }, [initialSchedule, watchingLive, getEntry, nowSec]);

  const myListRows = useMemo(() => allRows.filter((r) => r.inUserList), [allRows]);

  // Smart default scope: show "Mes animés" if user has releasing shows, otherwise "Toutes les sorties"
  useEffect(() => {
    if (!hydrated || loadingMyAiring || scopeInitialized) return;
    if (myListRows.length === 0) {
      setScope("all");
    } else {
      setScope("mylist");
    }
    setScopeInitialized(true);
  }, [hydrated, loadingMyAiring, myListRows.length, scopeInitialized]);

  const scopedRows = scope === "mylist" ? myListRows : allRows;

  // Weekly progress KPIs for current scope
  const stats = useMemo(() => {
    const aired = scopedRows.filter((r) => r.latestAiredEpisode > 0);
    const watched = aired.filter((r) => r.isWatched);
    const unwatched = aired.filter((r) => !r.isWatched);
    const upcoming = scopedRows.filter(
      (r) => r.nextEpisode !== null && r.nextEpisode.airingAt > nowSec
    );
    const pct = aired.length > 0 ? Math.round((watched.length / aired.length) * 100) : 0;
    return {
      airedCount: aired.length,
      watchedCount: watched.length,
      unwatchedCount: unwatched.length,
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
      if (filterTab === "watched") {
        return row.latestAiredEpisode > 0 && row.isWatched;
      }
      if (filterTab === "upcoming") {
        return row.nextEpisode !== null && row.nextEpisode.airingAt > nowSec;
      }
      return true;
    });
  }, [scopedRows, search, filterTab, nowSec]);

  // 1-Click OUI (Mark episode watched)
  const markEpisodeWatched = (row: WeeklyEpisodeRow, targetEpisode: number) => {
    const total = row.media.episodes;
    const isFinished = Boolean(total && targetEpisode >= total);
    upsertEntry(row.media, {
      status: isFinished ? "COMPLETED" : "WATCHING",
      progress: targetEpisode,
    });
    setFlashId(row.mediaId);
    setTimeout(() => setFlashId((prev) => (prev === row.mediaId ? null : prev)), 700);
  };

  // 1-Click NON (Unmark episode / Undo back to ep - 1)
  const markEpisodeUnwatched = (row: WeeklyEpisodeRow) => {
    const targetEp = Math.max(0, row.latestAiredEpisode - 1);
    upsertEntry(row.media, {
      status: "WATCHING",
      progress: targetEp,
    });
  };

  // Group rows visually into Aujourd'hui / Plus tôt cette semaine / À venir
  const grouped = useMemo(() => {
    if (filterTab === "upcoming") {
      return [
        {
          id: "upcoming",
          title: "Prochains épisodes cette semaine",
          subtitle: "Triés par ordre de sortie",
          rows: [...filteredRows].sort(
            (a, b) =>
              (a.nextEpisode?.airingAt ?? Infinity) -
              (b.nextEpisode?.airingAt ?? Infinity)
          ),
        },
      ];
    }

    const today: WeeklyEpisodeRow[] = [];
    const recent: WeeklyEpisodeRow[] = [];
    const upcomingOnly: WeeklyEpisodeRow[] = [];

    for (const r of filteredRows) {
      const b = getBucketGroup(r, nowMs);
      if (b === "today") today.push(r);
      else if (b === "recent") recent.push(r);
      else upcomingOnly.push(r);
    }

    const groups: { id: string; title: string; subtitle: string; rows: WeeklyEpisodeRow[] }[] = [];
    if (today.length > 0) {
      groups.push({
        id: "today",
        title: "Sortis aujourd'hui",
        subtitle: "Cochez Oui ou Non en 1 clic",
        rows: today,
      });
    }
    if (recent.length > 0) {
      groups.push({
        id: "recent",
        title: "Sortis cette semaine",
        subtitle: "Derniers épisodes diffusés ces 7 derniers jours",
        rows: recent,
      });
    }
    if (upcomingOnly.length > 0) {
      groups.push({
        id: "upcoming",
        title: "Premiers épisodes à venir cette semaine",
        subtitle: "Diffusion imminente",
        rows: upcomingOnly,
      });
    }
    return groups;
  }, [filteredRows, filterTab, nowMs]);

  return (
    <div className="pt-24 pb-16 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent mb-1.5 flex items-center gap-1.5">
            <ListChecks className="w-3.5 h-3.5" />
            <span>Pointage Hebdomadaire · 1 Clic</span>
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gradient-editorial">
            Épisodes de la Semaine
          </h1>
          <p className="text-sm text-[#8A8FA4] mt-1.5 max-w-2xl">
            Indiquez en un seul clic <strong className="text-white">Oui (Vu)</strong> ou{" "}
            <strong className="text-white">Non (Pas vu)</strong> pour chaque épisode qui vient de
            sortir — sans menus ni manipulations compliquées.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {anilistConnection.connected && anilistAutoSync && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/12 border border-emerald-500/30 text-[11px] font-mono text-emerald-300">
              <ArrowLeftRight className="w-3 h-3" />
              <span>Sync AniList auto</span>
            </span>
          )}
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-white transition-colors"
          >
            <CalendarDays className="w-3.5 h-3.5 text-kinpaku" />
            <span>Calendrier & Saisons</span>
          </Link>
        </div>
      </div>

      {/* Live Weekly Progress Dashboard Card */}
      <div className="rounded-2xl card-surface border-accent/25 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-sm sm:text-base font-semibold text-white">
                {scope === "mylist" ? "Vos sorties cette semaine" : "Toutes les sorties de la semaine"}
              </span>
              {loadingMyAiring && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#8E93A6]">
                  <Loader2 className="w-3 h-3 animate-spin text-accent" />
                  Actualisation AniList...
                </span>
              )}
              {stats.airedCount > 0 && stats.unwatchedCount === 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-[11px] font-semibold text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Tout est à jour !
                </span>
              )}
            </div>
            <p className="text-xs text-[#8E93A6] font-mono">
              <strong className="text-white">{stats.watchedCount}</strong> / {stats.airedCount}{" "}
              épisodes sortis vus ({stats.pct}%) ·{" "}
              <span className={stats.unwatchedCount > 0 ? "text-kinpaku font-semibold" : "text-emerald-400"}>
                {stats.unwatchedCount} à regarder
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
              <span>Mes animés ({myListRows.length})</span>
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
              <span>Toutes les sorties ({allRows.length})</span>
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
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "all" as const, label: "Tout", count: stats.totalCount },
              { id: "unwatched" as const, label: "À voir (Non vus)", count: stats.unwatchedCount },
              { id: "watched" as const, label: "Déjà vus ✓", count: stats.watchedCount },
              { id: "upcoming" as const, label: "À venir", count: stats.upcomingCount },
            ].map((tab) => {
              const active = filterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer inline-flex items-center gap-1.5",
                    active
                      ? "bg-white text-[#090A0F] border-white"
                      : "bg-obsidian/70 border-white/[0.08] text-[#A2A6B8] hover:text-white hover:border-white/[0.16]"
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "font-mono text-[10.5px] px-1.5 py-0.2 rounded-full",
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
              placeholder="Filtrer un anime..."
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-obsidian/80 border border-white/[0.09] text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      </div>

      {/* Episode Checklist Groups */}
      {filteredRows.length === 0 ? (
        <div className="rounded-2xl card-surface p-12 text-center space-y-3">
          {scope === "mylist" && myListRows.length === 0 ? (
            <>
              <p className="text-base font-semibold text-white">
                Aucun anime en cours de diffusion dans votre liste pour l&apos;instant.
              </p>
              <p className="text-xs text-[#858A9E] max-w-md mx-auto">
                Passez sur « Toutes les sorties » pour cocher en 1 clic les animés de la saison que
                vous regardez cette semaine : ils s&apos;ajouteront automatiquement à votre suivi !
              </p>
              <button
                type="button"
                onClick={() => setScope("all")}
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold cursor-pointer shadow-accent"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Voir toutes les sorties de la semaine</span>
              </button>
            </>
          ) : filterTab === "unwatched" ? (
            <>
              <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto" />
              <p className="text-base font-semibold text-white">
                Bravo, aucun épisode en retard !
              </p>
              <p className="text-xs text-[#858A9E]">
                Tous les épisodes sortis cette semaine dans cette vue sont déjà cochés comme vus.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-[#A5A9BB]">Aucun épisode ne correspond à ce filtre.</p>
              <button
                type="button"
                onClick={() => {
                  setFilterTab("all");
                  setSearch("");
                }}
                className="text-xs text-accent-soft hover:underline cursor-pointer"
              >
                Réinitialiser les filtres
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
                    <span>{group.title}</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[#B8BCCB]">
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

                  return (
                    <div
                      key={row.mediaId}
                      className={cn(
                        "group rounded-2xl p-3.5 card-surface border transition-all flex items-center gap-3.5",
                        hasAired && row.isWatched
                          ? "border-emerald-500/35 bg-emerald-500/[0.04]"
                          : hasAired && row.inUserList
                            ? "border-accent/35 bg-accent/[0.03]"
                            : "border-white/[0.08] hover:border-white/[0.16]",
                        isFlashing && "ring-2 ring-emerald-400/70"
                      )}
                    >
                      {/* Poster */}
                      <Link href={`/media/${row.mediaId}`} className="relative shrink-0">
                        <img
                          src={row.media.coverImage.large || row.media.coverImage.extraLarge}
                          alt={title}
                          loading="lazy"
                          decoding="async"
                          className={cn(
                            "w-14 h-20 rounded-xl object-cover border transition-transform duration-300 group-hover:scale-105",
                            row.isWatched ? "border-emerald-400/50" : "border-white/12"
                          )}
                        />
                        {hasAired && row.isWatched && (
                          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-[#07080C] flex items-center justify-center shadow-md">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </Link>

                      {/* Info */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {hasAired ? (
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-md font-mono text-[10.5px] font-bold border",
                                row.isWatched
                                  ? "bg-emerald-500/18 border-emerald-400/40 text-emerald-300"
                                  : "bg-accent/18 border-accent/40 text-accent-soft"
                              )}
                            >
                              Ép. {row.latestAiredEpisode} sorti
                            </span>
                          ) : (
                            row.nextEpisode && (
                              <span className="px-2 py-0.5 rounded-md font-mono text-[10.5px] font-bold bg-kinpaku/18 border border-kinpaku/40 text-kinpaku">
                                Ép. {row.nextEpisode.episode} bientôt
                              </span>
                            )
                          )}

                          {/* Behind indicator just like AniList ("2 ép. de retard") */}
                          {hasAired && row.inUserList && row.behindCount >= 2 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/18 border border-amber-400/40 font-mono text-[10px] font-semibold text-amber-300">
                              <AlertCircle className="w-3 h-3" />
                              {row.behindCount} ép. de retard
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
                          className="block text-sm font-semibold text-[#F4F3EE] hover:text-accent-hover transition-colors line-clamp-1"
                        >
                          {title}
                        </Link>

                        <div className="flex items-center gap-2 flex-wrap text-[11px] text-[#8A8FA4]">
                          {hasAired && row.latestAiredAt && (
                            <span className="font-mono text-[#A6AAB8]">
                              {formatRelativeDayLabel(row.latestAiredAt)}
                            </span>
                          )}
                          {row.inUserList && (
                            <>
                              <span className="text-white/20">·</span>
                              <span className="font-mono text-white/80">
                                Votre avancée : Ép. {row.userProgress}
                                {row.media.episodes ? `/${row.media.episodes}` : ""}
                              </span>
                            </>
                          )}
                          {row.nextEpisode && row.nextEpisode.airingAt > nowSec && (
                            <>
                              <span className="text-white/20">·</span>
                              <span className="inline-flex items-center gap-1 font-mono text-kinpaku/90">
                                <Clock className="w-3 h-3" />
                                Ép. {row.nextEpisode.episode} · {formatCountdown(row.nextEpisode.airingAt)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 1-CLICK OUI / NON TOGGLE */}
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        {hasAired ? (
                          <>
                            <div
                              role="group"
                              aria-label={`Avez-vous regardé ${title} épisode ${row.latestAiredEpisode} ?`}
                              className="inline-flex items-center p-0.5 rounded-xl bg-obsidian/90 border border-white/[0.1]"
                            >
                              {/* NON (Pas vu) */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (row.isWatched) markEpisodeUnwatched(row);
                                }}
                                title={
                                  row.isWatched
                                    ? `Marquer l'épisode ${row.latestAiredEpisode} comme non vu`
                                    : "Pas encore regardé"
                                }
                                className={cn(
                                  "h-8 px-2.5 rounded-lg text-[11.5px] font-semibold inline-flex items-center gap-1 transition-all cursor-pointer",
                                  !row.isWatched
                                    ? "bg-white/[0.12] text-white"
                                    : "text-[#7D8296] hover:text-rose-300 hover:bg-rose-500/12"
                                )}
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Non</span>
                              </button>

                              {/* OUI (Vu ✓) */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (!row.isWatched) {
                                    markEpisodeWatched(row, row.latestAiredEpisode);
                                  }
                                }}
                                title={
                                  row.isWatched
                                    ? `Épisode ${row.latestAiredEpisode} déjà marqué comme vu`
                                    : `Marquer l'épisode ${row.latestAiredEpisode} comme vu en 1 clic`
                                }
                                className={cn(
                                  "h-8 px-3 rounded-lg text-[11.5px] font-semibold inline-flex items-center gap-1 transition-all cursor-pointer",
                                  row.isWatched
                                    ? "bg-emerald-500 text-[#07080C] shadow-[0_6px_18px_rgba(16,185,129,0.4)]"
                                    : "text-[#C6CAD8] hover:bg-accent hover:text-accent-fg"
                                )}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[2.8]" />
                                <span>Oui</span>
                              </button>
                            </div>

                            {/* Quick +1 step button ONLY when behind by 2+ episodes */}
                            {row.inUserList && row.behindCount >= 2 && (
                              <button
                                type="button"
                                onClick={() => incrementProgress(row.mediaId, 1)}
                                className="text-[10.5px] font-mono font-semibold text-amber-300 hover:text-white px-2 py-0.5 rounded-md bg-amber-500/12 hover:bg-amber-500/25 border border-amber-400/30 transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Juste Ép. {row.userProgress + 1}</span>
                              </button>
                            )}
                          </>
                        ) : (
                          /* Upcoming Episode 1 (not aired yet) -> 1-click Follow */
                          <button
                            type="button"
                            onClick={() =>
                              upsertEntry(row.media, {
                                status: row.inUserList ? "WATCHING" : "PLAN_TO_WATCH",
                              })
                            }
                            className={cn(
                              "h-8 px-3 rounded-xl text-xs font-semibold border transition-colors cursor-pointer inline-flex items-center gap-1.5",
                              row.inUserList
                                ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                                : "bg-white/[0.06] hover:bg-accent border-white/[0.1] hover:border-accent text-white hover:text-accent-fg"
                            )}
                          >
                            {row.inUserList ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Suivi</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>Suivre</span>
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
