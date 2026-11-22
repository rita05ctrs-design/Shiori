"use client";

import React, { useRef } from "react";
import Link from "next/link";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from "framer-motion";
import { Star, Plus, Check, Edit3 } from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import {
  cn,
  formatFormat,
  formatScore,
  getDisplayTitle,
  STATUS_CONFIG,
} from "@/lib/utils";
import type { MediaItem } from "@/types/media";

interface MediaCardProps {
  media: MediaItem;
  rank?: number;
  className?: string;
}

export function MediaCard({ media, rank, className }: MediaCardProps) {
  const { getEntry, openQuickEdit } = useShiori();
  const entry = getEntry(media.id);
  const title = getDisplayTitle(media);
  const statusCfg = entry ? STATUS_CONFIG[entry.status] : null;
  const accentGlow = media.coverImage.color || "#E5484D";

  // Tactile 3D tilt + specular sheen (100% MotionValue GPU-driven, zero re-renders)
  const cardRef = useRef<HTMLDivElement>(null);
  const rotateXRaw = useMotionValue(0);
  const rotateYRaw = useMotionValue(0);
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  const glareOpacity = useMotionValue(0);

  const rotateX = useSpring(rotateXRaw, { stiffness: 260, damping: 24 });
  const rotateY = useSpring(rotateYRaw, { stiffness: 260, damping: 24 });
  const smoothGlareOpacity = useSpring(glareOpacity, { stiffness: 220, damping: 26 });

  const glareBg = useMotionTemplate`radial-gradient(240px circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.22), rgba(255,255,255,0.04) 45%, transparent 75%)`;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rotateXRaw.set((0.5 - py) * 11);
    rotateYRaw.set((px - 0.5) * 11);
    glareX.set(px * 100);
    glareY.set(py * 100);
    glareOpacity.set(1);
  };

  const handlePointerLeave = () => {
    rotateXRaw.set(0);
    rotateYRaw.set(0);
    glareOpacity.set(0);
  };

  return (
    <motion.div
      style={{ perspective: 900 }}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={cn("group relative flex flex-col", className)}
    >
      {/* Dynamic Ambient Poster Aura on Hover */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-1.5 rounded-2xl opacity-0 group-hover:opacity-45 blur-xl transition-opacity duration-500 -z-10"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${accentGlow}, transparent 72%)`,
        }}
      />

      {/* 3D Tilting Poster Container */}
      <motion.div
        ref={cardRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-[#121520] border border-white/[0.08] group-hover:border-white/[0.24] shadow-[0_14px_34px_rgba(0,0,0,0.5)] group-hover:shadow-[0_24px_50px_rgba(0,0,0,0.72)] transition-[border-color,box-shadow] duration-300 will-change-transform"
      >
        <Link
          href={`/media/${media.id}`}
          draggable={false}
          className="block w-full h-full select-none"
        >
          <img
            src={media.coverImage.extraLarge}
            alt={title}
            loading="lazy"
            draggable={false}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.08] pointer-events-none select-none"
          />
          {/* Subtle bottom vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#07080C]/92 via-transparent to-black/20 opacity-85 group-hover:opacity-95 transition-opacity" />
        </Link>

        {/* Pointer-following liquid specular sheen */}
        <motion.div
          aria-hidden="true"
          style={{ background: glareBg, opacity: smoothGlareOpacity }}
          className="pointer-events-none absolute inset-0 mix-blend-overlay"
        />

        {/* Top Left: Rank or Tracked Status Dot */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none">
          {rank !== undefined && (
            <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/15 font-mono text-[11px] font-semibold text-white shadow">
              #{String(rank).padStart(2, "0")}
            </span>
          )}
          {entry && statusCfg && (
            <span
              className={cn(
                "px-2 py-0.5 rounded-md backdrop-blur-md border text-[10px] font-semibold flex items-center gap-1",
                statusCfg.bg,
                statusCfg.border,
                statusCfg.color
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", statusCfg.dot)} />
              <span>
                {entry.progress > 0
                  ? `${entry.type === "MANGA" ? "Ch." : "Ep."} ${entry.progress}`
                  : statusCfg.shortLabel}
              </span>
            </span>
          )}
        </div>

        {/* Top Right: Score Pill */}
        {media.averageScore && (
          <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/72 backdrop-blur-md border border-white/10 flex items-center gap-1 pointer-events-none">
            <Star className="w-3 h-3 text-[#F0B95B] fill-[#F0B95B]" />
            <span className="font-mono text-[11px] font-semibold text-[#F4F3EE]">
              {formatScore(media.averageScore)}
            </span>
          </div>
        )}

        {/* Quick Action Button with spring micro-pop */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openQuickEdit(media);
          }}
          title={entry ? "Modifier dans ma bibliothèque" : "Ajouter à ma bibliothèque"}
          className={cn(
            "absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-200 cursor-pointer",
            entry
              ? "bg-emerald-500/22 border-emerald-400/45 text-emerald-300 opacity-95 hover:bg-emerald-500/35"
              : "bg-black/70 border-white/20 text-white opacity-90 sm:opacity-0 sm:translate-y-1 sm:group-hover:opacity-100 sm:group-hover:translate-y-0 hover:bg-[#E5484D] hover:border-[#E5484D]"
          )}
        >
          {entry ? <Edit3 className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
        </motion.button>

        {/* Bottom Left Format Tag */}
        <div className="absolute bottom-2.5 left-2.5 pointer-events-none">
          <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[#D2D5E0] border border-white/[0.08]">
            {formatFormat(media.format)}
          </span>
        </div>
      </motion.div>

      {/* Metadata below poster */}
      <Link
        href={`/media/${media.id}`}
        draggable={false}
        className="mt-2.5 block min-w-0 select-none"
      >
        <h3 className="text-[13.5px] font-semibold text-[#F2F1EC] group-hover:text-[#F45B62] transition-colors line-clamp-1 leading-snug">
          {title}
        </h3>
        <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-[#7E8397] truncate">
          {media.seasonYear && <span className="font-mono">{media.seasonYear}</span>}
          {media.seasonYear && media.genres[0] && <span>·</span>}
          {media.genres[0] && <span className="truncate">{media.genres[0]}</span>}
          {entry && <Check className="w-3 h-3 text-emerald-400 ml-auto shrink-0" />}
        </div>
      </Link>
    </motion.div>
  );
}
