"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Heart,
  Minus,
  Plus,
  Star,
  Trash2,
  Check,
  Bookmark,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import {
  cn,
  getDisplayTitle,
  getStatusLabel,
  STATUS_CONFIG,
} from "@/lib/utils";
import type { LibraryEntry, LibraryStatus, MediaItem } from "@/types/media";

const STATUSES: LibraryStatus[] = [
  "WATCHING",
  "COMPLETED",
  "ON_HOLD",
  "PLAN_TO_WATCH",
  "DROPPED",
];

function extractInfo(item: MediaItem | LibraryEntry) {
  if ("mediaId" in item) {
    return {
      id: item.mediaId,
      title: item.title,
      type: item.type,
      coverImage: item.coverImage,
      bannerImage: item.bannerImage,
      totalUnits: item.totalUnits,
    };
  }
  return {
    id: item.id,
    title: getDisplayTitle(item),
    type: item.type,
    coverImage: item.coverImage.extraLarge,
    bannerImage: item.bannerImage,
    totalUnits: item.type === "MANGA" ? item.chapters : item.episodes,
  };
}

export function QuickEditModal() {
  const { editingMedia, closeQuickEdit, getEntry, upsertEntry, removeEntry } =
    useShiori();

  const [status, setStatus] = useState<LibraryStatus>("WATCHING");
  const [progress, setProgress] = useState<number>(0);
  const [score, setScore] = useState<number | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [notes, setNotes] = useState("");

  const info = editingMedia ? extractInfo(editingMedia) : null;
  const existing = info ? getEntry(info.id) : undefined;

  useEffect(() => {
    if (!editingMedia || !info) return;
    if (existing) {
      setStatus(existing.status);
      setProgress(existing.progress);
      setScore(existing.score);
      setIsFavorite(existing.isFavorite);
      setNotes(existing.notes ?? "");
    } else {
      setStatus("WATCHING");
      setProgress(0);
      setScore(null);
      setIsFavorite(false);
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingMedia]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editingMedia) closeQuickEdit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingMedia, closeQuickEdit]);

  const handleStatusChange = (next: LibraryStatus) => {
    setStatus(next);
    if (next === "COMPLETED" && info?.totalUnits) {
      setProgress(info.totalUnits);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMedia) return;
    upsertEntry(editingMedia, {
      status,
      progress,
      score,
      isFavorite,
      notes: notes.trim(),
    });
    closeQuickEdit();
  };

  const handleRemove = () => {
    if (!info) return;
    removeEntry(info.id);
    closeQuickEdit();
  };

  const unitLabel = info?.type === "MANGA" ? "Chapitres" : "Épisodes";

  return (
    <AnimatePresence>
      {editingMedia && info && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeQuickEdit}
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
          />

          <motion.form
            onSubmit={handleSave}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-xl rounded-2xl bg-[#10121B] border border-white/[0.11] shadow-[0_32px_90px_rgba(0,0,0,0.85)] overflow-hidden"
          >
            {/* Header Banner */}
            <div className="relative h-32 overflow-hidden bg-[#161926]">
              {info.bannerImage ? (
                <img
                  src={info.bannerImage}
                  alt=""
                  className="w-full h-full object-cover opacity-55"
                />
              ) : (
                <img
                  src={info.coverImage}
                  alt=""
                  className="w-full h-full object-cover opacity-30 blur-xl scale-110"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#10121B] via-[#10121B]/55 to-transparent" />

              <button
                type="button"
                onClick={closeQuickEdit}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="absolute bottom-3 left-5 right-5 flex items-end gap-4">
                <img
                  src={info.coverImage}
                  alt={info.title}
                  className="w-14 h-20 rounded-lg object-cover border border-white/15 shadow-lg shrink-0"
                />
                <div className="min-w-0 flex-1 pb-0.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.16em] text-[#F45B62]">
                    <Bookmark className="w-3 h-3 fill-current" />
                    {info.type === "MANGA" ? "Manga" : "Anime"}
                  </span>
                  <h3 className="text-base sm:text-lg font-semibold text-white truncate">
                    {info.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFavorite((v) => !v)}
                  title="Coup de cœur"
                  className={cn(
                    "w-9 h-9 rounded-full border flex items-center justify-center transition-all cursor-pointer shrink-0",
                    isFavorite
                      ? "bg-[#E5484D]/20 border-[#E5484D]/50 text-[#F45B62]"
                      : "bg-white/[0.05] border-white/[0.1] text-[#9A9EAE] hover:text-white"
                  )}
                >
                  <Heart className={cn("w-4 h-4", isFavorite && "fill-current")} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-5 max-h-[68vh] overflow-y-auto">
              {/* Status Selector */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[#858A9E] mb-2">
                  Statut
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STATUSES.map((s) => {
                    const cfg = STATUS_CONFIG[s];
                    const active = status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleStatusChange(s)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-medium border transition-all flex items-center gap-2 cursor-pointer",
                          active
                            ? `${cfg.bg} ${cfg.border} ${cfg.color} shadow-sm`
                            : "bg-white/[0.03] border-white/[0.07] text-[#9A9EAE] hover:bg-white/[0.06] hover:text-white"
                        )}
                      >
                        <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dot)} />
                        <span className="truncate">{getStatusLabel(s, info.type)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Progress + Score Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Progress Stepper */}
                <div className="p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.07]">
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#858A9E]">
                      {unitLabel}
                    </label>
                    <span className="text-xs font-mono text-[#9A9EAE]">
                      {info.totalUnits ? `/ ${info.totalUnits}` : "En cours"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setProgress((p) => Math.max(0, p - 1))}
                      className="w-9 h-9 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={info.totalUnits ?? 9999}
                      value={progress}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value) || 0);
                        setProgress(info.totalUnits ? Math.min(info.totalUnits, v) : v);
                      }}
                      className="flex-1 h-9 rounded-lg bg-[#090A0F] border border-white/[0.09] text-center font-mono text-sm text-white focus:outline-none focus:border-[#E5484D]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setProgress((p) =>
                          info.totalUnits ? Math.min(info.totalUnits, p + 1) : p + 1
                        )
                      }
                      className="w-9 h-9 rounded-lg bg-[#E5484D]/20 hover:bg-[#E5484D]/35 border border-[#E5484D]/35 flex items-center justify-center text-[#FF8A8E] cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Score Picker */}
                <div className="p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.07]">
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#858A9E]">
                      Note personnelle
                    </label>
                    <span className="text-xs font-mono text-[#F0B95B] flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" />
                      {score !== null ? `${score.toFixed(1)} / 10` : "Non noté"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={0.5}
                      value={score ?? 0}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setScore(v === 0 ? null : v);
                      }}
                      className="flex-1 accent-[#F0B95B] cursor-pointer"
                    />
                    {score !== null && (
                      <button
                        type="button"
                        onClick={() => setScore(null)}
                        className="text-[11px] text-[#858A9E] hover:text-white px-2 py-1 rounded bg-white/[0.05] cursor-pointer"
                      >
                        Effacer
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal Notes */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[#858A9E] mb-2">
                  Notes & critiques personnelles
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Vos impressions, épisodes mémorables, citation favorite..."
                  className="w-full rounded-xl bg-[#090A0F] border border-white/[0.09] px-3.5 py-2.5 text-sm text-[#ECEBE6] placeholder:text-[#5F6477] focus:outline-none focus:border-[#E5484D]/60 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/[0.07] bg-white/[0.02] flex items-center justify-between gap-3">
              {existing ? (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/12 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Retirer</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={closeQuickEdit}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#A1A5B7] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#E5484D] hover:bg-[#F2545B] text-white text-xs font-semibold shadow-[0_8px_24px_rgba(229,72,77,0.38)] transition-all cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{existing ? "Enregistrer" : "Ajouter à ma liste"}</span>
                </button>
              </div>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}
