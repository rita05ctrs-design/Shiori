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
        initial={{ opacity: 0.36, scaleX: 0 }}
        animate={{ opacity: [0.36, 0.16, 0], scaleX: [0, 1, 1] }}
        transition={{ duration: 0.42, ease: CINEMA_EASE, times: [0, 0.45, 1] }}
        style={{ transformOrigin: "left center" }}
        className="pointer-events-none fixed top-0 inset-x-0 h-[120px] z-[40] bg-gradient-to-b from-accent/[0.12] to-transparent will-change-transform"
      />

      {/* Crisp 60/120fps Page Entrance */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, ease: CINEMA_EASE }}
      >
        {children}
      </motion.div>
    </div>
  );
}
