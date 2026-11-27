"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, X, Search } from "lucide-react";
import { CINEMA_EASE } from "@/components/motion/MotionPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export interface LuxurySelectOption {
  id: string;
  label: string;
  hint?: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: string;
  /** Optional column span when rendering in a multi-column grid (e.g. Era ranges inside Year selector) */
  colSpan?: 2 | 4;
  /** Optional non-clickable section divider label inside a multi-column grid */
  groupHeader?: boolean;
}

interface LuxurySelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: LuxurySelectOption[];
  icon?: React.ComponentType<{ className?: string }>;
  defaultValue?: string;
  /** Render options in a compact multi-column grid (ideal for Years) */
  columns?: 1 | 3 | 4;
  align?: "left" | "right";
  /** Show an inline search box inside the popover (auto-enabled when > 9 single-column options) */
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
}

export function LuxurySelect({
  label,
  value,
  onChange,
  options,
  icon: TriggerIcon,
  defaultValue = "ALL",
  columns = 1,
  align = "left",
  searchable,
  searchPlaceholder,
  className,
}: LuxurySelectProps) {
  const { tr } = useTranslation();
  const resolvedSearchPlaceholder = searchPlaceholder ?? tr("Filtrer...");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selected =
    options.find((o) => !o.groupHeader && o.id === value) ??
    (value === defaultValue ? options[0] : undefined);
  const isActive = value !== defaultValue;
  const SelectedOptionIcon = selected?.icon ?? TriggerIcon;
  const showSearch = searchable ?? (columns === 1 && options.length > 9);

  const visibleOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.id === defaultValue ||
        o.label.toLowerCase().includes(q) ||
        (o.hint && o.hint.toLowerCase().includes(q))
    );
  }, [options, query, defaultValue]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    if (showSearch) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open, showSearch]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {label && (
        <span className="block text-[10.5px] font-medium tracking-wide text-[#9A9EAE] mb-1.5 pl-0.5">
          {label}
        </span>
      )}

      {/* Frosted Glass Trigger Button */}
      <motion.button
        type="button"
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.985 }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "w-full h-10 px-3.5 rounded-xl border flex items-center justify-between gap-2 text-left transition-all cursor-pointer ring-1 ring-inset",
          open
            ? "bg-[#151828] border-accent/60 ring-accent/20 shadow-[0_0_24px_rgb(var(--shiori-accent-rgb)/0.18)] text-white"
            : isActive
              ? "bg-accent/[0.12] border-accent/45 ring-accent/15 text-white hover:border-accent/70"
              : "bg-obsidian/80 border-white/[0.09] ring-white/[0.03] text-[#D8DBE6] hover:border-white/[0.2] hover:bg-[#111420] hover:text-white"
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          {SelectedOptionIcon && (
            <SelectedOptionIcon
              className={cn(
                "w-3.5 h-3.5 shrink-0 transition-colors",
                isActive ? "text-accent-soft" : selected?.accent || "text-[#8C91A6]"
              )}
            />
          )}
          <span className="text-xs font-medium truncate">
            {selected?.label ?? value}
          </span>
        </span>

        <span className="flex items-center gap-1 shrink-0">
          {isActive && (
            <span
              role="button"
              tabIndex={-1}
              title={tr("Réinitialiser ce filtre")}
              onClick={(e) => {
                e.stopPropagation();
                onChange(defaultValue);
              }}
              className="w-4.5 h-4.5 rounded-full bg-white/[0.12] hover:bg-accent text-white hover:text-accent-fg flex items-center justify-center transition-colors"
            >
              <X className="w-2.5 h-2.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-[#8A8FA4] transition-transform duration-250",
              open && "rotate-180 text-accent-soft"
            )}
          />
        </span>
      </motion.button>

      {/* Frosted Animated Popover Menu (Mobile Bottom Sheet <640px, Anchored Popover >=640px) */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[89] sm:hidden"
            />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 440, damping: 32 }}
              className={cn(
                "fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[90] max-h-[62dvh] flex flex-col",
                "sm:absolute sm:inset-x-auto sm:bottom-auto sm:mt-2 sm:z-50 sm:max-h-none",
                "rounded-2xl bg-surface-solid/98 backdrop-blur-2xl border border-white/[0.14] ring-1 ring-inset ring-white/[0.05] shadow-[0_24px_64px_rgba(0,0,0,0.92)] overflow-hidden",
                columns > 1
                  ? "sm:w-[290px]"
                  : "sm:min-w-full sm:w-max sm:max-w-[270px]",
                align === "right" ? "sm:right-0" : "sm:left-0"
              )}
            >
              {/* Mobile Sheet Header */}
              <div className="flex sm:hidden items-center justify-between gap-2 px-3.5 py-2.5 border-b border-white/[0.08] bg-obsidian/65 shrink-0">
                <span className="text-xs font-semibold text-white truncate">
                  {label ?? selected?.label ?? tr("Sélectionner")}
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={tr("Fermer")}
                  className="w-7 h-7 rounded-full bg-white/[0.07] hover:bg-white/[0.14] flex items-center justify-center text-[#C8CCE0] hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Optional Quick Search inside Long Dropdowns */}
              {showSearch && (
                <div className="p-2 border-b border-white/[0.07] bg-obsidian/55 shrink-0">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#7D8296] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={resolvedSearchPlaceholder}
                      className="w-full h-9 sm:h-8 pl-8 pr-7 rounded-lg bg-white/[0.04] border border-white/[0.08] text-base sm:text-xs text-white placeholder:text-[#686D82] focus:outline-none focus:border-accent/60"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#7D8296] hover:text-white cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="p-2 sm:p-1.5 max-h-[50dvh] sm:max-h-[290px] overflow-y-auto overscroll-contain">
              {visibleOptions.length === 0 ? (
                <p className="py-5 px-3 text-center text-xs text-[#7D8296]">
                  {tr("Aucune option trouvée")}
                </p>
              ) : (
                <div
                  className={cn(
                    columns === 4
                      ? "grid grid-cols-4 gap-1"
                      : columns === 3
                        ? "grid grid-cols-3 gap-1"
                        : "space-y-0.5"
                  )}
                >
                  {visibleOptions.map((opt, idx) => {
                    const isSelected = opt.id === value;
                    const OptIcon = opt.icon;

                    if (columns > 1) {
                      if (opt.groupHeader) {
                        return (
                          <div
                            key={opt.id}
                            className="col-span-full pt-1.5 pb-0.5 px-1 text-[10px] font-mono uppercase tracking-[0.14em] text-[#7D8296]"
                          >
                            {opt.label}
                          </div>
                        );
                      }
                      const isResetOpt = opt.id === defaultValue;
                      return (
                        <motion.button
                          key={opt.id}
                          type="button"
                          title={opt.hint}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.94 }}
                          onClick={() => {
                            onChange(opt.id);
                            setOpen(false);
                          }}
                          className={cn(
                            "h-8 px-2 rounded-lg font-mono text-xs font-medium border transition-colors cursor-pointer flex items-center justify-center gap-1.5 truncate",
                            isResetOpt && "col-span-full mb-0.5 font-sans",
                            opt.colSpan === 2 && "col-span-2 text-[11px]",
                            opt.colSpan === 4 && "col-span-full text-[11px]",
                            isSelected
                              ? "bg-accent border-accent-hover text-accent-fg shadow-[0_4px_14px_rgb(var(--shiori-accent-rgb)/0.4)]"
                              : "bg-white/[0.03] border-white/[0.06] text-[#C6CAD8] hover:bg-white/[0.09] hover:text-white"
                          )}
                        >
                          <span className="truncate">{opt.label}</span>
                          {typeof opt.count === "number" && (
                            <span
                              className={cn(
                                "text-[10px] font-mono shrink-0",
                                isSelected ? "opacity-85" : "text-[#7D8296]"
                              )}
                            >
                              {opt.count}
                            </span>
                          )}
                        </motion.button>
                      );
                    }

                    return (
                      <motion.button
                        key={opt.id}
                        type="button"
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.14,
                          delay: Math.min(idx * 0.015, 0.12),
                          ease: CINEMA_EASE,
                        }}
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => {
                          onChange(opt.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 rounded-xl flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer",
                          isSelected
                            ? "bg-accent/18 border border-accent/40 text-white"
                            : "border border-transparent text-[#C8CCE0] hover:bg-white/[0.065] hover:text-white"
                        )}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          {OptIcon && (
                            <OptIcon
                              className={cn(
                                "w-3.5 h-3.5 shrink-0",
                                isSelected
                                  ? "text-accent-soft"
                                  : opt.accent || "text-[#8A8FA4]"
                              )}
                            />
                          )}
                          <span className="min-w-0">
                            <span className="block text-xs font-medium leading-tight truncate">
                              {opt.label}
                            </span>
                            {opt.hint && (
                              <span className="block text-[10px] text-[#7D8296] mt-0.5 truncate">
                                {opt.hint}
                              </span>
                            )}
                          </span>
                        </span>

                        <span className="flex items-center gap-1.5 shrink-0">
                          {typeof opt.count === "number" && (
                            <span className="text-[10.5px] font-mono px-1.5 py-0.5 rounded-md bg-white/[0.05] text-[#8E93A6]">
                              {opt.count}
                            </span>
                          )}
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-accent-soft shrink-0" />
                          )}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
