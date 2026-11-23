"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  Play,
  Plus,
  Check,
  Star,
  Info,
  Sparkles,
  Tv,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { TranslatedSynopsis } from "@/components/media/TranslatedSynopsis";
import { CINEMA_EASE } from "@/components/motion/MotionPrimitives";
import {
  cn,
  formatFormat,
  formatScore,
  formatSeason,
  getDisplayTitle,
  getStatusLabel,
} from "@/lib/utils";
import type { MediaItem } from "@/types/media";

const SLIDE_DURATION_MS = 8000;

interface HeroShowcaseProps {
  items: MediaItem[];
}

export function HeroShowcase({ items }: HeroShowcaseProps) {
  const { getEntry, openQuickEdit, openTrailer } = useShiori();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [heroDragging, setHeroDragging] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const heroDragRef = useRef({
    down: false,
    startX: 0,
    didSwipe: false,
    suppressClickUntil: 0,
  });

  // Scroll-linked parallax depth
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 42]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.2]);

  const slides = items.length ? items : [];
  const active = slides[index] ?? slides[0];

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(timer);
  }, [slides.length, paused]);

  if (!active) return null;

  const entry = getEntry(active.id);
  const title = getDisplayTitle(active);

  const prevSlide = () => setIndex((i) => (i - 1 + slides.length) % slides.length);
  const nextSlide = () => setIndex((i) => (i + 1) % slides.length);

  const handleHeroMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    if (e.button !== 0 || slides.length <= 1) return;
    if ((e.target as HTMLElement | null)?.closest("button, a")) return;

    const st = heroDragRef.current;
    st.down = true;
    st.startX = e.clientX;
    st.didSwipe = false;

    const onMove = (ev: MouseEvent) => {
      if (!st.down) return;
      const dx = ev.clientX - st.startX;
      if (!st.didSwipe && Math.abs(dx) > 6) {
        st.didSwipe = true;
        setHeroDragging(true);
      }
      if (st.didSwipe) {
        ev.preventDefault();
        setDragOffsetX(Math.max(-140, Math.min(140, dx * 0.45)));
      }
    };

    const onUp = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (!st.down) return;
      st.down = false;

      const dx = ev.clientX - st.startX;
      setHeroDragging(false);
      setDragOffsetX(0);

      if (st.didSwipe) {
        st.suppressClickUntil = performance.now() + 180;
        if (dx <= -55) nextSlide();
        else if (dx >= 55) prevSlide();
      }
    };

    window.addEventListener("mousemove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
  };

  return (
    <section
      ref={heroRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onMouseDown={handleHeroMouseDown}
      onDragStart={(e) => e.preventDefault()}
      onClickCapture={(e) => {
        if (performance.now() < heroDragRef.current.suppressClickUntil) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className={cn(
        "relative w-full min-h-[370px] sm:min-h-[420px] lg:min-h-[460px] flex items-end overflow-hidden pt-[calc(4.75rem+env(safe-area-inset-top))] pb-8 sm:pb-10 select-none",
        heroDragging ? "cursor-grabbing" : "cursor-grab"
      )}
    >
      {/* Scroll-Parallax + Ken Burns Cinema Backdrop */}
      <motion.div
        style={{ y: bgY, scale: bgScale }}
        className="absolute inset-0 z-0 will-change-transform"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 1.1, ease: CINEMA_EASE }}
            className="absolute inset-0"
          >
            <img
              src={active.bannerImage || active.coverImage.extraLarge}
              alt={title}
              className="w-full h-full object-cover object-center"
            />
            {/* Atmospheric editorial gradients (static GPU layer — no idle infinite animation) */}
            <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/78 to-obsidian/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/35 to-obsidian/55" />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: `radial-gradient(circle at 26% 42%, ${active.coverImage.color || "#E5484D"}55, transparent 62%)`,
              }}
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Foreground Content with gentle scroll parallax + subtle drag follow */}
      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        animate={{ x: dragOffsetX }}
        transition={heroDragging ? { duration: 0 } : { type: "spring", stiffness: 280, damping: 28 }}
        className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full will-change-transform"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          {/* Left Choreographed Editorial Column */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={{
                  hidden: {},
                  visible: {
                    transition: { staggerChildren: 0.065, delayChildren: 0.04 },
                  },
                  exit: {
                    opacity: 0,
                    y: -10,
                    transition: { duration: 0.2 },
                  },
                }}
              >
                {/* Eyebrow badges */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 14 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: CINEMA_EASE } },
                  }}
                  className="flex flex-wrap items-center gap-2 mb-4"
                >
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/18 border border-accent/35 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-soft">
                    <Sparkles className="w-3 h-3" />
                    Sélection Shiori
                  </span>
                  {active.averageScore && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.12] text-xs font-mono font-semibold text-[#F0B95B]">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {formatScore(active.averageScore)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] backdrop-blur-md border border-white/[0.08] text-xs text-[#CFD3E0]">
                    <Tv className="w-3 h-3 text-[#9A9EAE]" />
                    {formatFormat(active.format)}
                    {active.episodes ? ` · ${active.episodes} ép.` : ""}
                  </span>
                  {active.seasonYear && (
                    <span className="text-xs font-mono text-[#A6AAB8] px-1">
                      {formatSeason(active.season, active.seasonYear)}
                    </span>
                  )}
                </motion.div>

                {/* Native Japanese Subtitle */}
                {active.title.native && (
                  <motion.p
                    variants={{
                      hidden: { opacity: 0, y: 12 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.48, ease: CINEMA_EASE } },
                    }}
                    className="font-serif italic text-base sm:text-lg text-[#C9C7BE]/80 tracking-wide mb-1"
                  >
                    {active.title.native}
                  </motion.p>
                )}

                {/* Main Title */}
                <motion.h1
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.45, ease: CINEMA_EASE },
                    },
                  }}
                  className="text-3xl sm:text-5xl lg:text-[56px] font-bold tracking-tight text-gradient-editorial leading-[1.06] max-w-3xl"
                >
                  {title}
                </motion.h1>

                {/* Genres & Studio */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 14 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: CINEMA_EASE } },
                  }}
                  className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#B6BAC8]"
                >
                  {active.studio && (
                    <span className="font-semibold text-white">{active.studio}</span>
                  )}
                  {active.studio && active.genres.length > 0 && (
                    <span className="text-white/30">•</span>
                  )}
                  {active.genres.slice(0, 4).map((g) => (
                    <Link
                      key={g}
                      href={`/discover?genre=${encodeURIComponent(g)}`}
                      className="px-2.5 py-0.5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.08] text-[#D7DAE6] transition-colors"
                    >
                      {g}
                    </Link>
                  ))}
                </motion.div>

                {/* Synopsis (auto-translated in chosen content language) */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 14 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.48, ease: CINEMA_EASE } },
                  }}
                  className="mt-4"
                >
                  <TranslatedSynopsis
                    mediaId={active.id}
                    description={active.description}
                    variant="hero"
                  />
                </motion.div>

                {/* Actions */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: CINEMA_EASE } },
                  }}
                  className="mt-6 sm:mt-7 flex flex-wrap items-center gap-2.5 sm:gap-3"
                >
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}>
                    <Link
                      href={`/media/${active.id}`}
                      className="inline-flex items-center gap-2 h-10 sm:h-11 px-4 sm:px-6 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-xs sm:text-sm font-semibold shadow-[0_12px_34px_rgb(var(--shiori-accent-rgb)/0.45)] transition-colors"
                    >
                      <Info className="w-4 h-4" />
                      <span>Voir la fiche</span>
                    </Link>
                  </motion.div>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => openQuickEdit(active)}
                    className={cn(
                      "inline-flex items-center gap-2 h-10 sm:h-11 px-4 sm:px-5 rounded-full backdrop-blur-md border text-xs sm:text-sm font-medium transition-all cursor-pointer",
                      entry
                        ? "bg-emerald-500/18 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/28"
                        : "bg-white/[0.08] hover:bg-white/[0.15] border-white/[0.14] text-white"
                    )}
                  >
                    {entry ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>
                          {getStatusLabel(entry.status, entry.type)}
                          {entry.progress > 0 ? ` · Ép. ${entry.progress}` : ""}
                        </span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Ajouter à ma liste</span>
                      </>
                    )}
                  </motion.button>

                  {active.trailer && (
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => openTrailer(active.trailer!.id, title)}
                      className="inline-flex items-center gap-2 h-10 sm:h-11 px-4 sm:px-5 rounded-full bg-black/45 hover:bg-black/70 backdrop-blur-md border border-white/[0.14] text-xs sm:text-sm font-medium text-[#E9E8E3] transition-all cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current text-[#F0B95B]" />
                      <span>Bande-annonce</span>
                    </motion.button>
                  )}
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right Slide Selector Thumbnails + Live Auto-Advance Progress */}
          <div className="lg:col-span-4 min-w-0 flex flex-col items-start lg:items-end justify-end gap-3">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full pb-1">
              {slides.map((slide, idx) => {
                const isSelected = idx === index;
                return (
                  <motion.button
                    key={slide.id}
                    type="button"
                    whileHover={{ y: -3, scale: isSelected ? 1.06 : 1.04 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIndex(idx)}
                    aria-label={getDisplayTitle(slide)}
                    className={cn(
                      "relative group rounded-lg overflow-hidden transition-all duration-300 cursor-pointer border",
                      isSelected
                        ? "w-14 h-20 border-accent shadow-[0_0_24px_rgb(var(--shiori-accent-rgb)/0.5)]"
                        : "w-11 h-16 border-white/[0.14] opacity-55 hover:opacity-95"
                    )}
                  >
                    <img
                      src={slide.coverImage.large}
                      alt={getDisplayTitle(slide)}
                      className="w-full h-full object-cover"
                    />
                    {isSelected && (
                      <div className="absolute bottom-0 inset-x-0 h-[3px] bg-black/60">
                        <motion.div
                          key={`${active.id}-${paused ? "p" : "r"}`}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: paused ? 0.35 : 1 }}
                          transition={{
                            duration: paused ? 0.2 : SLIDE_DURATION_MS / 1000,
                            ease: "linear",
                          }}
                          style={{ transformOrigin: "left center" }}
                          className="h-full w-full bg-gradient-to-r from-accent to-[#F0B95B]"
                        />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <p className="text-[11px] font-mono text-[#7F8499] hidden sm:block truncate max-w-[240px]">
                0{index + 1} / 0{slides.length} · {title}
              </p>
              {slides.length > 1 && (
                <div className="flex items-center gap-1">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={prevSlide}
                    aria-label="Diapositive précédente"
                    className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.1] flex items-center justify-center text-[#D2D5E0] hover:text-white cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={nextSlide}
                    aria-label="Diapositive suivante"
                    className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.1] flex items-center justify-center text-[#D2D5E0] hover:text-white cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
