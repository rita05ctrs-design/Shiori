"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
  BookmarkPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  Heart,
  Minus,
  PauseCircle,
  Play,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  XCircle,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { CINEMA_EASE } from "@/components/motion/MotionPrimitives";
import { cn, STATUS_CONFIG } from "@/lib/utils";
import type { LibraryStatus, MediaDetail } from "@/types/media";

const STATUS_META: {
  id: LibraryStatus;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
  mangaHint: string;
  glow: string;
}[] = [
  {
    id: "WATCHING",
    icon: Play,
    hint: "En cours de visionnage",
    mangaHint: "Lecture en cours",
    glow: "rgba(56, 189, 248, 0.35)",
  },
  {
    id: "PLAN_TO_WATCH",
    icon: BookmarkPlus,
    hint: "À découvrir plus tard",
    mangaHint: "À lire plus tard",
    glow: "rgba(167, 139, 250, 0.35)",
  },
  {
    id: "COMPLETED",
    icon: CheckCircle2,
    hint: "Œuvre terminée",
    mangaHint: "Manga terminé",
    glow: "rgba(52, 211, 153, 0.35)",
  },
  {
    id: "ON_HOLD",
    icon: PauseCircle,
    hint: "En pause temporaire",
    mangaHint: "Lecture en pause",
    glow: "rgba(251, 191, 36, 0.35)",
  },
  {
    id: "DROPPED",
    icon: XCircle,
    hint: "Abandonné",
    mangaHint: "Abandonné",
    glow: "rgba(248, 113, 113, 0.35)",
  },
];

const SCORE_VERDICT: Record<number, string> = {
  10: "Chef-d'œuvre",
  9: "Exceptionnel",
  8: "Excellent",
  7: "Très bon",
  6: "Sympa",
  5: "Moyen",
  4: "Faible",
  3: "Décevant",
  2: "Mauvais",
  1: "À éviter",
};

const BURST_PARTICLES = [
  { x: -34, y: -22, color: "var(--shiori-accent)", size: 6 },
  { x: 34, y: -20, color: "var(--shiori-secondary)", size: 5 },
  { x: -24, y: 20, color: "var(--shiori-accent-hover)", size: 4 },
  { x: 26, y: 18, color: "#34D399", size: 5 },
  { x: 0, y: -32, color: "#F0B95B", size: 6 },
  { x: -42, y: 0, color: "#38BDF8", size: 4 },
  { x: 42, y: -2, color: "#A78BFA", size: 4 },
];

interface LibraryTrackerCardProps {
  media: MediaDetail;
  title: string;
}

export function LibraryTrackerCard({ media, title }: LibraryTrackerCardProps) {
  const {
    getEntry,
    upsertEntry,
    incrementProgress,
    incrementVolumeProgress,
    toggleFavorite,
    removeEntry,
    openQuickEdit,
    openTrailer,
  } = useShiori();
  const { t, tr, tStatus } = useTranslation();

  const entry = getEntry(media.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const [celebrationKey, setCelebrationKey] = useState<number>(0);
  const [plusPulseKey, setPlusPulseKey] = useState<number>(0);
  const [heartBurstKey, setHeartBurstKey] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const totalUnits = media.type === "MANGA" ? media.chapters : media.episodes;
  const unitLabel = media.type === "MANGA" ? tr("chapitre") : tr("épisode");
  const unitShort = media.type === "MANGA" ? tr("Ch.") : tr("Ép.");

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const handleSelectStatus = (status: LibraryStatus) => {
    const wasTracked = Boolean(entry);
    upsertEntry(media, { status });
    setMenuOpen(false);
    if (!wasTracked || status === "COMPLETED" || entry?.status !== status) {
      setCelebrationKey(Date.now());
    }
  };

  const handleIncrement = (delta: number) => {
    incrementProgress(media.id, delta);
    if (delta > 0) setPlusPulseKey(Date.now());
  };

  const handleToggleFav = () => {
    const willBeFav = !entry?.isFavorite;
    toggleFavorite(media.id);
    if (willBeFav) setHeartBurstKey(Date.now());
  };

  const handleQuickScore = (val: number) => {
    const nextScore = entry?.score === val ? null : val;
    upsertEntry(media, { score: nextScore });
  };

  const activeMeta = entry
    ? STATUS_META.find((m) => m.id === entry.status) ?? STATUS_META[0]
    : null;
  const ActiveIcon = activeMeta?.icon ?? Bookmark;

  const pct =
    entry && totalUnits
      ? Math.min(100, Math.round((entry.progress / totalUnits) * 100))
      : entry?.status === "COMPLETED"
        ? 100
        : entry && entry.progress > 0
          ? Math.min(82, 16 + entry.progress * 3)
          : 0;

  const activeScorePreview = hoverScore ?? (entry?.score ? Math.round(entry.score) : null);

  return (
    <motion.div
      layout
      transition={{ duration: 0.35, ease: CINEMA_EASE }}
      className={cn(
        "relative rounded-2xl p-4 space-y-3.5 transition-all duration-300",
        entry
          ? "card-surface border-white/[0.12] shadow-[0_16px_45px_rgba(0,0,0,0.5)]"
          : "bg-gradient-to-b from-[#171926]/95 via-[#10121C]/95 to-[#161015]/95 border border-accent/30 shadow-[0_18px_50px_rgb(var(--shiori-accent-rgb)/0.14)]"
      )}
    >
      {/* Celebratory Shiori Stamp Burst Overlay */}
      <AnimatePresence>
        {celebrationKey > 0 && (
          <motion.div
            key={celebrationKey}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.9, delay: 0.1 }}
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl z-20 flex items-center justify-center"
          >
            {/* Expanding luminous halo */}
            <motion.div
              initial={{ scale: 0.3, opacity: 0.8 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 0.75, ease: CINEMA_EASE }}
              className="w-24 h-24 rounded-full border-2 border-accent/70 shadow-[0_0_32px_rgb(var(--shiori-accent-rgb)/0.8)]"
            />
            {/* Floating sparkles */}
            {BURST_PARTICLES.map((p, i) => (
              <motion.span
                key={i}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{ x: p.x * 1.6, y: p.y * 1.6, scale: [0, 1.3, 0], opacity: [1, 1, 0] }}
                transition={{ duration: 0.75, ease: CINEMA_EASE }}
                style={{
                  backgroundColor: p.color,
                  width: p.size,
                  height: p.size,
                  boxShadow: `0 0 10px ${p.color}`,
                }}
                className="absolute rounded-full"
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-accent/18 border border-accent/40 font-serif text-[11px] text-[#FF8A8E]">
            栞
          </span>
          <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#9A9EAE]">
            {entry ? t("detail.inMyLibrary") : "Shiori"}
          </span>
        </div>

        {/* Heart Favorite Toggle with Micro-Burst */}
        {entry && (
          <div className="relative">
            <AnimatePresence>
              {heartBurstKey > 0 && (
                <motion.div
                  key={heartBurstKey}
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  {[0, 60, 120, 180, 240, 300].map((deg) => (
                    <motion.span
                      key={deg}
                      initial={{ scale: 0, x: 0, y: 0 }}
                      animate={{
                        scale: [0, 1.1, 0],
                        x: Math.cos((deg * Math.PI) / 180) * 18,
                        y: Math.sin((deg * Math.PI) / 180) * 18,
                      }}
                      transition={{ duration: 0.5, ease: CINEMA_EASE }}
                      className="absolute w-1.5 h-1.5 rounded-full bg-accent-hover"
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="button"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.85 }}
              onClick={handleToggleFav}
              aria-label={tr("Coup de cœur")}
              className={cn(
                "w-8 h-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer",
                entry.isFavorite
                  ? "bg-accent/22 border-accent/55 text-accent-soft shadow-[0_0_16px_rgb(var(--shiori-accent-rgb)/0.35)]"
                  : "bg-white/[0.04] border-white/[0.09] text-[#8E93A6] hover:text-white"
              )}
            >
              <motion.span
                key={entry.isFavorite ? "fav" : "nofav"}
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 450, damping: 16 }}
              >
                <Heart
                  className={cn("w-3.5 h-3.5", entry.isFavorite && "fill-current")}
                />
              </motion.span>
            </motion.button>
          </div>
        )}
      </div>

      {/* Custom Animated Status Dropdown Trigger */}
      <div className="relative" ref={dropdownRef}>
        {!entry ? (
          /* LUXURY NOT-ADDED CTA */
          <motion.button
            type="button"
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setMenuOpen((v) => !v)}
            className="group relative w-full h-11 px-4 rounded-xl overflow-hidden bg-gradient-to-r from-accent via-accent-hover to-accent-deep text-accent-fg text-xs font-semibold shadow-[0_12px_30px_rgb(var(--shiori-accent-rgb)/0.38)] flex items-center justify-between gap-2 cursor-pointer"
          >
            {/* Shimmer light sweep on hover */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-[-20deg]"
            />
            <span className="relative z-10 flex items-center gap-2">
              <BookmarkPlus className="w-4 h-4" />
              <span>{t("detail.addToLibrary")}</span>
            </span>
            <ChevronDown
              className={cn(
                "relative z-10 w-4 h-4 transition-transform duration-300",
                menuOpen && "rotate-180"
              )}
            />
          </motion.button>
        ) : (
          /* LUXURY TRACKED STATUS PILL */
          <motion.button
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              boxShadow: activeMeta ? `0 8px 26px -10px ${activeMeta.glow}` : undefined,
            }}
            className={cn(
              "w-full h-11 px-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer",
              STATUS_CONFIG[entry.status].bg,
              STATUS_CONFIG[entry.status].border,
              STATUS_CONFIG[entry.status].color
            )}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span
                  className={cn(
                    "animate-ping absolute inline-flex h-full w-full rounded-full opacity-55",
                    STATUS_CONFIG[entry.status].dot
                  )}
                />
                <span
                  className={cn(
                    "relative inline-flex rounded-full h-2.5 w-2.5",
                    STATUS_CONFIG[entry.status].dot
                  )}
                />
              </span>
              <ActiveIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate text-[13px]">
                {tStatus(entry.status, media.type)}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "w-4 h-4 shrink-0 opacity-80 transition-transform duration-300",
                menuOpen && "rotate-180"
              )}
            />
          </motion.button>
        )}

        {/* Animated Glass Popover Menu (5 Statuses + Remove) */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.8 }}
              className="absolute left-0 right-0 mt-2 z-40 rounded-2xl bg-[#11131E]/98 backdrop-blur-2xl border border-white/[0.13] shadow-[0_24px_64px_rgba(0,0,0,0.85)] p-1.5 space-y-1"
            >
              {STATUS_META.map((item, idx) => {
                const Icon = item.icon;
                const cfg = STATUS_CONFIG[item.id];
                const isSelected = entry?.status === item.id;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.03, ease: CINEMA_EASE }}
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectStatus(item.id)}
                    className={cn(
                      "w-full px-3 py-2.5 rounded-xl flex items-center gap-3 text-left transition-colors cursor-pointer",
                      isSelected
                        ? `${cfg.bg} border ${cfg.border}`
                        : "hover:bg-white/[0.06] border border-transparent"
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                        cfg.bg,
                        cfg.border,
                        cfg.color
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-xs font-semibold leading-tight",
                          isSelected ? cfg.color : "text-[#F4F3EE]"
                        )}
                      >
                        {tStatus(item.id, media.type)}
                      </p>
                      <p className="text-[10.5px] text-[#7F8499] mt-0.5 truncate">
                        {tr(media.type === "MANGA" ? item.mangaHint : item.hint)}
                      </p>
                    </div>
                    {isSelected && <Check className={cn("w-4 h-4 shrink-0", cfg.color)} />}
                  </motion.button>
                );
              })}

              {entry && (
                <div className="pt-1 mt-1 border-t border-white/[0.07]">
                  <button
                    type="button"
                    onClick={() => {
                      removeEntry(media.id);
                      setMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs font-medium text-rose-400 hover:bg-rose-500/12 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{tr("Retirer de la bibliothèque")}</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* STATE A: Not Yet Tracked -> Instant 1-Click Quick-Add Pills */}
      <AnimatePresence mode="wait">
        {!entry ? (
          <motion.div
            key="untracked"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.16 } }}
            className="space-y-2"
          >
            <p className="text-[10.5px] font-mono uppercase tracking-wider text-[#7A7F94] flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#F0B95B]" />
              <span>{tr("Ajout rapide en 1 clic")}</span>
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {(["WATCHING", "PLAN_TO_WATCH", "COMPLETED"] as LibraryStatus[]).map((s) => {
                const meta = STATUS_META.find((m) => m.id === s)!;
                const Icon = meta.icon;
                const cfg = STATUS_CONFIG[s];
                return (
                  <motion.button
                    key={s}
                    type="button"
                    whileHover={{ y: -2, scale: 1.03 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => handleSelectStatus(s)}
                    className={cn(
                      "px-2 py-2 rounded-xl border bg-white/[0.03] hover:bg-white/[0.08] border-white/[0.08] flex flex-col items-center gap-1 transition-all cursor-pointer group"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
                    <span className="text-[10px] font-medium text-[#D6D9E6] group-hover:text-white whitespace-nowrap truncate max-w-full">
                      {tStatus(s, media.type)}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          /* STATE B: Tracked -> Animated Progress + Inline Star Score */
          <motion.div
            key="tracked"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.32, ease: CINEMA_EASE }}
            className="space-y-4 pt-1"
          >
            {/* Progress Meter & Stepper */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#8E93A6]">{t("detail.progress")}</span>
                <span className="text-white font-semibold flex items-center gap-1.5">
                  <span>{unitShort}</span>
                  <motion.span
                    key={entry.progress}
                    initial={{ scale: 1.35, color: "#F0B95B" }}
                    animate={{ scale: 1, color: "#FFFFFF" }}
                    transition={{ duration: 0.32 }}
                  >
                    {entry.progress}
                  </motion.span>
                  {totalUnits ? (
                    <span className="text-[#787D91]">/ {totalUnits}</span>
                  ) : null}
                </span>
              </div>

              {/* Luminous Spring Progress Bar */}
              <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 200, damping: 24 }}
                  className="h-full rounded-full bg-gradient-to-r from-accent via-accent-hover to-[#F0B95B] shadow-[0_0_12px_rgb(var(--shiori-accent-rgb)/0.7)]"
                />
              </div>

              {/* Stepper with floating +1 burst */}
              <div className="flex items-center gap-2 pt-0.5">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  onClick={() => handleIncrement(-1)}
                  disabled={entry.progress <= 0}
                  aria-label={tr("Diminuer la progression")}
                  className="w-9 h-9 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] disabled:opacity-35 flex items-center justify-center text-white cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </motion.button>

                <div className="relative flex-1">
                  <AnimatePresence>
                    {plusPulseKey > 0 && (
                      <motion.span
                        key={plusPulseKey}
                        initial={{ opacity: 1, y: 0, scale: 0.8 }}
                        animate={{ opacity: 0, y: -30, scale: 1.15 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: CINEMA_EASE }}
                        className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 font-mono text-xs font-bold text-[#F0B95B] drop-shadow-[0_0_8px_rgba(240,185,91,0.9)]"
                      >
                        +1 {unitShort}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => handleIncrement(1)}
                    disabled={Boolean(totalUnits && entry.progress >= totalUnits)}
                    className="w-full h-9 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-40 text-accent-fg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-[0_6px_20px_rgb(var(--shiori-accent-rgb)/0.35)] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+1 {unitLabel}</span>
                  </motion.button>
                </div>
              </div>

              {/* Manga Volume / Tome Tracker */}
              {media.type === "MANGA" && (
                <div className="pt-2.5 mt-1 border-t border-white/[0.07] space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#8E93A6]">{tr("Tomes / Volumes")}</span>
                    <span className="text-violet-200 font-semibold flex items-center gap-1">
                      <span>{tr("Tome")}</span>
                      <span>{entry.progressVolumes ?? 0}</span>
                      {(media.volumes ?? entry.totalVolumes) ? (
                        <span className="text-[#787D91]">
                          / {media.volumes ?? entry.totalVolumes}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      onClick={() => incrementVolumeProgress(media.id, -1)}
                      disabled={(entry.progressVolumes ?? 0) <= 0}
                      aria-label={tr("Retirer 1 tome")}
                      className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] disabled:opacity-35 flex items-center justify-center text-white cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </motion.button>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => incrementVolumeProgress(media.id, 1)}
                      disabled={Boolean(
                        (media.volumes ?? entry.totalVolumes) &&
                          (entry.progressVolumes ?? 0) >= (media.volumes ?? entry.totalVolumes ?? 0)
                      )}
                      className="flex-1 h-8 rounded-xl bg-violet-500/20 hover:bg-violet-500/32 disabled:opacity-40 border border-violet-400/35 text-violet-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{tr("+1 tome")}</span>
                    </motion.button>
                  </div>
                </div>
              )}
            </div>

            {/* Inline Interactive 1–10 Star Score Picker */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-[#8E93A6] flex items-center gap-1.5 shrink-0">
                  <Star className="w-3.5 h-3.5 text-[#F0B95B] fill-[#F0B95B]" />
                  <span>{t("detail.score")}</span>
                </span>
                <span className="font-mono font-semibold text-[#F0B95B] truncate text-[11.5px]">
                  {activeScorePreview
                    ? `${hoverScore ?? entry.score}/10 · ${SCORE_VERDICT[activeScorePreview] ? tr(SCORE_VERDICT[activeScorePreview]) : ""}`
                    : tr("Noter")}
                </span>
              </div>

              <div
                onMouseLeave={() => setHoverScore(null)}
                className="grid grid-cols-5 gap-1.5"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => {
                  const filled = activeScorePreview !== null && val <= activeScorePreview;
                  const isExact = entry.score !== null && Math.round(entry.score) === val;
                  return (
                    <motion.button
                      key={val}
                      type="button"
                      whileHover={{ y: -2, scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      onMouseEnter={() => setHoverScore(val)}
                      onClick={() => handleQuickScore(val)}
                      title={tr("Noter {val}/10 — {verdict}", { val, verdict: tr(SCORE_VERDICT[val]) })}
                      className={cn(
                        "h-7 rounded-lg font-mono text-[11.5px] font-semibold border transition-colors cursor-pointer flex items-center justify-center",
                        isExact
                          ? "bg-[#F0B95B] border-[#F0B95B] text-[#090A0F] shadow-[0_0_14px_rgba(240,185,91,0.55)]"
                          : filled
                            ? "bg-[#F0B95B]/22 border-[#F0B95B]/45 text-[#F7D08A]"
                            : "bg-white/[0.03] border-white/[0.07] text-[#787D91] hover:text-white"
                      )}
                    >
                      {val}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Secondary Actions: Full Edit Modal & Trailer */}
      <div className="space-y-2 pt-0.5">
        <motion.button
          type="button"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => openQuickEdit(media)}
          className="w-full h-9 rounded-xl bg-white/[0.045] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-[#D6D9E5] hover:text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{entry ? tr("Notes, demi-points & dates") : tr("Personnaliser avant d'ajouter")}</span>
        </motion.button>

        {media.trailer && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => openTrailer(media.trailer!.id, title)}
            className="w-full h-9 rounded-xl bg-[#F0B95B]/12 hover:bg-[#F0B95B]/22 border border-[#F0B95B]/30 text-xs font-semibold text-[#F0B95B] flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{t("detail.watchTrailer")}</span>
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
