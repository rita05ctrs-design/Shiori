"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play } from "lucide-react";
import { useShiori } from "@/context/ShioriContext";

export function TrailerModal() {
  const { trailerVideo, closeTrailer } = useShiori();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && trailerVideo) closeTrailer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trailerVideo, closeTrailer]);

  return (
    <AnimatePresence>
      {trailerVideo && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-3 sm:px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeTrailer}
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-4xl rounded-2xl overflow-hidden bg-[#0A0C12] border border-white/[0.12] shadow-[0_32px_100px_rgba(0,0,0,0.9)]"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08]">
              <div className="flex items-center gap-2 min-w-0">
                <Play className="w-4 h-4 text-accent fill-current shrink-0" />
                <span className="text-sm font-medium text-white truncate">
                  Bande-annonce — {trailerVideo.title}
                </span>
              </div>
              <button
                type="button"
                onClick={closeTrailer}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="aspect-video bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${trailerVideo.id}?autoplay=1&rel=0`}
                title={`Trailer ${trailerVideo.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
