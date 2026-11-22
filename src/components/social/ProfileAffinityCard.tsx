"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Check,
  Heart,
  Mic2,
  Plus,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { computeProfileAffinity } from "@/lib/affinity";
import { cn } from "@/lib/utils";
import type { PublicUserProfile } from "@/types/media";

interface ProfileAffinityCardProps {
  targetProfile: PublicUserProfile;
}

const TONE_STYLES = {
  emerald: {
    ring: "#34D399",
    badge: "bg-emerald-500/18 border-emerald-400/45 text-emerald-200",
    glow: "0 0 36px -8px rgba(52,211,153,0.45)",
  },
  violet: {
    ring: "#C084FC",
    badge: "bg-violet-500/18 border-violet-400/45 text-violet-200",
    glow: "0 0 36px -8px rgba(192,132,252,0.45)",
  },
  sky: {
    ring: "#38BDF8",
    badge: "bg-sky-500/18 border-sky-400/45 text-sky-200",
    glow: "0 0 36px -8px rgba(56,189,248,0.42)",
  },
  amber: {
    ring: "#F0B95B",
    badge: "bg-amber-500/18 border-amber-400/45 text-amber-200",
    glow: "0 0 36px -8px rgba(240,185,91,0.42)",
  },
};

export function ProfileAffinityCard({ targetProfile }: ProfileAffinityCardProps) {
  const { library, favoriteStaff, getEntry, upsertEntry } = useShiori();

  const affinity = useMemo(
    () =>
      computeProfileAffinity({
        viewerLibrary: library,
        viewerFavoriteStaff: favoriteStaff,
        targetProfile,
      }),
    [library, favoriteStaff, targetProfile]
  );

  const tone = TONE_STYLES[affinity.tierTone];
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dashOffset =
    circumference - (affinity.compatibilityPct / 100) * circumference;

  return (
    <section className="rounded-3xl card-surface border border-white/[0.09] p-4 sm:p-6 md:p-7 space-y-5 sm:space-y-6 relative overflow-hidden">
      {/* Subtle Ambient Accent Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 rounded-full opacity-20 blur-3xl"
        style={{
          background: `radial-gradient(circle, ${tone.ring}, transparent 70%)`,
        }}
      />

      {/* TOP ROW: Animated Compatibility Ring + Affinity Breakdown */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 min-w-0">
          {/* Circular Compatibility Score Ring */}
          <div
            style={{ boxShadow: tone.glow }}
            className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-obsidian/80 border border-white/[0.1] flex items-center justify-center shrink-0 self-start sm:self-auto"
          >
            <svg viewBox="0 0 108 108" className="w-full h-full -rotate-90">
              <circle
                cx="54"
                cy="54"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="7"
              />
              <motion.circle
                cx="54"
                cy="54"
                r={radius}
                fill="none"
                stroke={tone.ring}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: dashOffset }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-extrabold font-mono text-white leading-none">
                {affinity.compatibilityPct}%
              </span>
              <span className="text-[9.5px] font-mono uppercase tracking-widest text-[#9A9EAE] mt-1">
                Affinité
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Compatibilité & Affinité</span>
              </p>
              <span
                className={cn(
                  "px-2.5 py-0.5 rounded-full border text-[11px] font-semibold",
                  tone.badge
                )}
              >
                {affinity.tierLabel}
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-white">
              Votre compatibilité avec {targetProfile.displayName}
            </h2>

            <p className="text-xs text-[#9EA3B5] max-w-xl leading-relaxed">
              Calculée en direct d&apos;après vos animés & mangas en commun, l&apos;écart entre vos notes,
              vos coups de cœur partagés et vos genres favoris.
            </p>

            {/* Key Affinity Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.09] font-mono text-[11px] text-white">
                {affinity.commonTitles.length} titre
                {affinity.commonTitles.length > 1 ? "s" : ""} en commun
              </span>
              <span className="px-2.5 py-1 rounded-full bg-rose-500/14 border border-rose-400/30 font-mono text-[11px] text-rose-200 inline-flex items-center gap-1">
                <Heart className="w-3 h-3 fill-current" />
                {affinity.sharedFavorites.length} favori
                {affinity.sharedFavorites.length > 1 ? "s" : ""} partagé
                {affinity.sharedFavorites.length > 1 ? "s" : ""}
              </span>
              {affinity.avgScoreDiff !== null && (
                <span className="px-2.5 py-1 rounded-full bg-amber-500/12 border border-amber-400/30 font-mono text-[11px] text-amber-200 inline-flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Écart moyen : ±{affinity.avgScoreDiff.toFixed(1)}★
                </span>
              )}
              {affinity.sharedStaff.length > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-violet-500/14 border border-violet-400/30 font-mono text-[11px] text-violet-200 inline-flex items-center gap-1">
                  <Mic2 className="w-3 h-3" />
                  {affinity.sharedStaff.length} Seiyuu en commun
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM 2-COLUMN SHOWCASE: Shared Favorites & Common Titles + 3 Recs from Target's List */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 pt-4 border-t border-white/[0.07]">
        {/* LEFT: Shared Favorites & Common Rated Titles */}
        <div className="lg:col-span-6 min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-400 fill-current" />
              <span>
                {affinity.sharedFavorites.length > 0
                  ? `Favoris & coups de cœur partagés (${affinity.sharedFavorites.length})`
                  : `Œuvres en commun (${affinity.commonTitles.length})`}
              </span>
            </h3>
          </div>

          {affinity.commonTitles.length === 0 ? (
            <div className="rounded-2xl bg-obsidian/65 border border-white/[0.06] p-4 text-xs text-[#8A8FA4]">
              Aucun titre en commun identifié dans son aperçu public — profitez de ses
              recommandations juste à côté pour découvrir son univers !
            </div>
          ) : (
            <div className="space-y-2">
              {(affinity.sharedFavorites.length > 0
                ? [
                    ...affinity.sharedFavorites,
                    ...affinity.commonTitles.filter(
                      (c) => !affinity.sharedFavorites.some((s) => s.mediaId === c.mediaId)
                    ),
                  ]
                : affinity.commonTitles
              )
                .slice(0, 4)
                .map((m) => (
                  <Link
                    key={m.mediaId}
                    href={`/media/${m.mediaId}`}
                    className="p-2.5 rounded-xl bg-obsidian/70 hover:bg-white/[0.06] border border-white/[0.07] hover:border-white/[0.16] flex items-center gap-3 transition-colors group"
                  >
                    <img
                      src={m.coverImage}
                      alt={m.title}
                      loading="lazy"
                      decoding="async"
                      className="w-10 h-14 rounded-lg object-cover border border-white/12 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs sm:text-sm font-semibold text-white group-hover:text-accent-hover truncate">
                          {m.title}
                        </p>
                        {m.bothFavorite && (
                          <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/35 text-[9.5px] font-semibold text-rose-200 shrink-0">
                            Favori commun
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] font-mono">
                        <span className="text-[#B5B9C9]">
                          Vous :{" "}
                          <strong className="text-white">
                            {m.viewerScore !== null ? `★ ${m.viewerScore.toFixed(1)}` : "Vu"}
                          </strong>
                        </span>
                        <span className="text-white/25">·</span>
                        <span className="text-[#B5B9C9]">
                          {targetProfile.displayName} :{" "}
                          <strong className="text-kinpaku">
                            {m.targetScore !== null ? `★ ${m.targetScore.toFixed(1)}` : "Vu"}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </div>

        {/* RIGHT: 3 Recommendations Drawn Directly from Target's List */}
        <div className="lg:col-span-6 min-w-0 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-kinpaku" />
            <span>
              {affinity.recommendationsFromTarget.length > 0
                ? `${affinity.recommendationsFromTarget.length} recommandation${affinity.recommendationsFromTarget.length > 1 ? "s" : ""} tirée${affinity.recommendationsFromTarget.length > 1 ? "s" : ""} de sa liste`
                : "Recommandations tirées de sa liste"}
            </span>
          </h3>

          {affinity.recommendationsFromTarget.length === 0 ? (
            <div className="rounded-2xl bg-obsidian/65 border border-white/[0.06] p-4 text-xs text-[#8A8FA4]">
              Incroyable — vous avez déjà vu tous les titres phares de {targetProfile.displayName} !
            </div>
          ) : (
            <div className="space-y-2.5">
              {affinity.recommendationsFromTarget.map((rec) => {
                const alreadyInLib = Boolean(getEntry(rec.mediaId));
                return (
                  <div
                    key={rec.mediaId}
                    className="p-2.5 rounded-xl bg-obsidian/70 border border-white/[0.08] hover:border-accent/40 flex items-center gap-3 transition-colors"
                  >
                    <Link href={`/media/${rec.mediaId}`} className="shrink-0">
                      <img
                        src={rec.coverImage}
                        alt={rec.title}
                        loading="lazy"
                        decoding="async"
                        className="w-10 h-14 rounded-lg object-cover border border-white/12"
                      />
                    </Link>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/media/${rec.mediaId}`}
                        className="text-xs sm:text-sm font-semibold text-white hover:text-accent-hover line-clamp-1 block"
                      >
                        {rec.title}
                      </Link>
                      <p className="text-[11px] text-kinpaku/90 mt-0.5 flex items-center gap-1 truncate">
                        <Star className="w-3 h-3 fill-current shrink-0" />
                        <span className="truncate">{rec.reason}</span>
                      </p>
                      {rec.genres.length > 0 && (
                        <p className="text-[10px] font-mono text-[#7E8398] truncate mt-0.5">
                          {rec.genres.slice(0, 3).join(" · ")}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={alreadyInLib}
                      onClick={() =>
                        upsertEntry(
                          {
                            mediaId: rec.mediaId,
                            type: rec.type,
                            title: rec.title,
                            coverImage: rec.coverImage,
                            bannerImage: null,
                            genres: rec.genres,
                            totalUnits: null,
                            duration: null,
                            studio: null,
                            format: null,
                            seasonYear: null,
                            averageScore: rec.targetScore ? Math.round(rec.targetScore * 10) : null,
                            status: "PLAN_TO_WATCH",
                            progress: 0,
                            score: null,
                            isFavorite: false,
                            notes: "",
                            updatedAt: new Date().toISOString(),
                          },
                          { status: "PLAN_TO_WATCH" }
                        )
                      }
                      className={cn(
                        "h-8 px-3 rounded-xl border text-[11px] font-semibold inline-flex items-center gap-1 transition-all shrink-0",
                        alreadyInLib
                          ? "bg-emerald-500/15 border-emerald-400/35 text-emerald-300 cursor-default"
                          : "bg-accent/18 hover:bg-accent border-accent/45 text-accent-soft hover:text-accent-fg cursor-pointer"
                      )}
                    >
                      {alreadyInLib ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Ajouté</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          <span>Ma liste</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
