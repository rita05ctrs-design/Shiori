"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Film,
  Rocket,
  Gem,
  Zap,
  Star,
  Plus,
  Check,
  ArrowRight,
  CalendarClock,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { RevealSection } from "@/components/motion/MotionPrimitives";
import {
  cn,
  formatFormat,
  formatScore,
  formatSeason,
  getDisplayTitle,
} from "@/lib/utils";
import type { MediaItem } from "@/types/media";

type CuratedTabId = "movies" | "upcoming" | "hiddenGems" | "shortBinge";

interface HomeCuratedTabsSectionProps {
  movies: MediaItem[];
  upcoming: MediaItem[];
  hiddenGems: MediaItem[];
  shortBinge: MediaItem[];
}

export function HomeCuratedTabsSection({
  movies,
  upcoming,
  hiddenGems,
  shortBinge,
}: HomeCuratedTabsSectionProps) {
  const { getEntry, quickAdd } = useShiori();
  const [activeTab, setActiveTab] = useState<CuratedTabId>("movies");

  const tabs: {
    id: CuratedTabId;
    label: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    href: string;
    cta: string;
    items: MediaItem[];
  }[] = [
    {
      id: "movies",
      label: "Films d'Animation",
      subtitle: "Les chefs-d'œuvre du grand écran à voir absolument",
      icon: Film,
      href: "/discover?format=MOVIE&sort=SCORE_DESC",
      cta: "Tous les films",
      items: movies,
    },
    {
      id: "upcoming",
      label: "Prochainement",
      subtitle: "Les sorties les plus attendues des prochaines saisons",
      icon: Rocket,
      href: "/calendar#seasonal-browser",
      cta: "Calendrier des saisons",
      items: upcoming,
    },
    {
      id: "hiddenGems",
      label: "Pépites Cachées",
      subtitle: "Des séries acclamées (8.1+) hors des sentiers battus",
      icon: Gem,
      href: "/discover?minScore=80&sort=SCORE_DESC",
      cta: "Plus de pépites",
      items: hiddenGems,
    },
    {
      id: "shortBinge",
      label: "Courts (≤ 13 ép.)",
      subtitle: "Des chefs-d'œuvre parfaits à dévorer en un week-end",
      icon: Zap,
      href: "/discover?format=TV&maxEpisodes=13&minScore=80&sort=POPULARITY_DESC",
      cta: "Explorer le catalogue",
      items: shortBinge,
    },
  ];

  const current = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  return (
    <RevealSection className="space-y-5">
      {/* Header + Interactive Tabs Bar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent mb-1">
            Collections par onglets
          </p>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#F4F3EE]">
            {current.label}
          </h2>
          <p className="text-xs text-[#8A8FA4] mt-1">{current.subtitle}</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 max-w-full">
          <div className="w-full sm:w-auto max-w-full overflow-x-auto touch-rail no-scrollbar pb-0.5">
            <div
              role="tablist"
              aria-label="Collections curatées"
              className="inline-flex flex-nowrap items-center gap-1 p-1 rounded-2xl bg-surface border border-white/[0.08]"
            >
              {tabs.map((t) => {
                const Icon = t.icon;
                const active = t.id === activeTab;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(t.id)}
                    className={cn(
                      "px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0",
                      active
                        ? "bg-accent text-accent-fg shadow-accent"
                        : "text-[#9A9EAE] hover:text-white hover:bg-white/[0.05]"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Link
            href={current.href}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.09] text-xs font-medium text-white transition-colors"
          >
            <span>{current.cta}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 6-Card Grid for Active Tab */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {current.items.slice(0, 6).map((m) => {
          const title = getDisplayTitle(m);
          const entry = getEntry(m.id);
          const seasonLabel =
            m.season && m.seasonYear
              ? formatSeason(m.season, m.seasonYear)
              : m.startYear
                ? String(m.startYear)
                : null;

          return (
            <div
              key={`${activeTab}-${m.id}`}
              className="group h-full flex flex-col rounded-2xl overflow-hidden isolate [transform:translateZ(0)] card-surface hover:border-white/[0.2] transition-colors"
            >
              <Link
                href={`/media/${m.id}`}
                className="relative aspect-[2/3] block overflow-hidden bg-[#121521]"
              >
                <img
                  src={m.coverImage.extraLarge || m.coverImage.large}
                  alt={title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transform-gpu transition-transform duration-500 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/15 to-transparent pointer-events-none" />

                {/* Top Left Pill */}
                <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-obsidian/85 border border-white/12 text-[9.5px] font-mono uppercase text-[#D8DBE6] inline-flex items-center gap-1">
                  {activeTab === "upcoming" ? (
                    <>
                      <CalendarClock className="w-2.5 h-2.5 text-kinpaku" />
                      {seasonLabel || "À venir"}
                    </>
                  ) : m.episodes ? (
                    `${m.episodes} ép.`
                  ) : (
                    formatFormat(m.format)
                  )}
                </span>

                {/* Score Pill */}
                {m.averageScore && (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-obsidian/85 border border-white/12 font-mono text-[10.5px] font-bold text-kinpaku">
                    <Star className="w-2.5 h-2.5 fill-current" />
                    {formatScore(m.averageScore)}
                  </span>
                )}

                {/* 1-Click Bookmark */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!entry) quickAdd(m, "PLAN_TO_WATCH");
                  }}
                  title={entry ? "Dans votre bibliothèque" : "Ajouter en Plan to Watch"}
                  className={cn(
                    "absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-lg",
                    entry
                      ? "bg-emerald-500 border-emerald-400 text-[#07080C]"
                      : "bg-obsidian/90 hover:bg-accent border-white/20 hover:border-accent text-white hover:text-accent-fg"
                  )}
                >
                  {entry ? (
                    <Check className="w-4 h-4 stroke-[3]" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </button>
              </Link>

              <div className="p-3 flex-1 flex flex-col justify-between gap-1.5">
                <Link
                  href={`/media/${m.id}`}
                  className="text-xs sm:text-[13px] font-semibold text-[#F4F3EE] group-hover:text-accent-hover transition-colors line-clamp-2 leading-snug"
                >
                  {title}
                </Link>
                <p className="text-[10.5px] text-[#7D8296] truncate">
                  {m.genres.slice(0, 2).join(" · ") || formatFormat(m.format)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </RevealSection>
  );
}
