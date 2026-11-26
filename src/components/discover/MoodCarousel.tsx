"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Swords,
  Skull,
  Sparkles,
  Brain,
  Heart,
  Droplet,
  Laugh,
  Coffee,
  Moon,
  Flame,
  Compass,
  Cpu,
  Trophy,
  Search,
  Check,
  Wand2,
  ArrowUpRight,
  ChevronDown,
} from "lucide-react";
import {
  MOOD_PRESETS,
  type MoodIconKey,
  type MoodPreset,
} from "@/lib/discover-taxonomy";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<MoodIconKey, React.ComponentType<{ className?: string }>> = {
  swords: Swords,
  skull: Skull,
  sparkles: Sparkles,
  brain: Brain,
  heart: Heart,
  droplet: Droplet,
  laugh: Laugh,
  coffee: Coffee,
  moon: Moon,
  flame: Flame,
  compass: Compass,
  cpu: Cpu,
  trophy: Trophy,
  search: Search,
};

const INITIAL_VISIBLE = 8;

interface MoodCarouselProps {
  activeMoodId: string | null;
  onSelectMood: (mood: MoodPreset | null) => void;
}

export function MoodCarousel({ activeMoodId, onSelectMood }: MoodCarouselProps) {
  const { tr } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const visibleMoods = expanded
    ? MOOD_PRESETS
    : MOOD_PRESETS.slice(0, INITIAL_VISIBLE);
  const hiddenCount = MOOD_PRESETS.length - INITIAL_VISIBLE;

  return (
    <section className="space-y-3.5">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-gradient-to-br from-[#F0B95B]/25 to-accent/20 border border-[#F0B95B]/40 text-[#F0B95B] shadow-[0_0_16px_rgba(240,185,91,0.18)]">
            <Wand2 className="w-3.5 h-3.5" />
          </span>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-[#F4F3EE] leading-tight">
              {tr("Quelle est votre envie ce soir ?")}
            </h2>
            <p className="text-[11.5px] text-[#83889C] hidden sm:block">
              {tr("Appuyez sur une ambiance pour filtrer instantanément le catalogue")}
            </p>
          </div>
        </div>

        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.11] border border-white/[0.09] hover:border-white/[0.18] text-xs font-medium text-[#D6D9E6] hover:text-white transition-all cursor-pointer shrink-0"
        >
          <span>{expanded ? tr("Réduire") : tr("+ {n} autres envies", { n: hiddenCount })}</span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-[#F0B95B] transition-transform duration-300",
              expanded && "rotate-180"
            )}
          />
        </motion.button>
      </div>

      {/* Visual Cinema Bento Grid — 8 flagship moods visible immediately without sliding */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {visibleMoods.map((mood) => {
          const Icon = ICON_MAP[mood.icon];
          const isActive = activeMoodId === mood.id;

          return (
            <button
              key={mood.id}
              type="button"
              onClick={() => onSelectMood(isActive ? null : mood)}
              style={{
                borderColor: isActive ? mood.accentHex : undefined,
                boxShadow: isActive
                  ? `0 16px 38px -10px ${mood.accentHex}75, 0 0 0 1px ${mood.accentHex}55`
                  : undefined,
              }}
              className={cn(
                "group relative h-[108px] sm:h-[114px] rounded-2xl overflow-hidden isolate [transform:translateZ(0)] border text-left transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-1 active:scale-[0.98] cursor-pointer bg-[#0D1018] will-change-transform",
                isActive
                  ? "border-transparent"
                  : "border-white/[0.09] hover:border-white/[0.24] hover:shadow-[0_18px_36px_rgba(0,0,0,0.62)]"
              )}
            >
              {/* Full-Bleed Real Anime Cinema Artwork Backdrop */}
              <img
                src={mood.image}
                alt=""
                loading="lazy"
                decoding="async"
                className={cn(
                  "absolute inset-0 z-0 w-full h-full object-cover object-center transform-gpu transition-[transform,opacity] duration-500 ease-out",
                  isActive
                    ? "opacity-65 scale-105"
                    : "opacity-40 group-hover:opacity-65 group-hover:scale-105"
                )}
              />

              {/* Rich Cinematic Vignette + Mood Color Wash */}
              <div className="absolute inset-0 z-[1] bg-gradient-to-r from-[#080A10]/95 via-[#080A10]/72 to-[#080A10]/20 pointer-events-none" />
              <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#080A10]/92 via-transparent to-black/25 pointer-events-none" />
              <div
                aria-hidden="true"
                className={cn(
                  "absolute inset-0 z-[1] transition-opacity duration-300 pointer-events-none",
                  isActive ? "opacity-40" : "opacity-15 group-hover:opacity-35"
                )}
                style={{
                  background: `radial-gradient(circle at 90% 15%, ${mood.accentHex}90, transparent 62%)`,
                }}
              />

              {/* Diagonal Glass Sheen Sweep on Hover */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-[2] -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/[0.14] to-transparent skew-x-[-20deg]"
              />

              {/* Card Foreground */}
              <div className="relative z-10 h-full p-3.5 flex flex-col justify-between">
                {/* Top Row: Icon Badge + Active Check / Hover Arrow */}
                <div className="flex items-center justify-between gap-2">
                  <div
                    className="w-8 h-8 rounded-xl bg-[#0A0C14]/80 flex items-center justify-center border shadow-md transition-transform duration-200 group-hover:scale-105"
                    style={{
                      backgroundColor: `${mood.accentHex}30`,
                      borderColor: `${mood.accentHex}65`,
                      color: "#FFFFFF",
                    }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  {isActive ? (
                    <span
                      style={{ backgroundColor: mood.accentHex }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-lg"
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>{tr("Actif")}</span>
                    </span>
                  ) : (
                    <span className="w-7 h-7 rounded-full bg-[#090B12]/80 border border-white/15 flex items-center justify-center text-white/70 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-white transition-all duration-200">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                {/* Bottom Title + Hook */}
                <div>
                  <h3 className="text-[14px] font-bold text-white tracking-tight leading-tight drop-shadow-sm">
                    {tr(mood.label)}
                  </h3>
                  <p className="text-[11px] text-[#C6CAD8]/90 mt-0.5 line-clamp-1">
                    {tr(mood.subtitle)}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
