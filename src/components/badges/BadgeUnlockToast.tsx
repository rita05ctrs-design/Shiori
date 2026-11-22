"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Sparkles, Trophy, X } from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { RARITY_META } from "@/lib/badges";
import { BadgeIcon } from "@/components/badges/BadgeIcon";
import { cn } from "@/lib/utils";

const CONFETTI_PARTICLES = [
  { x: -115, y: -38, rot: -40, color: "#FDE047", size: 6, delay: 0.02 },
  { x: -84, y: -56, rot: 25, color: "#F472B6", size: 5, delay: 0.05 },
  { x: -52, y: -64, rot: -20, color: "#38BDF8", size: 6, delay: 0.04 },
  { x: -18, y: -68, rot: 55, color: "#C084FC", size: 5, delay: 0.08 },
  { x: 24, y: -66, rot: -35, color: "#F0B95B", size: 6, delay: 0.03 },
  { x: 64, y: -58, rot: 45, color: "#34D399", size: 5, delay: 0.07 },
  { x: 102, y: -40, rot: -50, color: "#F472B6", size: 6, delay: 0.05 },
  { x: -124, y: 12, rot: 65, color: "#38BDF8", size: 5, delay: 0.06 },
  { x: 126, y: 14, rot: -65, color: "#FDE047", size: 5, delay: 0.04 },
  { x: -96, y: 48, rot: -30, color: "#C084FC", size: 5, delay: 0.09 },
  { x: 96, y: 50, rot: 35, color: "#FB7185", size: 6, delay: 0.08 },
  { x: 0, y: 58, rot: 45, color: "#F0B95B", size: 5, delay: 0.06 },
];

const AUTO_DISMISS_MS = 5800;

export function BadgeUnlockToast() {
  const { badgeUnlockQueue, dismissBadgeUnlock, profile } = useShiori();
  const [paused, setPaused] = useState(false);

  const active = badgeUnlockQueue[0] ?? null;
  const remainingCount = Math.max(0, badgeUnlockQueue.length - 1);

  useEffect(() => {
    if (!active || paused) return;
    const timer = setTimeout(() => {
      dismissBadgeUnlock();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [active, paused, dismissBadgeUnlock]);

  const meta = active ? RARITY_META[active.rarity] : null;

  return (
    <div
      aria-live="polite"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[95] w-[calc(100vw-1.5rem)] max-w-md pointer-events-none flex justify-center"
    >
      <AnimatePresence mode="wait">
        {active && meta && (
          <motion.div
            key={`${active.id}-${active.unlockedAt ?? ""}`}
            initial={{ opacity: 0, y: -28, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 360, damping: 26 }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            style={{ boxShadow: meta.glow }}
            className={cn(
              "pointer-events-auto relative w-full rounded-2xl border p-4 overflow-hidden",
              "badge-shine-sweep",
              active.rarity === "mythic" ||
                active.rarity === "legendary" ||
                active.rarity === "gold"
                ? "badge-shine-loop"
                : "badge-shine-auto",
              meta.bg,
              meta.border
            )}
          >
            {/* Holographic / Mythic ambient aura */}
            {active.rarity === "mythic" ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-6 badge-mythic-aura"
              />
            ) : active.rarity === "legendary" ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-6 badge-holo-aura"
              />
            ) : null}

            {/* Lightweight GPU confetti sparkles burst */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-10 top-10 w-0 h-0 z-10"
            >
              {CONFETTI_PARTICLES.map((p, idx) => (
                <motion.span
                  key={idx}
                  initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
                  animate={{
                    x: p.x,
                    y: p.y,
                    scale: [0, 1.2, 0.85, 0],
                    opacity: [1, 1, 0.8, 0],
                    rotate: p.rot,
                  }}
                  transition={{
                    duration: 1.15,
                    delay: p.delay,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={{
                    width: p.size,
                    height: p.size,
                    backgroundColor: p.color,
                  }}
                  className="absolute rounded-[2px] shadow-sm"
                />
              ))}
            </div>

            <div className="relative z-10 flex items-start gap-3.5">
              {/* Glowing Trophy Medallion */}
              <motion.div
                initial={{ rotate: -14, scale: 0.75 }}
                animate={{ rotate: [0, -6, 6, 0], scale: 1 }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shrink-0 ring-2 ring-white/25 shadow-xl relative",
                  meta.iconBg
                )}
              >
                <BadgeIcon iconKey={active.iconKey} className="w-7 h-7 text-[#08090E] drop-shadow" />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#090B12] border border-white/25 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                </span>
              </motion.div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.18em] text-[#D8DCEB]">
                    <Trophy className="w-3 h-3 text-amber-300" />
                    <span>Nouveau badge débloqué</span>
                  </span>
                  <button
                    type="button"
                    onClick={dismissBadgeUnlock}
                    aria-label="Fermer la notification de badge"
                    className="w-6 h-6 rounded-full bg-white/[0.08] hover:bg-white/[0.18] flex items-center justify-center text-[#C8CCE0] hover:text-white transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <h3 className="text-base font-bold text-white tracking-tight leading-snug">
                    {active.title}
                  </h3>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider",
                      meta.pillClass
                    )}
                  >
                    {meta.shortLabel}
                  </span>
                </div>

                <p className="text-xs text-[#C4C8D8] mt-1 leading-relaxed">
                  {active.description}
                </p>

                <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-white/[0.09]">
                  <Link
                    href={`/profile/${encodeURIComponent(profile.username)}#badges`}
                    onClick={dismissBadgeUnlock}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-white hover:text-accent-soft transition-colors"
                  >
                    <span>Voir mes trophées & épingler</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                  {remainingCount > 0 && (
                    <span className="text-[10.5px] font-mono text-[#9EA3B5]">
                      +{remainingCount} autre{remainingCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Subtle countdown bar */}
            {!paused && (
              <motion.div
                key={`bar-${active.id}-${active.unlockedAt ?? ""}`}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: AUTO_DISMISS_MS / 1000, ease: "linear" }}
                className={cn(
                  "absolute bottom-0 left-0 right-0 h-[2.5px] origin-left bg-gradient-to-r",
                  meta.iconBg
                )}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
