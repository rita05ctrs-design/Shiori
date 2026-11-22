"use client";

import React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  X,
  Sparkles,
  Bookmark,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { cn, STATUS_CONFIG } from "@/lib/utils";
import { CINEMA_EASE } from "@/components/motion/MotionPrimitives";

const SPARKLE_RAYS = [
  { x: -18, y: -16, delay: 0.05 },
  { x: 18, y: -18, delay: 0.08 },
  { x: -22, y: 6, delay: 0.12 },
  { x: 22, y: 8, delay: 0.1 },
  { x: 0, y: -24, delay: 0.06 },
];

export function ToastContainer() {
  const { toasts, dismissToast } = useShiori();

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-[95] flex flex-col gap-3 pointer-events-none max-w-[380px] w-[calc(100vw-2rem)]">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => {
          const statusCfg = t.status ? STATUS_CONFIG[t.status] : null;
          const isRichMedia = Boolean(t.coverImage);

          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 48, y: 12, scale: 0.9, filter: "blur(6px)" }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: 36, scale: 0.92, filter: "blur(4px)" }}
              transition={{ type: "spring", stiffness: 340, damping: 26 }}
              className={cn(
                "pointer-events-auto relative overflow-hidden rounded-2xl backdrop-blur-2xl border shadow-[0_24px_60px_rgba(0,0,0,0.75)]",
                t.celebrate
                  ? "bg-gradient-to-br from-[#191522]/96 via-[#12141F]/96 to-[#1A1015]/96 border-accent/35"
                  : "bg-[#131622]/95 border-white/[0.12]"
              )}
            >
              {/* Soft celebratory top sheen */}
              {t.celebrate && (
                <motion.div
                  aria-hidden="true"
                  initial={{ x: "-110%" }}
                  animate={{ x: "140%" }}
                  transition={{ duration: 0.95, ease: CINEMA_EASE }}
                  className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/[0.1] to-transparent skew-x-[-20deg]"
                />
              )}

              <div className="p-3.5 flex items-center gap-3.5 relative z-10">
                {/* Rich Poster Thumbnail with Animated Shiori Ribbon Drop */}
                {isRichMedia ? (
                  <div className="relative shrink-0">
                    <motion.div
                      initial={{ scale: 0.78, rotate: -4 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 360, damping: 20 }}
                      className="relative w-11 h-[62px] rounded-xl overflow-hidden border border-white/20 shadow-lg"
                    >
                      <img
                        src={t.coverImage}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    </motion.div>

                    {/* Animated Shiori Silk Bookmark Seal dropping onto the poster */}
                    <motion.div
                      initial={{ y: -14, scale: 0.4, opacity: 0 }}
                      animate={{ y: 0, scale: 1, opacity: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 18,
                        delay: 0.08,
                      }}
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-br from-accent-hover to-accent-deep border border-white/30 flex items-center justify-center shadow-[0_0_16px_rgb(var(--shiori-accent-rgb)/0.8)]"
                    >
                      <Bookmark className="w-3 h-3 text-white fill-white" />
                    </motion.div>

                    {/* Celebratory micro-sparkles */}
                    {t.celebrate &&
                      SPARKLE_RAYS.map((ray, i) => (
                        <motion.span
                          key={i}
                          aria-hidden="true"
                          initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                          animate={{
                            opacity: [0, 1, 0],
                            scale: [0.2, 1.15, 0],
                            x: ray.x,
                            y: ray.y,
                          }}
                          transition={{
                            duration: 0.7,
                            delay: ray.delay,
                            ease: CINEMA_EASE,
                          }}
                          className="pointer-events-none absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-[#F0B95B] shadow-[0_0_8px_#F0B95B]"
                        />
                      ))}
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.09] flex items-center justify-center shrink-0">
                    {t.variant === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : t.variant === "warning" ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    ) : t.variant === "info" ? (
                      <Info className="w-4 h-4 text-sky-400" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-accent-hover" />
                    )}
                  </div>
                )}

                {/* Copy */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-semibold text-white leading-tight">
                      {t.title}
                    </p>
                    {statusCfg && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold",
                          statusCfg.bg,
                          statusCfg.border,
                          statusCfg.color
                        )}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full", statusCfg.dot)} />
                        {statusCfg.shortLabel}
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <p className="text-xs text-[#A5A9BB] mt-1 leading-snug line-clamp-1">
                      {t.description}
                    </p>
                  )}
                  {isRichMedia && (
                    <Link
                      href="/library"
                      onClick={() => dismissToast(t.id)}
                      className="inline-block mt-1 text-[11px] font-medium text-[#FF8A8E] hover:text-white transition-colors"
                    >
                      Voir ma bibliothèque →
                    </Link>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => dismissToast(t.id)}
                  aria-label="Fermer la notification"
                  className="p-1.5 rounded-lg text-[#7D8296] hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer self-start"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Animated auto-dismiss hairline */}
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 3.4, ease: "linear" }}
                style={{ transformOrigin: "left center" }}
                className={cn(
                  "h-[2px] w-full",
                  t.celebrate
                    ? "bg-gradient-to-r from-accent via-accent-hover to-[#F0B95B]"
                    : "bg-white/25"
                )}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
