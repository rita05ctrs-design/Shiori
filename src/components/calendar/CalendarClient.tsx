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
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import {
  cn,
  formatCountdown,
  formatScore,
  getDisplayTitle,
  STATUS_CONFIG,
} from "@/lib/utils";
import type { AiringScheduleItem } from "@/types/media";

const DAYS_FR = [
  { key: 1, short: "Lun", full: "Lundi" },
  { key: 2, short: "Mar", full: "Mardi" },
  { key: 3, short: "Mer", full: "Mercredi" },
  { key: 4, short: "Jeu", full: "Jeudi" },
  { key: 5, short: "Ven", full: "Vendredi" },
  { key: 6, short: "Sam", full: "Samedi" },
  { key: 0, short: "Dim", full: "Dimanche" },
];

interface CalendarClientProps {
  schedule: AiringScheduleItem[];
}

export function CalendarClient({ schedule }: CalendarClientProps) {
  const { getEntry, openQuickEdit, incrementProgress } = useShiori();
  const todayJsDay = new Date().getDay(); // 0=Sun..6=Sat

  const [selectedDay, setSelectedDay] = useState<number>(todayJsDay);
  const [onlyMyList, setOnlyMyList] = useState(false);
  const [search, setSearch] = useState("");

  // Group schedule items by JS day-of-week
  const byDay = useMemo(() => {
    const map: Record<number, AiringScheduleItem[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };
    const q = search.trim().toLowerCase();

    for (const item of schedule) {
      if (onlyMyList && !getEntry(item.media.id)) continue;
      if (q && !getDisplayTitle(item.media).toLowerCase().includes(q)) continue;
      const d = new Date(item.airingAt * 1000).getDay();
      map[d].push(item);
    }

    for (const k of Object.keys(map)) {
      map[Number(k)].sort((a, b) => a.airingAt - b.airingAt);
    }
    return map;
  }, [schedule, onlyMyList, search, getEntry]);

  const activeItems = byDay[selectedDay] ?? [];
  const activeDayMeta = DAYS_FR.find((d) => d.key === selectedDay) ?? DAYS_FR[0];

  const trackedThisWeek = useMemo(
    () => schedule.filter((s) => Boolean(getEntry(s.media.id))).length,
    [schedule, getEntry]
  );

  return (
    <div className="pt-24 pb-16 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#E5484D] mb-1.5 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Simulcast & Diffusions Japon</span>
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gradient-editorial">
            Calendrier Hebdomadaire
          </h1>
          <p className="text-sm text-[#8A8FA4] mt-1.5">
            Heures converties dans votre fuseau local ·{" "}
            <span className="text-white font-mono">{schedule.length}</span> épisodes programmés
            cette semaine.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-[#73788C] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer un anime..."
              className="w-full h-10 pl-10 pr-3.5 rounded-full bg-[#0E1017] border border-white/[0.09] text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-[#E5484D]"
            />
          </div>

          <div className="inline-flex items-center p-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setOnlyMyList(false)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer",
                !onlyMyList
                  ? "bg-[#E5484D] text-white"
                  : "text-[#9A9EAE] hover:text-white"
              )}
            >
              Toutes les sorties
            </button>
            <button
              type="button"
              onClick={() => setOnlyMyList(true)}
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer",
                onlyMyList
                  ? "bg-[#E5484D] text-white"
                  : "text-[#9A9EAE] hover:text-white"
              )}
            >
              <Bookmark className="w-3 h-3" />
              <span>Ma Liste ({trackedThisWeek})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 7-Day Selector */}
      <div className="grid grid-cols-7 gap-2 sm:gap-3">
        {DAYS_FR.map((day) => {
          const isSelected = selectedDay === day.key;
          const isToday = todayJsDay === day.key;
          const count = byDay[day.key]?.length ?? 0;

          return (
            <motion.button
              key={day.key}
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSelectedDay(day.key)}
              className={cn(
                "relative rounded-2xl p-3 sm:p-4 text-left border transition-colors cursor-pointer overflow-hidden",
                isSelected
                  ? "border-[#E5484D]/65 shadow-[0_12px_30px_rgba(229,72,77,0.22)]"
                  : "bg-[#0E1017] border-white/[0.07] hover:border-white/[0.16] hover:bg-[#141722]"
              )}
            >
              {isSelected && (
                <motion.div
                  layoutId="calendar-day-active"
                  transition={{ type: "spring", stiffness: 360, damping: 30 }}
                  className="absolute inset-0 bg-gradient-to-br from-[#E5484D]/22 via-[#E5484D]/12 to-transparent pointer-events-none"
                />
              )}
              <div className="relative z-10 flex items-center justify-between gap-1">
                <span
                  className={cn(
                    "text-xs sm:text-sm font-semibold",
                    isSelected ? "text-white" : "text-[#C6CAD8]"
                  )}
                >
                  <span className="sm:hidden">{day.short}</span>
                  <span className="hidden sm:inline">{day.full}</span>
                </span>
                {isToday && (
                  <span className="w-2 h-2 rounded-full bg-[#E5484D] shadow-[0_0_8px_#E5484D]" />
                )}
              </div>
              <p className="relative z-10 mt-1.5 text-[11px] font-mono text-[#7F8499]">
                {count} <span className="hidden md:inline">sortie{count > 1 ? "s" : ""}</span>
              </p>
              {isToday && (
                <span className="relative z-10 hidden lg:inline-block mt-1 text-[9.5px] font-mono uppercase tracking-wider text-[#FF8C90]">
                  Aujourd&apos;hui
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Active Day Timeline with Smooth Animated Switch */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${selectedDay}-${onlyMyList ? "mine" : "all"}`}
          initial={{ opacity: 0, x: 14, filter: "blur(4px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, x: -14, filter: "blur(4px)" }}
          transition={{ duration: 0.28, ease: CINEMA_EASE }}
          className="space-y-4"
        >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>{activeDayMeta.full}</span>
            {selectedDay === todayJsDay && (
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#E5484D]/20 text-[#FF8C90] border border-[#E5484D]/35">
                Aujourd&apos;hui
              </span>
            )}
          </h2>
          <span className="text-xs font-mono text-[#7E8397]">
            {activeItems.length} épisode{activeItems.length > 1 ? "s" : ""}
          </span>
        </div>

        {activeItems.length === 0 ? (
          <div className="rounded-2xl card-surface py-16 px-6 text-center">
            <Sparkles className="w-8 h-8 text-[#52576B] mx-auto mb-3" />
            <p className="text-base font-semibold text-white">
              Aucune sortie programmée pour ce filtre
            </p>
            <p className="text-sm text-[#868B9F] mt-1">
              {onlyMyList
                ? "Essayez d'afficher toutes les sorties ou ajoutez des séries de la saison à votre liste."
                : "Sélectionnez un autre jour de la semaine ci-dessus."}
            </p>
            {onlyMyList && (
              <button
                type="button"
                onClick={() => setOnlyMyList(false)}
                className="mt-4 px-5 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-white cursor-pointer"
              >
                Afficher toutes les sorties
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeItems.map((slot, idx) => {
              const title = getDisplayTitle(slot.media);
              const entry = getEntry(slot.media.id);
              const airDate = new Date(slot.airingAt * 1000);
              const timeStr = airDate.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const isPast = slot.airingAt * 1000 < Date.now();

              return (
                <motion.div
                  key={slot.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.25) }}
                  className={cn(
                    "group rounded-2xl p-4 card-surface hover:border-white/[0.16] transition-all flex items-center gap-4",
                    entry && "ring-1 ring-[#E5484D]/35 bg-[#E5484D]/[0.03]"
                  )}
                >
                  {/* Time Column */}
                  <div className="w-14 sm:w-16 shrink-0 text-center border-r border-white/[0.07] pr-3">
                    <p className="font-mono text-base sm:text-lg font-semibold text-white">
                      {timeStr}
                    </p>
                    <span
                      className={cn(
                        "inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded",
                        isPast
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-[#F0B95B]/15 text-[#F0B95B]"
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
                      className="w-14 h-20 rounded-xl object-cover border border-white/10 group-hover:scale-105 transition-transform duration-300"
                    />
                  </Link>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="px-2 py-0.5 rounded-md bg-[#E5484D]/18 border border-[#E5484D]/35 font-mono text-[11px] font-semibold text-[#FF8C90]">
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
                      className="text-sm sm:text-[15px] font-semibold text-[#F4F3EE] group-hover:text-white line-clamp-1"
                    >
                      {title}
                    </Link>

                    <div className="mt-1 flex items-center gap-2 text-xs text-[#858A9E]">
                      <Clock className="w-3.5 h-3.5 text-[#7D8296] shrink-0" />
                      <span className="font-mono text-[11.5px]">
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
                        className="h-9 px-3 rounded-xl bg-white/[0.05] hover:bg-[#E5484D] border border-white/[0.09] hover:border-[#E5484D] text-white text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Suivre</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
