"use client";

import React from "react";
import { Crown, ShieldCheck } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/media";

interface RoleBadgeProps {
  role?: UserRole | null;
  size?: "xs" | "sm" | "md";
  className?: string;
}

/**
 * Distinctive golden (#F0B95B) "Créateur" badge (and "Modérateur" staff badge).
 * Renders nothing for standard "user" accounts.
 */
export function RoleBadge({ role, size = "sm", className }: RoleBadgeProps) {
  const { tr } = useTranslation();
  if (!role || role === "user") return null;

  const sizeClasses =
    size === "xs"
      ? "px-1.5 py-0.5 text-[10px] gap-1"
      : size === "md"
      ? "px-3 py-1 text-xs gap-1.5"
      : "px-2 py-0.5 text-[11px] gap-1";

  const iconSize = size === "xs" ? "w-2.5 h-2.5" : size === "md" ? "w-3.5 h-3.5" : "w-3 h-3";

  if (role === "creator") {
    return (
      <span
        title={tr("Créateur de Shiori")}
        className={cn(
          "inline-flex items-center shrink-0 rounded-full font-semibold tracking-wide whitespace-nowrap select-none",
          "bg-gradient-to-r from-[#F0B95B]/24 via-[#FDE68A]/18 to-[#F0B95B]/24",
          "border border-[#F0B95B]/65 text-[#FDE68A]",
          "shadow-[0_0_18px_-4px_rgba(240,185,91,0.55)]",
          sizeClasses,
          className
        )}
      >
        <Crown className={cn(iconSize, "text-[#F0B95B] shrink-0")} />
        <span>{tr("Créateur")}</span>
      </span>
    );
  }

  return (
    <span
      title={tr("Modérateur Shiori")}
      className={cn(
        "inline-flex items-center shrink-0 rounded-full font-semibold tracking-wide whitespace-nowrap select-none",
        "bg-[#E5484D]/18 border border-[#E5484D]/50 text-[#FCA5A5]",
        sizeClasses,
        className
      )}
    >
      <ShieldCheck className={cn(iconSize, "text-[#E5484D] shrink-0")} />
      <span>{tr("Modérateur")}</span>
    </span>
  );
}
