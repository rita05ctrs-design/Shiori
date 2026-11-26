"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronDown,
  Flame,
  Handshake,
  Heart,
  Mic2,
  Plus,
  Scale,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
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
  const { tr, tGenre } = useTranslation();
  const [showComparator, setShowComparator] = useState(false);

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
                {tr("Affinité")}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{tr("Compatibilité & Affinité")}</span>
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
              {tr("Compatibilité avec {name}", { name: targetProfile.displayName })}
            </h2>

            <p className="text-xs text-[#9EA3B5] max-w-xl leading-relaxed">
              {tr("Calculée en direct d'après vos titres en commun, vos notes, vos coups de cœur partagés et vos genres favoris.")}
            </p>

            {/* Key Affinity Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.09] font-mono text-[11px] text-white">
                {tr("{n} titre(s) en commun", { n: affinity.commonTitles.length })}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-rose-500/14 border border-rose-400/30 font-mono text-[11px] text-rose-200 inline-flex items-center gap-1">
                <Heart className="w-3 h-3 fill-current" />
                {tr("{n} favori(s) partagé(s)", { n: affinity.sharedFavorites.length })}
              </span>
              {affinity.avgScoreDiff !== null && (
                <span className="px-2.5 py-1 rounded-full bg-amber-500/12 border border-amber-400/30 font-mono text-[11px] text-amber-200 inline-flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  ±{affinity.avgScoreDiff.toFixed(1)}★
                </span>
              )}
              {affinity.sharedStaff.length > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-violet-500/14 border border-violet-400/30 font-mono text-[11px] text-violet-200 inline-flex items-center gap-1">
                  <Mic2 className="w-3 h-3" />
                  {affinity.sharedStaff.length} Seiyuu
                </span>
              )}
              {affinity.commonTitles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowComparator((v) => !v)}
                  className={cn(
                    "px-3 py-1 rounded-full border text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer",
                    showComparator
                      ? "bg-accent border-accent text-accent-fg"
                      : "bg-white/[0.06] hover:bg-white/[0.12] border-white/[0.14] text-white"
                  )}
                >
                  <Scale className="w-3 h-3" />
                  <span>{showComparator ? tr("Masquer le comparateur") : tr("Comparer nos notes")}</span>
                  <ChevronDown
                    className={cn(
                      "w-3 h-3 transition-transform",
                      showComparator && "rotate-180"
                    )}
                  />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* EXPANDABLE SIDE-BY-SIDE FRIEND COMPARATOR */}
      <AnimatePresence initial={false}>
        {showComparator && affinity.commonTitles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="relative z-10 overflow-hidden"
          >
            <div className="pt-4 border-t border-white/[0.07] space-y-4">
              {/* Shared Genres Overlap */}
              {affinity.sharedGenres.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#858A9E] mr-1">
                    {tr("Genres partagés :")}
                  </span>
                  {affinity.sharedGenres.map((g) => (
                    <span
                      key={g.genre}
                      className="px-2.5 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.09] text-[11px] text-[#D6D9E6]"
                    >
                      {tGenre(g.genre)}
                    </span>
                  ))}
                </div>
              )}

              {/* Agreements vs Debates */}
              {(affinity.biggestAgreements.length > 0 || affinity.biggestDebates.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-emerald-500/[0.06] border border-emerald-400/25 p-3.5 space-y-2">
                    <p className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                      <Handshake className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{tr("Vos accords parfaits")}</span>
                    </p>
                    {affinity.biggestAgreements.length === 0 ? (
                      <p className="text-[11px] text-[#8A8FA4]">
                        {tr("Pas encore assez de titres notés en commun.")}
                      </p>
                    ) : (
                      affinity.biggestAgreements.map((m) => (
                        <Link
                          key={`agree-${m.mediaId}`}
                          href={`/media/${m.mediaId}`}
                          className="flex items-center justify-between gap-2 text-xs hover:text-white transition-colors"
                        >
                          <span className="text-[#E4E6F0] truncate">{m.title}</span>
                          <span className="font-mono text-[11px] text-emerald-300 shrink-0">
                            ★ {m.viewerScore?.toFixed(1)} vs ★ {m.targetScore?.toFixed(1)}
                          </span>
                        </Link>
                      ))
                    )}
                  </div>

                  <div className="rounded-2xl bg-amber-500/[0.06] border border-amber-400/25 p-3.5 space-y-2">
                    <p className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span>{tr("Vos plus gros débats")}</span>
                    </p>
                    {affinity.biggestDebates.length === 0 ? (
                      <p className="text-[11px] text-[#8A8FA4]">
                        {tr("Aucun désaccord majeur — vous êtes sur la même longueur d'onde !")}
                      </p>
                    ) : (
                      affinity.biggestDebates.map((m) => (
                        <Link
                          key={`debate-${m.mediaId}`}
                          href={`/media/${m.mediaId}`}
                          className="flex items-center justify-between gap-2 text-xs hover:text-white transition-colors"
                        >
                          <span className="text-[#E4E6F0] truncate">{m.title}</span>
                          <span className="font-mono text-[11px] text-amber-300 shrink-0">
                            ★ {m.viewerScore?.toFixed(1)} vs ★ {m.targetScore?.toFixed(1)} (Δ{" "}
                            {m.scoreDiff?.toFixed(1)})
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Compact Side-by-Side Table */}
              <div className="rounded-2xl bg-obsidian/70 border border-white/[0.07] overflow-hidden">
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.03] border-b border-white/[0.07] font-mono text-[10px] uppercase tracking-wider text-[#858A9E]">
                      <tr>
                        <th className="px-3.5 py-2">{tr("Œuvre en commun")}</th>
                        <th className="px-3 py-2 text-right">{tr("Vous")}</th>
                        <th className="px-3 py-2 text-right truncate max-w-[110px]">
                          {targetProfile.displayName}
                        </th>
                        <th className="px-3 py-2 text-right">{tr("Écart")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {affinity.commonTitles.slice(0, 15).map((m) => (
                        <tr key={`cmp-${m.mediaId}`} className="hover:bg-white/[0.03]">
                          <td className="px-3.5 py-2">
                            <Link
                              href={`/media/${m.mediaId}`}
                              className="font-medium text-white hover:text-accent-hover line-clamp-1"
                            >
                              {m.title}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[#D6D9E6]">
                            {m.viewerScore !== null ? `★ ${m.viewerScore.toFixed(1)}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-kinpaku">
                            {m.targetScore !== null ? `★ ${m.targetScore.toFixed(1)}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {m.scoreDiff !== null ? (
                              <span
                                className={cn(
                                  m.scoreDiff <= 1
                                    ? "text-emerald-300"
                                    : m.scoreDiff >= 2
                                      ? "text-rose-300"
                                      : "text-amber-300"
                                )}
                              >
                                {m.scoreDiff === 0 ? "=" : `±${m.scoreDiff.toFixed(1)}`}
                              </span>
                            ) : (
                              <span className="text-[#5E6377]">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM 2-COLUMN SHOWCASE: Shared Favorites & Common Titles + 3 Recs from Target's List */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 pt-4 border-t border-white/[0.07]">
        {/* LEFT: Shared Favorites & Common Rated Titles */}
        <div className="lg:col-span-6 min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-400 fill-current" />
              <span>
                {affinity.sharedFavorites.length > 0
                  ? `${tr("Favoris partagés")} (${affinity.sharedFavorites.length})`
                  : `${tr("Œuvres en commun")} (${affinity.commonTitles.length})`}
              </span>
            </h3>
          </div>

          {affinity.commonTitles.length === 0 ? (
            <div className="rounded-2xl bg-obsidian/65 border border-white/[0.06] p-4 text-xs text-[#8A8FA4]">
              {tr("Aucun titre en commun identifié dans son aperçu public.")}
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
                            {tr("Favori commun")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] font-mono">
                        <span className="text-[#B5B9C9]">
                          {tr("Vous")} :{" "}
                          <strong className="text-white">
                            {m.viewerScore !== null ? `★ ${m.viewerScore.toFixed(1)}` : "✓"}
                          </strong>
                        </span>
                        <span className="text-white/25">·</span>
                        <span className="text-[#B5B9C9]">
                          {targetProfile.displayName} :{" "}
                          <strong className="text-kinpaku">
                            {m.targetScore !== null ? `★ ${m.targetScore.toFixed(1)}` : "✓"}
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
              {tr("Recommandations tirées de sa liste")}
              {affinity.recommendationsFromTarget.length > 0
                ? ` (${affinity.recommendationsFromTarget.length})`
                : ""}
            </span>
          </h3>

          {affinity.recommendationsFromTarget.length === 0 ? (
            <div className="rounded-2xl bg-obsidian/65 border border-white/[0.06] p-4 text-xs text-[#8A8FA4]">
              {tr("Vous avez déjà vu tous les titres phares de {name} !", { name: targetProfile.displayName })}
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
                          {rec.genres.slice(0, 3).map((g) => tGenre(g)).join(" · ")}
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
                          <span>{tr("Ajouté")}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          <span>{tr("Ma liste")}</span>
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
