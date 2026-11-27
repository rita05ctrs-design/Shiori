"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Play,
  Plus,
  BookOpen,
  Tv,
  SlidersHorizontal,
  ArrowRight,
  Star,
  Radio,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import {
  computeLiveAiringMetrics,
  formatShortAiringCountdown,
  useWatchingAiring,
} from "@/hooks/useWatchingAiring";
import { getProgressPercent } from "@/lib/library-utils";
import { cn } from "@/lib/utils";

interface ContinueWatchingSectionProps {
  /** Compact embedded mode when rendered at the top of `/library` */
  embeddedInLibrary?: boolean;
}

export function ContinueWatchingSection({
  embeddedInLibrary = false,
}: ContinueWatchingSectionProps) {
  const { library, hydrated, incrementProgress, openQuickEdit } = useShiori();
  const { t, tr, tFormat } = useTranslation();
  const { airingMap } = useWatchingAiring(library);

  const [typeFilter, setTypeFilter] = useState<"ALL" | "ANIME" | "MANGA">("ALL");
  const [expanded, setExpanded] = useState(false);

  const allWatching = useMemo(() => {
    const active = library.filter((e) => e.status === "WATCHING");
    return [...active].sort((a, b) => {
      const airA = computeLiveAiringMetrics(a, airingMap.get(a.mediaId));
      const airB = computeLiveAiringMetrics(b, airingMap.get(b.mediaId));
      const behindA = airA?.behindCount ?? 0;
      const behindB = airB?.behindCount ?? 0;
      // Prioritize airing shows with new unwatched episodes at the very front, then most recently updated
      if (behindA > 0 && behindB === 0) return -1;
      if (behindB > 0 && behindA === 0) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [library, airingMap]);

  const animeCount = useMemo(
    () => allWatching.filter((e) => e.type === "ANIME").length,
    [allWatching]
  );
  const mangaCount = useMemo(
    () => allWatching.filter((e) => e.type === "MANGA").length,
    [allWatching]
  );

  const totalUnwatchedAired = useMemo(() => {
    let sum = 0;
    for (const e of allWatching) {
      const m = computeLiveAiringMetrics(e, airingMap.get(e.mediaId));
      if (m && m.behindCount > 0) sum += m.behindCount;
    }
    return sum;
  }, [allWatching, airingMap]);

  const filteredWatching = useMemo(() => {
    if (typeFilter === "ALL") return allWatching;
    return allWatching.filter((e) => e.type === typeFilter);
  }, [allWatching, typeFilter]);

  const defaultVisibleLimit = embeddedInLibrary ? 6 : 6;
  const displayedItems = expanded
    ? filteredWatching
    : filteredWatching.slice(0, defaultVisibleLimit);
  const hasMore = filteredWatching.length > defaultVisibleLimit;

  if (!hydrated || allWatching.length === 0) return null;

  return (
    <section
      className={cn(
        "relative overflow-hidden",
        embeddedInLibrary
          ? "rounded-3xl bg-gradient-to-br from-[#121522]/96 via-[#0C0E16]/98 to-[#080A11] border border-white/[0.09] p-4 sm:p-6 shadow-[0_24px_70px_-28px_rgba(0,0,0,0.88)]"
          : "space-y-4"
      )}
    >
      {/* Subtle editorial cinema lighting */}
      {embeddedInLibrary && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F0B95B]/40 to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 rounded-full bg-accent/[0.09] blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -right-12 w-72 h-72 rounded-full bg-[#F0B95B]/[0.06] blur-3xl"
          />
        </>
      )}

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-accent/25 via-accent/15 to-[#F0B95B]/15 border border-accent/40 flex items-center justify-center text-accent-soft shadow-[0_8px_24px_-8px_rgba(229,72,77,0.65)] shrink-0">
            <Play className="w-4 h-4 fill-current translate-x-[0.5px]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-[#F6F5F0]">
                {t("library.resumeTitle")}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-white/[0.07] border border-white/[0.1] font-mono text-[11px] font-semibold text-[#C8CCE0]">
                {allWatching.length}
              </span>
              {totalUnwatchedAired > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-accent/20 to-[#F0B95B]/20 border border-[#F0B95B]/45 text-[11px] font-semibold text-[#FDE68A]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F0B95B] animate-pulse" />
                  <span>
                    {tr("+{n} ép. sortis à rattraper", { n: totalUnwatchedAired })}
                  </span>
                </span>
              )}
            </div>
            <p className="text-xs text-[#8A8FA4] mt-0.5">
              {tr("Vos séries en cours avec leur épisode diffusé en direct")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {animeCount > 0 && mangaCount > 0 && (
            <div className="inline-flex items-center p-0.5 rounded-full bg-black/40 border border-white/[0.08]">
              {(
                [
                  { id: "ALL", label: t("common.all") },
                  { id: "ANIME", label: t("common.anime") },
                  { id: "MANGA", label: t("common.manga") },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTypeFilter(opt.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer",
                    typeFilter === opt.id
                      ? "bg-white/[0.14] text-white"
                      : "text-[#8A8FA4] hover:text-white"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {!embeddedInLibrary && (
            <Link
              href="/library?status=WATCHING"
              className="text-xs font-semibold text-[#B4B8C8] hover:text-white inline-flex items-center gap-1 transition-colors px-2.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08]"
            >
              <span>{t("footer.myLibrary")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Cinema Poster Cards Grid (Horizontal snap rail on narrow mobile, refined 2/3-col cinema cards on tablet/desktop) */}
      <div className="relative z-10 flex gap-3.5 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1 sm:grid sm:grid-cols-2 xl:grid-cols-3 sm:overflow-visible sm:pb-0">
        {displayedItems.map((entry) => {
          const isManga = entry.type === "MANGA";
          const unitShort = isManga ? t("common.chShort") : t("common.epShort");
          const airing = airingMap.get(entry.mediaId);
          const live = computeLiveAiringMetrics(entry, airing);

          const totalKnown = live?.totalKnown ?? entry.totalUnits ?? null;
          const exactPct = live
            ? live.watchedPct
            : getProgressPercent(entry);
          const watchedBarPct =
            exactPct ?? Math.min(82, Math.max(8, entry.progress * 4));
          const airedBarPct = live?.airedPct ?? null;
          const nextCountdown = formatShortAiringCountdown(live?.timeUntilNextSec);

          const atCap = Boolean(totalKnown && entry.progress >= totalKnown);
          const nextUnitNumber = entry.progress + 1;

          return (
            <motion.div
              key={entry.mediaId}
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="group relative snap-start shrink-0 w-[300px] sm:w-auto rounded-2xl overflow-hidden bg-[#0E111B]/95 border border-white/[0.085] hover:border-white/[0.2] shadow-[0_14px_34px_-16px_rgba(0,0,0,0.85)] transition-[border-color,box-shadow] flex flex-col justify-between"
            >
              {/* Soft blurred ambient backdrop from series art */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden"
              >
                <img
                  src={entry.bannerImage || entry.coverImage}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover opacity-[0.18] blur-xl scale-125 group-hover:opacity-[0.26] transition-opacity duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0B0D15]/95 via-[#0B0D15]/88 to-[#0B0D15]/96" />
              </div>

              {/* Main Horizontal Cinema Content */}
              <div className="relative z-10 p-3.5 flex gap-3.5 items-stretch">
                {/* Crisp 2:3 Poster Cover */}
                <Link
                  href={`/media/${entry.mediaId}`}
                  className="relative shrink-0 w-[76px] h-[112px] sm:w-[82px] sm:h-[120px] rounded-xl overflow-hidden border border-white/[0.15] shadow-[0_12px_26px_rgba(0,0,0,0.65)] bg-[#141724]"
                >
                  <img
                    src={entry.coverImage}
                    alt={entry.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-500 ease-out"
                  />
                  {entry.score !== null && (
                    <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/82 backdrop-blur-sm border border-[#F0B95B]/40 font-mono text-[10px] font-bold text-[#F0B95B]">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      {entry.score.toFixed(1)}
                    </span>
                  )}
                </Link>

                {/* Right Info & Telemetry Column */}
                <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                  {/* Top Status Pill: Live Aired Episode vs Caught Up vs Format */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      {live && live.behindCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-accent/24 to-[#F0B95B]/22 border border-[#F0B95B]/50 text-[10.5px] font-semibold text-[#FDE68A] truncate">
                          <Radio className="w-2.5 h-2.5 text-[#F0B95B] shrink-0 animate-pulse" />
                          <span className="truncate">
                            {tr("Ép. {aired} sorti · +{behind}", {
                              aired: live.latestAiredEpisode,
                              behind: live.behindCount,
                            })}
                          </span>
                        </span>
                      ) : live && live.isCaughtUp ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-[10.5px] font-semibold text-emerald-300 truncate">
                          <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">
                            {tr("À jour · Ép. {aired}", {
                              aired: live.latestAiredEpisode,
                            })}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-mono uppercase tracking-wider text-[#8C91A6]">
                          {isManga ? (
                            <BookOpen className="w-3 h-3 text-violet-400 shrink-0" />
                          ) : (
                            <Tv className="w-3 h-3 text-sky-400 shrink-0" />
                          )}
                          <span>{entry.format ? tFormat(entry.format) : entry.type}</span>
                        </span>
                      )}

                      {nextCountdown && live?.nextEpisode && (
                        <span
                          title={tr("Prochain épisode")}
                          className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-[#8A8FA4] shrink-0"
                        >
                          <Clock className="w-2.5 h-2.5 text-[#F0B95B]/80" />
                          <span>
                            {unitShort} {live.nextEpisode} · {nextCountdown}
                          </span>
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/media/${entry.mediaId}`}
                      className="block text-[13.5px] sm:text-sm font-bold text-[#F6F5F0] hover:text-accent-soft transition-colors line-clamp-2 leading-snug"
                    >
                      {entry.title}
                    </Link>
                  </div>

                  {/* Dual-Layer Progress Bar + Episode Telemetry */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11.5px] font-mono">
                      <span className="text-[#C5C9D8] truncate">
                        {unitShort}{" "}
                        <strong className="text-white font-bold">{entry.progress}</strong>
                        {totalKnown ? (
                          <span className="text-[#7E8398]"> / {totalKnown}</span>
                        ) : live && live.latestAiredEpisode > 0 ? (
                          <span className="text-[#F0B95B]/90">
                            {" "}
                            / {live.latestAiredEpisode} {tr("sortis")}
                          </span>
                        ) : (
                          <span className="text-[#7E8398]"> / ?</span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "text-[10.5px] font-semibold shrink-0",
                          live && live.behindCount > 0
                            ? "text-[#F0B95B]"
                            : "text-[#8A8FA4]"
                        )}
                      >
                        {live && live.behindCount > 0
                          ? tr("{n} à voir", { n: live.behindCount })
                          : exactPct !== null
                            ? `${exactPct}%`
                            : t("home.inProgress")}
                      </span>
                    </div>

                    {/* Dual Progress Bar: Subtle Gold Aired Track + Crimson-Gold Watched Track */}
                    <div
                      className="relative h-2 rounded-full bg-white/[0.08] overflow-hidden"
                      title={
                        live && live.latestAiredEpisode > 0
                          ? tr("Vu {watched} · Diffusé jusqu'à l'ép. {aired}", {
                              watched: entry.progress,
                              aired: live.latestAiredEpisode,
                            })
                          : undefined
                      }
                    >
                      {airedBarPct !== null && airedBarPct > watchedBarPct && (
                        <div
                          style={{ width: `${airedBarPct}%` }}
                          className="absolute inset-y-0 left-0 rounded-full bg-[#F0B95B]/35 transition-all duration-300"
                        />
                      )}
                      <div
                        style={{ width: `${watchedBarPct}%` }}
                        className="relative z-10 h-full rounded-full bg-gradient-to-r from-accent via-accent-hover to-[#F0B95B] shadow-[0_0_12px_rgba(229,72,77,0.45)] transition-all duration-300"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Clean Footer Action Bar */}
              <div className="relative z-10 px-3.5 pb-3 pt-0.5 flex items-center gap-2">
                <button
                  type="button"
                  disabled={atCap}
                  onClick={() => incrementProgress(entry.mediaId, 1)}
                  className={cn(
                    "flex-1 h-9 px-3 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-40",
                    live && live.behindCount > 0
                      ? "bg-gradient-to-r from-accent to-accent-deep hover:brightness-110 text-accent-fg shadow-[0_8px_22px_-8px_rgba(229,72,77,0.75)]"
                      : "bg-white/[0.08] hover:bg-accent border border-white/[0.1] hover:border-accent text-white hover:text-accent-fg"
                  )}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {atCap
                      ? tr("Terminé")
                      : `+1 · ${unitShort} ${nextUnitNumber}`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openQuickEdit(entry)}
                  aria-label={tr("Éditer & collections")}
                  title={tr("Éditer & collections")}
                  className="w-9 h-9 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.09] flex items-center justify-center text-[#B2B6C6] hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Expand / Collapse Toggle when > 6 watching items */}
      {hasMore && (
        <div className="relative z-10 flex justify-center pt-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.11] border border-white/[0.1] text-xs font-semibold text-[#C8CCE0] hover:text-white transition-colors cursor-pointer"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>{tr("Réduire")}</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>
                  {tr("Voir tout ({n})", { n: filteredWatching.length })}
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
