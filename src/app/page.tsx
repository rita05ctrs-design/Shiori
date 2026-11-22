import React from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { fetchHomeData } from "@/lib/anilist";
import { HeroShowcase } from "@/components/media/HeroShowcase";
import { ContinueWatchingSection } from "@/components/media/ContinueWatchingSection";
import { PersonalizedRecommendationsSection } from "@/components/media/PersonalizedRecommendationsSection";
import { HomeMoodAndRouletteSection } from "@/components/home/HomeMoodAndRouletteSection";
import { HomeWeeklyCheckStrip } from "@/components/episodes/HomeWeeklyCheckStrip";
import { HomeCuratedTabsSection } from "@/components/home/HomeCuratedTabsSection";
import { HomeCommunityPulseSection } from "@/components/home/HomeCommunityPulseSection";
import { MediaRail } from "@/components/media/MediaRail";
import { RevealSection } from "@/components/motion/MotionPrimitives";

export const revalidate = 300;

export default async function HomePage() {
  const data = await fetchHomeData();

  const surprisePool = [
    ...data.topAnime,
    ...data.trending,
    ...data.movies,
    ...data.hiddenGems,
    ...data.shortBinge,
    ...data.manga,
  ];

  return (
    <div className="pb-12">
      {/* Immersive Full-Bleed Hero Showcase */}
      <HeroShowcase items={data.hero} />

      {/* Main Content Container */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-14 mt-6">
        {/* 1. User Personal Progress — Continue Watching / Reading */}
        <ContinueWatchingSection />

        {/* 2. Personalized Recommendations ("Recommandations pour toi") */}
        <PersonalizedRecommendationsSection />

        {/* 3. Mood Quick-Hub & "Surprends-moi" Tonight Roulette */}
        <HomeMoodAndRouletteSection surprisePool={surprisePool} />

        {/* 4. Interactive 1-Click Weekly Episode Check-In Strip */}
        <HomeWeeklyCheckStrip airingSlots={data.airingToday} />

        {/* 5. Trending Now */}
        <MediaRail
          eyebrow="Saison en cours"
          title="Tendances du moment"
          subtitle="Les animés qui captivent la communauté cette semaine"
          href="/discover?sort=TRENDING_DESC&type=ANIME"
          items={data.trending}
        />

        {/* 6. Interactive Tabbed Curated Collections (Films, Prochainement, Pépites, Courts) */}
        <HomeCuratedTabsSection
          movies={data.movies}
          upcoming={data.upcoming}
          hiddenGems={data.hiddenGems}
          shortBinge={data.shortBinge}
        />

        {/* 7. Popular All-Time Anime */}
        <MediaRail
          eyebrow="Incontournables"
          title="Animés les plus populaires"
          subtitle="Les séries emblématiques plébiscitées à travers le monde"
          href="/discover?sort=POPULARITY_DESC&type=ANIME"
          items={data.popular}
        />

        {/* 8. Top Critically Acclaimed Anime (Ranked) */}
        <MediaRail
          eyebrow="Panthéon critique"
          title="Les mieux notés de l'histoire"
          subtitle="Classement par score moyen sur la communauté mondiale"
          href="/discover?sort=SCORE_DESC&type=ANIME"
          items={data.topAnime}
          showRank
        />

        {/* 9. Editorial Manga Shelf */}
        <MediaRail
          eyebrow="Bibliothèque papier"
          title="Chefs-d'œuvre Manga"
          subtitle="Seinen, shōnen et récits graphiques d'exception à suivre"
          href="/discover?sort=SCORE_DESC&type=MANGA"
          items={data.manga}
          showRank
        />

        {/* 10. Live Community Pulse & Voice Actors Spotlight */}
        <HomeCommunityPulseSection />

        {/* 11. Subtle CTA Banner to Discover / Stats */}
        <RevealSection className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#161824] via-[#0F111A] to-[#1A1015] p-7 sm:p-9 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.18em] text-accent-hover">
              <Sparkles className="w-3.5 h-3.5" />
              Votre cinémathèque sur mesure
            </span>
            <h3 className="text-2xl sm:text-3xl font-semibold text-white mt-2 tracking-tight">
              Explorez des milliers d&apos;œuvres et analysez vos goûts.
            </h3>
            <p className="text-sm text-[#989DB0] mt-2 leading-relaxed">
              Filtrez par genre, saison ou studio, construisez vos listes et visualisez votre
              profil de spectateur en temps réel dans vos statistiques Shiori.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/discover"
              className="px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-sm font-semibold shadow-[0_10px_28px_rgb(var(--shiori-accent-rgb)/0.35)] transition-all"
            >
              Explorer le catalogue
            </Link>
            <Link
              href="/stats"
              className="px-5 py-2.5 rounded-full bg-white/[0.07] hover:bg-white/[0.13] border border-white/[0.12] text-white text-sm font-medium transition-colors"
            >
              Voir mes statistiques
            </Link>
          </div>
        </RevealSection>
      </div>
    </div>
  );
}
