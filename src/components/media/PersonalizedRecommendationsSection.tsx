"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  RefreshCw,
  Star,
  Plus,
  Check,
  Tv,
  BookOpen,
  Heart,
  ChevronLeft,
  ChevronRight,
  MoveHorizontal,
  Bot,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { RevealSection } from "@/components/motion/MotionPrimitives";
import { useDragScroll } from "@/hooks/useDragScroll";
import { cn, formatScore, getDisplayTitle } from "@/lib/utils";
import type { PersonalizedRecommendation } from "@/types/media";

export function PersonalizedRecommendationsSection() {
  const { library, hydrated, getEntry, quickAdd } = useShiori();
  const [items, setItems] = useState<PersonalizedRecommendation[]>([]);
  const [analyzedGenres, setAnalyzedGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  const {
    ref: scrollRef,
    trackThumbRef,
    isDragging,
    canScrollLeft,
    canScrollRight,
    scrollByAmount,
    dragHandlers,
  } = useDragScroll<HTMLDivElement>();

  // Build stable fingerprint of user's highest-rated / favorite anime & manga
  const topSeeds = useMemo(() => {
    return [...library]
      .sort((a, b) => {
        const sA = (a.score ?? 7.5) + (a.isFavorite ? 2 : 0);
        const sB = (b.score ?? 7.5) + (b.isFavorite ? 2 : 0);
        return sB - sA;
      })
      .slice(0, 20)
      .map((e) => ({
        id: e.mediaId,
        title: e.title,
        type: e.type,
        score: e.score,
        isFavorite: e.isFavorite,
        genres: e.genres,
      }));
  }, [library]);

  const excludeIds = useMemo(() => library.map((e) => e.mediaId), [library]);
  const seedsFingerprint = useMemo(
    () => topSeeds.slice(0, 6).map((s) => `${s.id}:${s.score ?? ""}`).join("|"),
    [topSeeds]
  );

  const loadRecommendations = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      try {
        const res = await fetch("/api/anilist/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topMedia: topSeeds,
            excludeIds,
            offset: nextOffset,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data?.recommendations)) {
          setItems(data.recommendations.slice(0, 10));
        }
        if (Array.isArray(data?.analyzedGenres)) {
          setAnalyzedGenres(data.analyzedGenres);
        }
      } catch {
        // keep previous recommendations if transient error
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seedsFingerprint, excludeIds.length]
  );

  useEffect(() => {
    if (!hydrated) return;
    void loadRecommendations(offset);
  }, [hydrated, offset, loadRecommendations]);

  return (
    <RevealSection className="relative">
      {/* Header matching MediaRail editorial design */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sélection sur mesure</span>
          </p>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#F4F3EE]">
            Recommandés pour toi
          </h2>
          {analyzedGenres.length > 0 ? (
            <p className="text-xs sm:text-sm text-[#868B9F] mt-0.5">
              Basé sur tes affinités ({analyzedGenres.join(" · ")}) — absents de ta liste
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-[#868B9F] mt-0.5">
              Des pépites calibrées sur tes meilleures notes
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span
            className={cn(
              "hidden xl:inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border transition-colors select-none",
              isDragging
                ? "bg-accent/15 border-accent/40 text-accent-soft"
                : "bg-white/[0.025] border-white/[0.06] text-[#6F7489]"
            )}
          >
            <MoveHorizontal className="w-3 h-3" />
            <span>{isDragging ? "Défilement..." : "Glisser"}</span>
          </span>

          <Link
            href="/assistant"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/14 hover:bg-accent/25 border border-accent/35 text-xs font-semibold text-accent-soft hover:text-white transition-colors"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Shiori IA</span>
          </Link>

          <button
            type="button"
            disabled={loading}
            onClick={() => setOffset((n) => n + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.045] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-[#CFD3E2] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 text-kinpaku", loading && "animate-spin")} />
            <span className="hidden sm:inline">Rafraîchir</span>
          </button>

          <button
            type="button"
            disabled={!canScrollLeft}
            onClick={() => scrollByAmount(-1)}
            aria-label="Défiler vers la gauche"
            className="w-8 h-8 rounded-full bg-white/[0.045] hover:bg-white/[0.12] active:scale-90 disabled:opacity-30 border border-white/[0.08] flex items-center justify-center text-[#C2C6D4] hover:text-white transition-all cursor-pointer disabled:cursor-default"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canScrollRight}
            onClick={() => scrollByAmount(1)}
            aria-label="Défiler vers la droite"
            className="w-8 h-8 rounded-full bg-white/[0.045] hover:bg-white/[0.12] active:scale-90 disabled:opacity-30 border border-white/[0.08] flex items-center justify-center text-[#C2C6D4] hover:text-white transition-all cursor-pointer disabled:cursor-default"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal 2:3 Poster Carousel matching MediaRail */}
      {loading && items.length === 0 ? (
        <div className="flex gap-4 sm:gap-5 overflow-hidden py-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="w-[152px] sm:w-[176px] lg:w-[188px] shrink-0 animate-pulse space-y-2.5"
            >
              <div className="aspect-[2/3] rounded-xl bg-white/[0.05] border border-white/[0.06]" />
              <div className="h-3 bg-white/[0.08] rounded w-4/5" />
              <div className="h-2.5 bg-white/[0.05] rounded w-3/5" />
            </div>
          ))}
        </div>
      ) : (
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

          <div
            ref={scrollRef}
            {...dragHandlers}
            className={cn(
              "flex gap-4 sm:gap-5 overflow-x-auto overflow-y-hidden overscroll-x-contain no-scrollbar py-4 -my-3 -mx-1 px-1 select-none",
              isDragging ? "cursor-grabbing" : "cursor-grab"
            )}
          >
            {items.map((rec) => {
              const m = rec.media;
              const title = getDisplayTitle(m);
              const entry = getEntry(m.id);

              return (
                <div
                  key={m.id}
                  className="w-[152px] sm:w-[176px] lg:w-[188px] shrink-0 group flex flex-col"
                >
                  {/* 2:3 Vertical Poster */}
                  <Link
                    href={`/media/${m.id}`}
                    draggable={false}
                    className="relative aspect-[2/3] block rounded-xl overflow-hidden isolate [transform:translateZ(0)] border border-white/[0.08] group-hover:border-white/[0.22] bg-[#121521] shadow-[0_14px_34px_rgba(0,0,0,0.45)] transition-all duration-300 group-hover:-translate-y-1"
                  >
                    <img
                      src={m.coverImage.extraLarge || m.coverImage.large}
                      alt={title}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className="w-full h-full object-cover transform-gpu transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/20 to-transparent pointer-events-none" />

                    {/* Type Pill */}
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-obsidian/85 border border-white/12 text-[9.5px] font-mono uppercase text-[#D8DBE6]">
                      {m.type === "MANGA" ? (
                        <BookOpen className="w-2.5 h-2.5 text-violet-400" />
                      ) : (
                        <Tv className="w-2.5 h-2.5 text-sky-400" />
                      )}
                      {m.type === "MANGA" ? "Manga" : "Anime"}
                    </span>

                    {/* Score Pill */}
                    {m.averageScore && (
                      <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-obsidian/85 border border-white/12 font-mono text-[10.5px] font-bold text-kinpaku">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        {formatScore(m.averageScore)}
                      </span>
                    )}

                    {/* Quick Add Overlay Button */}
                    <div className="absolute bottom-2 right-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!entry) quickAdd(m, "PLAN_TO_WATCH");
                        }}
                        title={entry ? "Déjà dans votre liste" : "Ajouter en À voir"}
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-lg",
                          entry
                            ? "bg-emerald-500 border-emerald-400 text-[#07080C]"
                            : "bg-obsidian/90 hover:bg-accent border-white/20 hover:border-accent text-white hover:text-accent-fg"
                        )}
                      >
                        {entry ? (
                          <Check className="w-4 h-4 stroke-[3]" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </Link>

                  {/* Title & Compact Reason Tag */}
                  <div className="pt-2.5 space-y-1.5">
                    <Link
                      href={`/media/${m.id}`}
                      draggable={false}
                      className="block text-[13px] font-semibold text-[#F4F3EE] group-hover:text-accent-hover transition-colors line-clamp-1 leading-snug"
                    >
                      {title}
                    </Link>

                    <div
                      className={cn(
                        "px-2 py-0.5 rounded-md border text-[10.5px] leading-snug inline-flex items-center gap-1 max-w-full",
                        rec.reasonKind === "similar"
                          ? "bg-accent/12 border-accent/30 text-accent-soft"
                          : "bg-kinpaku/12 border-kinpaku/30 text-[#F7D794]"
                      )}
                    >
                      {rec.reasonKind === "similar" ? (
                        <Heart className="w-2.5 h-2.5 shrink-0 fill-current" />
                      ) : (
                        <Sparkles className="w-2.5 h-2.5 shrink-0" />
                      )}
                      <span className="truncate">{rec.reason}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sleek Hairline Glide Track */}
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
      )}
    </RevealSection>
  );
}
