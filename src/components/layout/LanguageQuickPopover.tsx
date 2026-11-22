"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Languages } from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { CONTENT_LANGUAGE_MAP, CONTENT_LANGUAGES } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageQuickPopover() {
  const { contentLanguage, setContentLanguage } = useShiori();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = CONTENT_LANGUAGE_MAP.get(contentLanguage) ?? CONTENT_LANGUAGES[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Langue des synopsis : ${active.label}`}
        aria-expanded={open}
        title={`Langue des synopsis : ${active.label}`}
        className={cn(
          "h-9 px-2.5 rounded-full border flex items-center gap-1.5 transition-all cursor-pointer",
          open
            ? "bg-accent/20 border-accent/55 text-white"
            : "bg-white/[0.045] hover:bg-white/[0.09] border-white/[0.08] hover:border-white/[0.18] text-[#B8BCCB] hover:text-white"
        )}
      >
        <Languages className="w-3.5 h-3.5 text-accent-soft" />
        <span className="font-mono text-[11px] font-bold tracking-wider">
          {active.code}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="fixed inset-x-3 top-[calc(4rem+env(safe-area-inset-top))] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-64 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-[#0D101A]/98 border border-white/[0.12] shadow-[0_24px_60px_rgba(0,0,0,0.82)] p-2.5 z-50 space-y-1.5"
          >
            <div className="px-2 py-1 border-b border-white/[0.07]">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-accent-soft">
                Langue des synopsis
              </p>
              <p className="text-[11px] text-[#8E93A6] mt-0.5">
                Traduction à la volée avec cache
              </p>
            </div>

            <div className="space-y-1">
              {CONTENT_LANGUAGES.map((lang) => {
                const isSelected = lang.id === contentLanguage;
                return (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => {
                      setContentLanguage(lang.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full px-2.5 py-2 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-colors cursor-pointer",
                      isSelected
                        ? "bg-accent/18 border-accent/45 text-white"
                        : "bg-transparent hover:bg-white/[0.06] border-transparent text-[#C8CCE0] hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cn(
                          "w-7 h-7 rounded-lg font-mono text-[11px] font-bold flex items-center justify-center shrink-0 border",
                          isSelected
                            ? "bg-accent text-accent-fg border-accent"
                            : "bg-white/[0.05] text-[#B8BCCB] border-white/[0.09]"
                        )}
                      >
                        {lang.code}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{lang.label}</p>
                        <p className="text-[10px] text-[#858A9E] truncate">
                          {lang.isAutoTranslated ? "Traduit + mis en cache" : "Texte AniList natif"}
                        </p>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-accent-soft shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
