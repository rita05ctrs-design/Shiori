"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Film,
  Layers,
  MoveHorizontal,
  Sparkles,
} from "lucide-react";
import { useDragScroll } from "@/hooks/useDragScroll";
import { useTranslation } from "@/hooks/useTranslation";
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
  const { t, tr } = useTranslation();
  const localizeSeasonShortLabel = (raw: string): string => {
    const m = /^Saison\s+(\d+)(.*)$/i.exec(raw.trim());
    if (m) return `${tr("Saison")} ${m[1]}${m[2]}`;
    if (raw === "Film") return tr("Film");
    if (raw === "Spécial") return tr("Spécial");
    if (raw === "Suite") return tr("Suite");
    if (raw === "Préquelle") return tr("Préquelle");
    return raw;
  };
  const activeCardRef = useRef<HTMLDivElement | null>(null);
  const {
    ref: scrollRef,
    trackThumbRef,
    isDragging,
    canScrollLeft,
    canScrollRight,
    scrollByAmount,
    dragHandlers,
  } = useDragScroll<HTMLDivElement>();

  const hasOverflow = canScrollLeft || canScrollRight;

  // Center the active season horizontally inside the rail without jumping page vertical scroll
  useEffect(() => {
    const container = scrollRef.current;
    const card = activeCardRef.current;
    if (!container || !card) return;
    const targetLeft = card.offsetLeft - (container.clientWidth - card.clientWidth) / 2;
    container.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: "smooth",
    });
  }, [currentId, scrollRef]);

  // Allow smooth mouse-wheel horizontal scrolling (left <-> right) while hovering the rail,
  // automatically handing control back to vertical page scroll once either edge is reached.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 4) return;

      const scrollingRight = e.deltaY > 0;
      const canMove = scrollingRight
        ? el.scrollLeft < maxScroll - 2
        : el.scrollLeft > 2;

      if (canMove) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [scrollRef]);

  // Cleanly hide section if this is a standalone anime/manga with no linked seasons
  if (!timeline || timeline.length <= 1) {
    return null;
  }

  return (
    <section
      aria-label="Saisons et Chronologie"
      className="rounded-2xl card-surface border border-white/[0.09] p-4 sm:p-5 space-y-4"
    >
      {/* Header + Desktop Prev/Next Quick Navigation + Horizontal Rail Scroll Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>{t("detail.seasonsTitle")}</span>
          </p>
          <p className="text-xs text-[#8E93A6] mt-0.5">
            {t("detail.seasonsSub")} ({timeline.length})
          </p>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 flex-wrap">
          {/* Bidirectional Horizontal Scroll Controls (Left <-> Right) */}
          {hasOverflow && (
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "hidden lg:inline-flex items-center gap-1 text-[10.5px] font-mono px-2 py-1 rounded-full border transition-colors select-none",
                  isDragging
                    ? "bg-accent/15 border-accent/40 text-accent-soft"
                    : "bg-white/[0.03] border-white/[0.07] text-[#7A7F94]"
                )}
              >
                <MoveHorizontal className="w-3 h-3" />
                <span>{isDragging ? t("common.scrolling") : t("common.drag")}</span>
              </span>

              <button
                type="button"
                disabled={!canScrollLeft}
                onClick={() => scrollByAmount(-1)}
                title="Défiler les saisons vers la gauche"
                aria-label="Défiler les saisons vers la gauche"
                className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.14] active:scale-90 disabled:opacity-30 border border-white/[0.09] flex items-center justify-center text-[#D0D4E2] hover:text-white transition-all cursor-pointer disabled:cursor-default"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={!canScrollRight}
                onClick={() => scrollByAmount(1)}
                title="Défiler les saisons vers la droite"
                aria-label="Défiler les saisons vers la droite"
                className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.14] active:scale-90 disabled:opacity-30 border border-white/[0.09] flex items-center justify-center text-[#D0D4E2] hover:text-white transition-all cursor-pointer disabled:cursor-default"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Desktop Prev / Next Quick Season Page Buttons */}
          {(prevSeason || nextSeason) && (
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              {prevSeason && (
                <Link
                  href={getSeasonHref(prevSeason)}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-[#E8E9F0] hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-accent-soft" />
                  <span>{t("detail.prevSeason")}</span>
                </Link>
              )}
              {nextSeason && (
                <Link
                  href={getSeasonHref(nextSeason)}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-accent hover:bg-accent-hover border border-white/15 text-xs font-semibold text-accent-fg shadow-[0_8px_22px_rgba(229,72,77,0.32)] transition-colors"
                >
                  <span>{t("detail.nextSeason")}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Interactive Season Cards Rail (Drag, Wheel, Swipe & Edge Arrows) */}
      <div className="relative group/seasons">
        {/* Left Atmospheric Edge Vignette & Floating Arrow */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-0 top-0 bottom-2 w-10 z-10 bg-gradient-to-r from-[#0E1019] to-transparent transition-opacity duration-200",
            canScrollLeft ? "opacity-95" : "opacity-0"
          )}
        />
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollByAmount(-1)}
            aria-label="Faire défiler vers la gauche"
            className="hidden sm:flex absolute left-1.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-obsidian/90 hover:bg-accent border border-white/15 text-white items-center justify-center shadow-[0_6px_18px_rgba(0,0,0,0.65)] transition-all cursor-pointer active:scale-90 opacity-0 group-hover/seasons:opacity-100 focus-visible:opacity-100"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Right Atmospheric Edge Vignette & Floating Arrow */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute right-0 top-0 bottom-2 w-10 z-10 bg-gradient-to-l from-[#0E1019] to-transparent transition-opacity duration-200",
            canScrollRight ? "opacity-95" : "opacity-0"
          )}
        />
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollByAmount(1)}
            aria-label="Faire défiler vers la droite"
            className="hidden sm:flex absolute right-1.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-obsidian/90 hover:bg-accent border border-white/15 text-white items-center justify-center shadow-[0_6px_18px_rgba(0,0,0,0.65)] transition-all cursor-pointer active:scale-90 opacity-0 group-hover/seasons:opacity-100 focus-visible:opacity-100"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        <div
          ref={scrollRef}
          {...dragHandlers}
          className={cn(
            "flex gap-2.5 overflow-x-auto overflow-y-hidden touch-rail no-scrollbar pb-1.5 -mx-1 px-1 select-none",
            hasOverflow
              ? isDragging
                ? "cursor-grabbing"
                : "cursor-grab"
              : ""
          )}
        >
          {timeline.map((item, idx) => {
            const isExtra =
              item.format === "MOVIE" || item.format === "OVA" || item.format === "SPECIAL";
            const prevItem = idx > 0 ? timeline[idx - 1] : null;
            const prevWasMain =
              prevItem !== null &&
              prevItem.format !== "MOVIE" &&
              prevItem.format !== "OVA" &&
              prevItem.format !== "SPECIAL";
            const showExtrasDivider = isExtra && prevWasMain;
            const isCurrent = item.id === currentId;
            const unitCount =
              item.type === "MANGA"
                ? item.chapters
                  ? `${item.chapters} ${t("common.chShort")}`
                  : null
                : item.episodes
                  ? `${item.episodes} ${t("common.epShort")}`
                  : null;

            const cardInner = (
              <div
                className={cn(
                  "w-[205px] sm:w-[228px] shrink-0 rounded-xl p-2.5 border transition-all flex items-center gap-2.5 h-full",
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
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover pointer-events-none"
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
                      {localizeSeasonShortLabel(item.shortLabel)}
                    </span>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-accent text-accent-fg text-[9.5px] font-bold uppercase tracking-wider">
                        <Sparkles className="w-2.5 h-2.5" />
                        {t("detail.current")}
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
                      .join(" · ") || tr("Série liée")}
                  </p>
                </div>
              </div>
            );

            const divider = showExtrasDivider ? (
              <div
                aria-hidden="true"
                className="flex flex-col items-center justify-center px-1 shrink-0 select-none"
              >
                <span className="w-px h-4 bg-white/[0.12]" />
                <span className="my-1 px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.09] font-mono text-[9px] uppercase tracking-wider text-[#7E8397]">
                  +
                </span>
                <span className="w-px h-4 bg-white/[0.12]" />
              </div>
            ) : null;

            if (isCurrent) {
              return (
                <React.Fragment key={item.id}>
                  {divider}
                  <div ref={activeCardRef} aria-current="page" className="shrink-0">
                    {cardInner}
                  </div>
                </React.Fragment>
              );
            }

            return (
              <React.Fragment key={item.id}>
                {divider}
                <Link
                  href={getSeasonHref(item)}
                  draggable={false}
                  className="group block shrink-0"
                >
                  {cardInner}
                </Link>
              </React.Fragment>
            );
          })}
        </div>

        {/* Hairline Glide Progress Bar (visible only when scrollable horizontally) */}
        {hasOverflow && (
          <div className="mt-1.5 h-[2px] w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div
              ref={trackThumbRef}
              style={{ width: "28%", transform: "translate3d(0%, 0, 0)" }}
              className={cn(
                "h-full rounded-full transition-colors duration-200 will-change-transform",
                isDragging
                  ? "bg-gradient-to-r from-accent to-[#F0B95B]"
                  : "bg-white/25 group-hover/seasons:bg-accent/75"
              )}
            />
          </div>
        )}
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
              <span className="truncate">{t("detail.prevSeason")}</span>
            </Link>
          )}
          {nextSeason && (
            <Link
              href={getSeasonHref(nextSeason)}
              className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-accent text-accent-fg text-xs font-semibold shadow-[0_6px_18px_rgba(229,72,77,0.3)]"
            >
              <span className="truncate">{t("detail.nextSeason")}</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
