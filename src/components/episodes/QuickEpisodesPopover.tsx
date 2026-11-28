"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListChecks,
  Plus,
  Minus,
  Check,
  ArrowRight,
  Loader2,
  Flame,
  Tv,
  Sun,
  CalendarRange,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { getSettingsCopy } from "@/lib/settings-translations";
import { cn } from "@/lib/utils";
import type { WatchingAiringItem } from "@/app/api/anilist/watching-airing/route";

interface CachedAiring {
  key: string;
  at: number;
  items: WatchingAiringItem[];
}

let airingMemCache: CachedAiring | null = null;
const CACHE_TTL_MS = 3 * 60 * 1000;

function isSameLocalDay(unixSec: number | null): boolean {
  if (!unixSec) return false;
  const dt = new Date(unixSec * 1000);
  const now = new Date();
  return (
    dt.getFullYear() === now.getFullYear() &&
    dt.getMonth() === now.getMonth() &&
    dt.getDate() === now.getDate()
  );
}

function formatShortBroadcastDay(
  unixSec: number | null,
  locale: string,
  todayLabel: string,
  fallbackLabel: string
): string {
  if (!unixSec) return fallbackLabel;
  const dt = new Date(unixSec * 1000);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startTarget = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diffDays = Math.round((startTarget - startToday) / 86400000);
  const timeStr = dt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return `${todayLabel} · ${timeStr}`;
  const day = dt.toLocaleDateString(locale, { weekday: "short", day: "numeric" });
  return `${day.charAt(0).toUpperCase() + day.slice(1)} · ${timeStr}`;
}

/**
 * Universal Quick Access Drawer (Mobile & Desktop) for Today / Week Episodes:
 * Mark "+1 Vu" or "-1 Pas vu" directly from any page in 1 tap without leaving your view.
 */
export function QuickEpisodesPopover() {
  const { library, hydrated, incrementProgress, contentLanguage } = useShiori();
  const { t, tr, locale } = useTranslation();
  const copy = getSettingsCopy(contentLanguage).quickEp;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"week" | "today">("week");
  const [loading, setLoading] = useState(false);
  const [airingItems, setAiringItems] = useState<WatchingAiringItem[]>([]);
  const [flashId, setFlashId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const watchingAnime = useMemo(
    () =>
      library
        .filter((e) => e.type === "ANIME" && e.status === "WATCHING")
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [library]
  );

  const watchingIds = useMemo(
    () => watchingAnime.slice(0, 40).map((e) => e.mediaId),
    [watchingAnime]
  );
  const idsKey = watchingIds.join(",");

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Fetch live airing status for Watching anime (cached 3 min)
  useEffect(() => {
    if (!hydrated || watchingIds.length === 0) {
      setAiringItems([]);
      return;
    }
    if (
      airingMemCache &&
      airingMemCache.key === idsKey &&
      Date.now() - airingMemCache.at < CACHE_TTL_MS
    ) {
      setAiringItems(airingMemCache.items);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch("/api/anilist/watching-airing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: watchingIds }),
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.items)) {
          airingMemCache = { key: idsKey, at: Date.now(), items: data.items };
          setAiringItems(data.items);
        }
      })
      .catch(() => {
        // non-fatal
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, idsKey]);

  const airingById = useMemo(() => {
    const map = new Map<number, WatchingAiringItem>();
    for (const item of airingItems) {
      map.set(item.mediaId, item);
    }
    return map;
  }, [airingItems]);

  const quickRows = useMemo(() => {
    return watchingAnime
      .map((entry) => {
        const live = airingById.get(entry.mediaId);
        const latestAiredEpisode = live?.latestAiredEpisode ?? 0;
        const isOngoingAiring = Boolean(live && latestAiredEpisode > 0);
        const plannedTotal = live?.episodes ?? entry.totalUnits ?? null;
        const availableEpisodes = isOngoingAiring
          ? latestAiredEpisode
          : (plannedTotal ?? 0);
        const remainingToCatchUp =
          availableEpisodes > 0 ? Math.max(0, availableEpisodes - entry.progress) : 0;
        const hasNewAired = isOngoingAiring && remainingToCatchUp > 0;
        const isUpToDate = availableEpisodes > 0 && remainingToCatchUp === 0;
        const isToday =
          isSameLocalDay(live?.latestAiredAt ?? null) ||
          isSameLocalDay(live?.nextAiringEpisode?.airingAt ?? null);

        return {
          entry,
          isOngoingAiring,
          latestAiredEpisode,
          plannedTotal,
          availableEpisodes,
          latestAiredAt: live?.latestAiredAt ?? null,
          remainingToCatchUp,
          hasNewAired,
          isUpToDate,
          isToday,
        };
      })
      .sort((a, b) => {
        if (a.hasNewAired !== b.hasNewAired) return a.hasNewAired ? -1 : 1;
        const aBehind = a.remainingToCatchUp > 0;
        const bBehind = b.remainingToCatchUp > 0;
        if (aBehind !== bBehind) return aBehind ? -1 : 1;
        if (a.isToday !== b.isToday) return a.isToday ? -1 : 1;
        if (a.hasNewAired && b.hasNewAired) {
          return (b.latestAiredAt ?? 0) - (a.latestAiredAt ?? 0);
        }
        return (
          new Date(b.entry.updatedAt).getTime() - new Date(a.entry.updatedAt).getTime()
        );
      });
  }, [watchingAnime, airingById]);

  const todayRows = useMemo(() => quickRows.filter((r) => r.isToday), [quickRows]);
  const visibleRows = tab === "today" ? todayRows : quickRows;

  const unwatchedAiredCount = useMemo(
    () => quickRows.filter((r) => r.hasNewAired).length,
    [quickRows]
  );

  const behindSummary = useMemo(() => {
    let shows = 0;
    let eps = 0;
    for (const r of quickRows) {
      if (r.remainingToCatchUp > 0) {
        shows += 1;
        eps += r.remainingToCatchUp;
      }
    }
    return { shows, eps };
  }, [quickRows]);

  const handleStep = (mediaId: number, delta: 1 | -1) => {
    incrementProgress(mediaId, delta);
    setFlashId(mediaId);
    setTimeout(() => setFlashId((prev) => (prev === mediaId ? null : prev)), 620);
  };

  return (
    <div className="relative" ref={containerRef}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.93 }}
        onClick={() => setOpen((v) => !v)}
        aria-label={copy.title}
        aria-expanded={open}
        title={copy.title}
        className={cn(
          "relative flex items-center justify-center gap-1.5 h-8.5 sm:h-9 px-2 xl:px-2.5 rounded-full border text-xs font-medium transition-all cursor-pointer shrink-0",
          open
            ? "bg-accent/22 border-accent/60 text-white shadow-[0_0_16px_rgb(var(--shiori-accent-rgb)/0.35)]"
            : "bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.09] hover:border-white/[0.2] text-[#CFD3E2] hover:text-white"
        )}
      >
        <ListChecks className="w-3.5 h-3.5 text-accent-soft shrink-0" />
        <span className="hidden 2xl:inline whitespace-nowrap">{t("nav.toWatch")}</span>
        {(unwatchedAiredCount > 0 || watchingAnime.length > 0) && (
          <span
            className={cn(
              "min-w-[17px] h-[17px] px-1 rounded-full font-mono text-[10px] font-bold flex items-center justify-center",
              unwatchedAiredCount > 0
                ? "bg-accent text-accent-fg shadow-[0_0_10px_rgb(var(--shiori-accent-rgb)/0.65)]"
                : "bg-white/[0.11] text-[#D8DBE8]"
            )}
          >
            {unwatchedAiredCount > 0 ? unwatchedAiredCount : watchingAnime.length}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="fixed inset-x-3 top-[calc(3.85rem+env(safe-area-inset-top))] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2.5 sm:w-[410px] max-w-[calc(100vw-1.5rem)] rounded-2xl bg-surface-solid/98 backdrop-blur-2xl border border-white/[0.14] shadow-[0_28px_72px_rgba(0,0,0,0.92)] overflow-hidden z-50"
          >
            {/* Header + Day / Week Switch */}
            <div className="px-4 py-3 border-b border-white/[0.08] bg-surface-solid-header space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-accent" />
                    <span>{t("episodes.quickHeader")}</span>
                  </p>
                  <p className="text-[11px] text-[#8A8FA4] mt-0.5">
                    {behindSummary.shows > 0
                      ? tr("{shows} en retard · {eps} à voir", {
                          shows: behindSummary.shows,
                          eps: behindSummary.eps,
                        })
                      : watchingAnime.length > 0
                        ? `${tr("Tout est à jour")} · ${watchingAnime.length} ${copy.inProgressUnit}`
                        : `0 ${copy.inProgressUnit}`}
                  </p>
                </div>
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-accent shrink-0" />}
              </div>

              <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-obsidian/80 border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setTab("today")}
                  className={cn(
                    "py-1.5 rounded-lg text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                    tab === "today"
                      ? "bg-accent text-accent-fg shadow-sm"
                      : "text-[#9A9EAE] hover:text-white"
                  )}
                >
                  <Sun className="w-3 h-3" />
                  <span>
                    {copy.today} ({todayRows.length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab("week")}
                  className={cn(
                    "py-1.5 rounded-lg text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                    tab === "week"
                      ? "bg-accent text-accent-fg shadow-sm"
                      : "text-[#9A9EAE] hover:text-white"
                  )}
                >
                  <CalendarRange className="w-3 h-3" />
                  <span>
                    {copy.week} ({quickRows.length})
                  </span>
                </button>
              </div>
            </div>

            {/* Direct -1 / +1 Vu List */}
            <div className="max-h-[58dvh] sm:max-h-[380px] overflow-y-auto overscroll-contain p-2 space-y-1.5">
              {visibleRows.length === 0 ? (
                <div className="py-8 px-4 text-center space-y-2">
                  <Tv className="w-7 h-7 text-[#6E7387] mx-auto" />
                  <p className="text-xs font-medium text-[#CFD3E2]">
                    {tab === "today" ? copy.noTodayPopover : copy.noWatchingPopover}
                  </p>
                  <Link
                    href="/episodes"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-accent-soft hover:text-white"
                  >
                    <span>{copy.exploreWeek}</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ) : (
                visibleRows.slice(0, 10).map((row) => {
                  const e = row.entry;
                  const canInc = !e.totalUnits || e.progress < e.totalUnits;
                  const canDec = e.progress > 0;
                  const isFlashing = flashId === e.mediaId;
                  const airHint = row.latestAiredAt
                    ? formatShortBroadcastDay(
                        row.latestAiredAt,
                        locale,
                        copy.today,
                        t("home.inProgress")
                      )
                    : undefined;

                  return (
                    <div
                      key={e.mediaId}
                      className={cn(
                        "p-2 rounded-xl border flex items-center gap-2.5 transition-all",
                        row.hasNewAired
                          ? "bg-accent/[0.08] border-accent/38"
                          : "bg-obsidian/65 border-white/[0.07] hover:border-white/[0.15]",
                        isFlashing && "ring-2 ring-emerald-400/75"
                      )}
                    >
                      <Link
                        href={`/media/${e.mediaId}`}
                        onClick={() => setOpen(false)}
                        className="shrink-0"
                      >
                        <img
                          src={e.coverImage}
                          alt={e.title}
                          loading="lazy"
                          decoding="async"
                          className="w-10 h-14 rounded-lg object-cover border border-white/12"
                        />
                      </Link>

                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/media/${e.mediaId}`}
                          onClick={() => setOpen(false)}
                          className="text-xs font-semibold text-[#F4F3EE] hover:text-accent-hover transition-colors line-clamp-1"
                        >
                          {e.title}
                        </Link>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          {row.remainingToCatchUp > 0 ? (
                            <span
                              title={airHint}
                              className={cn(
                                "px-1.5 py-0.5 rounded font-mono text-[10px] font-bold leading-none border",
                                row.isOngoingAiring
                                  ? "bg-accent/20 border-accent/40 text-accent-soft"
                                  : "bg-amber-500/14 border-amber-400/35 text-amber-200"
                              )}
                            >
                              {tr("{n} à voir", { n: row.remainingToCatchUp })}
                            </span>
                          ) : row.isUpToDate ? (
                            <span
                              title={airHint}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/35 font-mono text-[10px] font-bold leading-none text-emerald-300"
                            >
                              <Check className="w-2.5 h-2.5 stroke-[2.8]" />
                              <span>{tr("À jour")}</span>
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] text-[#8E93A6]">
                              {t("home.inProgress")}
                            </span>
                          )}

                          <span className="font-mono text-[10.5px] text-white/85 whitespace-nowrap">
                            {row.isOngoingAiring ? (
                              <>
                                {t("common.epShort")}{" "}
                                <strong className="text-white">{e.progress}</strong>
                                {`/${row.latestAiredEpisode}`}
                                {row.plannedTotal && row.plannedTotal > row.latestAiredEpisode && (
                                  <span className="ml-1 text-[10px] text-[#7E8398]">
                                    ({tr("{n} total", { n: row.plannedTotal })})
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                {t("common.epShort")}{" "}
                                <strong className="text-white">{e.progress}</strong>
                                {row.plannedTotal ? `/${row.plannedTotal}` : ""}
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1">
                        {canDec && (
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleStep(e.mediaId, -1)}
                            title={`${copy.notWatched} (-1)`}
                            aria-label={`${copy.notWatched} (-1) · ${e.title}`}
                            className="w-7.5 h-8.5 rounded-lg bg-white/[0.05] hover:bg-rose-500/20 border border-white/[0.09] hover:border-rose-400/40 text-[#9A9EAE] hover:text-rose-200 flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </motion.button>
                        )}
                        {canInc ? (
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.92 }}
                            onClick={() => handleStep(e.mediaId, 1)}
                            aria-label={`+1 ${copy.watched} · ${e.title}`}
                            className="h-8.5 px-2.5 sm:px-3 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg text-[11.5px] font-bold inline-flex items-center gap-1 shadow-[0_6px_16px_rgb(var(--shiori-accent-rgb)/0.38)] transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.8]" />
                            <span>{t("episodes.markWatched")}</span>
                          </motion.button>
                        ) : (
                          <span className="h-8 px-2.5 rounded-lg bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-[11px] font-semibold inline-flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>{t("home.completed")}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Link */}
            <div className="p-2.5 border-t border-white/[0.08] bg-surface-solid-header">
              <Link
                href="/episodes"
                onClick={() => setOpen(false)}
                className="w-full py-2.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.09] text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>{t("episodes.seeFullWeek")}</span>
                <ArrowRight className="w-3.5 h-3.5 text-accent-soft" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
