"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  Clock,
  ArrowRight,
  ListChecks,
  Sun,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Bookmark,
  Globe,
  Plus,
  Minus,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { getSettingsCopy } from "@/lib/settings-translations";
import { CINEMA_EASE } from "@/components/motion/MotionPrimitives";
import { cn, formatCountdown, getDisplayTitle } from "@/lib/utils";
import type { AiringScheduleItem, LibraryEntry, MediaItem } from "@/types/media";
import type { WatchingAiringItem } from "@/app/api/anilist/watching-airing/route";

interface HomeWeeklyCheckStripProps {
  airingSlots: AiringScheduleItem[];
}

type StripTab = "today" | "week";
type StripScope = "mylist" | "all";

const SCOPE_STORAGE_KEY = "shiori_home_ep_scope_v1";

interface CachedHomeAiring {
  key: string;
  at: number;
  items: WatchingAiringItem[];
}

let homeAiringCache: CachedHomeAiring | null = null;
const HOME_AIRING_TTL_MS = 3 * 60 * 1000;

function isSameLocalDay(unixSec: number, nowMs: number): boolean {
  const dt = new Date(unixSec * 1000);
  const now = new Date(nowMs);
  return (
    dt.getFullYear() === now.getFullYear() &&
    dt.getMonth() === now.getMonth() &&
    dt.getDate() === now.getDate()
  );
}

function watchingAiringToScheduleSlot(
  item: WatchingAiringItem,
  nowSec: number
): AiringScheduleItem | null {
  const episode =
    item.latestAiredEpisode > 0
      ? item.latestAiredEpisode
      : item.nextAiringEpisode?.episode ?? 0;
  const airingAt =
    item.latestAiredAt ?? item.nextAiringEpisode?.airingAt ?? null;
  if (!episode || !airingAt) return null;

  const media: MediaItem = {
    id: item.mediaId,
    type: "ANIME",
    title: {
      romaji: item.title.romaji,
      english: item.title.english,
      native: item.title.native,
    },
    coverImage: {
      extraLarge: item.coverImage.extraLarge || item.coverImage.large,
      large: item.coverImage.large || item.coverImage.extraLarge,
      color: item.coverImage.color,
    },
    bannerImage: item.bannerImage,
    description: null,
    format: item.format,
    status: "RELEASING",
    episodes: item.episodes,
    chapters: null,
    volumes: null,
    duration: null,
    season: null,
    seasonYear: null,
    startYear: null,
    averageScore: item.averageScore,
    meanScore: null,
    popularity: null,
    favourites: null,
    genres: item.genres,
    studio: item.studio,
    trailer: null,
    nextAiringEpisode: item.nextAiringEpisode,
  };

  return {
    id: item.mediaId * 10000 + episode,
    episode,
    airingAt,
    timeUntilAiring: airingAt - nowSec,
    media,
  };
}

/**
 * Mobile-only compact collapsible 1-Tap Daily & Weekly Episode Check-In Hub on Home:
 * - Collapsed by default into a sleek 1-row bar (~62px) so Home stays clean and gallery-like
 * - Toggle between "Ma Liste" (only your followed / watching anime) and "Tout" (all weekly releases)
 * - Toggle between "Aujourd'hui" and "Semaine" with 1-tap "Pas vu ✕" / "Vu ✓" buttons
 */
export function HomeWeeklyCheckStrip({ airingSlots }: HomeWeeklyCheckStripProps) {
  const {
    library,
    hydrated,
    getEntry,
    upsertEntry,
    incrementProgress,
    contentLanguage,
  } = useShiori();
  const { t } = useTranslation();
  const copy = getSettingsCopy(contentLanguage).quickEp;

  const [expanded, setExpanded] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [scope, setScope] = useState<StripScope>("mylist");
  const [scopeInitialized, setScopeInitialized] = useState(false);
  const [tab, setTab] = useState<StripTab>("today");
  const [tabInitialized, setTabInitialized] = useState(false);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [initialTrackedIds, setInitialTrackedIds] = useState<Set<number> | null>(null);
  const [liveUserAiring, setLiveUserAiring] = useState<WatchingAiringItem[]>([]);

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  // Freeze initial tracked set once hydrated so tapping "Vu" / "Pas vu" never jumps cards in "Tout" mode
  useEffect(() => {
    if (!hydrated || initialTrackedIds !== null) return;
    setInitialTrackedIds(new Set(library.map((e) => e.mediaId)));
  }, [hydrated, initialTrackedIds, library]);

  // All non-dropped anime in the user's library (for "Ma Liste")
  const trackedLibraryIds = useMemo(
    () =>
      new Set(
        library
          .filter((e) => e.type === "ANIME" && e.status !== "DROPPED")
          .map((e) => e.mediaId)
      ),
    [library]
  );

  // Active WATCHING anime in the user's library (fallback in "Ma Liste" when none are seasonal simulcasts)
  const watchingAnimeEntries = useMemo<LibraryEntry[]>(
    () =>
      library
        .filter((e) => e.type === "ANIME" && e.status === "WATCHING")
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ),
    [library]
  );

  // Active anime IDs to query live AniList airing info so "Ma Liste" never misses a user's simulcast
  const activeQueryIds = useMemo(
    () =>
      library
        .filter(
          (e) =>
            e.type === "ANIME" &&
            (e.status === "WATCHING" ||
              e.status === "PLAN_TO_WATCH" ||
              e.status === "ON_HOLD")
        )
        .slice(0, 40)
        .map((e) => e.mediaId),
    [library]
  );
  const activeQueryKey = activeQueryIds.join(",");

  useEffect(() => {
    if (!hydrated || activeQueryIds.length === 0) {
      setLiveUserAiring([]);
      return;
    }
    if (
      homeAiringCache &&
      homeAiringCache.key === activeQueryKey &&
      Date.now() - homeAiringCache.at < HOME_AIRING_TTL_MS
    ) {
      setLiveUserAiring(homeAiringCache.items);
      return;
    }

    let cancelled = false;
    fetch("/api/anilist/watching-airing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: activeQueryIds }),
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.items)) {
          homeAiringCache = {
            key: activeQueryKey,
            at: Date.now(),
            items: data.items,
          };
          setLiveUserAiring(data.items);
        }
      })
      .catch(() => {
        // non-fatal
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, activeQueryKey]);

  const nowSec = nowMs !== null ? Math.floor(nowMs / 1000) : null;

  // Merge SSR airingSlots + live user airing slots (deduplicated by media.id)
  const allWeekSlots = useMemo(() => {
    const byMedia = new Map<number, AiringScheduleItem>();
    for (const s of airingSlots) {
      if (!byMedia.has(s.media.id)) byMedia.set(s.media.id, s);
    }
    const refNowSec = nowSec ?? Math.floor(Date.now() / 1000);
    for (const live of liveUserAiring) {
      if (!byMedia.has(live.mediaId)) {
        const converted = watchingAiringToScheduleSlot(live, refNowSec);
        if (converted) byMedia.set(live.mediaId, converted);
      }
    }
    return Array.from(byMedia.values()).sort((a, b) => {
      const aTracked = initialTrackedIds ? initialTrackedIds.has(a.media.id) : false;
      const bTracked = initialTrackedIds ? initialTrackedIds.has(b.media.id) : false;
      if (aTracked !== bTracked) return aTracked ? -1 : 1;
      if (nowSec !== null) {
        const aAired = a.airingAt <= nowSec;
        const bAired = b.airingAt <= nowSec;
        if (aAired !== bAired) return aAired ? -1 : 1;
      }
      return a.airingAt - b.airingAt;
    });
  }, [airingSlots, liveUserAiring, initialTrackedIds, nowSec]);

  // Slots strictly belonging to the user's library
  const myListAiringSlots = useMemo(
    () => allWeekSlots.filter((s) => trackedLibraryIds.has(s.media.id)),
    [allWeekSlots, trackedLibraryIds]
  );

  // Restore saved scope preference, or smart-default to "mylist" when the user has tracked anime
  useEffect(() => {
    if (!hydrated || scopeInitialized) return;
    let saved: StripScope | null = null;
    try {
      const raw = localStorage.getItem(SCOPE_STORAGE_KEY);
      if (raw === "mylist" || raw === "all") saved = raw;
    } catch {
      // ignore
    }
    if (saved) {
      setScope(saved);
    } else {
      const hasMyContent =
        myListAiringSlots.length > 0 || watchingAnimeEntries.length > 0;
      setScope(hasMyContent ? "mylist" : "all");
    }
    setScopeInitialized(true);
  }, [hydrated, scopeInitialized, myListAiringSlots.length, watchingAnimeEntries.length]);

  const handleScopeChange = (next: StripScope) => {
    setScope(next);
    try {
      localStorage.setItem(SCOPE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  // True when user selected "Ma Liste" and none of their library anime have a weekly airing slot,
  // so we seamlessly show their "En cours" (WATCHING) library anime with -1 / +1 quick check-in!
  const isWatchingFallbackMode =
    scope === "mylist" &&
    myListAiringSlots.length === 0 &&
    watchingAnimeEntries.length > 0;

  const scopedWeekSlots = useMemo(
    () => (scope === "mylist" ? myListAiringSlots : allWeekSlots),
    [scope, myListAiringSlots, allWeekSlots]
  );

  const scopedTodaySlots = useMemo(() => {
    if (nowMs === null) return [];
    return scopedWeekSlots.filter((s) => isSameLocalDay(s.airingAt, nowMs));
  }, [scopedWeekSlots, nowMs]);

  // Smart default for Today vs Week tab on first hydration
  useEffect(() => {
    if (nowMs === null || tabInitialized) return;
    setTab(scopedTodaySlots.length > 0 ? "today" : "week");
    setTabInitialized(true);
  }, [nowMs, scopedTodaySlots.length, tabInitialized]);

  const visibleSlots = useMemo(() => {
    const source =
      tab === "today" && scopedTodaySlots.length > 0
        ? scopedTodaySlots
        : scopedWeekSlots;
    return source.slice(0, 8);
  }, [tab, scopedTodaySlots, scopedWeekSlots]);

  const myListBadgeCount =
    myListAiringSlots.length > 0
      ? myListAiringSlots.length
      : watchingAnimeEntries.length;

  const summary = useMemo(() => {
    if (isWatchingFallbackMode) {
      const slice = watchingAnimeEntries.slice(0, 8);
      return {
        watched: slice.filter((e) => e.progress > 0).length,
        total: slice.length,
        pct:
          slice.length > 0
            ? Math.round(
                (slice.filter((e) => e.progress > 0).length / slice.length) * 100
              )
            : 0,
      };
    }
    let watched = 0;
    for (const slot of visibleSlots) {
      const entry = getEntry(slot.media.id);
      const isAired = nowSec !== null ? slot.airingAt <= nowSec : false;
      const targetEp = isAired ? slot.episode : Math.max(1, slot.episode - 1);
      if (entry && entry.progress >= targetEp) watched++;
    }
    const total = visibleSlots.length;
    const pct = total > 0 ? Math.round((watched / total) * 100) : 0;
    return { watched, total, pct };
  }, [isWatchingFallbackMode, watchingAnimeEntries, visibleSlots, getEntry, nowSec]);

  if (allWeekSlots.length === 0 && watchingAnimeEntries.length === 0) return null;

  const triggerFlash = (mediaId: number) => {
    setFlashId(mediaId);
    setTimeout(() => setFlashId((prev) => (prev === mediaId ? null : prev)), 620);
  };

  const previewCovers: { id: string | number; src: string }[] = isWatchingFallbackMode
    ? watchingAnimeEntries.slice(0, 3).map((e) => ({ id: e.mediaId, src: e.coverImage }))
    : visibleSlots
        .slice(0, 3)
        .map((s) => ({ id: s.id, src: s.media.coverImage.large }));

  return (
    <section className="w-full max-w-full rounded-2xl card-surface border border-white/[0.09] relative overflow-hidden shadow-[0_12px_34px_rgba(0,0,0,0.36)]">
      {/* Subtle top hairline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent"
      />

      {/* Sleek 1-Row Collapsible Trigger Bar (unobtrusive on mobile Home, expands in 1 tap!) */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full px-3.5 py-3 flex items-center justify-between gap-2.5 text-left active:bg-white/[0.04] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-accent/16 border border-accent/35 flex items-center justify-center shrink-0">
            <ListChecks className="w-4 h-4 text-accent-soft" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-semibold text-white truncate">
                {copy.title}
              </p>
              {!isWatchingFallbackMode &&
                summary.total > 0 &&
                summary.watched === summary.total && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
            </div>
            <p className="text-[11px] font-mono text-[#8C91A6] truncate mt-0.5 flex items-center gap-1.5">
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded text-[9.5px] font-sans font-semibold border shrink-0",
                  scope === "mylist"
                    ? "bg-accent/15 border-accent/35 text-accent-soft"
                    : "bg-white/[0.06] border-white/[0.1] text-[#B8BCCB]"
                )}
              >
                {scope === "mylist" ? t("nav.myList") : t("common.all")}
              </span>
              <span className="truncate">
                {isWatchingFallbackMode ? (
                  <>
                    <strong className="text-white">{watchingAnimeEntries.length}</strong>{" "}
                    {copy.inProgressUnit}
                  </>
                ) : (
                  <>
                    <strong className="text-white">{summary.watched}</strong>/{summary.total}{" "}
                    {copy.watchedUnit} ·{" "}
                    {scopedTodaySlots.length > 0
                      ? `${copy.today} (${scopedTodaySlots.length})`
                      : `${copy.week} (${scopedWeekSlots.length})`}
                  </>
                )}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Tiny overlapping poster peeks */}
          {!expanded && previewCovers.length > 0 && (
            <div className="flex items-center -space-x-2">
              {previewCovers.map((cover) => (
                <img
                  key={cover.id}
                  src={cover.src}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                  className="w-6 h-8 rounded-md object-cover border border-obsidian ring-1 ring-white/15"
                />
              ))}
            </div>
          )}

          <span
            className={cn(
              "w-7 h-7 rounded-full border flex items-center justify-center transition-all",
              expanded
                ? "bg-accent/20 border-accent/45 text-accent-soft"
                : "bg-white/[0.05] border-white/[0.1] text-[#A8ADBE]"
            )}
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
          </span>
        </div>
      </button>

      {/* Smoothly Expanding Quick Check-In Drawer */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: CINEMA_EASE }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 pt-1 border-t border-white/[0.07] space-y-2.5">
              {/* Row 1: Scope Switch ("Ma Liste" vs "Tout") + "Tout voir" link */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5">
                <div className="inline-flex items-center p-0.5 rounded-full bg-obsidian/85 border border-white/[0.09]">
                  {(
                    [
                      {
                        id: "mylist" as const,
                        label: t("nav.myList"),
                        count: myListBadgeCount,
                        icon: Bookmark,
                      },
                      {
                        id: "all" as const,
                        label: t("common.all"),
                        count: allWeekSlots.length,
                        icon: Globe,
                      },
                    ] as const
                  ).map((opt) => {
                    const active = scope === opt.id;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleScopeChange(opt.id)}
                        className={cn(
                          "relative px-2.5 py-1 rounded-full text-[11.5px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1",
                          active ? "text-accent-fg" : "text-[#9A9EAE] hover:text-white"
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="home-ep-list-scope"
                            transition={{ type: "spring", stiffness: 420, damping: 32 }}
                            className="absolute inset-0 rounded-full bg-accent shadow-accent"
                          />
                        )}
                        <Icon className="w-3 h-3 relative z-10" />
                        <span className="relative z-10">{opt.label}</span>
                        <span
                          className={cn(
                            "relative z-10 font-mono text-[10px] px-1 rounded-full",
                            active
                              ? "bg-black/20 text-accent-fg"
                              : "bg-white/[0.08] text-[#B8BCCB]"
                          )}
                        >
                          {opt.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <Link
                  href="/episodes"
                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent-soft hover:text-white transition-colors shrink-0"
                >
                  <span>{copy.seeAll}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Row 2: Today / Week Switch (shown when viewing weekly airing slots) */}
              {!isWatchingFallbackMode && scopedWeekSlots.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center p-0.5 rounded-full bg-white/[0.03] border border-white/[0.08]">
                    {(
                      [
                        {
                          id: "today" as const,
                          label: copy.today,
                          count: scopedTodaySlots.length,
                          icon: Sun,
                        },
                        {
                          id: "week" as const,
                          label: copy.week,
                          count: scopedWeekSlots.length,
                          icon: CalendarRange,
                        },
                      ] as const
                    ).map((opt) => {
                      const active = tab === opt.id;
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setTab(opt.id)}
                          className={cn(
                            "relative px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1",
                            active ? "text-white" : "text-[#8C91A6] hover:text-white"
                          )}
                        >
                          {active && (
                            <motion.span
                              layoutId="home-ep-time-tab"
                              transition={{ type: "spring", stiffness: 420, damping: 32 }}
                              className="absolute inset-0 rounded-full bg-white/[0.12] border border-white/[0.14]"
                            />
                          )}
                          <Icon className="w-3 h-3 relative z-10 text-kinpaku" />
                          <span className="relative z-10">{opt.label}</span>
                          <span className="relative z-10 font-mono text-[10px] opacity-80">
                            {opt.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <span className="text-[10.5px] font-mono text-[#8C91A6]">
                    <strong className="text-white">{summary.watched}</strong>/{summary.total}{" "}
                    {copy.watchedUnit}
                  </span>
                </div>
              )}

              {/* Slim Progress Bar */}
              {!isWatchingFallbackMode && scopedWeekSlots.length > 0 && (
                <div className="h-1 w-full rounded-full bg-white/[0.07] overflow-hidden">
                  <motion.div
                    initial={false}
                    animate={{ width: `${summary.pct}%` }}
                    transition={{ type: "spring", stiffness: 220, damping: 26 }}
                    className="h-full rounded-full bg-gradient-to-r from-accent via-accent-hover to-emerald-400"
                  />
                </div>
              )}

              {!isWatchingFallbackMode &&
                tab === "today" &&
                scopedTodaySlots.length === 0 &&
                scopedWeekSlots.length > 0 && (
                  <p className="text-[11px] text-[#9A9EAE]">{copy.noTodayHome}</p>
                )}

              {/* CONTENT:
                  Case 1: Empty "Ma Liste" (0 tracked anime at all)
                  Case 2: "Ma Liste" fallback -> user's WATCHING anime with -1 / +1 Vu
                  Case 3: Airing schedule slots (filtered by "Ma Liste" OR "Tout") */}
              {scope === "mylist" &&
              scopedWeekSlots.length === 0 &&
              watchingAnimeEntries.length === 0 ? (
                <div className="py-4 px-3 rounded-xl bg-white/[0.03] border border-white/[0.07] text-center space-y-2">
                  <p className="text-xs text-[#C6CAD8]">{copy.noWatchingPopover}</p>
                  <button
                    type="button"
                    onClick={() => handleScopeChange("all")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/18 border border-accent/40 text-xs font-semibold text-accent-soft hover:text-white transition-colors cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{copy.exploreWeek}</span>
                  </button>
                </div>
              ) : isWatchingFallbackMode ? (
                <div className="flex gap-2.5 overflow-x-auto touch-rail no-scrollbar pb-0.5 -mx-0.5 px-0.5">
                  {watchingAnimeEntries.slice(0, 8).map((entry) => {
                    const canInc = !entry.totalUnits || entry.progress < entry.totalUnits;
                    const canDec = entry.progress > 0;
                    const isFlashing = flashId === entry.mediaId;

                    return (
                      <div
                        key={entry.mediaId}
                        className={cn(
                          "w-[236px] shrink-0 rounded-2xl p-2.5 border bg-white/[0.035] border-white/[0.08] transition-all duration-200 flex flex-col justify-between gap-2.5",
                          isFlashing && "ring-2 ring-emerald-400/75"
                        )}
                      >
                        <Link
                          href={`/media/${entry.mediaId}`}
                          className="flex items-center gap-2.5 group"
                        >
                          <img
                            src={entry.coverImage}
                            alt={entry.title}
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                            className="w-11 h-15 rounded-xl object-cover border border-white/12 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-md border font-semibold bg-accent/18 text-accent-soft border-accent/35">
                              {t("common.epShort")} {entry.progress}
                              {entry.totalUnits ? `/${entry.totalUnits}` : ""}
                            </span>
                            <p className="text-[12.5px] font-semibold text-[#F4F3EE] truncate mt-1">
                              {entry.title}
                            </p>
                            <p className="text-[10.5px] font-mono text-[#8C91A6] truncate mt-0.5">
                              {t("home.inProgress")}
                            </p>
                          </div>
                        </Link>

                        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-obsidian/85 border border-white/[0.09]">
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            disabled={!canDec}
                            onClick={() => {
                              if (!canDec) return;
                              incrementProgress(entry.mediaId, -1);
                            }}
                            className="h-8 rounded-lg text-[11.5px] font-semibold inline-flex items-center justify-center gap-1 transition-all cursor-pointer text-[#B8BCCB] hover:text-rose-300 hover:bg-rose-500/12 disabled:opacity-35"
                          >
                            <Minus className="w-3.5 h-3.5" />
                            <span>{copy.notWatched}</span>
                          </motion.button>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            disabled={!canInc}
                            onClick={() => {
                              if (!canInc) return;
                              incrementProgress(entry.mediaId, 1);
                              triggerFlash(entry.mediaId);
                            }}
                            className="h-8 rounded-lg text-[11.5px] font-bold inline-flex items-center justify-center gap-1 transition-all cursor-pointer bg-accent text-accent-fg shadow-[0_4px_14px_rgb(var(--shiori-accent-rgb)/0.38)] disabled:opacity-45"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.8]" />
                            <span>{copy.watched}</span>
                          </motion.button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex gap-2.5 overflow-x-auto touch-rail no-scrollbar pb-0.5 -mx-0.5 px-0.5">
                  {visibleSlots.map((slot) => {
                    const entry = getEntry(slot.media.id);
                    const isAired = nowSec !== null ? slot.airingAt <= nowSec : false;
                    const targetEp = isAired
                      ? slot.episode
                      : Math.max(1, slot.episode - 1);
                    const isWatched = Boolean(entry && entry.progress >= targetEp);
                    const title = getDisplayTitle(slot.media);
                    const isFlashing = flashId === slot.media.id;

                    return (
                      <div
                        key={slot.id}
                        className={cn(
                          "w-[236px] shrink-0 rounded-2xl p-2.5 border transition-all duration-200 flex flex-col justify-between gap-2.5",
                          isWatched
                            ? "bg-emerald-500/[0.07] border-emerald-500/38"
                            : "bg-white/[0.035] border-white/[0.08]",
                          isFlashing && "ring-2 ring-emerald-400/75"
                        )}
                      >
                        <Link
                          href={`/media/${slot.media.id}`}
                          className="flex items-center gap-2.5 group"
                        >
                          <div className="relative shrink-0">
                            <img
                              src={slot.media.coverImage.large}
                              alt={title}
                              loading="lazy"
                              decoding="async"
                              draggable={false}
                              className={cn(
                                "w-11 h-15 rounded-xl object-cover border",
                                isWatched ? "border-emerald-400/50" : "border-white/12"
                              )}
                            />
                            {isWatched && (
                              <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-emerald-500 text-[#07080C] flex items-center justify-center shadow">
                                <Check className="w-2.5 h-2.5 stroke-[3.2]" />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-md border font-semibold",
                                isWatched
                                  ? "bg-emerald-500/18 text-emerald-300 border-emerald-400/35"
                                  : "bg-accent/18 text-accent-soft border-accent/35"
                              )}
                            >
                              {t("common.epShort")} {targetEp}{" "}
                              {isWatched
                                ? `${copy.watched} ✓`
                                : isAired
                                  ? copy.aired
                                  : copy.available}
                            </span>
                            <p className="text-[12.5px] font-semibold text-[#F4F3EE] truncate mt-1">
                              {title}
                            </p>
                            <p className="text-[10.5px] font-mono text-[#8C91A6] flex items-center gap-1 mt-0.5 truncate">
                              <Clock className="w-3 h-3 text-kinpaku shrink-0" />
                              <span suppressHydrationWarning className="truncate">
                                {nowSec !== null
                                  ? formatCountdown(slot.airingAt, nowSec, contentLanguage)
                                  : copy.week}
                              </span>
                            </p>
                          </div>
                        </Link>

                        {/* 1-tap Pas vu / Vu toggle */}
                        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-obsidian/85 border border-white/[0.09]">
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            onClick={() => {
                              if (isWatched) {
                                upsertEntry(slot.media, {
                                  status: "WATCHING",
                                  progress: Math.max(0, targetEp - 1),
                                });
                              }
                            }}
                            className={cn(
                              "h-8 rounded-lg text-[11.5px] font-semibold inline-flex items-center justify-center gap-1 transition-all cursor-pointer",
                              !isWatched
                                ? "bg-white/[0.12] text-white shadow-sm"
                                : "text-[#8A8FA4] hover:text-rose-300 hover:bg-rose-500/12"
                            )}
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>{copy.notWatched}</span>
                          </motion.button>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            onClick={() => {
                              if (!isWatched) {
                                const total = slot.media.episodes;
                                upsertEntry(slot.media, {
                                  status:
                                    total && targetEp >= total ? "COMPLETED" : "WATCHING",
                                  progress: targetEp,
                                });
                                triggerFlash(slot.media.id);
                              }
                            }}
                            className={cn(
                              "h-8 rounded-lg text-[11.5px] font-bold inline-flex items-center justify-center gap-1 transition-all cursor-pointer",
                              isWatched
                                ? "bg-emerald-500 text-[#07080C] shadow-[0_4px_14px_rgba(16,185,129,0.38)]"
                                : "text-[#D4D7E4] hover:bg-accent hover:text-accent-fg"
                            )}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.8]" />
                            <span>{copy.watched}</span>
                          </motion.button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
