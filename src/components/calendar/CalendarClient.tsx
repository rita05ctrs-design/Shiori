"use client";

import React, { useMemo, useState } from "react";
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
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import {
  cn,
  formatCompactNumber,
  formatCountdown,
  formatFormat,
  formatScore,
  formatSeason,
  getDisplayTitle,
  STATUS_CONFIG,
  stripHtml,
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

function getLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function formatReleaseDate(media: MediaItem): { label: string; daysUntil: number | null } {
  const d = media.startDate;
  if (d?.year && d?.month && d?.day) {
    const dt = new Date(d.year, d.month - 1, d.day);
    const diffDays = Math.ceil((dt.getTime() - Date.now()) / 86400000);
    return {
      label: `${d.day} ${MONTHS_FR[d.month - 1]} ${d.year}`,
      daysUntil: diffDays > 0 ? diffDays : null,
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

interface CalendarClientProps {
  schedule: AiringScheduleItem[];
  seasons: SeasonalBucket[];
}

export function CalendarClient({ schedule, seasons }: CalendarClientProps) {
  const { getEntry, quickAdd, openQuickEdit, incrementProgress, openTrailer } = useShiori();

  // Rolling 7 days starting from Today
  const rollingDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return {
        key: getLocalDateKey(d),
        short: DAY_NAMES_SHORT[d.getDay()],
        full: DAY_NAMES_FULL[d.getDay()],
        dayNum: d.getDate(),
        monthLabel: MONTHS_FR[d.getMonth()],
        isToday: i === 0,
        isTomorrow: i === 1,
      };
    });
  }, []);

  // Section 1 state (Daily Schedule — Same Day Upcoming + Already Aired)
  const [selectedDayKey, setSelectedDayKey] = useState<string>(rollingDays[0].key);
  const [scheduleOnlyMyList, setScheduleOnlyMyList] = useState(false);

  // Section 2 state (MyAnimeList-style Seasonal Browser — Current + Upcoming Seasons)
  const defaultSeasonId = seasons[1]?.id ?? seasons[0]?.id ?? "ANNOUNCED";
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(defaultSeasonId);
  const [seasonFormat, setSeasonFormat] = useState<SeasonFormatFilter>("ALL");
  const [seasonSearch, setSeasonSearch] = useState("");

  const nowMs = Date.now();
  const nowTimeStr = new Date(nowMs).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Group schedule by local date key
  const byDay = useMemo(() => {
    const map: Record<string, AiringScheduleItem[]> = {};
    for (const d of rollingDays) map[d.key] = [];

    for (const item of schedule) {
      if (scheduleOnlyMyList && !getEntry(item.media.id)) continue;
      const k = getLocalDateKey(new Date(item.airingAt * 1000));
      if (map[k]) map[k].push(item);
    }

    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.airingAt - b.airingAt);
    }
    return map;
  }, [schedule, rollingDays, scheduleOnlyMyList, getEntry]);

  const activeDayItems = byDay[selectedDayKey] ?? [];
  const activeDayMeta =
    rollingDays.find((d) => d.key === selectedDayKey) ?? rollingDays[0];

  // Split selected day cleanly into:
  // 1) "À venir aujourd'hui" (upcoming later today / on selected day)
  // 2) "Déjà sortis aujourd'hui" (already aired earlier today)
  const dayUpcoming = useMemo(
    () => activeDayItems.filter((s) => s.airingAt * 1000 >= nowMs),
    [activeDayItems, nowMs]
  );
  const dayAired = useMemo(
    () => activeDayItems.filter((s) => s.airingAt * 1000 < nowMs).reverse(),
    [activeDayItems, nowMs]
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
    const airDate = new Date(slot.airingAt * 1000);
    const timeStr = airDate.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

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
              className={cn(
                "font-mono text-[11px]",
                !isPast && "text-[#F7D08A]"
              )}
            >
              {formatCountdown(slot.airingAt)}
            </span>
            {slot.media.studio && (
              <>
                <span className="text-white/20">·</span>
                <span className="truncate">{slot.media.studio}</span>
              </>
            )}
          </div>
        </div>

        {/* Quick Action */}
        <div className="shrink-0">
          {entry ? (
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
              onClick={() => openQuickEdit(slot.media)}
              title="Ajouter à ma bibliothèque"
              className="h-9 px-3 rounded-xl bg-white/[0.05] hover:bg-accent border border-white/[0.09] hover:border-accent text-accent-fg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
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
    <div className="pt-24 pb-16 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
              <span>Sorties du jour & 7 prochains jours</span>
              <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[#B8BCCB]">
                {activeDayMeta.full} {activeDayMeta.dayNum} {activeDayMeta.monthLabel}
              </span>
            </h2>
            <p className="text-xs text-[#858A9E] mt-1">
              Dans la même journée : voyez d&apos;abord les épisodes qui arrivent bientôt, puis ceux
              déjà sortis.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setScheduleOnlyMyList((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto",
              scheduleOnlyMyList
                ? "bg-accent/20 border-accent/50 text-accent-soft"
                : "bg-surface border-white/[0.09] text-[#A2A6B8] hover:text-white"
            )}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Ma Liste ({trackedThisWeek})</span>
          </button>
        </div>

        {/* 7-Day Selector Bar */}
        <div className="grid grid-cols-7 gap-2 sm:gap-2.5">
          {rollingDays.map((day) => {
            const isSelected = selectedDayKey === day.key;
            const list = byDay[day.key] ?? [];
            const upCount = list.filter((s) => s.airingAt * 1000 >= nowMs).length;
            const doneCount = list.length - upCount;

            return (
              <button
                key={day.key}
                type="button"
                onClick={() => setSelectedDayKey(day.key)}
                className={cn(
                  "relative rounded-2xl p-2.5 sm:p-3.5 text-left border transition-all cursor-pointer overflow-hidden",
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
                <p className="relative z-10 mt-1 font-mono text-[11px] text-[#9A9EAE]">
                  {day.dayNum} {day.monthLabel}
                </p>
                <div className="relative z-10 mt-1.5 flex items-center gap-1.5 text-[10px] font-mono">
                  {upCount > 0 && (
                    <span className="text-[#F0B95B]">{upCount} à venir</span>
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
              const rel = formatReleaseDate(media);
              const entry = getEntry(media.id);
              const synopsis = stripHtml(media.description);

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

                        {/* Readable MAL-style Synopsis */}
                        <p className="text-xs text-[#9FA4B8] leading-relaxed line-clamp-4">
                          {synopsis}
                        </p>
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
