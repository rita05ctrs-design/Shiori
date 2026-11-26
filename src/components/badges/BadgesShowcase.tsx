"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Lock, Pin, Sparkles, Target, Trophy } from "lucide-react";
import {
  BADGE_CATEGORY_LABELS,
  RARITY_META,
  RARITY_RANK,
} from "@/lib/badges";
import { BadgeIcon } from "@/components/badges/BadgeIcon";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { BadgeCategory, BadgeRarity, EvaluatedBadge } from "@/types/media";

interface BadgesShowcaseProps {
  badges: EvaluatedBadge[];
  pinnedBadges: string[];
  canPin?: boolean;
  onTogglePin?: (badgeId: string) => void;
  onPreviewUnlock?: (badgeId: string) => void;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

const CATEGORY_TABS: { id: "all" | BadgeCategory; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "anime", label: "Animés" },
  { id: "manga", label: "Mangas" },
  { id: "milestone", label: "Exploits & Marathon" },
  { id: "critic", label: "Critique & Favoris" },
  { id: "social", label: "Social" },
];

type StatusFilter = "all" | "unlocked" | "locked";

export function BadgesShowcase({
  badges,
  pinnedBadges,
  canPin = false,
  onTogglePin,
  onPreviewUnlock,
  title,
  subtitle,
  compact = false,
}: BadgesShowcaseProps) {
  const { tr, locale } = useTranslation();
  const [category, setCategory] = useState<"all" | BadgeCategory>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedCompact, setExpandedCompact] = useState(false);

  const unlockedCount = useMemo(
    () => badges.filter((b) => b.unlocked).length,
    [badges]
  );

  const rarityCounts = useMemo(() => {
    const counts: Record<BadgeRarity, number> = {
      mythic: 0,
      legendary: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
    };
    for (const b of badges) {
      if (b.unlocked) counts[b.rarity] += 1;
    }
    return counts;
  }, [badges]);

  const visibleBadges = useMemo(() => {
    let filtered =
      category === "all" ? badges : badges.filter((b) => b.category === category);
    if (statusFilter === "unlocked") {
      filtered = filtered.filter((b) => b.unlocked);
    } else if (statusFilter === "locked") {
      filtered = filtered.filter((b) => !b.unlocked);
    }
    // Unlocked first (highest rarity first), then locked sorted by closest % progress
    return [...filtered].sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      if (a.unlocked && b.unlocked) {
        if (RARITY_RANK[b.rarity] !== RARITY_RANK[a.rarity]) {
          return RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity];
        }
        return b.target - a.target;
      }
      if (b.progressPct !== a.progressPct) return b.progressPct - a.progressPct;
      return a.target - b.target;
    });
  }, [badges, category, statusFilter]);

  const displayedBadges =
    compact && !expandedCompact ? visibleBadges.slice(0, 9) : visibleBadges;
  const hiddenCount = Math.max(0, visibleBadges.length - displayedBadges.length);

  const completionPct = badges.length
    ? Math.round((unlockedCount / badges.length) * 100)
    : 0;

  return (
    <section
      id="badges"
      className={cn(
        "rounded-3xl card-surface border border-white/[0.08] scroll-mt-24 space-y-5",
        compact ? "p-4 sm:p-6" : "p-4 sm:p-6 md:p-7"
      )}
    >
      {/* Header + Progress Summary */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-kinpaku flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" />
            <span>
              {tr("Vitrine Gamification")} · {unlockedCount} / {badges.length} {tr("débloqués")}
            </span>
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {title ?? tr("Badges & Trophées")}
          </h2>
          <p className="text-xs text-[#8D92A6] max-w-2xl">
            {subtitle ||
              (canPin
                ? tr("Épinglez jusqu'à 3 badges favoris à côté de votre pseudo.")
                : tr("Trophées débloqués automatiquement selon l'historique de visionnage, de lecture et d'engagement."))}
          </p>
        </div>

        {/* Rarity Breakdown & Pinned Counter */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {(["mythic", "legendary", "gold", "silver", "bronze"] as BadgeRarity[]).map(
            (r) => {
              const meta = RARITY_META[r];
              return (
                <span
                  key={r}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10.5px] font-mono font-semibold",
                    meta.pillClass,
                    rarityCounts[r] === 0 && "opacity-40"
                  )}
                >
                  <span>{tr(meta.label)}</span>
                  <span>{rarityCounts[r]}</span>
                </span>
              );
            }
          )}
          {canPin && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.07] border border-white/[0.12] text-[10.5px] font-mono text-white">
              <Pin className="w-3 h-3 text-accent" />
              <span>{tr("{n} / 3 épinglés", { n: pinnedBadges.length })}</span>
            </span>
          )}
        </div>
      </div>

      {/* Overall Trophy Collection Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-[#9A9EAE]">
          <span>{tr("Progression globale des trophées")}</span>
          <span className="text-white font-semibold">
            {unlockedCount}/{badges.length} ({completionPct}%)
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden border border-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#CD7F32] via-[#F0B95B] via-[#C084FC] to-[#22D3EE] transition-all duration-500"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Category Filters + Status Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-nowrap sm:flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 max-w-full">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategory(tab.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0",
                category === tab.id
                  ? "bg-white text-[#090A0F] border-white"
                  : "bg-obsidian/70 border-white/[0.08] text-[#9A9EAE] hover:text-white"
              )}
            >
              {tr(tab.label)}
            </button>
          ))}
        </div>

        <div className="inline-flex items-center p-0.5 rounded-full bg-obsidian/80 border border-white/[0.08] self-start sm:self-auto shrink-0 max-w-full overflow-x-auto no-scrollbar">
          {(
            [
              { id: "all", label: tr("Tous") },
              { id: "unlocked", label: `${tr("Débloqués")} (${unlockedCount})` },
              {
                id: "locked",
                label: `${tr("Défis")} (${Math.max(0, badges.length - unlockedCount)})`,
              },
            ] as { id: StatusFilter; label: string }[]
          ).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStatusFilter(s.id)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1",
                statusFilter === s.id
                  ? "bg-accent text-accent-fg shadow-sm"
                  : "text-[#9A9EAE] hover:text-white"
              )}
            >
              {s.id === "locked" && <Target className="w-3 h-3" />}
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Badges Grid */}
      {displayedBadges.length === 0 ? (
        <div className="rounded-2xl bg-obsidian/60 border border-white/[0.07] p-8 text-center text-xs text-[#8A8FA4]">
          {tr("Aucun badge dans cette catégorie avec ce filtre pour le moment.")}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {displayedBadges.map((badge) => {
            const meta = RARITY_META[badge.rarity];
            const isPinned = pinnedBadges.includes(badge.id);

            if (badge.unlocked) {
              const unlockedDateLabel = badge.unlockedAt
                ? new Date(badge.unlockedAt).toLocaleDateString(locale, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : tr("Débloqué");

              return (
                <div
                  key={badge.id}
                  style={{ boxShadow: meta.glow }}
                  className={cn(
                    "group relative rounded-2xl border p-4 transition-transform duration-300 hover:-translate-y-1 flex flex-col justify-between gap-3.5",
                    "badge-shine-sweep",
                    badge.rarity === "mythic" && "badge-shine-loop",
                    meta.bg,
                    meta.border,
                    isPinned && "ring-1 ring-white/40"
                  )}
                >
                  {badge.rarity === "mythic" ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-6 badge-mythic-aura opacity-75 group-hover:opacity-100 transition-opacity"
                    />
                  ) : badge.rarity === "legendary" ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-6 badge-holo-aura opacity-60 group-hover:opacity-95 transition-opacity"
                    />
                  ) : null}

                  <div className="relative z-10 flex items-start gap-3.5">
                    {/* Vivid Medallion */}
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 ring-2 ring-white/25 shadow-lg transition-transform duration-300 group-hover:scale-105",
                        meta.iconBg
                      )}
                    >
                      <BadgeIcon
                        iconKey={badge.iconKey}
                        className="w-6 h-6 text-[#08090E]"
                      />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full border text-[9.5px] font-mono font-bold uppercase tracking-wider shrink-0",
                            meta.pillClass
                          )}
                        >
                          {tr(meta.label)}
                        </span>
                        <span className="text-[10px] font-mono text-[#9EA3B5] truncate">
                          {tr(BADGE_CATEGORY_LABELS[badge.category])}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-white leading-snug">
                        {badge.title}
                      </h3>
                      <p className="text-xs text-[#C2C6D6] leading-relaxed">
                        {badge.description}
                      </p>
                    </div>
                  </div>

                  {/* Footer Row: Date + Pin Action + Animation Replay */}
                  <div className="relative z-10 pt-2.5 border-t border-white/[0.08] flex items-center justify-between gap-2">
                    <span className="text-[10.5px] font-mono text-[#A6AAB8]">
                      {unlockedDateLabel}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {onPreviewUnlock && (
                        <button
                          type="button"
                          onClick={() => onPreviewUnlock(badge.id)}
                          title={tr("Revoir l'animation")}
                          className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.15] border border-white/[0.1] text-[#D2D6E6] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canPin && onTogglePin && (
                        <button
                          type="button"
                          onClick={() => onTogglePin(badge.id)}
                          className={cn(
                            "h-7 px-2.5 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 transition-all cursor-pointer",
                            isPinned
                              ? "bg-white text-[#090A0F] border-white shadow-sm"
                              : "bg-white/[0.07] hover:bg-white/[0.15] border-white/[0.12] text-white"
                          )}
                        >
                          <Pin className={cn("w-3 h-3", isPinned && "fill-current")} />
                          <span>{isPinned ? tr("Épinglé") : tr("Épingler")}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // Locked Badge Card (Grayscale + Live Progress Bar + Rarity preview)
            return (
              <div
                key={badge.id}
                className="rounded-2xl bg-obsidian/70 border border-white/[0.07] p-4 flex flex-col justify-between gap-3.5 opacity-80 hover:opacity-100 hover:border-white/[0.14] transition-all"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.09] flex items-center justify-center shrink-0 text-[#6F7489] relative">
                    <BadgeIcon
                      iconKey={badge.iconKey}
                      className="w-5 h-5 grayscale opacity-75"
                    />
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-surface border border-white/15 flex items-center justify-center">
                      <Lock className="w-2.5 h-2.5 text-[#8A8FA4]" />
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full border text-[9.5px] font-mono uppercase tracking-wider",
                          badge.rarity === "mythic"
                            ? "bg-cyan-500/10 border-cyan-400/25 text-cyan-300/80"
                            : "bg-white/[0.05] border-white/[0.08] text-[#8C91A6]"
                        )}
                      >
                        {tr(meta.label)} · {tr("Verrouillé")}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-[#C6CAD8] leading-snug">
                      {badge.title}
                    </h3>
                    <p className="text-xs text-[#7E8398] leading-relaxed">
                      {badge.description}
                    </p>
                  </div>
                </div>

                {/* Live Progress Bar */}
                <div className="space-y-1.5 pt-2 border-t border-white/[0.05]">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="text-[#9A9EAE]">
                      {Math.min(badge.current, badge.target).toLocaleString(locale)} /{" "}
                      {badge.target.toLocaleString(locale)} {badge.unitLabel}
                    </span>
                    <span className="text-white/75 font-semibold">
                      {badge.progressPct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        badge.progressPct >= 75
                          ? "bg-gradient-to-r from-accent to-kinpaku"
                          : "bg-white/35"
                      )}
                      style={{ width: `${badge.progressPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Expand / Collapse toggle in compact Settings mode */}
      {compact && (hiddenCount > 0 || expandedCompact) && visibleBadges.length > 9 && (
        <div className="pt-1 flex justify-center">
          <button
            type="button"
            onClick={() => setExpandedCompact((v) => !v)}
            className="h-9 px-4 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {expandedCompact ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>{tr("Réduire")}</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>{tr("Voir tous les badges (+{n})", { n: hiddenCount })}</span>
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
