"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Film, Layers, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SeasonTimelineEntry } from "@/types/media";

interface SeasonChronologySectionProps {
  currentId: number;
  timeline: SeasonTimelineEntry[];
  prevSeason: SeasonTimelineEntry | null;
  nextSeason: SeasonTimelineEntry | null;
}

function getSeasonHref(entry: SeasonTimelineEntry): string {
  return entry.type === "ANIME" ? `/anime/${entry.id}` : `/media/${entry.id}`;
}

export function SeasonChronologySection({
  currentId,
  timeline,
  prevSeason,
  nextSeason,
}: SeasonChronologySectionProps) {
  const activeCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeCardRef.current) {
      activeCardRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentId]);

  // Cleanly hide section if this is a standalone anime/manga with no linked seasons
  if (!timeline || timeline.length <= 1) {
    return null;
  }

  return (
    <section
      aria-label="Saisons et Chronologie"
      className="rounded-2xl card-surface border border-white/[0.09] p-4 sm:p-5 space-y-4"
    >
      {/* Header + Desktop Prev/Next Quick Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Saisons & Chronologie</span>
          </p>
          <p className="text-xs text-[#8E93A6] mt-0.5">
            Naviguez en un clic entre les {timeline.length} entrées de la franchise
          </p>
        </div>

        {/* Desktop Prev / Next Quick Buttons */}
        {(prevSeason || nextSeason) && (
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {prevSeason && (
              <Link
                href={getSeasonHref(prevSeason)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-[#E8E9F0] hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-accent-soft" />
                <span>Saison précédente</span>
              </Link>
            )}
            {nextSeason && (
              <Link
                href={getSeasonHref(nextSeason)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-accent hover:bg-accent-hover border border-white/15 text-xs font-semibold text-accent-fg shadow-[0_8px_22px_rgba(229,72,77,0.32)] transition-colors"
              >
                <span>Saison suivante</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Horizontal Interactive Season Cards Rail */}
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar snap-x pb-1 -mx-1 px-1">
        {timeline.map((item) => {
          const isCurrent = item.id === currentId;
          const unitCount =
            item.type === "MANGA"
              ? item.chapters
                ? `${item.chapters} ch.`
                : null
              : item.episodes
                ? `${item.episodes} ép.`
                : null;

          const cardInner = (
            <div
              className={cn(
                "w-[205px] sm:w-[228px] shrink-0 snap-start rounded-xl p-2.5 border transition-all flex items-center gap-2.5 h-full",
                isCurrent
                  ? "bg-gradient-to-br from-accent/20 via-[#15111B] to-kinpaku/10 border-accent/65 shadow-[0_0_24px_rgba(229,72,77,0.22)] ring-1 ring-inset ring-kinpaku/25"
                  : "bg-obsidian/70 border-white/[0.08] hover:border-white/[0.22] hover:bg-white/[0.05]"
              )}
            >
              {/* Compact Thumbnail */}
              <div className="relative w-11 h-16 rounded-lg overflow-hidden shrink-0 border border-white/12 bg-[#121521]">
                <img
                  src={item.coverImage}
                  alt={item.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
                {item.format === "MOVIE" && (
                  <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded bg-obsidian/90 flex items-center justify-center">
                    <Film className="w-2.5 h-2.5 text-kinpaku" />
                  </span>
                )}
              </div>

              {/* Season Info */}
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={cn(
                      "text-[11px] font-mono font-bold uppercase tracking-wide",
                      isCurrent ? "text-kinpaku" : "text-accent-soft"
                    )}
                  >
                    {item.shortLabel}
                  </span>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-accent text-accent-fg text-[9.5px] font-bold uppercase tracking-wider">
                      <Sparkles className="w-2.5 h-2.5" />
                      Actuelle
                    </span>
                  )}
                </div>

                <p
                  className={cn(
                    "text-xs font-semibold line-clamp-1",
                    isCurrent ? "text-white" : "text-[#DCDFE9] group-hover:text-white"
                  )}
                >
                  {item.title}
                </p>

                <p className="text-[10.5px] font-mono text-[#8A8FA4] truncate">
                  {[item.seasonYear ? String(item.seasonYear) : null, unitCount]
                    .filter(Boolean)
                    .join(" · ") || "Série liée"}
                </p>
              </div>
            </div>
          );

          if (isCurrent) {
            return (
              <div key={item.id} ref={activeCardRef} aria-current="page">
                {cardInner}
              </div>
            );
          }

          return (
            <Link
              key={item.id}
              href={getSeasonHref(item)}
              className="group block shrink-0"
            >
              {cardInner}
            </Link>
          );
        })}
      </div>

      {/* Mobile Clean Prev / Next Bar */}
      {(prevSeason || nextSeason) && (
        <div
          className={cn(
            "grid sm:hidden gap-2 pt-0.5",
            prevSeason && nextSeason ? "grid-cols-2" : "grid-cols-1"
          )}
        >
          {prevSeason && (
            <Link
              href={getSeasonHref(prevSeason)}
              className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-xs font-semibold text-[#E8E9F0]"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-accent-soft shrink-0" />
              <span className="truncate">Saison précédente</span>
            </Link>
          )}
          {nextSeason && (
            <Link
              href={getSeasonHref(nextSeason)}
              className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-accent text-accent-fg text-xs font-semibold shadow-[0_6px_18px_rgba(229,72,77,0.3)]"
            >
              <span className="truncate">Saison suivante</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
