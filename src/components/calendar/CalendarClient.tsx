"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CINEMA_EASE } from "@/components/motion/MotionPrimitives";
import {
  Clock,
  Star,
  Plus,
  Check,
  Search,
  CalendarDays,
  Sparkles,
  Bookmark,
  Play,
  Users,
  CalendarClock,
  BookmarkPlus,
  CheckCircle2,
  Tv,
  Film,
  Layers,
  ChevronRight,
  ChevronLeft,
  Globe,
  X,
  ListChecks,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { TranslatedSynopsis } from "@/components/media/TranslatedSynopsis";
import { StreamingIconsStrip } from "@/components/media/WhereToWatchSection";
import {
  buildMonthCalendarGrid,
  formatDateKeyInTimezone,
  formatTimeInTimezone,
} from "@/lib/calendar-utils";
import {
  clearSessionState,
  FILTER_STORAGE_KEYS,
  readSessionState,
  syncUrlSearchParams,
  writeSessionState,
  type PersistedCalendarState,
} from "@/lib/filter-persistence";
import {
  cn,
  formatCompactNumber,
  formatCountdown,
  formatFormat,
  formatScore,
  formatSeason,
  getDisplayTitle,
  STATUS_CONFIG,
} from "@/lib/utils";
import type { SeasonalBucket } from "@/lib/anilist";
import type { AiringScheduleItem, MediaItem } from "@/types/media";

const DAY_NAMES_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAY_NAMES_FULL = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];
const MONTHS_FR = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

function formatReleaseDate(
  media: MediaItem,
  nowMs: number | null
): { label: string; daysUntil: number | null } {
  const d = media.startDate;
  if (d?.year && d?.month && d?.day) {
    const dt = new Date(d.year, d.month - 1, d.day);
    const diffDays =
      nowMs && nowMs > 0 ? Math.ceil((dt.getTime() - nowMs) / 86400000) : null;
    return {
      label: `${d.day} ${MONTHS_FR[d.month - 1]} ${d.year}`,
      daysUntil: diffDays !== null && diffDays > 0 ? diffDays : null,
    };
  }
  if (media.season && media.seasonYear) {
    return { label: formatSeason(media.season, media.seasonYear), daysUntil: null };
  }
  if (d?.year && d?.month) {
    return { label: `${MONTHS_FR[d.month - 1]} ${d.year}`, daysUntil: null };
  }
  if (d?.year || media.seasonYear) {
    return { label: String(d?.year ?? media.seasonYear), daysUntil: null };
  }
  return { label: "Date à confirmer", daysUntil: null };
}

type SeasonFormatFilter = "ALL" | "TV" | "MOVIE" | "ONA_OVA" | "MYLIST";
type CalendarViewMode = "day" | "week" | "month";

const MONTH_NAMES_FULL_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const WEEKDAY_HEADERS_MON = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

interface CalendarClientProps {
  schedule: AiringScheduleItem[];
  seasons: SeasonalBucket[];
}

export function CalendarClient({ schedule, seasons }: CalendarClientProps) {
  const { getEntry, quickAdd, upsertEntry, openQuickEdit, incrementProgress, openTrailer } = useShiori();

  const [tzMode, setTzMode] = useState<"local" | "jst">("local");
  const [localTimeZone, setLocalTimeZone] = useState<string>("UTC");
  const [nowMs, setNowMs] = useState<number | null>(null);
  const activeTimeZone = tzMode === "jst" ? "Asia/Tokyo" : localTimeZone;

  const anchorMs = useMemo(() => {
    if (nowMs !== null) return nowMs;
    const firstSlot = schedule[0]?.airingAt;
    return firstSlot ? firstSlot * 1000 : Date.UTC(2026, 0, 1);
  }, [nowMs, schedule]);

  const [viewMode, setViewMode] = useState<CalendarViewMode>("day");
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date(schedule[0]?.airingAt ? schedule[0].airingAt * 1000 : Date.UTC(2026, 0, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });

  // Hydrate browser timezone & live clock after mount so SSR and client never diverge (React #418)
  useEffect(() => {
    let tz = "UTC";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      tz = "UTC";
    }
    const now = Date.now();
    const today = new Date(now);
    const todayKey = formatDateKeyInTimezone(today, tz);
    setLocalTimeZone(tz);
    setNowMs(now);
    setMonthCursor({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedDayKey(todayKey);
    setSelectedMonthDateKey(todayKey);

    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Rolling 7 days starting from Today (anchored deterministically on SSR)
  const rollingDays = useMemo(() => {
    const base = new Date(anchorMs);
    if (nowMs !== null) {
      base.setHours(0, 0, 0, 0);
    } else {
      base.setUTCHours(0, 0, 0, 0);
    }
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      if (nowMs !== null) {
        d.setDate(base.getDate() + i);
      } else {
        d.setUTCDate(base.getUTCDate() + i);
      }
      return {
        key: formatDateKeyInTimezone(d, activeTimeZone),
        short: DAY_NAMES_SHORT[nowMs !== null ? d.getDay() : d.getUTCDay()],
        full: DAY_NAMES_FULL[nowMs !== null ? d.getDay() : d.getUTCDay()],
        dayNum: nowMs !== null ? d.getDate() : d.getUTCDate(),
        monthLabel: MONTHS_FR[nowMs !== null ? d.getMonth() : d.getUTCMonth()],
        isToday: i === 0,
        isTomorrow: i === 1,
      };
    });
  }, [anchorMs, nowMs, activeTimeZone]);

  // Section 1 state (Daily / Weekly / Monthly Schedule)
  const [selectedDayKey, setSelectedDayKey] = useState<string>(rollingDays[0].key);
  const [selectedMonthDateKey, setSelectedMonthDateKey] = useState<string>(rollingDays[0].key);
  const [scheduleOnlyMyList, setScheduleOnlyMyList] = useState(false);

  // Section 2 state (MyAnimeList-style Seasonal Browser — Current + Upcoming Seasons)
  const defaultSeasonId = seasons[1]?.id ?? seasons[0]?.id ?? "ANNOUNCED";
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(defaultSeasonId);
  const [seasonFormat, setSeasonFormat] = useState<SeasonFormatFilter>("ALL");
  const [seasonSearch, setSeasonSearch] = useState("");
  const [filtersReady, setFiltersReady] = useState(false);

  // Restore calendar filters from URL query params or sessionStorage when navigating back
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const saved = readSessionState<PersistedCalendarState>(FILTER_STORAGE_KEYS.calendar);
    const hasUrl = Array.from(params.keys()).length > 0;

    const tz = hasUrl ? params.get("tz") : saved?.tzMode;
    if (tz === "local" || tz === "jst") setTzMode(tz);

    const vm = hasUrl ? params.get("view") : saved?.viewMode;
    if (vm === "day" || vm === "week" || vm === "month") setViewMode(vm);

    const onlyMyList = hasUrl
      ? params.get("mylist") === "1"
      : Boolean(saved?.scheduleOnlyMyList);
    if (onlyMyList) setScheduleOnlyMyList(true);

    const seasonId = hasUrl ? params.get("season") : saved?.selectedSeasonId;
    if (seasonId && seasons.some((s) => s.id === seasonId)) {
      setSelectedSeasonId(seasonId);
    }

    const fmt = hasUrl ? params.get("format") : saved?.seasonFormat;
    if (fmt === "ALL" || fmt === "TV" || fmt === "MOVIE" || fmt === "ONA_OVA" || fmt === "MYLIST") {
      setSeasonFormat(fmt);
    }

    const q = hasUrl ? (params.get("q") ?? "") : (saved?.seasonSearch ?? "");
    if (q) setSeasonSearch(q);

    setFiltersReady(true);
  }, [seasons]);

  // Persist calendar filters to URL & sessionStorage
  useEffect(() => {
    if (!filtersReady) return;
    const params = new URLSearchParams();
    if (tzMode !== "local") params.set("tz", tzMode);
    if (viewMode !== "day") params.set("view", viewMode);
    if (scheduleOnlyMyList) params.set("mylist", "1");
    if (selectedSeasonId !== defaultSeasonId) params.set("season", selectedSeasonId);
    if (seasonFormat !== "ALL") params.set("format", seasonFormat);
    if (seasonSearch.trim()) params.set("q", seasonSearch.trim());

    const qs = syncUrlSearchParams("/calendar", params);
    if (qs) {
      writeSessionState<PersistedCalendarState>(FILTER_STORAGE_KEYS.calendar, {
        tzMode,
        viewMode,
        scheduleOnlyMyList,
        selectedSeasonId,
        seasonFormat,
        seasonSearch,
      });
    } else {
      clearSessionState(FILTER_STORAGE_KEYS.calendar);
    }
  }, [
    filtersReady,
    tzMode,
    viewMode,
    scheduleOnlyMyList,
    selectedSeasonId,
    defaultSeasonId,
    seasonFormat,
    seasonSearch,
  ]);

  const nowTimeStr =
    nowMs !== null ? formatTimeInTimezone(Math.floor(nowMs / 1000), activeTimeZone) : "--:--";

  // Group schedule by date key in active timezone
  const byDay = useMemo(() => {
    const map: Record<string, AiringScheduleItem[]> = {};
    for (const d of rollingDays) map[d.key] = [];

    for (const item of schedule) {
      if (scheduleOnlyMyList && !getEntry(item.media.id)) continue;
      const k = formatDateKeyInTimezone(new Date(item.airingAt * 1000), activeTimeZone);
      if (map[k]) map[k].push(item);
    }

    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.airingAt - b.airingAt);
    }
    return map;
  }, [schedule, rollingDays, scheduleOnlyMyList, getEntry, activeTimeZone]);

  const allSeasonalMedia = useMemo(() => {
    const list: MediaItem[] = [];
    for (const bucket of seasons) {
      for (const m of bucket.items) {
        if (scheduleOnlyMyList && !getEntry(m.id)) continue;
        list.push(m);
      }
    }
    return list;
  }, [seasons, scheduleOnlyMyList, getEntry]);

  const monthGrid = useMemo(() => {
    const filteredSchedule = scheduleOnlyMyList
      ? schedule.filter((s) => Boolean(getEntry(s.media.id)))
      : schedule;
    return buildMonthCalendarGrid(
      monthCursor.year,
      monthCursor.month,
      filteredSchedule,
      allSeasonalMedia,
      { timeZone: activeTimeZone, today: new Date(anchorMs) }
    );
  }, [monthCursor, schedule, scheduleOnlyMyList, getEntry, allSeasonalMedia, activeTimeZone, anchorMs]);

  const activeDayItems = useMemo(
    () => byDay[selectedDayKey] ?? [],
    [byDay, selectedDayKey]
  );
  const activeDayMeta =
    rollingDays.find((d) => d.key === selectedDayKey) ?? rollingDays[0];

  // Split selected day cleanly into:
  // 1) "À venir aujourd'hui" (upcoming later today / on selected day)
  // 2) "Déjà sortis aujourd'hui" (already aired earlier today)
  const dayUpcoming = useMemo(
    () => activeDayItems.filter((s) => s.airingAt * 1000 >= anchorMs),
    [activeDayItems, anchorMs]
  );
  const dayAired = useMemo(
    () => activeDayItems.filter((s) => s.airingAt * 1000 < anchorMs).reverse(),
    [activeDayItems, anchorMs]
  );

  const trackedThisWeek = useMemo(
    () => schedule.filter((s) => Boolean(getEntry(s.media.id))).length,
    [schedule, getEntry]
  );

  // Active seasonal bucket (MAL-style section)
  const activeSeason =
    seasons.find((s) => s.id === selectedSeasonId) ?? seasons[0];

  const filteredSeasonItems = useMemo(() => {
    const list = activeSeason?.items ?? [];
    const q = seasonSearch.trim().toLowerCase();
    return list
      .filter((m) =>
        q
          ? getDisplayTitle(m).toLowerCase().includes(q) ||
            (m.studio ?? "").toLowerCase().includes(q) ||
            m.genres.some((g) => g.toLowerCase().includes(q))
          : true
      )
      .filter((m) => {
        if (seasonFormat === "TV") return m.format === "TV" || m.format === "TV_SHORT";
        if (seasonFormat === "MOVIE") return m.format === "MOVIE";
        if (seasonFormat === "ONA_OVA")
          return m.format === "ONA" || m.format === "OVA" || m.format === "SPECIAL";
        if (seasonFormat === "MYLIST") return Boolean(getEntry(m.id));
        return true;
      });
  }, [activeSeason, seasonSearch, seasonFormat, getEntry]);

  const renderEpisodeCard = (slot: AiringScheduleItem, isPast: boolean) => {
    const title = getDisplayTitle(slot.media);
    const entry = getEntry(slot.media.id);
    const timeStr = formatTimeInTimezone(slot.airingAt, activeTimeZone);

    return (
      <div
        key={slot.id}
        className={cn(
          "group rounded-2xl p-3.5 card-surface hover:border-white/[0.18] transition-colors flex items-center gap-3.5",
          entry && "ring-1 ring-accent/35 bg-accent/[0.03]",
          !isPast && !entry && "border-[#F0B95B]/20"
        )}
      >
        {/* Time Column */}
        <div className="w-[76px] shrink-0 text-center border-r border-white/[0.08] pr-3">
          <p className="font-mono text-base font-bold text-white">{timeStr}</p>
          <span
            className={cn(
              "inline-block mt-1 whitespace-nowrap text-[9.5px] font-mono font-semibold px-1.5 py-0.5 rounded",
              isPast
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-[#F0B95B]/18 text-[#F0B95B]"
            )}
          >
            {isPast ? "Sorti" : "À venir"}
          </span>
        </div>

        {/* Poster */}
        <Link href={`/media/${slot.media.id}`} className="shrink-0">
          <img
            src={slot.media.coverImage.large}
            alt={title}
            loading="lazy"
            decoding="async"
            className="w-13 h-19 rounded-xl object-cover border border-white/10 group-hover:scale-105 transition-transform duration-300"
          />
        </Link>

        {/* Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="px-2 py-0.5 rounded-md bg-accent/18 border border-accent/35 font-mono text-[10.5px] font-semibold text-accent-soft">
              Ép. {slot.episode}
            </span>
            {slot.media.averageScore && (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#F0B95B]">
                <Star className="w-3 h-3 fill-current" />
                {formatScore(slot.media.averageScore)}
              </span>
            )}
            {entry && (
              <span
                className={cn(
                  "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                  STATUS_CONFIG[entry.status].bg,
                  STATUS_CONFIG[entry.status].border,
                  STATUS_CONFIG[entry.status].color
                )}
              >
                Suivi · Ép. {entry.progress}
              </span>
            )}
          </div>

          <Link
            href={`/media/${slot.media.id}`}
            className="text-sm font-semibold text-[#F4F3EE] group-hover:text-white line-clamp-1"
          >
            {title}
          </Link>

          <div className="mt-1 flex items-center gap-2 text-xs text-[#858A9E]">
            <Clock
              className={cn(
                "w-3.5 h-3.5 shrink-0",
                isPast ? "text-emerald-400/75" : "text-[#F0B95B]"
              )}
            />
            <span
              suppressHydrationWarning
              className={cn(
                "font-mono text-[11px]",
                !isPast && "text-[#F7D08A]"
              )}
            >
              {nowMs !== null ? formatCountdown(slot.airingAt) : "Horaire confirmé"}
            </span>
            {slot.media.studio && (
              <>
                <span className="text-white/20">·</span>
                <span className="truncate">{slot.media.studio}</span>
              </>
            )}
            {slot.media.streamingLinks && slot.media.streamingLinks.length > 0 && (
              <>
                <span className="text-white/20">·</span>
                <StreamingIconsStrip links={slot.media.streamingLinks} max={3} />
              </>
            )}
          </div>
        </div>

        {/* Quick 1-Click Oui / Non (for aired episodes) or Follow (for upcoming) */}
        <div className="shrink-0">
          {isPast ? (
            (() => {
              const isWatched = Boolean(entry && entry.progress >= slot.episode);
              return (
                <div
                  role="group"
                  aria-label={`Avez-vous vu ${title} épisode ${slot.episode} ?`}
                  className="inline-flex items-center p-0.5 rounded-xl bg-obsidian/90 border border-white/[0.1]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (isWatched) {
                        upsertEntry(slot.media, {
                          status: "WATCHING",
                          progress: Math.max(0, slot.episode - 1),
                        });
                      }
                    }}
                    title={isWatched ? `Marquer Ép. ${slot.episode} non vu` : "Non vu"}
                    className={cn(
                      "h-8 px-2 rounded-lg text-[11px] font-semibold inline-flex items-center gap-0.5 transition-colors cursor-pointer",
                      !isWatched
                        ? "bg-white/[0.12] text-white"
                        : "text-[#7D8296] hover:text-rose-300 hover:bg-rose-500/12"
                    )}
                  >
                    <X className="w-3 h-3" />
                    <span className="hidden sm:inline">Non</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isWatched) {
                        const total = slot.media.episodes;
                        upsertEntry(slot.media, {
                          status: total && slot.episode >= total ? "COMPLETED" : "WATCHING",
                          progress: slot.episode,
                        });
                      }
                    }}
                    title={isWatched ? `Ép. ${slot.episode} vu ✓` : `Marquer Ép. ${slot.episode} vu en 1 clic`}
                    className={cn(
                      "h-8 px-2.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 transition-all cursor-pointer",
                      isWatched
                        ? "bg-emerald-500 text-[#07080C] shadow-[0_4px_14px_rgba(16,185,129,0.4)]"
                        : "text-[#C6CAD8] hover:bg-accent hover:text-accent-fg"
                    )}
                  >
                    <Check className="w-3 h-3 stroke-[2.8]" />
                    <span className="hidden sm:inline">Oui</span>
                  </button>
                </div>
              );
            })()
          ) : entry ? (
            <button
              type="button"
              onClick={() => incrementProgress(slot.media.id, 1)}
              title="Marquer +1 épisode vu"
              className="h-9 px-3 rounded-xl bg-emerald-500/18 hover:bg-emerald-500/30 border border-emerald-400/35 text-emerald-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">+1</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => quickAdd(slot.media, "WATCHING")}
              title="Suivre cet anime en 1 clic"
              className="h-9 px-3 rounded-xl bg-white/[0.05] hover:bg-accent border border-white/[0.09] hover:border-accent text-white hover:text-accent-fg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Suivre</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="pt-[calc(5rem+env(safe-area-inset-top))] sm:pt-24 pb-24 md:pb-16 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12 sm:space-y-14">
      {/* Page Header with Quick Section Jump Links */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent mb-1.5 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Simulcast du jour & Saisons Anime</span>
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gradient-editorial">
            Calendrier & Saisons
          </h1>
          <p className="text-sm text-[#8A8FA4] mt-1.5">
            Suivez les épisodes qui sortent aujourd&apos;hui heure par heure, puis explorez les
            prochaines saisons façon MyAnimeList.
          </p>
        </div>

        {/* Quick Section Jump Pills */}
        <div className="flex flex-wrap lg:flex-nowrap shrink-0 items-center gap-2">
          <Link
            href="/episodes"
            className="inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-full bg-emerald-500/16 hover:bg-emerald-500/26 border border-emerald-400/35 text-xs font-semibold text-emerald-200 transition-colors"
          >
            <ListChecks className="w-3.5 h-3.5" />
            <span>Pointage 1 clic</span>
          </Link>
          <a
            href="#daily-schedule"
            className="inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-full bg-white/[0.07] hover:bg-white/[0.13] border border-white/[0.12] text-xs font-semibold text-white transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-[#F0B95B]" />
            <span>Planning du jour</span>
          </a>
          <a
            href="#seasonal-browser"
            className="inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-full bg-accent/18 hover:bg-accent/30 border border-accent/40 text-xs font-semibold text-accent-soft hover:text-accent-fg transition-colors"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>Saisons & Prochainement</span>
          </a>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 1: PLANNING DU JOUR (À VENIR + MAINTENANT + DÉJÀ SORTIS)     */}
      {/* ==================================================================== */}
      <section id="daily-schedule" className="space-y-6 scroll-mt-24">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex flex-wrap items-center gap-2.5">
              <span>Planning des sorties</span>
              <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[#B8BCCB]">
                {viewMode === "month"
                  ? `${MONTH_NAMES_FULL_FR[monthCursor.month]} ${monthCursor.year}`
                  : viewMode === "week"
                    ? "Vue 7 jours"
                    : `${activeDayMeta.full} ${activeDayMeta.dayNum} ${activeDayMeta.monthLabel}`}
              </span>
            </h2>
            <p className="text-xs text-[#858A9E] mt-1">
              Horaires authentiques AniList affichés en{" "}
              <strong className="text-[#C8CCE0]">
                {tzMode === "jst" ? "JST (Asia/Tokyo)" : localTimeZone}
              </strong>{" "}
              · distinction automatique disponible vs à venir.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {/* View Switcher: Jour / Semaine / Mois */}
            <div className="inline-flex items-center p-1 rounded-full bg-surface border border-white/[0.09]">
              {(
                [
                  { id: "day", label: "Jour" },
                  { id: "week", label: "Semaine" },
                  { id: "month", label: "Mois" },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setViewMode(m.id)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer",
                    viewMode === m.id
                      ? "bg-accent text-accent-fg shadow-accent"
                      : "text-[#9A9EAE] hover:text-white"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Timezone Toggle: Local vs Japan JST */}
            <button
              type="button"
              onClick={() => setTzMode((z) => (z === "local" ? "jst" : "local"))}
              title="Basculer entre votre fuseau horaire local et l'heure japonaise (JST)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface hover:bg-white/[0.08] border border-white/[0.09] text-xs font-mono text-[#C8CCE0] hover:text-white transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span>{tzMode === "jst" ? "JST (Japon)" : "Heure locale"}</span>
            </button>

            <button
              type="button"
              onClick={() => setScheduleOnlyMyList((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-colors cursor-pointer",
                scheduleOnlyMyList
                  ? "bg-accent/20 border-accent/50 text-accent-soft"
                  : "bg-surface border-white/[0.09] text-[#A2A6B8] hover:text-white"
              )}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Ma Liste ({trackedThisWeek})</span>
            </button>
          </div>
        </div>

        {/* VIEW 1: QUOTIDIENNE (7-Day Bar + Same-Day Timeline) */}
        {viewMode === "day" && (
          <>
            {/* 7-Day Selector Bar (horizontally scrollable on mobile so day labels never truncate) */}
            <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1 sm:grid sm:grid-cols-7 sm:gap-2.5 sm:overflow-visible sm:pb-0">
          {rollingDays.map((day) => {
            const isSelected = selectedDayKey === day.key;
            const list = byDay[day.key] ?? [];
            const upCount = list.filter((s) => s.airingAt * 1000 >= anchorMs).length;
            const doneCount = list.length - upCount;

            return (
              <button
                key={day.key}
                type="button"
                onClick={() => setSelectedDayKey(day.key)}
                className={cn(
                  "relative rounded-2xl p-2.5 sm:p-3.5 text-left border transition-all cursor-pointer overflow-hidden min-w-[88px] shrink-0 sm:min-w-0",
                  isSelected
                    ? "border-accent/65 shadow-[0_10px_26px_rgb(var(--shiori-accent-rgb)/0.2)]"
                    : "bg-surface border-white/[0.07] hover:border-white/[0.16] hover:bg-[#141722]"
                )}
              >
                {isSelected && (
                  <motion.div
                    layoutId="calendar-day-pill"
                    transition={{ type: "spring", stiffness: 360, damping: 30 }}
                    className="absolute inset-0 bg-gradient-to-br from-accent/22 via-accent/10 to-transparent pointer-events-none"
                  />
                )}
                <div className="relative z-10 flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      "text-xs sm:text-sm font-semibold truncate",
                      isSelected ? "text-white" : "text-[#C6CAD8]"
                    )}
                  >
                    <span className="md:hidden">{day.short}</span>
                    <span className="hidden md:inline">{day.full}</span>
                  </span>
                  {day.isToday && (
                    <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                  )}
                </div>
                <p className="relative z-10 mt-1 font-mono text-[11px] text-[#9A9EAE] whitespace-nowrap">
                  {day.dayNum} {day.monthLabel}
                </p>
                <div className="relative z-10 mt-1.5 flex items-center gap-1.5 text-[10px] font-mono">
                  {upCount > 0 && (
                    <span className="text-[#F0B95B] whitespace-nowrap">{upCount} à venir</span>
                  )}
                  {upCount > 0 && doneCount > 0 && (
                    <span className="text-white/25 hidden xl:inline">·</span>
                  )}
                  {doneCount > 0 && (
                    <span className="text-emerald-400/80 hidden xl:inline">
                      {doneCount} sorti{doneCount > 1 ? "s" : ""}
                    </span>
                  )}
                  {list.length === 0 && <span className="text-[#656A7E]">0 ép.</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Same-Day Split View: À venir aujourd'hui + Ligne Maintenant + Déjà sortis aujourd'hui */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${selectedDayKey}-${scheduleOnlyMyList ? "mine" : "all"}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2, ease: CINEMA_EASE }}
            className="space-y-6"
          >
            {activeDayItems.length === 0 ? (
              <div className="rounded-2xl card-surface py-12 px-6 text-center">
                <Sparkles className="w-7 h-7 text-[#52576B] mx-auto mb-2.5" />
                <p className="text-sm font-semibold text-white">
                  Aucune diffusion enregistrée pour ce jour
                  {scheduleOnlyMyList ? " dans votre liste" : ""}.
                </p>
                {scheduleOnlyMyList && (
                  <button
                    type="button"
                    onClick={() => setScheduleOnlyMyList(false)}
                    className="mt-3 px-4 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-xs font-medium text-white cursor-pointer"
                  >
                    Afficher toutes les sorties
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* BLOC A: À venir dans cette journée */}
                {dayUpcoming.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[#F7D08A] flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#F0B95B]" />
                        <span>
                          {activeDayMeta.isToday
                            ? "À venir plus tard aujourd'hui"
                            : `À venir — ${activeDayMeta.full} ${activeDayMeta.dayNum} ${activeDayMeta.monthLabel}`}
                        </span>
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-[#F0B95B]/16 border border-[#F0B95B]/35 text-[#F0B95B]">
                          {dayUpcoming.length}
                        </span>
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {dayUpcoming.map((slot) => renderEpisodeCard(slot, false))}
                    </div>
                  </div>
                )}

                {/* Ligne de séparation temporelle "Maintenant" quand la journée contient À venir ET Déjà sortis */}
                {dayUpcoming.length > 0 && dayAired.length > 0 && (
                  <div className="flex items-center gap-3 py-1">
                    <span className="h-px flex-1 bg-gradient-to-r from-transparent via-accent/50 to-accent/50" />
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 border border-accent/40 text-[11px] font-mono font-semibold text-accent-soft">
                      <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                      <span>Maintenant · {nowTimeStr}</span>
                    </span>
                    <span className="h-px flex-1 bg-gradient-to-l from-transparent via-accent/50 to-accent/50" />
                  </div>
                )}

                {/* BLOC B: Déjà sortis dans cette journée */}
                {dayAired.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>
                          {activeDayMeta.isToday
                            ? "Déjà sortis aujourd'hui"
                            : `Déjà sortis — ${activeDayMeta.full}`}
                        </span>
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300">
                          {dayAired.length}
                        </span>
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {dayAired.map((slot) => renderEpisodeCard(slot, true))}
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
          </>
        )}

        {/* VIEW 2: HEBDOMADAIRE (7 jours côte à côte / empilés avec heures exactes) */}
        {viewMode === "week" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {rollingDays.map((day) => {
              const items = byDay[day.key] ?? [];
              return (
                <div
                  key={day.key}
                  className={cn(
                    "rounded-2xl card-surface border p-4 space-y-3 flex flex-col",
                    day.isToday ? "border-accent/55" : "border-white/[0.08]"
                  )}
                >
                  <div className="flex items-center justify-between border-b border-white/[0.07] pb-2.5">
                    <div>
                      <p className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span>{day.full}</span>
                        {day.isToday && (
                          <span className="px-1.5 py-0.2 rounded bg-accent/20 text-accent-soft font-mono text-[9.5px]">
                            AUJ.
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] font-mono text-[#858A9E]">
                        {day.dayNum} {day.monthLabel}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-white/[0.06] font-mono text-[10.5px] text-[#D2D6E6]">
                      {items.length} ép.
                    </span>
                  </div>

                  {items.length === 0 ? (
                    <p className="text-xs text-[#6E7387] py-4 text-center">
                      Aucune sortie enregistrée
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-0.5">
                      {items.map((slot) => {
                        const isPast = slot.airingAt * 1000 < anchorMs;
                        const tracked = Boolean(getEntry(slot.media.id));
                        return (
                          <Link
                            key={slot.id}
                            href={`/media/${slot.media.id}`}
                            className={cn(
                              "flex items-center gap-2.5 p-2 rounded-xl border transition-colors",
                              tracked
                                ? "bg-accent/[0.07] border-accent/35 hover:border-accent/60"
                                : "bg-obsidian/65 border-white/[0.06] hover:border-white/[0.16]"
                            )}
                          >
                            <img
                              src={slot.media.coverImage.large}
                              alt={getDisplayTitle(slot.media)}
                              loading="lazy"
                              className="w-9 h-12 rounded-lg object-cover shrink-0 border border-white/10"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-white truncate">
                                {getDisplayTitle(slot.media)}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[10px]">
                                <span className="text-[#C8CCE0]">
                                  {formatTimeInTimezone(slot.airingAt, activeTimeZone)}
                                </span>
                                <span className="text-white/25">·</span>
                                <span className="text-accent-soft">Ép. {slot.episode}</span>
                                <span
                                  className={cn(
                                    "ml-auto px-1.5 rounded text-[9px]",
                                    isPast
                                      ? "bg-emerald-500/15 text-emerald-300"
                                      : "bg-[#F0B95B]/15 text-[#F0B95B]"
                                  )}
                                >
                                  {isPast ? "Dispo" : "À venir"}
                                </span>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW 3: MENSUELLE (Grille calendrier mensuel avec sorties simulcast + premières saisonnières réelles) */}
        {viewMode === "month" && (
          <div className="space-y-5">
            <div className="rounded-2xl card-surface border border-white/[0.09] p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setMonthCursor((c) =>
                      c.month === 0
                        ? { year: c.year - 1, month: 11 }
                        : { year: c.year, month: c.month - 1 }
                    )
                  }
                  aria-label="Mois précédent"
                  className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] flex items-center justify-center text-white cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-center">
                  <p className="text-sm sm:text-base font-bold text-white">
                    {MONTH_NAMES_FULL_FR[monthCursor.month]} {monthCursor.year}
                  </p>
                  <p className="text-[11px] text-[#858A9E]">
                    Épisodes simulcast (points or) & premières saisonnières confirmées (points cyan)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setMonthCursor((c) =>
                      c.month === 11
                        ? { year: c.year + 1, month: 0 }
                        : { year: c.year, month: c.month + 1 }
                    )
                  }
                  aria-label="Mois suivant"
                  className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] flex items-center justify-center text-white cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[10.5px] font-mono uppercase text-[#7D8296]">
                {WEEKDAY_HEADERS_MON.map((w) => (
                  <div key={w} className="py-1">
                    {w}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {monthGrid.cells.map((cell) => {
                  const selected = selectedMonthDateKey === cell.dateKey;
                  const hasEvents = cell.airingCount > 0 || cell.premiereCount > 0;
                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      onClick={() => setSelectedMonthDateKey(cell.dateKey)}
                      className={cn(
                        "min-h-[56px] sm:min-h-[72px] p-1.5 sm:p-2 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer",
                        selected
                          ? "bg-accent/18 border-accent text-white shadow-accent"
                          : cell.isToday
                            ? "bg-white/[0.06] border-accent/45 text-white"
                            : cell.inCurrentMonth
                              ? "bg-obsidian/70 border-white/[0.07] hover:border-white/[0.16] text-[#E5E7F0]"
                              : "bg-obsidian/30 border-white/[0.04] text-[#5B6073]"
                      )}
                    >
                      <span className="font-mono text-xs font-semibold leading-none">
                        {cell.dayOfMonth}
                      </span>
                      {hasEvents && (
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {cell.airingCount > 0 && (
                            <span className="px-1 py-0.2 rounded bg-[#F0B95B]/20 text-[#F0B95B] font-mono text-[9.5px] font-bold">
                              {cell.airingCount} ép
                            </span>
                          )}
                          {cell.premiereCount > 0 && (
                            <span className="px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono text-[9.5px] font-bold">
                              {cell.premiereCount}★
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Date Details in Monthly View */}
            {(() => {
              const slots = monthGrid.airingByDate[selectedMonthDateKey] ?? [];
              const premieres = monthGrid.premieresByDate[selectedMonthDateKey] ?? [];
              return (
                <div className="rounded-2xl card-surface border border-white/[0.08] p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white">
                      Sorties confirmées le {selectedMonthDateKey}
                    </h3>
                    <span className="text-[11px] font-mono text-[#858A9E]">
                      {slots.length} épisode(s) · {premieres.length} première(s)
                    </span>
                  </div>

                  {slots.length === 0 && premieres.length === 0 ? (
                    <p className="text-xs text-[#858A9E]">
                      Aucune sortie horodatée confirmée par AniList pour cette date.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {slots.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {slots.map((slot) =>
                            renderEpisodeCard(slot, slot.airingAt * 1000 < anchorMs)
                          )}
                        </div>
                      )}
                      {premieres.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-mono uppercase tracking-wider text-sky-300">
                            Premières / Lancements confirmés
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {premieres.map((m) => (
                              <Link
                                key={m.id}
                                href={`/media/${m.id}`}
                                className="flex items-center gap-3 p-2.5 rounded-xl bg-obsidian/70 border border-white/[0.08] hover:border-sky-400/45 transition-colors"
                              >
                                <img
                                  src={m.coverImage.large}
                                  alt={getDisplayTitle(m)}
                                  loading="lazy"
                                  className="w-10 h-14 rounded-lg object-cover border border-white/10 shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-white truncate">
                                    {getDisplayTitle(m)}
                                  </p>
                                  <p className="text-[10.5px] font-mono text-[#8E93A6] mt-0.5">
                                    {formatFormat(m.format)}
                                    {m.studio ? ` · ${m.studio}` : ""}
                                  </p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </section>

      {/* ==================================================================== */}
      {/* SECTION 2: SAISONS & PROCHAINEMENT (STYLE MYANIMELIST SEASONAL)      */}
      {/* ==================================================================== */}
      <section
        id="seasonal-browser"
        className="pt-10 border-t border-white/[0.08] space-y-6 scroll-mt-24"
      >
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#F0B95B] mb-1 flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5" />
              <span>Catalogue Saisonnier · Façon MyAnimeList</span>
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Saisons & Sorties Prochainement
            </h2>
            <p className="text-sm text-[#868B9F] mt-1">
              Parcourez la saison en cours, les prochaines saisons (Hiver, Printemps, Été, Automne)
              et les sorties annoncées avec synopsis complet.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#73788C] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={seasonSearch}
              onChange={(e) => setSeasonSearch(e.target.value)}
              placeholder="Filtrer dans cette saison..."
              className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-surface border border-white/[0.09] text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* MAL-style Season Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 border-b border-white/[0.08]">
          {seasons.map((bucket) => {
            const isSelected = selectedSeasonId === bucket.id;
            return (
              <button
                key={bucket.id}
                type="button"
                onClick={() => setSelectedSeasonId(bucket.id)}
                className={cn(
                  "relative px-4 py-3 text-left whitespace-nowrap transition-colors cursor-pointer shrink-0 group",
                  isSelected ? "text-white" : "text-[#8A8FA4] hover:text-[#ECEBE6]"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{bucket.label}</span>
                  <span
                    className={cn(
                      "text-[10.5px] font-mono px-1.5 py-0.5 rounded-md",
                      isSelected
                        ? "bg-accent/22 text-accent-soft"
                        : "bg-white/[0.05] text-[#7D8296]"
                    )}
                  >
                    {bucket.items.length}
                  </span>
                </div>
                <span
                  className={cn(
                    "block text-[10px] font-mono uppercase tracking-wider mt-0.5",
                    bucket.isCurrent
                      ? "text-emerald-400"
                      : bucket.isNext
                        ? "text-[#F0B95B]"
                        : "text-[#6E7387]"
                  )}
                >
                  {bucket.sublabel}
                </span>
                {isSelected && (
                  <motion.span
                    layoutId="mal-season-underline"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    className="absolute bottom-0 inset-x-2 h-0.5 bg-accent rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Format Sub-filter Bar (TV, Films, ONA/OVA, Dans ma liste) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "ALL" as const, label: "Tous les formats", icon: Layers },
              { id: "TV" as const, label: "Séries TV", icon: Tv },
              { id: "MOVIE" as const, label: "Films", icon: Film },
              { id: "ONA_OVA" as const, label: "ONA / OVA", icon: Sparkles },
              { id: "MYLIST" as const, label: "Dans ma liste", icon: Bookmark },
            ].map((f) => {
              const Icon = f.icon;
              const active = seasonFormat === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSeasonFormat(f.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer",
                    active
                      ? "bg-white/[0.12] border-white/[0.22] text-white"
                      : "bg-surface border-white/[0.07] text-[#9A9EAE] hover:text-white"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 opacity-80" />
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>
          <span className="text-xs font-mono text-[#7D8296]">
            {filteredSeasonItems.length} anime{filteredSeasonItems.length > 1 ? "s" : ""} ·{" "}
            {activeSeason?.label}
          </span>
        </div>

        {/* MAL-Inspired Detailed Seasonal Cards Grid (Poster left + Synopsis & Metadata right!) */}
        {filteredSeasonItems.length === 0 ? (
          <div className="rounded-2xl card-surface py-14 px-6 text-center">
            <Sparkles className="w-7 h-7 text-[#52576B] mx-auto mb-2.5" />
            <p className="text-sm font-semibold text-white">
              Aucun anime trouvé pour ce filtre dans {activeSeason?.label}.
            </p>
            <button
              type="button"
              onClick={() => {
                setSeasonFormat("ALL");
                setSeasonSearch("");
              }}
              className="mt-3 px-4 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-xs font-medium text-white cursor-pointer"
            >
              Réinitialiser le filtre
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredSeasonItems.map((media) => {
              const title = getDisplayTitle(media);
              const rel = formatReleaseDate(media, nowMs);
              const entry = getEntry(media.id);

              return (
                <article
                  key={media.id}
                  className="group rounded-2xl overflow-hidden isolate [transform:translateZ(0)] card-surface hover:border-white/[0.18] transition-colors flex flex-col"
                >
                  {/* MAL-style Card Top Header Strip */}
                  <div className="px-4 py-3 bg-[#131622]/90 border-b border-white/[0.07] flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/media/${media.id}`}
                        className="text-[15px] font-bold text-[#F4F3EE] group-hover:text-accent-hover transition-colors line-clamp-1 leading-snug"
                      >
                        {title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#8C91A6]">
                        <span className="font-mono text-[#D2D5E2]">
                          {formatFormat(media.format)}
                        </span>
                        {media.episodes && (
                          <>
                            <span className="text-white/25">·</span>
                            <span className="font-mono">{media.episodes} ép.</span>
                          </>
                        )}
                        {media.studio && (
                          <>
                            <span className="text-white/25">·</span>
                            <span className="text-[#C8CCE0] font-medium truncate max-w-[160px]">
                              {media.studio}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Release Date & Countdown Pills */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full font-mono text-[10.5px] font-semibold border",
                          media.status === "RELEASING"
                            ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                            : "bg-[#F0B95B]/15 border-[#F0B95B]/40 text-[#F0B95B]"
                        )}
                      >
                        {rel.label}
                      </span>
                      {rel.daysUntil && (
                        <span className="px-2 py-0.5 rounded-full bg-accent/20 border border-accent/45 font-mono text-[10px] font-semibold text-accent-soft">
                          J-{rel.daysUntil}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* MAL-style 2-Column Body: Full Poster Left + Genres/Synopsis/Actions Right */}
                  <div className="p-4 flex gap-4 flex-1">
                    {/* Left Poster */}
                    <Link
                      href={`/media/${media.id}`}
                      className="relative w-[108px] sm:w-[122px] aspect-[2/3] shrink-0 rounded-xl overflow-hidden border border-white/12 bg-[#141724] self-start"
                    >
                      <img
                        src={media.coverImage.extraLarge}
                        alt={title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover transform-gpu group-hover:scale-105 transition-transform duration-500"
                      />
                      {media.averageScore ? (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-[#090B12]/90 border border-[#F0B95B]/40 font-mono text-[10.5px] font-semibold text-[#F0B95B] flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          {formatScore(media.averageScore)}
                        </span>
                      ) : media.popularity ? (
                        <span className="absolute bottom-2 left-2 right-2 px-1.5 py-0.5 rounded-md bg-[#090B12]/90 border border-white/12 font-mono text-[10px] text-[#D8DBE6] flex items-center justify-center gap-1">
                          <Users className="w-2.5 h-2.5 text-sky-400" />
                          {formatCompactNumber(media.popularity)}
                        </span>
                      ) : null}
                    </Link>

                    {/* Right Content: Genres + Synopsis + Footer Controls */}
                    <div className="min-w-0 flex-1 flex flex-col justify-between gap-3">
                      <div className="space-y-2.5">
                        {/* Genres Row */}
                        {media.genres.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {media.genres.slice(0, 4).map((g) => (
                              <Link
                                key={g}
                                href={`/discover?genre=${encodeURIComponent(g)}`}
                                className="px-2 py-0.5 rounded-md bg-white/[0.05] hover:bg-accent/20 border border-white/[0.08] text-[10.5px] text-[#C8CCE0] hover:text-accent-fg transition-colors"
                              >
                                {g}
                              </Link>
                            ))}
                          </div>
                        )}

                        {/* Readable MAL-style Auto-Translated Synopsis (lazy on viewport) */}
                        <TranslatedSynopsis
                          mediaId={media.id}
                          description={media.description}
                          variant="compact"
                          lazy
                        />
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              entry
                                ? openQuickEdit(media)
                                : quickAdd(
                                    media,
                                    media.status === "RELEASING"
                                      ? "WATCHING"
                                      : "PLAN_TO_WATCH"
                                  )
                            }
                            className={cn(
                              "h-8 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer",
                              entry
                                ? "bg-emerald-500/16 border-emerald-400/40 text-emerald-300"
                                : "bg-accent/18 hover:bg-accent border-accent/40 text-accent-soft hover:text-accent-fg"
                            )}
                          >
                            {entry ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>{STATUS_CONFIG[entry.status].shortLabel}</span>
                              </>
                            ) : (
                              <>
                                <BookmarkPlus className="w-3.5 h-3.5" />
                                <span>
                                  {media.status === "RELEASING"
                                    ? "Watching"
                                    : "Plan to Watch"}
                                </span>
                              </>
                            )}
                          </button>

                          {media.trailer && (
                            <button
                              type="button"
                              onClick={() => openTrailer(media.trailer!.id, title)}
                              title="Bande-annonce"
                              className="h-8 px-2.5 rounded-lg bg-[#F0B95B]/14 hover:bg-[#F0B95B]/26 border border-[#F0B95B]/35 text-[#F0B95B] text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span className="hidden sm:inline">Trailer</span>
                            </button>
                          )}
                        </div>

                        <Link
                          href={`/media/${media.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#9A9EAE] hover:text-white transition-colors"
                        >
                          <span>Fiche</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
