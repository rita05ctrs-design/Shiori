"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowRight, MoveHorizontal } from "lucide-react";
import { MediaCard } from "./MediaCard";
import { CINEMA_EASE, RevealSection } from "@/components/motion/MotionPrimitives";
import { useDragScroll } from "@/hooks/useDragScroll";
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
  const {
    ref: scrollRef,
    isDragging,
    canScrollLeft,
    canScrollRight,
    scrollProgress,
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
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#E5484D] mb-1">
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
          {/* Subtle interactive drag hint pill */}
          <span
            className={cn(
              "hidden lg:inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border transition-colors select-none",
              isDragging
                ? "bg-[#E5484D]/15 border-[#E5484D]/40 text-[#FF8C90]"
                : "bg-white/[0.025] border-white/[0.06] text-[#6F7489]"
            )}
          >
            <MoveHorizontal className="w-3 h-3" />
            <span>{isDragging ? "Défilement..." : "Glisser"}</span>
          </span>

          {href && (
            <Link
              href={href}
              className="group hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-[#A4A8BA] hover:text-white px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] transition-all"
            >
              <span>Voir tout</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}

          <motion.button
            type="button"
            whileHover={{ scale: canScrollLeft ? 1.08 : 1 }}
            whileTap={{ scale: canScrollLeft ? 0.9 : 1 }}
            disabled={!canScrollLeft}
            onClick={() => scrollByAmount(-1)}
            aria-label="Défiler vers la gauche"
            className="w-8 h-8 rounded-full bg-white/[0.045] hover:bg-white/[0.12] disabled:opacity-30 border border-white/[0.08] flex items-center justify-center text-[#C2C6D4] hover:text-white transition-colors cursor-pointer disabled:cursor-default"
          >
            <ChevronLeft className="w-4 h-4" />
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: canScrollRight ? 1.08 : 1 }}
            whileTap={{ scale: canScrollRight ? 0.9 : 1 }}
            disabled={!canScrollRight}
            onClick={() => scrollByAmount(1)}
            aria-label="Défiler vers la droite"
            className="w-8 h-8 rounded-full bg-white/[0.045] hover:bg-white/[0.12] disabled:opacity-30 border border-white/[0.08] flex items-center justify-center text-[#C2C6D4] hover:text-white transition-colors cursor-pointer disabled:cursor-default"
          >
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Rail Wrapper with Smooth Atmospheric Edge Vignettes */}
      <div className="relative group/rail">
        {/* Left fade mask */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-0 top-0 bottom-5 w-14 z-10 bg-gradient-to-r from-[#07080C] to-transparent transition-opacity duration-300",
            canScrollLeft ? "opacity-90" : "opacity-0"
          )}
        />
        {/* Right fade mask */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute right-0 top-0 bottom-5 w-14 z-10 bg-gradient-to-l from-[#07080C] to-transparent transition-opacity duration-300",
            canScrollRight ? "opacity-90" : "opacity-0"
          )}
        />

        {/* Click-and-Drag Horizontal Rail */}
        <div
          ref={scrollRef}
          {...dragHandlers}
          className={cn(
            "flex gap-4 sm:gap-5 overflow-x-auto no-scrollbar pb-4 pt-1 -mx-1 px-1 select-none",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
        >
          {items.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: "some", margin: "80px 0px 80px 0px" }}
              transition={{
                duration: 0.48,
                delay: Math.min(idx * 0.04, 0.32),
                ease: CINEMA_EASE,
              }}
              className={cn(
                "w-[152px] sm:w-[176px] lg:w-[188px] shrink-0 transition-transform duration-200",
                isDragging && "scale-[0.985]"
              )}
            >
              <MediaCard media={item} rank={showRank ? idx + 1 : undefined} />
            </motion.div>
          ))}
        </div>

        {/* Sleek Hairline Glide Track */}
        <div className="mt-1 h-[2px] w-full rounded-full bg-white/[0.05] overflow-hidden">
          <div
            style={{
              width: "28%",
              transform: `translateX(${scrollProgress * 257}%)`,
            }}
            className={cn(
              "h-full rounded-full transition-[background-color,box-shadow] duration-200 will-change-transform",
              isDragging
                ? "bg-gradient-to-r from-[#E5484D] to-[#F0B95B] shadow-[0_0_10px_rgba(229,72,77,0.8)]"
                : "bg-white/25 group-hover/rail:bg-[#E5484D]/75"
            )}
          />
        </div>
      </div>
    </RevealSection>
  );
}
