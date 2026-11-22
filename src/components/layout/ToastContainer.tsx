"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Info, AlertTriangle, X, Sparkles } from "lucide-react";
import { useShiori } from "@/context/ShioriContext";

export function ToastContainer() {
  const { toasts, dismissToast } = useShiori();

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-[95] flex flex-col gap-2.5 pointer-events-none max-w-sm w-[calc(100vw-2rem)]">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 18, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto rounded-xl bg-[#141722]/95 backdrop-blur-xl border border-white/[0.11] shadow-[0_18px_45px_rgba(0,0,0,0.6)] p-3.5 flex items-start gap-3"
          >
            <div className="mt-0.5 shrink-0">
              {t.variant === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : t.variant === "warning" ? (
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              ) : t.variant === "info" ? (
                <Info className="w-4 h-4 text-sky-400" />
              ) : (
                <Sparkles className="w-4 h-4 text-[#F45B62]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-white leading-tight">{t.title}</p>
              {t.description && (
                <p className="text-xs text-[#9A9EAE] mt-0.5 leading-snug">{t.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="p-1 text-[#7D8296] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
