"use client";

import React from "react";
import Link from "next/link";
import { Star, Plus, Check, Edit3 } from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { StreamingIconsStrip } from "@/components/media/WhereToWatchSection";
import {
  cn,
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
  const { t, tr, tStatus, tFormat, tGenre } = useTranslation();
  const entry = getEntry(media.id);
  const title = getDisplayTitle(media);
  const statusCfg = entry ? STATUS_CONFIG[entry.status] : null;

  return (
    /* Non-moving outer hit-area wrapper eliminates hover edge jitter while preserving native 120fps horizontal touch swiping */
    <div className={cn("group relative flex flex-col", className)}>
      {/* Zero-repaint 120fps Cinema Poster Container (glow & rim fade via opacity only — no animated box-shadow!) */}
      <div className="shiori-poster-shell relative z-0 aspect-[2/3] w-full rounded-xl bg-[#121520] border border-white/[0.09] shadow-[0_10px_24px_rgba(0,0,0,0.45)]">
        {/* Pre-rendered ambient glow halo (pure GPU opacity 0 -> 1 on desktop hover) */}
        <span
          aria-hidden="true"
          className="shiori-poster-glow pointer-events-none absolute inset-0 rounded-xl z-0"
        />

        {/* Clipped artwork & cinema overlays */}
        <div className="relative z-[1] w-full h-full rounded-[11px] overflow-hidden bg-[#121520]">
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
              className="shiori-poster-img w-full h-full object-cover pointer-events-none select-none"
            />
            {/* Cinematic bottom vignette */}
            <div className="shiori-poster-vignette absolute inset-0 z-[1] bg-gradient-to-t from-obsidian/94 via-obsidian/10 to-black/22 pointer-events-none" />
            {/* Pure GPU diagonal glass specular sheen sweep on hover */}
            <span
              aria-hidden="true"
              className="shiori-poster-sheen pointer-events-none absolute inset-0 z-[2] bg-gradient-to-r from-transparent via-white/[0.18] to-transparent"
            />
            {/* Crisp luminous inner highlight rim */}
            <span
              aria-hidden="true"
              className="shiori-poster-rim pointer-events-none absolute inset-0 z-[3] rounded-[11px]"
            />
          </Link>

          {/* Top Left: Rank or Tracked Status Dot */}
          <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 z-10 flex items-center gap-1 sm:gap-1.5 pointer-events-none max-w-[65%]">
            {rank !== undefined && (
              <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-[#090B12]/90 border border-white/15 font-mono text-[10px] sm:text-[11px] font-semibold text-white shrink-0">
                #{String(rank).padStart(2, "0")}
              </span>
            )}
            {entry && statusCfg && (
              <span
                className={cn(
                  "px-1.5 sm:px-2 py-0.5 rounded-md bg-[#090B12]/90 border text-[9.5px] sm:text-[10px] font-semibold flex items-center gap-1 truncate",
                  statusCfg.border,
                  statusCfg.color
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusCfg.dot)} />
                <span className="truncate">
                  {entry.progress > 0
                    ? `${entry.type === "MANGA" ? t("common.chShort") : t("common.epShort")} ${entry.progress}`
                    : tStatus(entry.status, entry.type)}
                </span>
              </span>
            )}
          </div>

          {/* Top Right: Score Pill */}
          {media.averageScore && (
            <div className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 z-10 px-1.5 sm:px-2 py-0.5 rounded-md bg-[#090B12]/90 border border-white/12 flex items-center gap-1 pointer-events-none">
              <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#F0B95B] fill-[#F0B95B]" />
              <span className="font-mono text-[10px] sm:text-[11px] font-semibold text-[#F4F3EE]">
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
            title={entry ? tr("Modifier dans ma bibliothèque") : tr("Ajouter à ma bibliothèque")}
            className={cn(
              "absolute bottom-2.5 right-2.5 z-10 w-8 h-8 rounded-full flex items-center justify-center border transition-[transform,opacity,background-color,border-color] duration-250 ease-out cursor-pointer active:scale-90",
              entry
                ? "bg-[#0B1E18]/92 border-emerald-400/50 text-emerald-300 opacity-95 hover:bg-emerald-500/35 hover:scale-105"
                : "bg-[#090B12]/92 border-white/22 text-white opacity-95 sm:opacity-0 sm:translate-y-2 sm:scale-90 sm:group-hover:opacity-100 sm:group-hover:translate-y-0 sm:group-hover:scale-100 hover:bg-accent hover:border-accent"
            )}
          >
            {entry ? <Edit3 className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
          </button>

          {/* Bottom Left Format Tag */}
          <div className="absolute bottom-2.5 left-2.5 z-10 pointer-events-none">
            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#090B12]/88 text-[#D2D5E0] border border-white/[0.1]">
              {tFormat(media.format)}
            </span>
          </div>
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
        <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-[#7E8397] min-w-0">
          {media.seasonYear && <span className="font-mono shrink-0">{media.seasonYear}</span>}
          {media.seasonYear && media.genres[0] && <span className="shrink-0">·</span>}
          {media.genres[0] && <span className="truncate">{tGenre(media.genres[0])}</span>}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            <StreamingIconsStrip links={media.streamingLinks} max={2} />
            {entry && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
          </div>
        </div>
      </Link>
    </div>
  );
});
