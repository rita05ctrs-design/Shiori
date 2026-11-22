"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Dices,
  Compass,
  ArrowRight,
  Star,
  Plus,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { RevealSection } from "@/components/motion/MotionPrimitives";
import { MOOD_PRESETS } from "@/lib/discover-taxonomy";
import {
  cn,
  formatFormat,
  formatScore,
  getDisplayTitle,
  stripHtml,
} from "@/lib/utils";
import type { MediaItem } from "@/types/media";

interface HomeMoodAndRouletteSectionProps {
  surprisePool: MediaItem[];
}

export function HomeMoodAndRouletteSection({
  surprisePool,
}: HomeMoodAndRouletteSectionProps) {
  const { getEntry, quickAdd } = useShiori();
  const [picked, setPicked] = useState<MediaItem | null>(null);

  const featuredMoods = useMemo(() => MOOD_PRESETS.slice(0, 6), []);

  // Deduplicated pool of high-rated titles not already in user's library (fallback to full pool)
  const eligiblePool = useMemo(() => {
    const map = new Map<number, MediaItem>();
    for (const m of surprisePool) {
      if (!map.has(m.id)) map.set(m.id, m);
    }
    const all = Array.from(map.values());
    const unseen = all.filter((m) => !getEntry(m.id));
    return unseen.length > 0 ? unseen : all;
  }, [surprisePool, getEntry]);

  const rollSurprise = () => {
    if (eligiblePool.length === 0) return;
    const candidates =
      picked && eligiblePool.length > 1
        ? eligiblePool.filter((m) => m.id !== picked.id)
        : eligiblePool;
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    setPicked(next);
  };

  const pickedEntry = picked ? getEntry(picked.id) : undefined;

  return (
    <RevealSection className="space-y-5">
      {/* Header + 1-Click Surprise Roulette Button */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent mb-1 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            <span>Explorer par ambiance</span>
          </p>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#F4F3EE]">
            Quelle est ton envie ce soir ?
          </h2>
          <p className="text-xs text-[#8A8FA4] mt-1">
            Choisis une atmosphère en un clic ou laisse la roulette choisir un chef-d&apos;œuvre
            absent de ta liste.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={rollSurprise}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold shadow-accent transition-all cursor-pointer"
          >
            <Dices className="w-3.5 h-3.5" />
            <span>{picked ? "Relancer la roulette" : "Surprends-moi"}</span>
          </button>
          <Link
            href="/discover"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.09] text-xs font-medium text-white transition-colors"
          >
            <span>Toutes les envies</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Inline Surprise Pick Spotlight Card (when rolled!) */}
      {picked && (
        <div className="rounded-2xl card-surface border border-accent/40 p-4 sm:p-5 relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-20 w-64 h-64 rounded-full opacity-25 blur-3xl"
            style={{
              background: "radial-gradient(circle, var(--shiori-accent), transparent 70%)",
            }}
          />

          <div className="relative z-10 flex flex-col sm:flex-row items-start gap-4">
            <Link href={`/media/${picked.id}`} className="shrink-0">
              <img
                src={picked.coverImage.extraLarge || picked.coverImage.large}
                alt={getDisplayTitle(picked)}
                className="w-24 h-36 rounded-xl object-cover border border-white/15 shadow-xl"
              />
            </Link>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-mono uppercase tracking-wider text-accent-soft">
                    <Sparkles className="w-3 h-3 text-accent" />
                    Coup de dé du soir
                  </span>
                  <Link
                    href={`/media/${picked.id}`}
                    className="block text-lg font-bold text-white hover:text-accent-hover transition-colors mt-0.5"
                  >
                    {getDisplayTitle(picked)}
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => setPicked(null)}
                  aria-label="Fermer la suggestion surprise"
                  className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#9A9EAE] hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {picked.averageScore && (
                  <span className="inline-flex items-center gap-1 font-mono font-bold text-kinpaku">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    {formatScore(picked.averageScore)}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] font-mono text-[10.5px] text-[#C8CCE0]">
                  {formatFormat(picked.format)}
                  {picked.episodes ? ` · ${picked.episodes} ép.` : ""}
                </span>
                {picked.genres.slice(0, 3).map((g) => (
                  <span
                    key={g}
                    className="px-2 py-0.5 rounded-md bg-accent/14 border border-accent/30 text-[10.5px] text-accent-soft"
                  >
                    {g}
                  </span>
                ))}
              </div>

              {picked.description && (
                <p className="text-xs text-[#A6AAB8] line-clamp-2 leading-relaxed">
                  {stripHtml(picked.description)}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Link
                  href={`/media/${picked.id}`}
                  className="h-8 px-4 rounded-xl bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>Voir la fiche</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (!pickedEntry) quickAdd(picked, "PLAN_TO_WATCH");
                  }}
                  className={cn(
                    "h-8 px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer",
                    pickedEntry
                      ? "bg-emerald-500/18 border-emerald-400/40 text-emerald-300"
                      : "bg-white/[0.06] hover:bg-white/[0.12] border-white/[0.12] text-white"
                  )}
                >
                  {pickedEntry ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Ajouté</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Plan to Watch</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6 Flagship Visual Mood Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {featuredMoods.map((mood) => (
          <Link
            key={mood.id}
            href={`/discover?mood=${encodeURIComponent(mood.id)}`}
            className="group relative h-28 sm:h-32 rounded-2xl overflow-hidden isolate [transform:translateZ(0)] border border-white/[0.09] hover:border-white/[0.25] transition-all flex flex-col justify-end p-3.5"
          >
            <img
              src={mood.image}
              alt={mood.label}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover opacity-55 group-hover:opacity-75 group-hover:scale-105 transition-all duration-500"
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(180deg, rgba(7,8,12,0.12) 0%, rgba(7,8,12,0.72) 55%, rgba(7,8,12,0.95) 100%)`,
              }}
            />
            <span
              className="absolute top-2.5 left-3 w-2 h-2 rounded-full"
              style={{
                backgroundColor: mood.accentHex,
                boxShadow: `0 0 10px ${mood.accentHex}`,
              }}
            />
            <div className="relative z-10">
              <p className="text-xs sm:text-[13px] font-bold text-white leading-tight group-hover:text-accent-soft transition-colors">
                {mood.label}
              </p>
              <p className="text-[10px] text-[#B5B9C9] line-clamp-1 mt-0.5">
                {mood.subtitle}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </RevealSection>
  );
}
