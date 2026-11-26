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
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { getSettingsCopy } from "@/lib/settings-translations";
import { CINEMA_EASE } from "@/components/motion/MotionPrimitives";
import { cn, formatCountdown, getDisplayTitle } from "@/lib/utils";
import type { AiringScheduleItem } from "@/types/media";

interface HomeWeeklyCheckStripProps {
  airingSlots: AiringScheduleItem[];
}

type StripTab = "today" | "week";

function isSameLocalDay(unixSec: number, nowMs: number): boolean {
  const dt = new Date(unixSec * 1000);
  const now = new Date(nowMs);
  return (
    dt.getFullYear() === now.getFullYear() &&
    dt.getMonth() === now.getMonth() &&
    dt.getDate() === now.getDate()
  );
}

/**
 * Interactive 1-Tap Daily & Weekly Episode Check-In Hub directly on Home:
 * - Instant toggle between "Aujourd'hui" (jour) and "Semaine" (semaine)
 * - 1-tap "Vu ✓" / "Pas vu ✕" buttons with tactile spring feedback & live progress bar
 * - Native silky horizontal swipe on mobile (.touch-rail) & clean 4-column grid on desktop
 */
export function HomeWeeklyCheckStrip({ airingSlots }: HomeWeeklyCheckStripProps) {
  const { library, hydrated, getEntry, upsertEntry, contentLanguage } = useShiori();
  const { t } = useTranslation();
  const copy = getSettingsCopy(contentLanguage).quickEp;
  const [expanded, setExpanded] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [tab, setTab] = useState<StripTab>("today");
  const [tabInitialized, setTabInitialized] = useState(false);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [initialTrackedIds, setInitialTrackedIds] = useState<Set<number> | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  // Freeze initial tracked set once hydrated so tapping "Vu" / "Pas vu" never jumps cards under the user's thumb
  useEffect(() => {
    if (!hydrated || initialTrackedIds !== null) return;
    setInitialTrackedIds(new Set(library.map((e) => e.mediaId)));
  }, [hydrated, initialTrackedIds, library]);

  const nowSec = nowMs !== null ? Math.floor(nowMs / 1000) : null;

  // Deduplicate by mediaId, prioritizing initially tracked shows & aired episodes without mid-tap jumping
  const allWeekSlots = useMemo(() => {
    const byMedia = new Map<number, AiringScheduleItem>();
    for (const s of airingSlots) {
      if (!byMedia.has(s.media.id)) byMedia.set(s.media.id, s);
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
  }, [airingSlots, initialTrackedIds, nowSec]);

  const todaySlots = useMemo(() => {
    if (nowMs === null) return [];
    return allWeekSlots.filter((s) => isSameLocalDay(s.airingAt, nowMs));
  }, [allWeekSlots, nowMs]);

  // Smart default: land on "Aujourd'hui" when there are releases today, otherwise "Semaine"
  useEffect(() => {
    if (nowMs === null || tabInitialized) return;
    setTab(todaySlots.length > 0 ? "today" : "week");
    setTabInitialized(true);
  }, [nowMs, todaySlots.length, tabInitialized]);

  const visibleSlots = useMemo(() => {
    const source = tab === "today" && todaySlots.length > 0 ? todaySlots : allWeekSlots;
    return source.slice(0, 8);
  }, [tab, todaySlots, allWeekSlots]);

  const summary = useMemo(() => {
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
  }, [visibleSlots, getEntry, nowSec]);

  if (allWeekSlots.length === 0) return null;

  const triggerFlash = (mediaId: number) => {
    setFlashId(mediaId);
    setTimeout(() => setFlashId((prev) => (prev === mediaId ? null : prev)), 620);
  };

  const previewCovers = visibleSlots.slice(0, 3);

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
              {summary.total > 0 && summary.watched === summary.total && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
            </div>
            <p className="text-[11px] font-mono text-[#8C91A6] truncate mt-0.5">
              <strong className="text-white">{summary.watched}</strong>/{summary.total}{" "}
              {copy.watchedUnit} ·{" "}
              {todaySlots.length > 0
                ? `${copy.today} (${todaySlots.length})`
                : `${copy.week} (${allWeekSlots.length})`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Tiny overlapping poster peeks */}
          {!expanded && previewCovers.length > 0 && (
            <div className="flex items-center -space-x-2">
              {previewCovers.map((slot) => (
                <img
                  key={slot.id}
                  src={slot.media.coverImage.large}
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
            <div className="px-3.5 pb-3.5 pt-1 border-t border-white/[0.07] space-y-3">
              {/* Today / Week Switch + See All */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5">
                <div className="inline-flex items-center p-0.5 rounded-full bg-obsidian/85 border border-white/[0.09]">
                  {(
                    [
                      {
                        id: "today" as const,
                        label: copy.today,
                        count: todaySlots.length,
                        icon: Sun,
                      },
                      {
                        id: "week" as const,
                        label: copy.week,
                        count: allWeekSlots.length,
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
                          "relative px-2.5 py-1 rounded-full text-[11.5px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1",
                          active ? "text-accent-fg" : "text-[#9A9EAE] hover:text-white"
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="home-ep-scope"
                            transition={{ type: "spring", stiffness: 420, damping: 32 }}
                            className="absolute inset-0 rounded-full bg-accent shadow-accent"
                          />
                        )}
                        <Icon className="w-3 h-3 relative z-10" />
                        <span className="relative z-10">{opt.label}</span>
                        <span
                          className={cn(
                            "relative z-10 font-mono text-[10px] px-1 rounded-full",
                            active ? "bg-black/20 text-accent-fg" : "bg-white/[0.08] text-[#B8BCCB]"
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

              {/* Slim Progress Bar */}
              <div className="h-1 w-full rounded-full bg-white/[0.07] overflow-hidden">
                <motion.div
                  initial={false}
                  animate={{ width: `${summary.pct}%` }}
                  transition={{ type: "spring", stiffness: 220, damping: 26 }}
                  className="h-full rounded-full bg-gradient-to-r from-accent via-accent-hover to-emerald-400"
                />
              </div>

              {tab === "today" && todaySlots.length === 0 && (
                <p className="text-[11px] text-[#9A9EAE]">{copy.noTodayHome}</p>
              )}

              {/* Silky Swipeable Horizontal Rail (.touch-rail) */}
              <div className="flex gap-2.5 overflow-x-auto touch-rail no-scrollbar pb-0.5 -mx-0.5 px-0.5">
                {visibleSlots.map((slot) => {
                  const entry = getEntry(slot.media.id);
                  const isAired = nowSec !== null ? slot.airingAt <= nowSec : false;
                  const targetEp = isAired ? slot.episode : Math.max(1, slot.episode - 1);
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
                      <Link href={`/media/${slot.media.id}`} className="flex items-center gap-2.5 group">
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
                                status: total && targetEp >= total ? "COMPLETED" : "WATCHING",
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
