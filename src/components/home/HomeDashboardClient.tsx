"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Eye,
  EyeOff,
  Heart,
  PlayCircle,
  RotateCcw,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { HeroShowcase } from "@/components/media/HeroShowcase";
import { ContinueWatchingSection } from "@/components/media/ContinueWatchingSection";
import { PersonalizedRecommendationsSection } from "@/components/media/PersonalizedRecommendationsSection";
import { HomeMoodAndRouletteSection } from "@/components/home/HomeMoodAndRouletteSection";
import { HomeWeeklyCheckStrip } from "@/components/episodes/HomeWeeklyCheckStrip";
import { HomeCommunityPulseSection } from "@/components/home/HomeCommunityPulseSection";
import { MediaRail } from "@/components/media/MediaRail";
import { RevealSection } from "@/components/motion/MotionPrimitives";
import { computeLibraryAnalytics } from "@/lib/stats";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { HomeData } from "@/lib/anilist";
import type { HomeSectionId, MediaItem } from "@/types/media";

const SECTION_LABELS: Record<HomeSectionId, { title: string; hint: string }> = {
  hero: { title: "À la une", hint: "Affiche principale en haut de l'accueil" },
  continue_watching: { title: "Reprendre la lecture", hint: "Vos titres en cours avec bouton +1" },
  stats_strip: { title: "Résumé rapide", hint: "En cours, favoris, terminés et note moyenne" },
  favorites_shelf: { title: "Mes favoris", hint: "Accès direct à vos coups de cœur" },
  weekly_episodes: { title: "Sorties de la semaine", hint: "Épisodes récents de vos séries" },
  catalog_rails: { title: "Tendances & Mangas", hint: "Sélection du moment à découvrir" },
  recommendations: { title: "Recommandations", hint: "Suggestions hors bibliothèque" },
  mood_roulette: { title: "Envies & Roulette", hint: "Choisir selon votre humeur" },
  recent_activity: { title: "Activité récente", hint: "Vos dernières mises à jour" },
  community_pulse: { title: "Communauté", hint: "Activité récente des membres" },
};

interface HomeDashboardClientProps {
  data: HomeData;
  surprisePool: MediaItem[];
}

export function HomeDashboardClient({ data, surprisePool }: HomeDashboardClientProps) {
  const {
    library,
    orderedFavorites,
    activity,
    homeSections,
    toggleHomeSection,
    moveHomeSection,
    resetHomeSections,
  } = useShiori();
  const [customizing, setCustomizing] = useState(false);

  const stats = useMemo(
    () => computeLibraryAnalytics(library, activity),
    [library, activity]
  );

  const heroVisible = homeSections.find((s) => s.id === "hero")?.visible ?? true;
  const nonHeroSections = homeSections.filter((s) => s.id !== "hero");
  const watchingTotal = library.filter((e) => e.status === "WATCHING").length;

  const renderSection = (id: HomeSectionId) => {
    switch (id) {
      case "stats_strip":
        return (
          <RevealSection key="stats_strip">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Link
                href="/library?status=WATCHING"
                className="p-4 rounded-2xl card-surface border border-white/[0.08] hover:border-sky-400/40 transition-colors flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-xs text-[#8D92A6]">En cours</p>
                  <p className="text-2xl font-bold font-mono text-white mt-0.5">
                    {watchingTotal}
                  </p>
                  <p className="text-[11px] text-[#7A7F94] mt-0.5">
                    {stats.totalEpisodes.toLocaleString("fr-FR")} ép. ·{" "}
                    {stats.totalChapters.toLocaleString("fr-FR")} ch.
                  </p>
                </div>
                <PlayCircle className="w-5 h-5 text-sky-400 shrink-0" />
              </Link>

              <Link
                href="/library?favorites=1"
                className="p-4 rounded-2xl card-surface border border-white/[0.08] hover:border-rose-400/40 transition-colors flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-xs text-[#8D92A6]">Mes favoris</p>
                  <p className="text-2xl font-bold font-mono text-white mt-0.5">
                    {orderedFavorites.length}
                  </p>
                  <p className="text-[11px] text-[#7A7F94] mt-0.5">
                    Voir la sélection →
                  </p>
                </div>
                <Heart className="w-5 h-5 text-rose-400 fill-current shrink-0" />
              </Link>

              <Link
                href="/library?status=COMPLETED"
                className="p-4 rounded-2xl card-surface border border-white/[0.08] hover:border-emerald-400/40 transition-colors flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-xs text-[#8D92A6]">Terminés</p>
                  <p className="text-2xl font-bold font-mono text-emerald-300 mt-0.5">
                    {stats.completedCount}
                  </p>
                  <p className="text-[11px] text-[#7A7F94] mt-0.5">
                    {stats.totalDays} jours estimés
                  </p>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              </Link>

              <Link
                href="/stats"
                className="p-4 rounded-2xl card-surface border border-white/[0.08] hover:border-kinpaku/40 transition-colors flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-xs text-[#8D92A6]">Note moyenne</p>
                  <p className="text-2xl font-bold font-mono text-kinpaku mt-0.5">
                    {stats.meanScore !== null ? `${stats.meanScore.toFixed(1)}/10` : "—"}
                  </p>
                  <p className="text-[11px] text-[#7A7F94] mt-0.5">
                    Voir les statistiques →
                  </p>
                </div>
                <Star className="w-5 h-5 text-kinpaku fill-current shrink-0" />
              </Link>
            </div>
          </RevealSection>
        );

      case "continue_watching":
        return <ContinueWatchingSection key="continue_watching" />;

      case "favorites_shelf":
        if (orderedFavorites.length === 0) return null;
        return (
          <RevealSection key="favorites_shelf" className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#F4F3EE]">
                  Mes favoris
                </h2>
                <p className="text-xs text-[#8A8FA4] mt-0.5">
                  Vos titres coups de cœur en accès direct
                </p>
              </div>
              <Link
                href="/library?favorites=1"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B8BCCB] hover:text-white transition-colors shrink-0"
              >
                <span>Tout voir ({orderedFavorites.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {orderedFavorites.slice(0, 6).map((fav, idx) => (
                <Link
                  key={fav.mediaId}
                  href={`/media/${fav.mediaId}`}
                  className="group space-y-1.5"
                >
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/10 group-hover:border-accent/60 transition-all bg-[#121521]">
                    <img
                      src={fav.coverImage}
                      alt={fav.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-obsidian/90 border border-white/15 font-mono text-[10px] font-bold text-kinpaku">
                      #{idx + 1}
                    </span>
                    {fav.score !== null && (
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[10px] text-[#F0B95B]">
                        ★ {fav.score.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-[#DCDFE9] group-hover:text-white truncate">
                    {fav.title}
                  </p>
                </Link>
              ))}
            </div>
          </RevealSection>
        );

      case "weekly_episodes":
        return <HomeWeeklyCheckStrip key="weekly_episodes" airingSlots={data.airingToday} />;

      case "recommendations":
        return <PersonalizedRecommendationsSection key="recommendations" />;

      case "mood_roulette":
        return <HomeMoodAndRouletteSection key="mood_roulette" surprisePool={surprisePool} />;

      case "recent_activity":
        if (activity.length === 0) return null;
        return (
          <RevealSection
            key="recent_activity"
            className="rounded-2xl card-surface border border-white/[0.08] p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent" />
                <span>Activité récente</span>
              </h2>
              <Link
                href="/stats"
                className="text-xs text-[#9A9EAE] hover:text-white transition-colors"
              >
                Statistiques →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {activity.slice(0, 6).map((ev) => (
                <Link
                  key={ev.id}
                  href={`/media/${ev.mediaId}`}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-obsidian/65 border border-white/[0.06] hover:border-white/[0.15] transition-colors"
                >
                  <img
                    src={ev.coverImage}
                    alt={ev.mediaTitle}
                    loading="lazy"
                    decoding="async"
                    className="w-9 h-12 rounded-lg object-cover shrink-0 border border-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#F4F3EE] truncate">
                      {ev.mediaTitle}
                    </p>
                    <p className="text-[11px] text-[#9A9EAE] truncate mt-0.5">{ev.action}</p>
                    <p suppressHydrationWarning className="text-[10px] font-mono text-[#6E7387] mt-0.5">
                      {formatRelativeTime(ev.createdAt)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </RevealSection>
        );

      case "catalog_rails":
        return (
          <div key="catalog_rails" className="space-y-10">
            <MediaRail
              eyebrow="À découvrir"
              title="Tendances du moment"
              subtitle="Les animés les plus suivis cette semaine"
              href="/discover?sort=TRENDING_DESC&type=ANIME"
              items={data.trending}
            />
            <MediaRail
              eyebrow="Lecture"
              title="Sélection Manga"
              subtitle="Les mangas incontournables du catalogue"
              href="/discover?sort=SCORE_DESC&type=MANGA"
              items={data.manga}
            />
          </div>
        );

      case "community_pulse":
        return <HomeCommunityPulseSection key="community_pulse" />;

      default:
        return null;
    }
  };

  return (
    <div className="pb-10">
      {/* Compact Cinematic Hero Showcase */}
      {heroVisible ? (
        <HeroShowcase items={data.hero} />
      ) : (
        <div className="pt-[calc(5rem+env(safe-area-inset-top))] sm:pt-24" />
      )}

      {/* Focused Main Content Container */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-12 mt-6">
        {/* Render user's visible sections in order */}
        {nonHeroSections
          .filter((s) => s.visible)
          .map((s) => renderSection(s.id))}

        {/* Discreet Home Customization Control at the bottom (never interrupts first impression) */}
        <div className="pt-2 flex flex-col items-end gap-4">
          <button
            type="button"
            onClick={() => setCustomizing((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-medium transition-all cursor-pointer",
              customizing
                ? "bg-accent/20 border-accent/50 text-accent-soft"
                : "bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-[#9A9EAE] hover:text-white"
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>
              {customizing ? "Fermer la personnalisation" : "Personnaliser les sections de l'accueil"}
            </span>
          </button>

          {customizing && (
            <div className="w-full rounded-2xl card-surface border border-accent/35 p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-white">
                    Afficher, masquer ou réordonner les sections
                  </h3>
                  <p className="text-xs text-[#858A9E]">
                    Activez les sections secondaires si vous souhaitez un accueil plus détaillé.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetHomeSections}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.09] text-xs font-medium text-[#D6D9E6] cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Par défaut</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomizing(false)}
                    aria-label="Fermer"
                    className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.14] flex items-center justify-center text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {homeSections.map((sec, idx) => {
                  const meta = SECTION_LABELS[sec.id];
                  return (
                    <div
                      key={sec.id}
                      className={cn(
                        "px-3 py-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors",
                        sec.visible
                          ? "bg-obsidian/80 border-white/[0.1]"
                          : "bg-obsidian/40 border-white/[0.05] opacity-65"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {meta.title}
                        </p>
                        <p className="text-[11px] text-[#858A9E] truncate">{meta.hint}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveHomeSection(sec.id, "up")}
                          aria-label={`Monter ${meta.title}`}
                          className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.14] disabled:opacity-30 flex items-center justify-center text-white cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === homeSections.length - 1}
                          onClick={() => moveHomeSection(sec.id, "down")}
                          aria-label={`Descendre ${meta.title}`}
                          className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.14] disabled:opacity-30 flex items-center justify-center text-white cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleHomeSection(sec.id)}
                          aria-label={sec.visible ? `Masquer ${meta.title}` : `Afficher ${meta.title}`}
                          className={cn(
                            "h-7 px-2 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer",
                            sec.visible
                              ? "bg-emerald-500/15 border-emerald-400/35 text-emerald-300"
                              : "bg-white/[0.05] border-white/[0.1] text-[#8E93A6]"
                          )}
                        >
                          {sec.visible ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
