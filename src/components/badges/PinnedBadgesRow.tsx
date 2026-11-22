"use client";

import React from "react";
import { BADGE_BY_ID, RARITY_META } from "@/lib/badges";
import { BadgeIcon } from "@/components/badges/BadgeIcon";
import { cn } from "@/lib/utils";

interface PinnedBadgesRowProps {
  badgeIds?: string[];
  size?: "xs" | "sm";
  showTitle?: boolean;
  className?: string;
}

export function PinnedBadgesRow({
  badgeIds,
  size = "sm",
  showTitle = true,
  className,
}: PinnedBadgesRowProps) {
  if (!badgeIds || badgeIds.length === 0) return null;

  const resolved = badgeIds
    .slice(0, 3)
    .map((id) => BADGE_BY_ID.get(id))
    .filter((b): b is NonNullable<typeof b> => Boolean(b));

  if (resolved.length === 0) return null;

  return (
    <div className={cn("inline-flex items-center gap-1.5 flex-wrap", className)}>
      {resolved.map((badge) => {
        const meta = RARITY_META[badge.rarity];
        return (
          <span
            key={badge.id}
            title={`${badge.title} (${meta.label}) — ${badge.description}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border font-semibold transition-transform hover:scale-105 select-none",
              meta.pillClass,
              badge.rarity === "mythic" && "shadow-[0_0_16px_rgba(56,189,248,0.48)]",
              badge.rarity === "legendary" && "shadow-[0_0_12px_rgba(192,132,252,0.35)]",
              badge.rarity === "gold" && "shadow-[0_0_10px_rgba(240,185,91,0.28)]",
              size === "xs"
                ? "px-1.5 py-0.5 text-[10px] leading-none"
                : "px-2 py-0.5 text-[10.5px] leading-tight"
            )}
          >
            <BadgeIcon
              iconKey={badge.iconKey}
              className={size === "xs" ? "w-2.5 h-2.5 shrink-0" : "w-3 h-3 shrink-0"}
            />
            {showTitle && <span className="truncate max-w-[130px]">{badge.title}</span>}
          </span>
        );
      })}
    </div>
  );
}
