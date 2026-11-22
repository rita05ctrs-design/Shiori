"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, X } from "lucide-react";
import { CINEMA_EASE } from "@/components/motion/MotionPrimitives";
import { cn } from "@/lib/utils";

export interface LuxurySelectOption {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: string;
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
  className,
}: LuxurySelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value) ?? options[0];
  const isActive = value !== defaultValue;
  const SelectedOptionIcon = selected?.icon ?? TriggerIcon;

  useEffect(() => {
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
  }, []);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {label && (
        <span className="block text-[10.5px] font-mono uppercase tracking-[0.16em] text-[#7A7F94] mb-1.5">
          {label}
        </span>
      )}

      {/* Glass Trigger Button */}
      <motion.button
        type="button"
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.985 }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "w-full h-10 px-3.5 rounded-xl border flex items-center justify-between gap-2 text-left transition-all cursor-pointer",
          open
            ? "bg-[#151826] border-accent/60 shadow-[0_0_24px_rgb(var(--shiori-accent-rgb)/0.18)] text-white"
            : isActive
              ? "bg-accent/[0.1] border-accent/40 text-accent-fg hover:border-accent/65"
              : "bg-[#090B12] border-white/[0.09] text-[#D8DBE6] hover:border-white/[0.2] hover:bg-[#111420]"
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          {SelectedOptionIcon && (
            <SelectedOptionIcon
              className={cn(
                "w-3.5 h-3.5 shrink-0 transition-colors",
                isActive ? "text-[#FF8A8E]" : selected?.accent || "text-[#8C91A6]"
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
              title="Réinitialiser ce filtre"
              onClick={(e) => {
                e.stopPropagation();
                onChange(defaultValue);
              }}
              className="w-4.5 h-4.5 rounded-full bg-white/[0.1] hover:bg-accent text-[#D2D5E0] hover:text-accent-fg flex items-center justify-center transition-colors"
            >
              <X className="w-2.5 h-2.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-[#8A8FA4] transition-transform duration-300",
              open && "rotate-180 text-[#FF8A8E]"
            )}
          />
        </span>
      </motion.button>

      {/* Frosted Animated Popover Menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, scale: 0.96, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className={cn(
              "absolute mt-2 z-50 rounded-2xl bg-[#10121D]/98 backdrop-blur-2xl border border-white/[0.13] shadow-[0_24px_64px_rgba(0,0,0,0.88)] p-1.5 max-h-[300px] overflow-y-auto",
              columns > 1 ? "w-[260px] sm:w-[290px]" : "min-w-full w-max max-w-[260px]",
              align === "right" ? "right-0" : "left-0"
            )}
          >
            <div
              className={cn(
                columns === 4
                  ? "grid grid-cols-4 gap-1"
                  : columns === 3
                    ? "grid grid-cols-3 gap-1"
                    : "space-y-0.5"
              )}
            >
              {options.map((opt, idx) => {
                const isSelected = opt.id === value;
                const OptIcon = opt.icon;

                if (columns > 1) {
                  const isResetOpt = opt.id === defaultValue;
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => {
                        onChange(opt.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "h-8 px-2 rounded-lg font-mono text-xs font-medium border transition-colors cursor-pointer flex items-center justify-center",
                        isResetOpt && "col-span-full mb-1 font-sans",
                        isSelected
                          ? "bg-accent border-accent-hover text-accent-fg shadow-[0_4px_14px_rgb(var(--shiori-accent-rgb)/0.4)]"
                          : "bg-white/[0.03] border-white/[0.06] text-[#C6CAD8] hover:bg-white/[0.09] hover:text-white"
                      )}
                    >
                      {opt.label}
                    </motion.button>
                  );
                }

                return (
                  <motion.button
                    key={opt.id}
                    type="button"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.16,
                      delay: Math.min(idx * 0.02, 0.14),
                      ease: CINEMA_EASE,
                    }}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onChange(opt.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full px-3 py-2 rounded-xl flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer",
                      isSelected
                        ? "bg-accent/18 border border-accent/40 text-accent-fg"
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
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-accent-soft shrink-0" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
