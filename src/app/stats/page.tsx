"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AnimatedNumber,
  CINEMA_EASE,
  RevealSection,
} from "@/components/motion/MotionPrimitives";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Clock,
  Film,
  BookOpen,
  Star,
  Award,
  Heart,
  Activity,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { cn, formatRelativeTime, STATUS_CONFIG } from "@/lib/utils";
import type { LibraryStatus, MediaType } from "@/types/media";

const STATUS_COLORS_HEX: Record<LibraryStatus, string> = {
  WATCHING: "#38BDF8",
  COMPLETED: "#34D399",
  ON_HOLD: "#FBBF24",
  DROPPED: "#F87171",
  PLAN_TO_WATCH: "#A78BFA",
};

export default function StatsPage() {
  const { library, activity, profile } = useShiori();
  const [scope, setScope] = useState<"ALL" | MediaType>("ALL");

  const entries = useMemo(
    () =>
      library.filter((e) => (scope === "ALL" ? true : e.type === scope)),
    [library, scope]
  );

  const metrics = useMemo(() => {
    const animeEntries = entries.filter((e) => e.type === "ANIME");
    const mangaEntries = entries.filter((e) => e.type === "MANGA");

    const totalEpisodes = animeEntries.reduce((sum, e) => sum + e.progress, 0);
    const totalMinutes = animeEntries.reduce(
      (sum, e) => sum + e.progress * (e.duration ?? 24),
      0
    );
    const totalHours = Math.round(totalMinutes / 60);
    const totalDays = (totalMinutes / 60 / 24).toFixed(1);

    const totalChapters = mangaEntries.reduce((sum, e) => sum + e.progress, 0);

    const scored = entries.filter((e) => e.score !== null);
    const meanScore = scored.length
      ? scored.reduce((sum, e) => sum + (e.score ?? 0), 0) / scored.length
      : null;

    const completed = entries.filter((e) => e.status === "COMPLETED").length;
    const activeBase = entries.filter((e) => e.status !== "PLAN_TO_WATCH").length;
    const completionRate = activeBase ? Math.round((completed / activeBase) * 100) : 0;

    // Score distribution 1..10
    const scoreBuckets = Array.from({ length: 10 }, (_, idx) => ({
      bucket: String(idx + 1),
      count: 0,
    }));
    for (const e of scored) {
      const rounded = Math.min(10, Math.max(1, Math.round(e.score ?? 0)));
      scoreBuckets[rounded - 1].count += 1;
    }

    // Status breakdown
    const statuses: LibraryStatus[] = [
      "WATCHING",
      "COMPLETED",
      "ON_HOLD",
      "PLAN_TO_WATCH",
      "DROPPED",
    ];
    const statusData = statuses
      .map((s) => ({
        status: s,
        name: STATUS_CONFIG[s].label,
        value: entries.filter((e) => e.status === s).length,
        color: STATUS_COLORS_HEX[s],
      }))
      .filter((d) => d.value > 0);

    // Genre affinity
    const genreMap = new Map<string, { count: number; scoreSum: number; scoredCount: number }>();
    for (const e of entries) {
      for (const g of e.genres) {
        const cur = genreMap.get(g) ?? { count: 0, scoreSum: 0, scoredCount: 0 };
        cur.count += 1;
        if (e.score !== null) {
          cur.scoreSum += e.score;
          cur.scoredCount += 1;
        }
        genreMap.set(g, cur);
      }
    }
    const topGenres = Array.from(genreMap.entries())
      .map(([genre, info]) => ({
        genre,
        count: info.count,
        avgScore: info.scoredCount ? info.scoreSum / info.scoredCount : null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Top Studios / Creators
    const studioMap = new Map<string, { count: number; scoreSum: number; scoredCount: number }>();
    for (const e of entries) {
      if (!e.studio) continue;
      const cur = studioMap.get(e.studio) ?? { count: 0, scoreSum: 0, scoredCount: 0 };
      cur.count += 1;
      if (e.score !== null) {
        cur.scoreSum += e.score;
        cur.scoredCount += 1;
      }
      studioMap.set(e.studio, cur);
    }
    const topStudios = Array.from(studioMap.entries())
      .map(([name, info]) => ({
        name,
        count: info.count,
        avgScore: info.scoredCount ? info.scoreSum / info.scoredCount : null,
      }))
      .sort((a, b) => b.count - a.count || (b.avgScore ?? 0) - (a.avgScore ?? 0))
      .slice(0, 6);

    const favorites = entries.filter((e) => e.isFavorite);

    return {
      totalTitles: entries.length,
      totalEpisodes,
      totalHours,
      totalDays,
      totalChapters,
      meanScore,
      scoredCount: scored.length,
      completionRate,
      completed,
      scoreBuckets,
      statusData,
      topGenres,
      topStudios,
      favorites,
    };
  }, [entries]);

  const maxGenreCount = Math.max(1, ...metrics.topGenres.map((g) => g.count));

  return (
    <div className="pt-24 pb-16 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-9">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#E5484D] mb-1.5 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Analytique · {profile.displayName}</span>
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gradient-editorial">
            Statistiques & Profil
          </h1>
          <p className="text-sm text-[#8A8FA4] mt-1.5">
            Calculées en temps réel à partir de votre bibliothèque Shiori.
          </p>
        </div>

        {/* Scope switcher */}
        <div className="inline-flex items-center p-1 rounded-full bg-white/[0.04] border border-white/[0.08] self-start md:self-auto">
          {[
            { id: "ALL", label: "Global" },
            { id: "ANIME", label: "Animes" },
            { id: "MANGA", label: "Mangas" },
          ].map((t) => {
            const active = scope === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setScope(t.id as "ALL" | MediaType)}
                className={cn(
                  "relative px-4 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer",
                  active ? "text-white" : "text-[#9A9EAE] hover:text-white"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="stats-scope-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className="absolute inset-0 rounded-full bg-[#E5484D] shadow-[0_6px_18px_rgba(229,72,77,0.35)]"
                  />
                )}
                <span className="relative z-10">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.02, ease: CINEMA_EASE }}
          whileHover={{ y: -4 }}
          className="rounded-2xl card-surface hover:border-white/[0.15] p-5 transition-colors"
        >
          <div className="flex items-center justify-between text-[#858A9E]">
            <span className="text-xs font-medium">Titres suivis</span>
            <Film className="w-4 h-4 text-[#E5484D]" />
          </div>
          <p className="mt-3 text-3xl font-bold font-mono text-white">
            <AnimatedNumber value={metrics.totalTitles} />
          </p>
          <p className="mt-1 text-[11px] text-[#7A7F94]">
            {metrics.completed} terminés · {metrics.completionRate}% complétion
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.07, ease: CINEMA_EASE }}
          whileHover={{ y: -4 }}
          className="rounded-2xl card-surface hover:border-white/[0.15] p-5 transition-colors"
        >
          <div className="flex items-center justify-between text-[#858A9E]">
            <span className="text-xs font-medium">Temps de visionnage</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <p className="mt-3 text-3xl font-bold font-mono text-white">
            <AnimatedNumber value={Number(metrics.totalDays)} decimals={1} formatLocale={false} />
            <span className="text-base font-normal text-[#858A9E] ml-1">j</span>
          </p>
          <p className="mt-1 text-[11px] text-[#7A7F94] font-mono">
            {metrics.totalHours.toLocaleString("fr-FR")} h · {metrics.totalEpisodes} ép.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.12, ease: CINEMA_EASE }}
          whileHover={{ y: -4 }}
          className="rounded-2xl card-surface hover:border-white/[0.15] p-5 transition-colors"
        >
          <div className="flex items-center justify-between text-[#858A9E]">
            <span className="text-xs font-medium">Chapitres lus</span>
            <BookOpen className="w-4 h-4 text-violet-400" />
          </div>
          <p className="mt-3 text-3xl font-bold font-mono text-white">
            <AnimatedNumber value={metrics.totalChapters} />
          </p>
          <p className="mt-1 text-[11px] text-[#7A7F94]">
            Collection manga & romans
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.17, ease: CINEMA_EASE }}
          whileHover={{ y: -4 }}
          className="rounded-2xl card-surface hover:border-white/[0.15] p-5 transition-colors"
        >
          <div className="flex items-center justify-between text-[#858A9E]">
            <span className="text-xs font-medium">Note moyenne</span>
            <Star className="w-4 h-4 text-[#F0B95B] fill-[#F0B95B]" />
          </div>
          <p className="mt-3 text-3xl font-bold font-mono text-[#F0B95B]">
            {metrics.meanScore !== null ? (
              <AnimatedNumber value={metrics.meanScore} decimals={2} formatLocale={false} />
            ) : (
              "—"
            )}
          </p>
          <p className="mt-1 text-[11px] text-[#7A7F94]">
            Sur {metrics.scoredCount} œuvre{metrics.scoredCount > 1 ? "s" : ""} notée
            {metrics.scoredCount > 1 ? "s" : ""}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.22, ease: CINEMA_EASE }}
          whileHover={{ y: -4 }}
          className="rounded-2xl card-surface hover:border-white/[0.15] p-5 col-span-2 lg:col-span-1 transition-colors"
        >
          <div className="flex items-center justify-between text-[#858A9E]">
            <span className="text-xs font-medium">Coups de cœur</span>
            <Heart className="w-4 h-4 text-[#F45B62] fill-[#F45B62]" />
          </div>
          <p className="mt-3 text-3xl font-bold font-mono text-white">
            <AnimatedNumber value={metrics.favorites.length} />
          </p>
          <p className="mt-1 text-[11px] text-[#7A7F94]">
            Sélection personnelle
          </p>
        </motion.div>
      </div>

      {/* Charts Row: Score Distribution + Status Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Score Distribution */}
        <div className="lg:col-span-7 rounded-2xl card-surface p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#E5484D]">
                Évaluations
              </p>
              <h2 className="text-lg font-semibold text-white mt-0.5">
                Distribution de vos notes
              </h2>
            </div>
            <span className="text-xs font-mono text-[#858A9E]">Échelle 1 → 10</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics.scoreBuckets}
                margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
              >
                <XAxis
                  dataKey="bucket"
                  stroke="#656A7E"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#656A7E"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  contentStyle={{
                    backgroundColor: "#11131D",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    color: "#F4F3EE",
                  }}
                  formatter={(value: number) => [`${value} titre(s)`, "Notes"]}
                  labelFormatter={(label) => `Note ${label} / 10`}
                />
                <Bar
                  dataKey="count"
                  radius={[8, 8, 2, 2]}
                  fill="#E5484D"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Donut */}
        <div className="lg:col-span-5 rounded-2xl card-surface p-6 flex flex-col">
          <div className="mb-4">
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#E5484D]">
              Organisation
            </p>
            <h2 className="text-lg font-semibold text-white mt-0.5">
              Répartition par statut
            </h2>
          </div>

          {metrics.statusData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-[#7D8296]">
              Aucune donnée à afficher.
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.statusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {metrics.statusData.map((item) => (
                        <Cell key={item.status} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#11131D",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: "12px",
                        fontSize: "12px",
                        color: "#F4F3EE",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2.5">
                {metrics.statusData.map((d) => (
                  <div
                    key={d.status}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="text-[#D2D5E2]">{d.name}</span>
                    </div>
                    <span className="font-mono font-semibold text-white">
                      {d.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Genres Affinity + Top Studios + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Genre Affinity */}
        <div className="lg:col-span-6 rounded-2xl card-surface p-6 space-y-5">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#E5484D]">
              ADN Spectateur
            </p>
            <h2 className="text-lg font-semibold text-white mt-0.5">
              Genres de prédilection
            </h2>
          </div>

          {metrics.topGenres.length === 0 ? (
            <p className="text-sm text-[#7D8296]">Ajoutez des œuvres pour analyser vos genres favoris.</p>
          ) : (
            <div className="space-y-3.5">
              {metrics.topGenres.map((g, i) => {
                const pct = Math.round((g.count / maxGenreCount) * 100);
                return (
                  <div key={g.genre} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <Link
                        href={`/discover?genre=${encodeURIComponent(g.genre)}`}
                        className="font-medium text-[#ECEBE6] hover:text-[#F45B62] transition-colors flex items-center gap-2"
                      >
                        <span className="font-mono text-[10px] text-[#6E7387]">
                          0{i + 1}
                        </span>
                        <span>{g.genre}</span>
                      </Link>
                      <div className="flex items-center gap-3 font-mono text-[11px]">
                        {g.avgScore !== null && (
                          <span className="text-[#F0B95B]">
                            ★ {g.avgScore.toFixed(1)}
                          </span>
                        )}
                        <span className="text-[#9A9EAE]">
                          {g.count} titre{g.count > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true, amount: 0.4 }}
                        transition={{
                          duration: 0.75,
                          delay: i * 0.055,
                          ease: CINEMA_EASE,
                        }}
                        style={{ width: `${pct}%`, transformOrigin: "left center" }}
                        className="h-full rounded-full bg-gradient-to-r from-[#E5484D] to-[#F0B95B]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Studios & Recent Activity */}
        <div className="lg:col-span-6 space-y-6">
          {/* Top Studios */}
          <div className="rounded-2xl card-surface p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#F0B95B]">
                  Signatures
                </p>
                <h2 className="text-lg font-semibold text-white mt-0.5">
                  Studios & Auteurs les plus suivis
                </h2>
              </div>
              <Award className="w-5 h-5 text-[#F0B95B]" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {metrics.topStudios.map((s) => (
                <div
                  key={s.name}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#F4F3EE] truncate">
                      {s.name}
                    </p>
                    <p className="text-[11px] text-[#7D8296] font-mono mt-0.5">
                      {s.count} œuvre{s.count > 1 ? "s" : ""}
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

          {/* Recent Activity Log */}
          <div className="rounded-2xl card-surface p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#E5484D]" />
                <span>Activité récente</span>
              </h2>
              <span className="text-[11px] font-mono text-[#7D8296]">Temps réel</span>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {activity.slice(0, 8).map((ev) => (
                <Link
                  key={ev.id}
                  href={`/media/${ev.mediaId}`}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.04] transition-colors"
                >
                  <img
                    src={ev.coverImage}
                    alt={ev.mediaTitle}
                    className="w-9 h-12 rounded-lg object-cover shrink-0 border border-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#F4F3EE] truncate">
                      {ev.mediaTitle}
                    </p>
                    <p className="text-[11.5px] text-[#9A9EAE] truncate mt-0.5">
                      {ev.action}
                    </p>
                  </div>
                  <span className="text-[10.5px] font-mono text-[#6E7387] shrink-0">
                    {formatRelativeTime(ev.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Favorites Showcase */}
      {metrics.favorites.length > 0 && (
        <RevealSection className="rounded-2xl card-surface p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#F45B62] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Panthéon personnel
              </p>
              <h2 className="text-lg font-semibold text-white mt-0.5">
                Vos coups de cœur
              </h2>
            </div>
            <Link
              href="/library"
              className="text-xs text-[#9A9EAE] hover:text-white transition-colors"
            >
              Gérer dans ma bibliothèque →
            </Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3.5">
            {metrics.favorites.map((fav) => (
              <Link
                key={fav.mediaId}
                href={`/media/${fav.mediaId}`}
                className="group space-y-1.5"
              >
                <div className="aspect-[2/3] rounded-xl overflow-hidden border border-white/10 group-hover:border-[#E5484D]/60 transition-all relative">
                  <img
                    src={fav.coverImage}
                    alt={fav.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {fav.score && (
                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/75 font-mono text-[10px] text-[#F0B95B]">
                      ★ {fav.score.toFixed(1)}
                    </span>
                  )}
                </div>
                <p className="text-[11.5px] font-medium text-[#DCDFE9] group-hover:text-white truncate">
                  {fav.title}
                </p>
              </Link>
            ))}
          </div>
        </RevealSection>
      )}
    </div>
  );
}
