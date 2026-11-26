"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight, MoveHorizontal } from "lucide-react";
import { MediaCard } from "./MediaCard";
import { RevealSection } from "@/components/motion/MotionPrimitives";
import { useDragScroll } from "@/hooks/useDragScroll";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/types/media";

interface MediaRailProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  href?: string;
  items: MediaItem[];
  showRank?: boolean;
}

export function MediaRail({
  title,
  subtitle,
  eyebrow,
  href,
  items,
  showRank = false,
}: MediaRailProps) {
  const { t, tr } = useTranslation();
  const {
    ref: scrollRef,
    trackThumbRef,
    isDragging,
    canScrollLeft,
    canScrollRight,
    scrollByAmount,
    dragHandlers,
  } = useDragScroll<HTMLDivElement>();

  if (!items.length) return null;

  return (
    <RevealSection className="relative">
      {/* Section Header */}
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          {eyebrow && (
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent mb-1">
              {eyebrow}
            </p>
          )}
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#F4F3EE]">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm text-[#868B9F] mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              "hidden lg:inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border transition-colors select-none",
              isDragging
                ? "bg-accent/15 border-accent/40 text-accent-soft"
                : "bg-white/[0.025] border-white/[0.06] text-[#6F7489]"
            )}
          >
            <MoveHorizontal className="w-3 h-3" />
            <span>{isDragging ? t("common.scrolling") : t("common.drag")}</span>
          </span>

          {href && (
            <Link
              href={href}
              className="group hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-[#A4A8BA] hover:text-white px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] transition-all"
            >
              <span>{t("common.viewAll")}</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}

          <button
            type="button"
            disabled={!canScrollLeft}
            onClick={() => scrollByAmount(-1)}
            aria-label={tr("Défiler vers la gauche")}
            className="w-8 h-8 rounded-full bg-white/[0.045] hover:bg-white/[0.12] active:scale-90 disabled:opacity-30 border border-white/[0.08] flex items-center justify-center text-[#C2C6D4] hover:text-white transition-all cursor-pointer disabled:cursor-default"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canScrollRight}
            onClick={() => scrollByAmount(1)}
            aria-label={tr("Défiler vers la droite")}
            className="w-8 h-8 rounded-full bg-white/[0.045] hover:bg-white/[0.12] active:scale-90 disabled:opacity-30 border border-white/[0.08] flex items-center justify-center text-[#C2C6D4] hover:text-white transition-all cursor-pointer disabled:cursor-default"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Rail Wrapper with Smooth Atmospheric Edge Vignettes */}
      <div className="relative group/rail">
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-0 top-0 bottom-5 w-14 z-10 bg-gradient-to-r from-obsidian to-transparent transition-opacity duration-300",
            canScrollLeft ? "opacity-90" : "opacity-0"
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute right-0 top-0 bottom-5 w-14 z-10 bg-gradient-to-l from-obsidian to-transparent transition-opacity duration-300",
            canScrollRight ? "opacity-90" : "opacity-0"
          )}
        />

        {/* Native 120fps Touch Swipe on Mobile + Physics Click-and-Drag on Desktop */}
        <div
          ref={scrollRef}
          {...dragHandlers}
          className={cn(
            "flex gap-3.5 sm:gap-5 overflow-x-auto overflow-y-hidden touch-rail no-scrollbar py-4 -my-3 -mx-1 px-1 select-none",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
        >
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="w-[152px] sm:w-[176px] lg:w-[188px] shrink-0"
            >
              <MediaCard media={item} rank={showRank ? idx + 1 : undefined} />
            </div>
          ))}
        </div>

        {/* Sleek Hairline Glide Track (updated directly via ref on GPU — 0 React re-renders!) */}
        <div className="mt-1 h-[2px] w-full rounded-full bg-white/[0.05] overflow-hidden">
          <div
            ref={trackThumbRef}
            style={{ width: "28%", transform: "translate3d(0%, 0, 0)" }}
            className={cn(
              "h-full rounded-full transition-colors duration-200 will-change-transform",
              isDragging
                ? "bg-gradient-to-r from-accent to-[#F0B95B]"
                : "bg-white/25 group-hover/rail:bg-accent/75"
            )}
          />
        </div>
      </div>
    </RevealSection>
  );
}
