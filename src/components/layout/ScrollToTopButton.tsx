"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Discreet obsidian floating scroll-to-top button that appears smoothly
 * after scrolling past 600px, positioned bottom-left so it never collides
 * with Shiori IA (bottom-right) or toasts.
 */
export function ScrollToTopButton() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setVisible(window.scrollY > 600);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          transition={{ duration: 0.18 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label={t("home.scrollTop")}
          title={t("home.scrollTop")}
          className="fixed left-4 sm:left-6 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-6 z-[45] w-10 h-10 rounded-full bg-surface-solid/90 hover:bg-accent backdrop-blur-md border border-white/[0.12] hover:border-accent text-[#D6D9E6] hover:text-accent-fg shadow-[0_12px_30px_rgba(0,0,0,0.6)] flex items-center justify-center transition-colors cursor-pointer active:scale-95"
        >
          <ArrowUp className="w-4 h-4" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
