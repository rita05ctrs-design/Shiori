"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Star,
  Check,
  Clock,
  Users,
  Bookmark,
  ExternalLink,
  Tv,
  BookOpen,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { MediaCard } from "@/components/media/MediaCard";
import { LibraryTrackerCard } from "@/components/media/LibraryTrackerCard";
import { TranslatedSynopsis } from "@/components/media/TranslatedSynopsis";
import {
  CINEMA_EASE,
  ParallaxBanner,
  RevealSection,
} from "@/components/motion/MotionPrimitives";
import {
  cn,
  formatCompactNumber,
  formatCountdown,
  formatFormat,
  formatMediaStatus,
  formatScore,
  formatSeason,
  getDisplayTitle,
} from "@/lib/utils";
import type { MediaDetail } from "@/types/media";

const RELATION_FR: Record<string, string> = {
  PREQUEL: "Préquelle",
  SEQUEL: "Suite",
  ADAPTATION: "Adaptation",
  SOURCE: "Œuvre originale",
  SIDE_STORY: "Histoire parallèle",
  SPIN_OFF: "Spin-off",
  ALTERNATIVE: "Alternatif",
  PARENT: "Série mère",
  SUMMARY: "Résumé",
  OTHER: "Lié",
};

interface MediaDetailClientProps {
  media: MediaDetail;
}

export function MediaDetailClient({ media }: MediaDetailClientProps) {
  const { getEntry, upsertEntry } = useShiori();

  const entry = getEntry(media.id);
  const title = getDisplayTitle(media);

  const totalUnits = media.type === "MANGA" ? media.chapters : media.episodes;
  const unitLabel = media.type === "MANGA" ? "Chapitre" : "Épisode";

  // Score distribution normalization
  const maxDistAmount = Math.max(
    1,
    ...media.scoreDistribution.map((s) => s.amount)
  );

  const handleSetEpisode = (epNum: number) => {
    upsertEntry(media, {
      status:
        totalUnits && epNum >= totalUnits
          ? "COMPLETED"
          : entry?.status && entry.status !== "PLAN_TO_WATCH"
            ? entry.status
            : "WATCHING",
      progress: epNum,
    });
  };

  // Interactive episode checklist (show up to 36 clean tiles, or current window)
  const checklistCount = totalUnits
    ? Math.min(totalUnits, 36)
    : entry && entry.progress > 0
      ? Math.min(24, entry.progress + 4)
      : 12;

  return (
    <div className="pb-16">
      {/* Full-Bleed Scroll-Parallax Atmospheric Banner */}
      <ParallaxBanner
        speed={95}
        className="h-[320px] sm:h-[400px] lg:h-[440px] w-full bg-surface"
      >
        <img
          src={media.bannerImage || media.coverImage.extraLarge}
          alt={title}
          className={cn(
            "w-full h-full object-cover",
            !media.bannerImage && "blur-xl scale-110 opacity-45"
          )}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/55 to-obsidian/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-obsidian/85 via-transparent to-obsidian/40" />

        {/* Back link */}
        <div className="absolute top-20 inset-x-0 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 z-10">
          <Link
            href="/discover"
            className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-md border border-white/[0.12] text-xs font-medium text-[#E4E6F0] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Catalogue</span>
          </Link>
        </div>
      </ParallaxBanner>

      {/* Main Layout */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 -mt-36 sm:-mt-44 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Poster + Tracker Controls + Metadata */}
          <div className="lg:col-span-3 space-y-5">
            {/* Poster */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="w-44 sm:w-56 lg:w-full aspect-[2/3] rounded-2xl overflow-hidden border border-white/[0.14] shadow-[0_24px_60px_rgba(0,0,0,0.75)] bg-[#131622]"
            >
              <img
                src={media.coverImage.extraLarge}
                alt={title}
                className="w-full h-full object-cover"
              />
            </motion.div>

            {/* Primary Animated Tracking Card */}
            <LibraryTrackerCard media={media} title={title} />

            {/* Metadata Card */}
            <div className="rounded-2xl card-surface p-4 space-y-3 text-xs">
              <h3 className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#858A9E]">
                Fiche technique
              </h3>
              <dl className="space-y-2.5">
                <div className="flex justify-between gap-2">
                  <dt className="text-[#7E8397]">Format</dt>
                  <dd className="text-[#ECEBE6] font-medium text-right">
                    {formatFormat(media.format)}
                  </dd>
                </div>
                {media.type === "ANIME" ? (
                  <>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#7E8397]">Épisodes</dt>
                      <dd className="text-[#ECEBE6] font-mono">
                        {media.episodes ?? "En cours"}
                      </dd>
                    </div>
                    {media.duration && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#7E8397]">Durée</dt>
                        <dd className="text-[#ECEBE6] font-mono">{media.duration} min</dd>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#7E8397]">Chapitres</dt>
                      <dd className="text-[#ECEBE6] font-mono">
                        {media.chapters ?? "En cours"}
                      </dd>
                    </div>
                    {media.volumes && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#7E8397]">Tomes</dt>
                        <dd className="text-[#ECEBE6] font-mono">{media.volumes}</dd>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-[#7E8397]">Statut</dt>
                  <dd className="text-[#ECEBE6] font-medium">
                    {formatMediaStatus(media.status)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#7E8397]">Sortie</dt>
                  <dd className="text-[#ECEBE6]">
                    {formatSeason(media.season, media.seasonYear ?? media.startYear)}
                  </dd>
                </div>
                {media.studio && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#7E8397]">
                      {media.type === "MANGA" ? "Auteur" : "Studio"}
                    </dt>
                    <dd className="text-white font-medium text-right">{media.studio}</dd>
                  </div>
                )}
                {media.popularity && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#7E8397]">Popularité</dt>
                    <dd className="text-[#ECEBE6] font-mono">
                      {formatCompactNumber(media.popularity)} membres
                    </dd>
                  </div>
                )}
                {media.favourites && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#7E8397]">Favoris</dt>
                    <dd className="text-[#ECEBE6] font-mono">
                      {formatCompactNumber(media.favourites)}
                    </dd>
                  </div>
                )}
              </dl>

              {media.siteUrl && (
                <a
                  href={media.siteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[#9A9EAE] hover:text-white transition-colors"
                >
                  <span>Fiche AniList</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Editorial Header, Synopsis, Progress Grid, Characters, Relations, Recs */}
          <div className="lg:col-span-9 space-y-10 pt-2 lg:pt-20">
            {/* Title & Key KPIs */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.07] border border-white/[0.1] text-[11px] font-mono uppercase text-[#E4E6F0]">
                  {media.type === "MANGA" ? (
                    <BookOpen className="w-3 h-3 text-violet-400" />
                  ) : (
                    <Tv className="w-3 h-3 text-sky-400" />
                  )}
                  {media.type} · {formatFormat(media.format)}
                </span>
                {media.averageScore && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F0B95B]/15 border border-[#F0B95B]/35 text-xs font-mono font-semibold text-[#F0B95B]">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    {formatScore(media.averageScore)} / 10
                  </span>
                )}
                {media.nextAiringEpisode && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/18 border border-accent/35 text-xs font-mono text-accent-soft">
                    <Clock className="w-3.5 h-3.5" />
                    Ép. {media.nextAiringEpisode.episode} ·{" "}
                    {formatCountdown(media.nextAiringEpisode.airingAt)}
                  </span>
                )}
              </div>

              {media.title.native && (
                <p className="font-serif italic text-lg text-[#C4C2B8]/80 mb-1">
                  {media.title.native}
                </p>
              )}
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-gradient-editorial leading-[1.08]">
                {title}
              </h1>
              {media.title.romaji !== title && (
                <p className="text-sm text-[#858A9E] mt-1.5">{media.title.romaji}</p>
              )}

              {/* Genres */}
              <div className="mt-4 flex flex-wrap gap-2">
                {media.genres.map((g) => (
                  <Link
                    key={g}
                    href={`/discover?genre=${encodeURIComponent(g)}&type=${media.type}`}
                    className="px-3 py-1 rounded-full bg-white/[0.05] hover:bg-accent/20 border border-white/[0.08] hover:border-accent/40 text-xs text-[#D6D9E6] hover:text-accent-fg transition-all"
                  >
                    {g}
                  </Link>
                ))}
              </div>
            </div>

            {/* Synopsis (with On-the-Fly Auto Translation & 1-Click Original Toggle) */}
            <section className="rounded-2xl card-surface p-6">
              <TranslatedSynopsis
                mediaId={media.id}
                description={media.description}
                variant="detail"
                expandable
              />

              {/* Personal Note Display if present */}
              {entry?.notes && (
                <div className="mt-5 pt-4 border-t border-white/[0.07]">
                  <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#F0B95B] mb-1.5 flex items-center gap-1.5">
                    <Bookmark className="w-3 h-3 fill-current" />
                    Votre note personnelle
                  </p>
                  <p className="text-sm italic text-[#E6E4DD] leading-relaxed">
                    &laquo; {entry.notes} &raquo;
                  </p>
                </div>
              )}
            </section>

            {/* Interactive Episode / Chapter Progress Tracker */}
            <section className="rounded-2xl card-surface p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-xs font-mono uppercase tracking-[0.18em] text-accent">
                    Progression rapide
                  </h2>
                  <p className="text-sm text-[#9A9EAE] mt-0.5">
                    Cliquez sur un {unitLabel.toLowerCase()} pour mettre à jour votre avancement instantanément
                  </p>
                </div>
                <span className="font-mono text-xs text-[#C6CAD8]">
                  Actuel : <strong className="text-white">{entry?.progress ?? 0}</strong>
                  {totalUnits ? ` / ${totalUnits}` : ""}
                </span>
              </div>

              <div className="grid grid-cols-6 sm:grid-cols-9 md:grid-cols-12 gap-2">
                {Array.from({ length: checklistCount }, (_, i) => i + 1).map((num) => {
                  const watched = Boolean(entry && entry.progress >= num);
                  const isCurrent = entry?.progress === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleSetEpisode(num)}
                      className={cn(
                        "h-9 rounded-lg font-mono text-xs font-medium border transition-all flex items-center justify-center gap-1 cursor-pointer",
                        isCurrent
                          ? "bg-accent border-accent-hover text-accent-fg shadow-[0_0_16px_rgb(var(--shiori-accent-rgb)/0.45)]"
                          : watched
                            ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25"
                            : "bg-white/[0.03] border-white/[0.07] text-[#9A9EAE] hover:bg-white/[0.09] hover:text-white"
                      )}
                    >
                      {watched && !isCurrent && <Check className="w-2.5 h-2.5" />}
                      <span>{num}</span>
                    </button>
                  );
                })}
              </div>
              {totalUnits && totalUnits > checklistCount && (
                <p className="mt-3 text-[11px] text-[#787D91]">
                  Utilisez le compteur +1 ou &laquo; Note, dates & critique &raquo; pour naviguer au-delà du {unitLabel.toLowerCase()} {checklistCount} (sur {totalUnits}).
                </p>
              )}
            </section>

            {/* Score Distribution & Tags Row */}
            {(media.scoreDistribution.length > 0 || media.tags.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {media.scoreDistribution.length > 0 && (
                  <section className="rounded-2xl card-surface p-5">
                    <h2 className="text-xs font-mono uppercase tracking-[0.18em] text-[#858A9E] mb-4 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#F0B95B]" />
                      Répartition des notes communautaires
                    </h2>
                    <div className="flex items-end gap-2 h-28 pt-2">
                      {media.scoreDistribution.map((bucket) => {
                        const pct = Math.max(8, Math.round((bucket.amount / maxDistAmount) * 100));
                        return (
                          <div
                            key={bucket.score}
                            className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group"
                          >
                            <div
                              style={{ height: `${pct}%` }}
                              title={`${bucket.score / 10}/10 : ${bucket.amount.toLocaleString("fr-FR")} votes`}
                              className={cn(
                                "w-full rounded-t-md transition-all",
                                bucket.score >= 80
                                  ? "bg-gradient-to-t from-accent/75 to-accent-hover"
                                  : bucket.score >= 60
                                    ? "bg-white/25 group-hover:bg-white/40"
                                    : "bg-white/12"
                              )}
                            />
                            <span className="text-[10px] font-mono text-[#7E8397]">
                              {bucket.score / 10}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {media.tags.length > 0 && (
                  <section className="rounded-2xl card-surface p-5">
                    <h2 className="text-xs font-mono uppercase tracking-[0.18em] text-[#858A9E] mb-3.5">
                      Thèmes & Atmosphère
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {media.tags.map((tag) => (
                        <div
                          key={tag.name}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.035] border border-white/[0.07] text-xs"
                        >
                          <span className="text-[#D8DBE6]">{tag.name}</span>
                          <span className="font-mono text-[10px] text-[#7D8296]">
                            {tag.rank}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* Characters & Voice Actors */}
            {media.characters.length > 0 && (
              <RevealSection className="space-y-4">
                <h2 className="text-lg font-semibold text-white">
                  Personnages & Voix originales
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {media.characters.map((ch, idx) => (
                    <motion.div
                      key={ch.id}
                      initial={{ opacity: 0, y: 14 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.15 }}
                      transition={{ duration: 0.4, delay: Math.min(idx * 0.04, 0.3), ease: CINEMA_EASE }}
                      whileHover={{ y: -2, borderColor: "rgba(255,255,255,0.16)" }}
                      className="rounded-xl card-surface p-2.5 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={ch.image}
                          alt={ch.name}
                          className="w-12 h-16 rounded-lg object-cover shrink-0 border border-white/10"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#F4F3EE] truncate">
                            {ch.name}
                          </p>
                          <p className="text-[11px] font-mono uppercase text-[#7E8397] mt-0.5">
                            {ch.role === "MAIN" ? "Principal" : "Secondaire"}
                          </p>
                        </div>
                      </div>

                      {ch.voiceActor && (
                        <div className="flex items-center gap-2.5 text-right min-w-0">
                          <div className="min-w-0 hidden sm:block">
                            <p className="text-xs font-medium text-[#D2D5E0] truncate">
                              {ch.voiceActor.name}
                            </p>
                            <p className="text-[10px] text-[#72778B]">
                              Seiyū (JP)
                            </p>
                          </div>
                          <img
                            src={ch.voiceActor.image}
                            alt={ch.voiceActor.name}
                            className="w-11 h-14 rounded-lg object-cover shrink-0 border border-white/10"
                          />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </RevealSection>
            )}

            {/* Relations */}
            {media.relations.length > 0 && (
              <RevealSection className="space-y-4">
                <h2 className="text-lg font-semibold text-white">Œuvres liées</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {media.relations.map((rel) => (
                    <motion.div key={`${rel.relationType}-${rel.media.id}`} whileHover={{ y: -3 }}>
                      <Link
                        href={`/media/${rel.media.id}`}
                        className="group flex items-center gap-3 p-2.5 rounded-xl card-surface hover:border-white/[0.16] transition-all h-full"
                      >
                        <img
                          src={rel.media.coverImage}
                          alt={rel.media.title}
                          className="w-12 h-16 rounded-lg object-cover shrink-0 border border-white/10 group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="min-w-0">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-accent-hover">
                            {RELATION_FR[rel.relationType] ?? rel.relationType}
                          </span>
                          <p className="text-xs font-semibold text-[#F4F3EE] group-hover:text-white line-clamp-2 mt-0.5">
                            {rel.media.title}
                          </p>
                          <p className="text-[10.5px] text-[#7E8397] mt-0.5">
                            {formatFormat(rel.media.format)}
                          </p>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </RevealSection>
            )}

            {/* Recommendations */}
            {media.recommendations.length > 0 && (
              <RevealSection className="space-y-4">
                <h2 className="text-lg font-semibold text-white">
                  Si vous aimez {title}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {media.recommendations.slice(0, 8).map((rec) => (
                    <MediaCard key={rec.id} media={rec} />
                  ))}
                </div>
              </RevealSection>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
