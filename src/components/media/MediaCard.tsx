"use client";

import React from "react";
import Link from "next/link";
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

export const MediaCard = React.memo(function MediaCard({
  media,
  rank,
  className,
}: MediaCardProps) {
  const { getEntry, openQuickEdit } = useShiori();
  const entry = getEntry(media.id);
  const title = getDisplayTitle(media);
  const statusCfg = entry ? STATUS_CONFIG[entry.status] : null;

  return (
    /* Non-moving outer hit-area wrapper eliminates hover edge jitter completely */
    <div className={cn("group relative flex flex-col touch-pan-y", className)}>
      {/* GPU-composited elevating Poster Container (zero per-card backdrop-blur/springs) */}
      <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden isolate [transform:translateZ(0)] bg-[#121520] border border-white/[0.08] group-hover:border-white/[0.24] shadow-[0_12px_28px_rgba(0,0,0,0.48)] group-hover:shadow-[0_20px_42px_rgba(0,0,0,0.72)] group-hover:-translate-y-1.5 transition-[transform,border-color,box-shadow] duration-250 ease-out will-change-transform">
        <Link
          href={`/media/${media.id}`}
          draggable={false}
          className="block w-full h-full select-none"
        >
          <img
            src={media.coverImage.extraLarge}
            alt={title}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="w-full h-full object-cover transform-gpu transition-transform duration-500 ease-out group-hover:scale-[1.06] pointer-events-none select-none"
          />
          {/* Subtle bottom vignette */}
          <div className="absolute inset-0 z-[1] bg-gradient-to-t from-obsidian/92 via-transparent to-black/20 pointer-events-none" />
          {/* Pure GPU diagonal specular sheen sweep on hover */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[2] -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/[0.14] to-transparent skew-x-[-20deg]"
          />
        </Link>

        {/* Top Left: Rank or Tracked Status Dot */}
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 pointer-events-none">
          {rank !== undefined && (
            <span className="px-2 py-0.5 rounded-md bg-[#090B12]/90 border border-white/15 font-mono text-[11px] font-semibold text-white">
              #{String(rank).padStart(2, "0")}
            </span>
          )}
          {entry && statusCfg && (
            <span
              className={cn(
                "px-2 py-0.5 rounded-md bg-[#090B12]/90 border text-[10px] font-semibold flex items-center gap-1",
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
          <div className="absolute top-2.5 right-2.5 z-10 px-2 py-0.5 rounded-md bg-[#090B12]/90 border border-white/12 flex items-center gap-1 pointer-events-none">
            <Star className="w-3 h-3 text-[#F0B95B] fill-[#F0B95B]" />
            <span className="font-mono text-[11px] font-semibold text-[#F4F3EE]">
              {formatScore(media.averageScore)}
            </span>
          </div>
        )}

        {/* Quick Action Button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openQuickEdit(media);
          }}
          title={entry ? "Modifier dans ma bibliothèque" : "Ajouter à ma bibliothèque"}
          className={cn(
            "absolute bottom-2.5 right-2.5 z-10 w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-200 cursor-pointer active:scale-90",
            entry
              ? "bg-[#0B1E18]/92 border-emerald-400/50 text-emerald-300 opacity-95 hover:bg-emerald-500/35"
              : "bg-[#090B12]/90 border-white/20 text-white opacity-90 sm:opacity-0 sm:translate-y-1 sm:group-hover:opacity-100 sm:group-hover:translate-y-0 hover:bg-accent hover:border-accent"
          )}
        >
          {entry ? <Edit3 className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
        </button>

        {/* Bottom Left Format Tag */}
        <div className="absolute bottom-2.5 left-2.5 z-10 pointer-events-none">
          <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#090B12]/88 text-[#D2D5E0] border border-white/[0.1]">
            {formatFormat(media.format)}
          </span>
        </div>
      </div>

      {/* Metadata below poster */}
      <Link
        href={`/media/${media.id}`}
        draggable={false}
        className="mt-2.5 block min-w-0 select-none"
      >
        <h3 className="text-[13.5px] font-semibold text-[#F2F1EC] group-hover:text-accent-hover transition-colors line-clamp-1 leading-snug">
          {title}
        </h3>
        <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-[#7E8397] truncate">
          {media.seasonYear && <span className="font-mono">{media.seasonYear}</span>}
          {media.seasonYear && media.genres[0] && <span>·</span>}
          {media.genres[0] && <span className="truncate">{media.genres[0]}</span>}
          {entry && <Check className="w-3 h-3 text-emerald-400 ml-auto shrink-0" />}
        </div>
      </Link>
    </div>
  );
});
