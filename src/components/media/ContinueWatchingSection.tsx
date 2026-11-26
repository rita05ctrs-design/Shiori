"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, SlidersHorizontal, ArrowRight, BookOpen, Tv } from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { CINEMA_EASE, RevealSection } from "@/components/motion/MotionPrimitives";

interface ContinueWatchingSectionProps {
  embeddedInLibrary?: boolean;
}

export function ContinueWatchingSection({
  embeddedInLibrary = false,
}: ContinueWatchingSectionProps) {
  const { library, incrementProgress, openQuickEdit, setCommandOpen } = useShiori();
  const { t } = useTranslation();
  const [pulseMap, setPulseMap] = useState<Record<number, number>>({});
  const [mediaFilter, setMediaFilter] = useState<"ALL" | "ANIME" | "MANGA">("ALL");

  const allWatching = library
    .filter((e) => e.status === "WATCHING")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const watching =
    mediaFilter === "ALL"
      ? allWatching
      : allWatching.filter((e) => e.type === mediaFilter);
  const watchingAnimeCount = allWatching.filter((e) => e.type === "ANIME").length;
  const watchingMangaCount = allWatching.filter((e) => e.type === "MANGA").length;

  const handleIncrement = (mediaId: number) => {
    incrementProgress(mediaId, 1);
    setPulseMap((prev) => ({ ...prev, [mediaId]: Date.now() }));
  };

  if (embeddedInLibrary && allWatching.length === 0) {
    return null;
  }

  return (
    <RevealSection
      className={
        embeddedInLibrary
          ? "rounded-2xl card-surface border border-white/[0.09] p-4 sm:p-5 space-y-4"
          : "space-y-4"
      }
    >
      {/* Clean Header with Media Filter + Direct "+ Ajouter" & optional Library Link */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-[#F4F3EE]">
            {t("library.resumeTitle")}
          </h2>
          <p className="text-xs text-[#8A8FA4] mt-0.5">
            {t("library.resumeSub")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick All / Animes / Mangas switch */}
          {allWatching.length > 0 && (
            <div className="inline-flex items-center p-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px]">
              {(
                [
                  { id: "ALL", label: `${t("common.all")} (${allWatching.length})` },
                  { id: "ANIME", label: `${t("common.anime")} (${watchingAnimeCount})` },
                  { id: "MANGA", label: `${t("common.manga")} (${watchingMangaCount})` },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMediaFilter(opt.id)}
                  className={`px-2.5 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
                    mediaFilter === opt.id
                      ? "bg-accent text-accent-fg"
                      : "text-[#9A9EAE] hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {!embeddedInLibrary && (
            <>
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t("common.add")}</span>
              </button>

              <Link
                href="/library?status=WATCHING"
                className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.09] text-xs font-medium text-white transition-colors"
              >
                <span>{t("nav.library")}</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Active Cards */}
      {watching.length === 0 ? (
        <div className="rounded-2xl card-surface p-8 text-center">
          <p className="text-sm text-[#B7BBC9]">
            {t("library.emptySub")}
          </p>
          <Link
            href="/discover"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover transition-colors"
          >
            {t("library.exploreCatalog")}
          </Link>
        </div>
      ) : (
        <div
          className={
            embeddedInLibrary
              ? "flex gap-3 overflow-x-auto touch-rail no-scrollbar snap-x snap-proximity pb-1 -mx-1 px-1 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-4 sm:overflow-visible sm:mx-0 sm:px-0 sm:pb-0"
              : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          }
        >
          {watching.slice(0, embeddedInLibrary ? 8 : 4).map((entry) => {
            const pct = entry.totalUnits
              ? Math.min(100, Math.round((entry.progress / entry.totalUnits) * 100))
              : 62;
            const unit = entry.type === "MANGA" ? "Ch." : "Ép.";
            const pulseKey = pulseMap[entry.mediaId];

            return (
              <div
                key={entry.mediaId}
                className={
                  embeddedInLibrary
                    ? "group h-full w-[258px] shrink-0 snap-start sm:w-auto"
                    : "group h-full"
                }
              >
                <div className="h-full relative rounded-2xl overflow-hidden isolate [transform:translateZ(0)] card-surface group-hover:border-white/[0.18] group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_rgba(0,0,0,0.55)] transition-[transform,border-color,box-shadow] duration-200 ease-out flex flex-col will-change-transform">
                  {/* Landscape Backdrop */}
                  <Link
                    href={`/media/${entry.mediaId}`}
                    className="relative h-32 block overflow-hidden isolate bg-[#141722]"
                  >
                    <img
                      src={entry.bannerImage || entry.coverImage}
                      alt={entry.title}
                      loading="lazy"
                      decoding="async"
                      className="relative z-0 w-full h-full object-cover transform-gpu transition-transform duration-500 ease-out group-hover:scale-[1.06] opacity-75"
                    />
                    <div className="absolute inset-0 z-[1] bg-gradient-to-t from-surface via-surface/40 to-black/25 pointer-events-none" />

                    {/* Type Badge */}
                    <span className="absolute top-2.5 left-2.5 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0A0C14]/90 border border-white/12 text-[10px] font-mono uppercase text-[#D8DBE6]">
                      {entry.type === "MANGA" ? (
                        <BookOpen className="w-3 h-3 text-violet-400" />
                      ) : (
                        <Tv className="w-3 h-3 text-sky-400" />
                      )}
                      {entry.type === "MANGA" ? "Manga" : "Anime"}
                    </span>

                    {entry.score && (
                      <span className="absolute top-2.5 right-2.5 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0A0C14]/90 border border-white/12 font-mono text-[11px] font-semibold text-[#F0B95B]">
                        ★ {entry.score.toFixed(1)}
                      </span>
                    )}

                    {/* Small Poster Inset */}
                    <img
                      src={entry.coverImage}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="absolute bottom-2.5 left-3.5 z-10 w-11 h-15 rounded-lg object-cover border border-white/20 shadow-lg"
                    />
                  </Link>

                {/* Info & Quick Controls */}
                <div className="p-3.5 pt-2.5 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <Link
                      href={`/media/${entry.mediaId}`}
                      className="text-sm font-semibold text-[#F4F3EE] hover:text-accent-hover transition-colors line-clamp-1"
                    >
                      {entry.title}
                    </Link>
                    <div className="mt-1.5 flex items-center justify-between text-xs font-mono">
                      <span className="text-[#B6BAC9]">
                        {unit}{" "}
                        <motion.strong
                          key={entry.progress}
                          initial={{ scale: 1.35, color: "#FF8A8E" }}
                          animate={{ scale: 1, color: "#FFFFFF" }}
                          transition={{ duration: 0.35 }}
                          className="inline-block text-white"
                        >
                          {entry.progress}
                        </motion.strong>
                        {entry.totalUnits ? ` / ${entry.totalUnits}` : ""}
                      </span>
                      <span className="text-[11px] text-[#7D8296]">
                        {entry.totalUnits ? `${pct}%` : "En cours"}
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="mt-2 h-1.5 w-full rounded-full bg-white/[0.07] overflow-hidden">
                      <motion.div
                        initial={false}
                        animate={{ width: `${pct}%` }}
                        transition={{ type: "spring", stiffness: 220, damping: 24 }}
                        className="h-full rounded-full bg-gradient-to-r from-accent via-accent-hover to-[#F0B95B] shadow-[0_0_12px_rgb(var(--shiori-accent-rgb)/0.65)]"
                      />
                    </div>
                  </div>

                  {/* Interactive +1 with Floating Celebration Pulse */}
                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <AnimatePresence>
                        {pulseKey && (
                          <motion.span
                            key={pulseKey}
                            initial={{ opacity: 1, y: 0, scale: 0.85 }}
                            animate={{ opacity: 0, y: -32, scale: 1.15 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.65, ease: CINEMA_EASE }}
                            className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 font-mono text-xs font-bold text-[#F0B95B] drop-shadow-[0_0_8px_rgba(240,185,91,0.9)]"
                          >
                            +1 {unit}
                          </motion.span>
                        )}
                      </AnimatePresence>

                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => handleIncrement(entry.mediaId)}
                        className="w-full h-8 rounded-xl bg-white/[0.06] hover:bg-accent border border-white/[0.09] hover:border-accent text-xs font-semibold text-white hover:text-accent-fg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>
                          {unit} {entry.progress + 1}
                        </span>
                      </motion.button>
                    </div>

                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.06 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => openQuickEdit(entry)}
                      title="Modifier la fiche"
                      className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.11] border border-white/[0.08] flex items-center justify-center text-[#A5A9BB] hover:text-white transition-colors cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>
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
