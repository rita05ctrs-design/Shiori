import React from "react";
import Link from "next/link";
import { CalendarDays, Clock, ArrowRight, Sparkles } from "lucide-react";
import { fetchHomeData } from "@/lib/anilist";
import { HeroShowcase } from "@/components/media/HeroShowcase";
import { ContinueWatchingSection } from "@/components/media/ContinueWatchingSection";
import { MediaRail } from "@/components/media/MediaRail";
import { RevealSection } from "@/components/motion/MotionPrimitives";
import { formatCountdown, getDisplayTitle } from "@/lib/utils";

export const revalidate = 300;

export default async function HomePage() {
  const data = await fetchHomeData();

  return (
    <div className="pb-12">
      {/* Immersive Full-Bleed Hero Showcase */}
      <HeroShowcase items={data.hero} />

      {/* Main Content Container */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-14 mt-6">
        {/* User Personal Progress — Continue Watching / Reading */}
        <ContinueWatchingSection />

        {/* Trending Now */}
        <MediaRail
          eyebrow="Saison en cours"
          title="Tendances du moment"
          subtitle="Les animés qui captivent la communauté cette semaine"
          href="/discover?sort=TRENDING_DESC&type=ANIME"
          items={data.trending}
        />

        {/* Compact Airing Schedule Spotlight Strip */}
        {data.airingToday.length > 0 && (
          <RevealSection className="rounded-2xl card-surface p-5 sm:p-6 relative overflow-hidden">
            <div
              className="pointer-events-none absolute -right-24 -top-24 w-72 h-72 rounded-full opacity-20 blur-3xl"
              style={{ background: "radial-gradient(circle, var(--shiori-accent), transparent 70%)" }}
            />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 relative z-10">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#F0B95B] flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Diffusions imminentes</span>
                </p>
                <h2 className="text-lg sm:text-xl font-semibold text-white mt-0.5">
                  Prochaines sorties de la semaine
                </h2>
              </div>
              <Link
                href="/calendar"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white px-4 py-2 rounded-full bg-white/[0.07] hover:bg-white/[0.13] border border-white/[0.1] transition-colors self-start sm:self-auto"
              >
                <span>Calendrier complet</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
              {data.airingToday.slice(0, 4).map((slot) => (
                <Link
                  key={slot.id}
                  href={`/media/${slot.media.id}`}
                  className="group flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/[0.14] transition-all"
                >
                  <img
                    src={slot.media.coverImage.large}
                    alt={getDisplayTitle(slot.media)}
                    className="w-12 h-16 rounded-lg object-cover shrink-0 border border-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/18 text-accent-soft border border-accent/30">
                      Ép. {slot.episode}
                    </span>
                    <p className="text-[13px] font-semibold text-[#F4F3EE] group-hover:text-white truncate mt-1">
                      {getDisplayTitle(slot.media)}
                    </p>
                    <p className="text-[11px] font-mono text-[#8C91A6] flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-[#F0B95B]" />
                      <span>{formatCountdown(slot.airingAt)}</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </RevealSection>
        )}

        {/* Popular All-Time Anime */}
        <MediaRail
          eyebrow="Incontournables"
          title="Animés les plus populaires"
          subtitle="Les séries emblématiques plébiscitées à travers le monde"
          href="/discover?sort=POPULARITY_DESC&type=ANIME"
          items={data.popular}
        />

        {/* Top Critically Acclaimed Anime (Ranked) */}
        <MediaRail
          eyebrow="Panthéon critique"
          title="Les mieux notés de l'histoire"
          subtitle="Classement par score moyen sur la communauté mondiale"
          href="/discover?sort=SCORE_DESC&type=ANIME"
          items={data.topAnime}
          showRank
        />

        {/* Editorial Manga Shelf */}
        <MediaRail
          eyebrow="Bibliothèque papier"
          title="Chefs-d'œuvre Manga"
          subtitle="Seinen, shōnen et récits graphiques d'exception à suivre"
          href="/discover?sort=SCORE_DESC&type=MANGA"
          items={data.manga}
          showRank
        />

        {/* Subtle CTA Banner to Discover / Stats */}
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
