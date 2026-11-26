"use client";

import React from "react";
import { motion } from "framer-motion";
import { CINEMA_EASE } from "@/components/motion/MotionPrimitives";

/**
 * Pure GPU-composited route entrance (opacity + translateY ONLY — zero blur repaints).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {/* Fast luminous Akane silk sweep on route arrival */}
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0.42, scaleX: 0 }}
        animate={{ opacity: [0.42, 0.18, 0], scaleX: [0, 1, 1] }}
        transition={{ duration: 0.36, ease: CINEMA_EASE, times: [0, 0.42, 1] }}
        style={{ transformOrigin: "left center" }}
        className="pointer-events-none fixed top-0 inset-x-0 h-[130px] z-[40] bg-gradient-to-b from-accent/[0.14] via-kinpaku/[0.04] to-transparent will-change-transform"
      />

      {/* Silky 120fps Pure-GPU Editorial Page Entrance */}
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.995 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: CINEMA_EASE }}
      >
        {children}
      </motion.div>
    </div>
  );
}
