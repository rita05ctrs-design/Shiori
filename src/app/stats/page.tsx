"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  AnimatedNumber,
  CINEMA_EASE,
} from "@/components/motion/MotionPrimitives";
import {
  Clock,
  Film,
  BookOpen,
  Star,
  Award,
  Heart,
  Sparkles,
  ExternalLink,
  BarChart3,
  Info,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { computeLibraryAnalytics } from "@/lib/stats";
import { cn } from "@/lib/utils";
import type { LibraryStatus, MediaType } from "@/types/media";

const StatsCoreCharts = dynamic(
  () => import("@/components/stats/StatsChartsPanel").then((m) => m.StatsCoreCharts),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 h-[268px] rounded-2xl card-surface animate-pulse" />
        <div className="lg:col-span-7 h-[268px] rounded-2xl card-surface animate-pulse" />
      </div>
    ),
  }
);

const StatsAdvancedCharts = dynamic(
  () => import("@/components/stats/StatsChartsPanel").then((m) => m.StatsAdvancedCharts),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 h-[290px] rounded-2xl card-surface animate-pulse" />
        <div className="lg:col-span-6 h-[290px] rounded-2xl card-surface animate-pulse" />
      </div>
    ),
  }
);

const ShioriWrappedCard = dynamic(
  () => import("@/components/stats/ShioriWrappedCard").then((m) => m.ShioriWrappedCard),
  {
    ssr: false,
    loading: () => <div className="h-72 rounded-2xl card-surface animate-pulse" />,
  }
);

const STATUS_COLORS_HEX: Record<LibraryStatus, string> = {
  WATCHING: "#38BDF8",
  COMPLETED: "#34D399",
  ON_HOLD: "#FBBF24",
  DROPPED: "#F87171",
  PLAN_TO_WATCH: "#A78BFA",
};

export default function StatsPage() {
  const { library, activity, anilistStats } = useShiori();
  const { t, tr, tStatus, tGenre, locale } = useTranslation();
  const [scope, setScope] = useState<"ALL" | MediaType>("ALL");
  const [showWrapped, setShowWrapped] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Auto-open Shiori Wrapped if user navigated via /stats#wrapped
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#wrapped") {
      setShowWrapped(true);
    }
  }, []);

  const entries = useMemo(
    () => library.filter((e) => (scope === "ALL" ? true : e.type === scope)),
    [library, scope]
  );

  const metrics = useMemo(() => {
    const analytics = computeLibraryAnalytics(entries, activity);
    const statuses: LibraryStatus[] = [
      "WATCHING",
      "COMPLETED",
      "PLAN_TO_WATCH",
      "ON_HOLD",
      "DROPPED",
    ];
    const statusData = statuses
      .map((s) => ({
        status: s,
        name: tStatus(s, scope === "MANGA" ? "MANGA" : "ANIME"),
        value: analytics.statusCounts[s] ?? 0,
        color: STATUS_COLORS_HEX[s],
      }))
      .filter((d) => d.value > 0);

    const localizedMonthlyActivity = analytics.monthlyActivity.map((m) => {
      const [yStr, mStr] = m.key.split("-");
      const dt = new Date(Number(yStr), Number(mStr) - 1, 1);
      const formatted = Number.isNaN(dt.getTime())
        ? m.label
        : new Intl.DateTimeFormat(locale, { month: "short" })
            .format(dt)
            .replace(/\.$/, "");
      return {
        ...m,
        label: formatted.charAt(0).toUpperCase() + formatted.slice(1),
      };
    });

    return {
      ...analytics,
      statusData,
      monthlyActivity: localizedMonthlyActivity,
    };
  }, [entries, activity, scope, tStatus, locale]);

  const maxGenreCount = Math.max(1, ...metrics.topGenres.map((g) => g.count));
  const hasMonthlyActivity = metrics.monthlyActivity.some((m) => m.count > 0);

  return (
    <div className="pt-[calc(5rem+env(safe-area-inset-top))] sm:pt-24 pb-24 md:pb-16 max-w-[1300px] mx-auto px-4 sm:px-6 lg:px-8 space-y-7">
      {/* Clean Header — 1 clear goal: understand your stats at a glance */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gradient-editorial">
            {t("stats.title")}
          </h1>
          <p className="text-sm text-[#8A8FA4] mt-1">
            {t("stats.subtitle")}
          </p>
        </div>

        {/* Single clean Scope Switcher */}
        <div className="inline-flex items-center p-1 rounded-full bg-white/[0.04] border border-white/[0.08] self-start sm:self-auto">
          {[
            { id: "ALL", label: tr("Global") },
            { id: "ANIME", label: tr("Animes") },
            { id: "MANGA", label: tr("Mangas") },
          ].map((tabItem) => {
            const active = scope === tabItem.id;
            return (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => setScope(tabItem.id as "ALL" | MediaType)}
                className={cn(
                  "relative px-4 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer",
                  active ? "text-white" : "text-[#9A9EAE] hover:text-white"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="stats-scope-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className="absolute inset-0 rounded-full bg-accent shadow-[0_6px_18px_rgb(var(--shiori-accent-rgb)/0.35)]"
                  />
                )}
                <span className="relative z-10">{tabItem.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TIER 1 — 4 Essential KPI Cards (immediately scannable above the fold) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="rounded-2xl card-surface p-5">
          <div className="flex items-center justify-between text-[#858A9E]">
            <span className="text-xs font-medium">{tr("Titres suivis")}</span>
            <Film className="w-4 h-4 text-accent" />
          </div>
          <p className="mt-2.5 text-3xl font-bold font-mono text-white">
            <AnimatedNumber value={metrics.totalTitles} />
          </p>
          <p className="mt-1 text-xs text-[#7A7F94]">
            {tr("{n} terminés · {pct}%", { n: metrics.completedCount, pct: metrics.completionRate })}
          </p>
        </div>

        <div className="rounded-2xl card-surface p-5">
          <div className="flex items-center justify-between text-[#858A9E]">
            <span className="text-xs font-medium">
              {scope === "MANGA" ? tr("Chapitres lus") : tr("Épisodes & Chapitres")}
            </span>
            <BookOpen className="w-4 h-4 text-violet-400" />
          </div>
          <p className="mt-2.5 text-3xl font-bold font-mono text-white">
            <AnimatedNumber
              value={scope === "MANGA" ? metrics.totalChapters : metrics.totalEpisodes}
            />
          </p>
          <p className="mt-1 text-xs text-[#7A7F94]">
            {scope === "MANGA"
              ? tr("{n} mangas lus", { n: metrics.mangaRead })
              : scope === "ANIME"
                ? tr("{watching} en cours · {completed} terminés", {
                    watching: metrics.animeWatching,
                    completed: metrics.animeCompleted,
                  })
                : tr("{n} chapitres lus", { n: metrics.totalChapters.toLocaleString(locale) })}
          </p>
        </div>

        <div className="rounded-2xl card-surface p-5">
          <div className="flex items-center justify-between text-[#858A9E]">
            <span className="text-xs font-medium">{tr("Temps estimé")}</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <p className="mt-2.5 text-3xl font-bold font-mono text-white">
            <AnimatedNumber value={metrics.totalDays} decimals={1} formatLocale={false} />
            <span className="text-base font-normal text-[#858A9E] ml-1">{tr("j")}</span>
          </p>
          <p className="mt-1 text-xs text-[#7A7F94]">
            {tr("{n} heures", { n: metrics.totalHours.toLocaleString(locale) })}
          </p>
        </div>

        <div className="rounded-2xl card-surface p-5">
          <div className="flex items-center justify-between text-[#858A9E]">
            <span className="text-xs font-medium">{tr("Note moyenne")}</span>
            <Star className="w-4 h-4 text-[#F0B95B] fill-[#F0B95B]" />
          </div>
          <p className="mt-2.5 text-3xl font-bold font-mono text-[#F0B95B]">
            {metrics.meanScore !== null ? (
              <AnimatedNumber value={metrics.meanScore} decimals={2} formatLocale={false} />
            ) : (
              "—"
            )}
          </p>
          <p className="mt-1 text-xs text-[#7A7F94]">
            {tr("Sur {n} titres notés", { n: metrics.scoredCount })}
          </p>
        </div>
      </div>

      {/* TIER 1 — 2 Core Charts (dynamically loaded to keep initial JS light) */}
      <StatsCoreCharts
        statusData={metrics.statusData}
        scoreBuckets={metrics.scoreBuckets}
      />

      {/* TIER 1 — Top Genres (Clean & Scannable) */}
      <div className="rounded-2xl card-surface p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">{tr("Genres préférés")}</h2>
          {metrics.favorites.length > 0 && (
            <Link
              href="/library?favorites=1"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B8BCCB] hover:text-white transition-colors"
            >
              <Heart className="w-3.5 h-3.5 text-rose-400 fill-current" />
              <span>{tr("Voir mes {n} favoris", { n: metrics.favorites.length })}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {metrics.topGenres.length === 0 ? (
          <p className="text-sm text-[#7D8296]">
            {tr("Ajoutez quelques œuvres à votre bibliothèque pour découvrir vos genres préférés.")}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5">
            {metrics.topGenres.slice(0, 6).map((g, i) => {
              const pct = Math.round((g.count / maxGenreCount) * 100);
              return (
                <div key={g.genre} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <Link
                      href={`/discover?genre=${encodeURIComponent(g.genre)}`}
                      className="font-medium text-[#ECEBE6] hover:text-accent-hover transition-colors flex items-center gap-2"
                    >
                      <span className="font-mono text-[10px] text-[#6E7387]">
                        0{i + 1}
                      </span>
                      <span>{tGenre(g.genre)}</span>
                    </Link>
                    <div className="flex items-center gap-2.5 font-mono text-[11px]">
                      {g.avgScore !== null && (
                        <span className="text-[#F0B95B]">★ {g.avgScore.toFixed(1)}</span>
                      )}
                      <span className="text-[#9A9EAE]">
                        {tr("{n} titres", { n: g.count })}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={{ duration: 0.65, delay: i * 0.04, ease: CINEMA_EASE }}
                      style={{ width: `${pct}%`, transformOrigin: "left center" }}
                      className="h-full rounded-full bg-gradient-to-r from-accent to-[#F0B95B]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* TIER 2 — Secondary Controls: Shiori Wrapped & Advanced Analytics (clean progressive disclosure) */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        {library.length > 0 && (
          <button
            type="button"
            onClick={() => setShowWrapped((v) => !v)}
            className={cn(
              "inline-flex items-center gap-2 h-10 px-4 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
              showWrapped
                ? "bg-accent/20 border-accent/50 text-white"
                : "bg-surface border-white/[0.09] text-[#D6D9E6] hover:text-white hover:border-white/[0.18]"
            )}
          >
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>
              {showWrapped
                ? tr("Masquer Shiori Wrapped")
                : tr("Voir ma rétrospective (Shiori Wrapped)")}
            </span>
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showWrapped && "rotate-180")} />
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className={cn(
            "inline-flex items-center gap-2 h-10 px-4 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
            showAdvanced
              ? "bg-white/[0.12] border-white/[0.22] text-white"
              : "bg-surface border-white/[0.09] text-[#D6D9E6] hover:text-white hover:border-white/[0.18]"
          )}
        >
          <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
          <span>
            {showAdvanced
              ? tr("Masquer les statistiques avancées")
              : tr("Statistiques avancées")}
          </span>
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showAdvanced && "rotate-180")} />
        </button>
      </div>

      {/* Collapsible Shiori Wrapped */}
      <AnimatePresence initial={false}>
        {showWrapped && (
          <motion.div
            id="wrapped"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            <ShioriWrappedCard />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsible Advanced Statistics (Annual Evolution, Monthly Activity, Studios, AniList Snapshot) */}
      <AnimatePresence initial={false}>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className="space-y-6"
          >
            {/* Detailed Breakdown & Duration Note */}
            <div className="rounded-2xl card-surface p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">{tr("Détail par statut")}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[11px] text-[#858A9E]">{tr("Animes commencés")}</p>
                  <p className="text-lg font-bold font-mono text-white mt-0.5">{metrics.animeStarted}</p>
                </div>
                <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[11px] text-[#858A9E]">{tr("Animes en cours")}</p>
                  <p className="text-lg font-bold font-mono text-sky-300 mt-0.5">{metrics.animeWatching}</p>
                </div>
                <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[11px] text-[#858A9E]">{tr("Animes terminés")}</p>
                  <p className="text-lg font-bold font-mono text-emerald-300 mt-0.5">{metrics.animeCompleted}</p>
                </div>
                <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[11px] text-[#858A9E]">{tStatus("ON_HOLD", "ANIME")}</p>
                  <p className="text-lg font-bold font-mono text-amber-300 mt-0.5">{metrics.animeOnHold}</p>
                </div>
                <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[11px] text-[#858A9E]">{tr("Abandonnés")}</p>
                  <p className="text-lg font-bold font-mono text-rose-300 mt-0.5">{metrics.animeDropped}</p>
                </div>
                <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[11px] text-[#858A9E]">{tr("Mangas lus")}</p>
                  <p className="text-lg font-bold font-mono text-violet-300 mt-0.5">{metrics.mangaRead}</p>
                </div>
              </div>

              {metrics.unknownDurationCount > 0 && (
                <p className="text-[11.5px] text-[#8A8FA4] flex items-center gap-1.5 pt-1">
                  <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>
                    {tr("Durée estimée à 24 min/épisode pour {n} animés sans durée renseignée.", {
                      n: metrics.unknownDurationCount,
                    })}
                  </span>
                </p>
              )}
            </div>

            {/* Annual Evolution + Monthly Activity */}
            <StatsAdvancedCharts
              yearEvolution={metrics.yearEvolution}
              monthlyActivity={metrics.monthlyActivity}
              hasMonthlyActivity={hasMonthlyActivity}
            />

            {/* Top Studios */}
            {metrics.topStudios.length > 0 && (
              <div className="rounded-2xl card-surface p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#F0B95B]" />
                    <span>{tr("Studios & Auteurs les plus suivis")}</span>
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {metrics.topStudios.map((s) => (
                    <div
                      key={s.name}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#F4F3EE] truncate">{s.name}</p>
                        <p className="text-[11px] text-[#7D8296] font-mono mt-0.5">
                          {tr("{n} œuvres", { n: s.count })}
                        </p>
                      </div>
                      {s.avgScore !== null && (
                        <span className="font-mono text-xs text-[#F0B95B] shrink-0">
                          ★ {s.avgScore.toFixed(1)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Imported AniList Summary (cleanly placed in Advanced Analytics with clear label) */}
            {anilistStats && (
              <div className="rounded-2xl card-surface border-sky-500/20 p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {anilistStats.anilistAvatarUrl && (
                      <img
                        src={anilistStats.anilistAvatarUrl}
                        alt={anilistStats.anilistUsername}
                        className="w-9 h-9 rounded-full object-cover border border-sky-400/35 shrink-0"
                      />
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {tr("Résumé importé depuis AniList (@{user})", {
                          user: anilistStats.anilistUsername,
                        })}
                      </h3>
                      <p className="text-xs text-[#858A9E]">
                        {tr("Chiffres globaux issus de votre dernier import AniList (peut inclure des révisions).")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {anilistStats.anilistSiteUrl && (
                      <a
                        href={anilistStats.anilistSiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
                      >
                        <span>{tr("Voir sur AniList")}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <Link
                      href="/settings#anilist-import"
                      className="px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#D6D9E6] hover:text-white transition-colors"
                    >
                      {tr("Actualiser")}
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-[11px] text-[#858A9E]">{tr("Animes AniList")}</p>
                    <p className="text-lg font-bold font-mono text-white mt-0.5">
                      {anilistStats.anime.count.toLocaleString(locale)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-[11px] text-[#858A9E]">{tr("Épisodes (AniList)")}</p>
                    <p className="text-lg font-bold font-mono text-sky-300 mt-0.5">
                      {anilistStats.anime.episodesWatched.toLocaleString(locale)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-[11px] text-[#858A9E]">{tr("Mangas AniList")}</p>
                    <p className="text-lg font-bold font-mono text-white mt-0.5">
                      {anilistStats.manga.count.toLocaleString(locale)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-[11px] text-[#858A9E]">{tr("Chapitres (AniList)")}</p>
                    <p className="text-lg font-bold font-mono text-violet-300 mt-0.5">
                      {anilistStats.manga.chaptersRead.toLocaleString(locale)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
