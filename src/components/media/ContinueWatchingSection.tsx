"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, SlidersHorizontal, ArrowRight, Flame, BookOpen, Tv, Star } from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import {
  AnimatedNumber,
  CINEMA_EASE,
  RevealSection,
} from "@/components/motion/MotionPrimitives";

export function ContinueWatchingSection() {
  const { library, incrementProgress, openQuickEdit } = useShiori();
  const [pulseMap, setPulseMap] = useState<Record<number, number>>({});

  const watching = library
    .filter((e) => e.status === "WATCHING")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const completedCount = library.filter((e) => e.status === "COMPLETED").length;
  const totalEpisodes = library
    .filter((e) => e.type === "ANIME")
    .reduce((acc, e) => acc + e.progress, 0);
  const scored = library.filter((e) => e.score !== null);
  const avgScore = scored.length
    ? scored.reduce((a, b) => a + (b.score ?? 0), 0) / scored.length
    : null;

  const handleIncrement = (mediaId: number) => {
    incrementProgress(mediaId, 1);
    setPulseMap((prev) => ({ ...prev, [mediaId]: Date.now() }));
  };

  return (
    <RevealSection className="space-y-5">
      {/* Header + Live Mini KPI Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#E5484D] mb-1">
            Reprendre la lecture
          </p>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#F4F3EE]">
            Votre progression en cours
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.07] text-xs text-[#C6CAD8]">
            <Flame className="w-3.5 h-3.5 text-[#F45B62]" />
            <span className="font-mono font-semibold text-white">
              <AnimatedNumber value={totalEpisodes} formatLocale={false} />
            </span>
            <span className="text-[#858A9E]">épisodes vus</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.07] text-xs text-[#C6CAD8]">
            <Star className="w-3.5 h-3.5 text-[#F0B95B] fill-[#F0B95B]" />
            <span className="font-mono font-semibold text-white">
              {avgScore !== null ? (
                <AnimatedNumber value={avgScore} decimals={1} formatLocale={false} />
              ) : (
                "—"
              )}
            </span>
            <span className="text-[#858A9E]">moyenne</span>
          </div>
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.07] text-xs text-[#C6CAD8]">
            <span className="font-mono font-semibold text-emerald-400">
              <AnimatedNumber value={completedCount} formatLocale={false} />
            </span>
            <span className="text-[#858A9E]">terminés</span>
          </div>
          <Link
            href="/library"
            className="group inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.09] text-xs font-medium text-white transition-colors"
          >
            <span>Ma bibliothèque</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {/* Active Cards */}
      {watching.length === 0 ? (
        <div className="rounded-2xl card-surface p-8 text-center">
          <p className="text-sm text-[#B7BBC9]">
            Vous n&apos;avez aucun anime ou manga en cours pour l&apos;instant.
          </p>
          <Link
            href="/discover"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#E5484D] text-white text-xs font-semibold hover:bg-[#F2545B] transition-colors"
          >
            Explorer le catalogue
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {watching.slice(0, 4).map((entry, idx) => {
            const pct = entry.totalUnits
              ? Math.min(100, Math.round((entry.progress / entry.totalUnits) * 100))
              : 62;
            const unit = entry.type === "MANGA" ? "Ch." : "Ép.";
            const pulseKey = pulseMap[entry.mediaId];

            return (
              <motion.div
                key={entry.mediaId}
                layout
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.5, delay: idx * 0.06, ease: CINEMA_EASE }}
                whileHover={{ y: -5 }}
                className="group relative rounded-2xl overflow-hidden card-surface hover:border-white/[0.18] hover:shadow-[0_20px_48px_rgba(0,0,0,0.55)] transition-all flex flex-col"
              >
                {/* Landscape Backdrop */}
                <Link
                  href={`/media/${entry.mediaId}`}
                  className="relative h-32 block overflow-hidden bg-[#141722]"
                >
                  <img
                    src={entry.bannerImage || entry.coverImage}
                    alt={entry.title}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 opacity-75"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0E1017] via-[#0E1017]/40 to-black/25" />

                  {/* Type Badge */}
                  <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/65 backdrop-blur-md border border-white/10 text-[10px] font-mono uppercase text-[#D8DBE6]">
                    {entry.type === "MANGA" ? (
                      <BookOpen className="w-3 h-3 text-violet-400" />
                    ) : (
                      <Tv className="w-3 h-3 text-sky-400" />
                    )}
                    {entry.type === "MANGA" ? "Manga" : "Anime"}
                  </span>

                  {entry.score && (
                    <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/65 backdrop-blur-md border border-white/10 font-mono text-[11px] font-semibold text-[#F0B95B]">
                      ★ {entry.score.toFixed(1)}
                    </span>
                  )}

                  {/* Small Poster Inset */}
                  <img
                    src={entry.coverImage}
                    alt=""
                    className="absolute bottom-2.5 left-3.5 w-11 h-15 rounded-lg object-cover border border-white/20 shadow-lg transition-transform duration-300 group-hover:scale-105"
                  />
                </Link>

                {/* Info & Quick Controls */}
                <div className="p-3.5 pt-2.5 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <Link
                      href={`/media/${entry.mediaId}`}
                      className="text-sm font-semibold text-[#F4F3EE] hover:text-[#F45B62] transition-colors line-clamp-1"
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
                        className="h-full rounded-full bg-gradient-to-r from-[#E5484D] via-[#F45B62] to-[#F0B95B] shadow-[0_0_12px_rgba(229,72,77,0.65)]"
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
                        className="w-full h-8 rounded-xl bg-white/[0.06] hover:bg-[#E5484D] border border-white/[0.09] hover:border-[#E5484D] text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
              </motion.div>
            );
          })}
        </div>
      )}
    </RevealSection>
  );
}
