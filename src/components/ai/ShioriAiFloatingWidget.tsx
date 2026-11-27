"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

const ShioriAiChatPanel = dynamic(
  () => import("@/components/ai/ShioriAiChatPanel").then((m) => m.ShioriAiChatPanel),
  { ssr: false }
);

/**
 * Floating conversational AI assistant button on desktop (`>= 768px`).
 * On mobile (`< 768px`), users access Shiori IA directly from the 4th Bottom Nav tab (`Profil/IA`).
 * Automatically hides on `/assistant` to avoid duplicating the full-page chat.
 */
export function ShioriAiFloatingWidget() {
  const pathname = usePathname();
  const { t, tr } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the floating assistant when navigating to another page
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape or when clicking/tapping anywhere outside the widget
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onOutsidePointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutsidePointer, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutsidePointer, true);
    };
  }, [open]);

  if (pathname.startsWith("/assistant")) {
    return null;
  }

  return (
    <div ref={containerRef} className="hidden md:block fixed bottom-6 right-6 z-[60]">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="mb-3 w-[410px] lg:w-[440px] h-[560px] max-h-[calc(100vh-8rem)]"
          >
            <ShioriAiChatPanel
              compact
              onClose={() => setOpen(false)}
              onNavigate={() => setOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? tr("Fermer l'assistant Shiori IA") : tr("Ouvrir l'assistant Shiori IA")}
        aria-expanded={open}
        className="ml-auto flex items-center gap-2.5 h-12 px-4 rounded-full bg-gradient-to-r from-accent via-accent to-accent-deep hover:brightness-110 text-accent-fg border border-white/20 shadow-[0_14px_38px_rgba(229,72,77,0.48)] font-semibold text-xs transition-all cursor-pointer"
      >
        {open ? (
          <>
            <X className="w-4 h-4" />
            <span>{t("ai.closeAi")}</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 text-kinpaku" />
            <span>{t("ai.pageTitle")}</span>
          </>
        )}
      </motion.button>
    </div>
  );
}
