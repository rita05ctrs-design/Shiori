"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Check, X, Clock, ArrowRight, ListChecks } from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { RevealSection } from "@/components/motion/MotionPrimitives";
import { cn, formatCountdown, getDisplayTitle } from "@/lib/utils";
import type { AiringScheduleItem } from "@/types/media";

interface HomeWeeklyCheckStripProps {
  airingSlots: AiringScheduleItem[];
}

/**
 * Interactive 1-Click Weekly Episode Check-In Strip directly on the Home page:
 * Lets the user mark newly aired episodes "Oui (Vu)" / "Non" in 1 click,
 * with a direct link to the full dedicated /episodes weekly checklist.
 */
export function HomeWeeklyCheckStrip({ airingSlots }: HomeWeeklyCheckStripProps) {
  const { getEntry, upsertEntry } = useShiori();
  const nowSec = Math.floor(Date.now() / 1000);

  // Deduplicate by mediaId, prioritizing user's tracked shows & recently aired episodes
  const featured = useMemo(() => {
    const byMedia = new Map<number, AiringScheduleItem>();
    for (const s of airingSlots) {
      if (!byMedia.has(s.media.id)) byMedia.set(s.media.id, s);
    }
    return Array.from(byMedia.values())
      .sort((a, b) => {
        const aTracked = Boolean(getEntry(a.media.id));
        const bTracked = Boolean(getEntry(b.media.id));
        if (aTracked !== bTracked) return aTracked ? -1 : 1;
        const aAired = a.airingAt <= nowSec;
        const bAired = b.airingAt <= nowSec;
        if (aAired !== bAired) return aAired ? -1 : 1;
        return a.airingAt - b.airingAt;
      })
      .slice(0, 4);
  }, [airingSlots, getEntry, nowSec]);

  if (featured.length === 0) return null;

  return (
    <RevealSection className="rounded-2xl card-surface p-5 sm:p-6 relative overflow-hidden">
      <div
        className="pointer-events-none absolute -right-24 -top-24 w-72 h-72 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--shiori-accent), transparent 70%)" }}
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 relative z-10">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-kinpaku flex items-center gap-1.5">
            <ListChecks className="w-3.5 h-3.5" />
            <span>Pointage rapide · 1 clic</span>
          </p>
          <h2 className="text-lg sm:text-xl font-semibold text-white mt-0.5">
            Sorties de la semaine — Avez-vous vu l&apos;épisode ?
          </h2>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/episodes"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-fg px-4 py-2 rounded-full bg-accent hover:bg-accent-hover shadow-accent transition-colors"
          >
            <span>Suivi hebdo (1 clic)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/calendar"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-white px-3.5 py-2 rounded-full bg-white/[0.07] hover:bg-white/[0.13] border border-white/[0.1] transition-colors"
          >
            <span>Calendrier</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
        {featured.map((slot) => {
          const entry = getEntry(slot.media.id);
          const isAired = slot.airingAt <= nowSec;
          const targetEp = isAired ? slot.episode : Math.max(1, slot.episode - 1);
          const isWatched = Boolean(entry && entry.progress >= targetEp);
          const title = getDisplayTitle(slot.media);

          return (
            <div
              key={slot.id}
              className={cn(
                "rounded-xl p-3 border transition-all flex flex-col justify-between gap-3",
                isWatched
                  ? "bg-emerald-500/[0.06] border-emerald-500/35"
                  : "bg-white/[0.03] hover:bg-white/[0.055] border-white/[0.07] hover:border-white/[0.15]"
              )}
            >
              <Link href={`/media/${slot.media.id}`} className="flex items-center gap-3 group">
                <img
                  src={slot.media.coverImage.large}
                  alt={title}
                  loading="lazy"
                  decoding="async"
                  className="w-12 h-16 rounded-lg object-cover shrink-0 border border-white/10"
                />
                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold",
                      isWatched
                        ? "bg-emerald-500/18 text-emerald-300 border-emerald-400/35"
                        : "bg-accent/18 text-accent-soft border-accent/30"
                    )}
                  >
                    Ép. {targetEp} {isWatched ? "vu ✓" : isAired ? "sorti" : "dispo"}
                  </span>
                  <p className="text-[13px] font-semibold text-[#F4F3EE] group-hover:text-white truncate mt-1">
                    {title}
                  </p>
                  <p className="text-[11px] font-mono text-[#8C91A6] flex items-center gap-1 mt-0.5 truncate">
                    <Clock className="w-3 h-3 text-kinpaku shrink-0" />
                    <span className="truncate">{formatCountdown(slot.airingAt)}</span>
                  </p>
                </div>
              </Link>

              {/* 1-click Oui / Non toggle */}
              <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-obsidian/85 border border-white/[0.09]">
                <button
                  type="button"
                  onClick={() => {
                    if (isWatched) {
                      upsertEntry(slot.media, {
                        status: "WATCHING",
                        progress: Math.max(0, targetEp - 1),
                      });
                    }
                  }}
                  className={cn(
                    "h-7 rounded-md text-[11px] font-semibold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer",
                    !isWatched
                      ? "bg-white/[0.12] text-white"
                      : "text-[#7D8296] hover:text-rose-300 hover:bg-rose-500/12"
                  )}
                >
                  <X className="w-3 h-3" />
                  <span>Non</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isWatched) {
                      const total = slot.media.episodes;
                      upsertEntry(slot.media, {
                        status: total && targetEp >= total ? "COMPLETED" : "WATCHING",
                        progress: targetEp,
                      });
                    }
                  }}
                  className={cn(
                    "h-7 rounded-md text-[11px] font-semibold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer",
                    isWatched
                      ? "bg-emerald-500 text-[#07080C]"
                      : "text-[#C6CAD8] hover:bg-accent hover:text-accent-fg"
                  )}
                >
                  <Check className="w-3 h-3 stroke-[2.8]" />
                  <span>Oui · Vu</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </RevealSection>
  );
}
