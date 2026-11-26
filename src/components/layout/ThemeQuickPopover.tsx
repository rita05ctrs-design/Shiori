"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette,
  Check,
  Flower2,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { getSettingsCopy } from "@/lib/settings-translations";
import {
  SURFACE_OPTIONS,
  THEME_PRESETS,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeQuickPopover() {
  const {
    theme,
    updateTheme,
    applyThemePreset,
    resetTheme,
    ambiance,
    updateAmbiance,
    contentLanguage,
  } = useShiori();
  const fullCopy = getSettingsCopy(contentLanguage);
  const copy = fullCopy.theme;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const currentAmbianceLabel =
    fullCopy.ambiance.effects[ambiance.effect]?.label ?? fullCopy.ambiance.title;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={copy.title}
        title={copy.title}
        className={cn(
          "relative w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full border flex items-center justify-center transition-all cursor-pointer",
          open
            ? "bg-accent/20 border-accent/55 text-white"
            : "bg-white/[0.045] hover:bg-white/[0.09] border-white/[0.08] hover:border-white/[0.18] text-[#B8BCCB] hover:text-white"
        )}
      >
        <Palette className="w-4 h-4" />
        <span
          className="absolute bottom-1 right-1 w-2 h-2 rounded-full ring-2 ring-obsidian"
          style={{ backgroundColor: theme.accentColor }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-x-3 top-[calc(4rem+env(safe-area-inset-top))] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2.5 sm:w-[340px] max-w-[calc(100vw-1.5rem)] rounded-2xl bg-surface-solid border border-white/[0.13] shadow-[0_28px_72px_rgba(0,0,0,0.92)] overflow-hidden z-50"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/[0.08] bg-surface-solid-header flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-accent" />
                <span className="text-xs font-semibold text-white">
                  {copy.title}
                </span>
              </div>
              <button
                type="button"
                onClick={resetTheme}
                title={copy.defaultBtn}
                className="inline-flex items-center gap-1 text-[11px] text-[#9A9EAE] hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{copy.defaultShort}</span>
              </button>
            </div>

            <div className="p-3.5 space-y-3.5">
              {/* 8 Preset Swatches */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-[#858A9E] mb-2">
                  {copy.quickTitle}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {THEME_PRESETS.map((preset) => {
                    const active = theme.presetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyThemePreset(preset.id)}
                        className={cn(
                          "px-2.5 py-2 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer",
                          active
                            ? "bg-white/[0.09] border-white/[0.26] text-white"
                            : "bg-white/[0.025] border-white/[0.07] text-[#C8CCE0] hover:bg-white/[0.06] hover:text-white"
                        )}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0 border border-white/25 flex items-center justify-center"
                          style={{ backgroundColor: preset.accentColor }}
                        >
                          {active && (
                            <Check className="w-2.5 h-2.5 text-[#090A0F] stroke-[3]" />
                          )}
                        </span>
                        <span className="text-[11.5px] font-medium truncate">
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Accent Color Picker Bar */}
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <span className="text-[11.5px] text-[#C6CAD8]">{copy.customColor}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-[#9A9EAE]">
                    {theme.accentColor}
                  </span>
                  <label
                    title={copy.customColor}
                    className="relative w-6 h-6 rounded-md border border-white/25 overflow-hidden cursor-pointer"
                    style={{ backgroundColor: theme.accentColor }}
                  >
                    <input
                      type="color"
                      aria-label={copy.customColor}
                      value={theme.accentColor}
                      onChange={(e) =>
                        updateTheme({ accentColor: e.target.value, presetId: "custom" })
                      }
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Background Surface Selector */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-[#858A9E] mb-1.5">
                  {copy.appBg}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {SURFACE_OPTIONS.map((surf) => {
                    const active = theme.surface === surf.id;
                    return (
                      <button
                        key={surf.id}
                        type="button"
                        onClick={() => updateTheme({ surface: surf.id })}
                        className={cn(
                          "px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer truncate",
                          active
                            ? "bg-accent/18 border-accent/50 text-accent-soft"
                            : "bg-white/[0.03] border-white/[0.07] text-[#A2A6B8] hover:text-white hover:bg-white/[0.06]"
                        )}
                      >
                        {copy.surfaces[surf.id].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Particle Toggle */}
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <span className="text-[11.5px] text-[#C6CAD8] flex items-center gap-1.5 truncate">
                  <Flower2 className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="truncate">{currentAmbianceLabel}</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateAmbiance({
                      effect: ambiance.effect === "none" ? "sakura" : "none",
                    })
                  }
                  className={cn(
                    "px-2.5 py-0.5 rounded-md text-[10.5px] font-mono font-semibold border transition-colors cursor-pointer shrink-0",
                    ambiance.effect === "none"
                      ? "bg-white/[0.05] border-white/[0.1] text-[#8E93A6] hover:text-white"
                      : "bg-accent/20 border-accent/45 text-accent-soft"
                  )}
                >
                  {ambiance.effect === "none" ? "OFF" : "ON"}
                </button>
              </div>
            </div>

            {/* Footer link to full Studio */}
            <Link
              href="/settings#personnalisation"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 border-t border-white/[0.08] bg-surface-solid-header text-xs font-semibold text-accent-soft hover:text-white transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{copy.fullStudioLink}</span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
