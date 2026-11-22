"use client";

import React from "react";
import { motion } from "framer-motion";
import { CINEMA_EASE } from "@/components/motion/MotionPrimitives";

/**
 * Next.js App Router template: remounts cleanly on every route navigation,
 * delivering a signature Shiori silk-ribbon reveal + cinematic depth entrance.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {/* Ultra-brief Akane silk shimmer veil that sweeps gracefully on route arrival */}
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0.42, scaleX: 0 }}
        animate={{ opacity: [0.42, 0.22, 0], scaleX: [0, 1, 1] }}
        transition={{ duration: 0.55, ease: CINEMA_EASE, times: [0, 0.45, 1] }}
        style={{ transformOrigin: "left center" }}
        className="pointer-events-none fixed top-0 inset-x-0 h-[180px] z-[40] bg-gradient-to-b from-[#E5484D]/[0.14] via-[#E5484D]/[0.03] to-transparent"
      />

      {/* Page Cinema Entrance */}
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.992, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.48, ease: CINEMA_EASE }}
      >
        {children}
      </motion.div>
    </div>
  );
}
