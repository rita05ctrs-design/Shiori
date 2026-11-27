"use client";

import React from "react";
import { Crown, Heart, Sparkles } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  extractSpecialBadgeIds,
  type AdminGrantableBadgeId,
} from "@/lib/badges";
import { cn } from "@/lib/utils";
import type { SpecialBadgeId, UnlockedBadgeRecord } from "@/types/media";

interface SpecialBadgeVisualStyle {
  titleFr: string;
  descriptionFr: string;
  tagFr: string;
  Icon: React.ComponentType<{ className?: string }>;
  heroCardClass: string;
  communityCardClass: string;
  pillClass: string;
  iconBoxClass: string;
  iconColorClass: string;
  titleColorClass: string;
  tagClass: string;
}

const SPECIAL_BADGE_STYLES: Record<AdminGrantableBadgeId, SpecialBadgeVisualStyle> = {
  beta_tester: {
    titleFr: "Bêta-testeur",
    descriptionFr: "Pionnier ayant aidé à tester et façonner Shiori dès ses débuts.",
    tagFr: "Distinction Créateur",
    Icon: Sparkles,
    heroCardClass:
      "bg-gradient-to-br from-[#35260C]/95 via-[#1C160B]/95 to-[#0F0E16]/95 border-[#F0B95B]/60 shadow-[0_14px_38px_-12px_rgba(240,185,91,0.52)]",
    communityCardClass:
      "bg-gradient-to-r from-[#F0B95B]/22 via-[#FDE68A]/12 to-[#1B150B]/90 border-[#F0B95B]/55 shadow-[0_8px_24px_-8px_rgba(240,185,91,0.45)]",
    pillClass:
      "bg-gradient-to-r from-[#F0B95B]/26 via-[#FDE68A]/18 to-[#F0B95B]/26 border-[#F0B95B]/65 text-[#FEF08A] shadow-[0_0_20px_-4px_rgba(240,185,91,0.58)]",
    iconBoxClass: "from-[#FEF08A] via-[#F0B95B] to-[#B45309] text-[#1A1103]",
    iconColorClass: "text-[#FDE68A]",
    titleColorClass: "text-[#FEF08A]",
    tagClass: "bg-[#F0B95B]/20 border-[#F0B95B]/45 text-[#FDE68A]",
  },
  supporter: {
    titleFr: "Supporter",
    descriptionFr: "Soutien généreux contribuant au développement et à l'indépendance de Shiori.",
    tagFr: "Distinction Créateur",
    Icon: Heart,
    heroCardClass:
      "bg-gradient-to-br from-[#331320]/95 via-[#1C1018]/95 to-[#0F0E16]/95 border-rose-400/55 shadow-[0_14px_38px_-12px_rgba(244,63,94,0.48)]",
    communityCardClass:
      "bg-gradient-to-r from-rose-500/22 via-pink-400/12 to-[#1C1018]/90 border-rose-400/55 shadow-[0_8px_24px_-8px_rgba(244,63,94,0.42)]",
    pillClass:
      "bg-gradient-to-r from-rose-500/25 via-amber-400/18 to-rose-500/25 border-rose-400/60 text-rose-100 shadow-[0_0_20px_-4px_rgba(244,63,94,0.52)]",
    iconBoxClass: "from-[#FDA4AF] via-[#F43F5E] to-[#BE123C] text-white",
    iconColorClass: "text-rose-300",
    titleColorClass: "text-rose-100",
    tagClass: "bg-rose-500/20 border-rose-400/45 text-rose-200",
  },
  vip: {
    titleFr: "VIP",
    descriptionFr: "Membre d'honneur distingué par le créateur de Shiori.",
    tagFr: "Distinction Créateur",
    Icon: Crown,
    heroCardClass:
      "bg-gradient-to-br from-[#2B1442]/95 via-[#181129]/95 to-[#0F0E18]/95 border-fuchsia-400/60 shadow-[0_14px_40px_-10px_rgba(192,132,252,0.55)]",
    communityCardClass:
      "bg-gradient-to-r from-fuchsia-500/22 via-violet-400/14 to-[#19112A]/90 border-fuchsia-400/55 shadow-[0_8px_24px_-8px_rgba(192,132,252,0.48)]",
    pillClass:
      "bg-gradient-to-r from-fuchsia-500/28 via-violet-400/22 to-amber-400/22 border-fuchsia-400/65 text-fuchsia-100 shadow-[0_0_22px_-4px_rgba(192,132,252,0.62)]",
    iconBoxClass: "from-[#FDE68A] via-[#C084FC] to-[#7C3AED] text-white",
    iconColorClass: "text-fuchsia-200",
    titleColorClass: "text-fuchsia-100",
    tagClass: "bg-fuchsia-500/20 border-fuchsia-400/45 text-fuchsia-200",
  },
};

interface SpecialBadgesSpotlightProps {
  unlockedBadges?: UnlockedBadgeRecord[] | null;
  badgeIds?: SpecialBadgeId[] | null;
  variant?: "hero" | "card" | "pill";
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * High-visibility showcase for Creator-granted special distinctions
 * (`Bêta-testeur`, `Supporter`, `VIP`) on Profile pages and across Community.
 */
export function SpecialBadgesSpotlight({
  unlockedBadges,
  badgeIds,
  variant = "hero",
  size = "md",
  className,
}: SpecialBadgesSpotlightProps) {
  const { tr } = useTranslation();
  const specialIds = extractSpecialBadgeIds(
    badgeIds && badgeIds.length > 0 ? badgeIds : unlockedBadges
  );

  if (specialIds.length === 0) return null;

  if (variant === "pill") {
    const sizeClasses =
      size === "lg"
        ? "px-3.5 py-1.5 text-xs sm:text-[13px] gap-2"
        : size === "sm"
          ? "px-2.5 py-0.5 text-[11px] gap-1"
          : "px-3 py-1 text-xs gap-1.5";
    const iconClasses =
      size === "lg"
        ? "w-4 h-4"
        : size === "sm"
          ? "w-3 h-3"
          : "w-3.5 h-3.5";

    return (
      <div className={cn("inline-flex items-center gap-1.5 flex-wrap", className)}>
        {specialIds.map((id) => {
          const style = SPECIAL_BADGE_STYLES[id];
          const Icon = style.Icon;
          return (
            <span
              key={id}
              title={`${tr(style.titleFr)} — ${tr(style.descriptionFr)}`}
              className={cn(
                "inline-flex items-center shrink-0 rounded-full border font-bold tracking-wide whitespace-nowrap select-none transition-transform hover:scale-[1.03]",
                style.pillClass,
                sizeClasses
              )}
            >
              <Icon className={cn(iconClasses, style.iconColorClass, "shrink-0")} />
              <span>{tr(style.titleFr)}</span>
            </span>
          );
        })}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className={cn("space-y-2", className)}>
        {specialIds.map((id) => {
          const style = SPECIAL_BADGE_STYLES[id];
          const Icon = style.Icon;
          return (
            <div
              key={id}
              title={tr(style.descriptionFr)}
              className={cn(
                "relative overflow-hidden rounded-xl border px-3 py-2 flex items-center gap-2.5",
                style.communityCardClass
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0 shadow-md",
                  style.iconBoxClass
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-xs sm:text-[13px] font-extrabold tracking-wide leading-tight truncate", style.titleColorClass)}>
                  {tr(style.titleFr)}
                </p>
                <p className="text-[10px] font-mono uppercase tracking-wider text-white/70 truncate mt-0.5">
                  {tr(style.tagFr)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // variant === "hero": Large spotlight showcase on Public Profile page
  return (
    <section
      aria-label={tr("Distinctions officielles")}
      className={cn("space-y-2.5", className)}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#F0B95B] shrink-0" />
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#F0B95B] font-bold">
          {tr("Distinctions officielles Shiori")}
        </p>
      </div>

      <div
        className={cn(
          "grid gap-3.5",
          specialIds.length === 1
            ? "grid-cols-1"
            : specialIds.length === 2
              ? "grid-cols-1 md:grid-cols-2"
              : "grid-cols-1 md:grid-cols-3"
        )}
      >
        {specialIds.map((id) => {
          const style = SPECIAL_BADGE_STYLES[id];
          const Icon = style.Icon;
          return (
            <div
              key={id}
              className={cn(
                "relative overflow-hidden rounded-2xl border p-4 sm:p-5 flex items-center gap-4 transition-transform hover:-translate-y-0.5",
                style.heroCardClass
              )}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-10 -right-10 w-36 h-36 rounded-full opacity-25 blur-2xl bg-gradient-to-br from-white/50 to-transparent"
              />
              <div
                className={cn(
                  "relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-lg ring-1 ring-white/25",
                  style.iconBoxClass
                )}
              >
                <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div className="relative min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2
                    className={cn(
                      "text-base sm:text-lg font-extrabold tracking-tight leading-tight",
                      style.titleColorClass
                    )}
                  >
                    {tr(style.titleFr)}
                  </h2>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider",
                      style.tagClass
                    )}
                  >
                    {tr(style.tagFr)}
                  </span>
                </div>
                <p className="text-xs sm:text-[13px] text-[#D8DCEB] leading-relaxed">
                  {tr(style.descriptionFr)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
