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
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { RevealSection } from "@/components/motion/MotionPrimitives";
import { cn, formatScore, getDisplayTitle } from "@/lib/utils";
import type { PersonalizedRecommendation } from "@/types/media";

export function PersonalizedRecommendationsSection() {
  const { library, hydrated, getEntry, quickAdd } = useShiori();
  const [items, setItems] = useState<PersonalizedRecommendation[]>([]);
  const [analyzedGenres, setAnalyzedGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

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
          setItems(data.recommendations.slice(0, 6));
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
    <RevealSection className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sélection sur mesure · Basée sur vos meilleures notes</span>
          </p>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#F4F3EE]">
            Recommandations pour toi
          </h2>
          {analyzedGenres.length > 0 && (
            <p className="text-xs text-[#8A8FA4] mt-1">
              Affinités détectées :{" "}
              <span className="text-[#C8CCE0] font-medium">
                {analyzedGenres.join(" · ")}
              </span>{" "}
              — 6 pépites absentes de votre liste.
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => setOffset((n) => n + 1)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-white transition-colors cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5 text-accent", loading && "animate-spin")} />
          <span>Nouvelles suggestions</span>
        </button>
      </div>

      {/* 6 Tailored Cards */}
      {loading && items.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl card-surface overflow-hidden animate-pulse"
            >
              <div className="aspect-[2/3] bg-white/[0.05]" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-white/[0.08] rounded w-3/4" />
                <div className="h-2.5 bg-white/[0.05] rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {items.map((rec) => {
            const m = rec.media;
            const title = getDisplayTitle(m);
            const entry = getEntry(m.id);

            return (
              <div
                key={m.id}
                className="group h-full flex flex-col rounded-2xl overflow-hidden isolate [transform:translateZ(0)] card-surface hover:border-white/[0.2] transition-colors"
              >
                {/* Poster */}
                <Link
                  href={`/media/${m.id}`}
                  className="relative aspect-[2/3] block overflow-hidden bg-[#121521]"
                >
                  <img
                    src={m.coverImage.extraLarge || m.coverImage.large}
                    alt={title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transform-gpu transition-transform duration-500 ease-out group-hover:scale-105"
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
                      title={entry ? "Déjà dans votre liste" : "Ajouter en Plan to Watch"}
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

                {/* Title & Explicit Tailored Reason */}
                <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                  <Link
                    href={`/media/${m.id}`}
                    className="text-xs sm:text-[13px] font-semibold text-[#F4F3EE] group-hover:text-accent-hover transition-colors line-clamp-2 leading-snug"
                  >
                    {title}
                  </Link>

                  <div
                    className={cn(
                      "px-2 py-1 rounded-lg border text-[10.5px] leading-snug flex items-start gap-1",
                      rec.reasonKind === "similar"
                        ? "bg-accent/12 border-accent/30 text-accent-soft"
                        : "bg-kinpaku/12 border-kinpaku/30 text-[#F7D794]"
                    )}
                  >
                    {rec.reasonKind === "similar" ? (
                      <Heart className="w-3 h-3 shrink-0 mt-0.5 fill-current" />
                    ) : (
                      <Sparkles className="w-3 h-3 shrink-0 mt-0.5" />
                    )}
                    <span className="line-clamp-2">{rec.reason}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </RevealSection>
  );
}
