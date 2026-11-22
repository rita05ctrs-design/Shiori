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
  Play,
  CheckCircle2,
  PauseCircle,
  BookmarkPlus,
  XCircle,
  Sparkles,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { CINEMA_EASE } from "@/components/motion/MotionPrimitives";
import {
  cn,
  getDisplayTitle,
  getStatusLabel,
  STATUS_CONFIG,
} from "@/lib/utils";
import type { LibraryEntry, LibraryStatus, MediaItem } from "@/types/media";

const STATUS_ITEMS: {
  id: LibraryStatus;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "WATCHING", icon: Play },
  { id: "PLAN_TO_WATCH", icon: BookmarkPlus },
  { id: "COMPLETED", icon: CheckCircle2 },
  { id: "ON_HOLD", icon: PauseCircle },
  { id: "DROPPED", icon: XCircle },
];

const SCORE_VERDICT: Record<number, string> = {
  10: "Chef-d'œuvre",
  9: "Exceptionnel",
  8: "Excellent",
  7: "Très bon",
  6: "Sympa",
  5: "Moyen",
  4: "Faible",
  3: "Décevant",
  2: "Mauvais",
  1: "À éviter",
};

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
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [heartPulse, setHeartPulse] = useState(0);
  const [notes, setNotes] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  const info = editingMedia ? extractInfo(editingMedia) : null;
  const existing = info ? getEntry(info.id) : undefined;

  useEffect(() => {
    if (!editingMedia || !info) return;
    setSavedFlash(false);
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
    setSavedFlash(true);
    upsertEntry(editingMedia, {
      status,
      progress,
      score,
      isFavorite,
      notes: notes.trim(),
    });
    setTimeout(() => {
      closeQuickEdit();
    }, 180);
  };

  const handleRemove = () => {
    if (!info) return;
    removeEntry(info.id);
    closeQuickEdit();
  };

  const unitLabel = info?.type === "MANGA" ? "Chapitres" : "Épisodes";
  const pct =
    info?.totalUnits
      ? Math.min(100, Math.round((progress / info.totalUnits) * 100))
      : status === "COMPLETED"
        ? 100
        : progress > 0
          ? Math.min(85, 15 + progress * 3)
          : 0;

  const previewInt = hoverScore ?? (score !== null ? Math.floor(score) : null);
  const hasHalf = score !== null && score % 1 !== 0;

  return (
    <AnimatePresence>
      {editingMedia && info && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={closeQuickEdit}
            className="fixed inset-0 bg-black/80 backdrop-blur-lg"
          />

          <motion.form
            onSubmit={handleSave}
            initial={{ opacity: 0, y: 26, scale: 0.93, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 16, scale: 0.95, filter: "blur(6px)" }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="relative w-full max-w-xl rounded-3xl bg-[#0F111B] border border-white/[0.12] shadow-[0_36px_110px_rgba(0,0,0,0.9),0_0_60px_rgb(var(--shiori-accent-rgb)/0.12)] overflow-hidden"
          >
            {/* Header Banner */}
            <div className="relative h-36 overflow-hidden bg-[#161926]">
              {info.bannerImage ? (
                <motion.img
                  initial={{ scale: 1.08 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.7, ease: CINEMA_EASE }}
                  src={info.bannerImage}
                  alt=""
                  className="w-full h-full object-cover opacity-60"
                />
              ) : (
                <img
                  src={info.coverImage}
                  alt=""
                  className="w-full h-full object-cover opacity-35 blur-xl scale-110"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F111B] via-[#0F111B]/55 to-black/25" />

              <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.9 }}
                onClick={closeQuickEdit}
                className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </motion.button>

              <div className="absolute bottom-3.5 left-5 right-5 flex items-end gap-4">
                <motion.div
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.35, ease: CINEMA_EASE }}
                  className="relative shrink-0"
                >
                  <img
                    src={info.coverImage}
                    alt={info.title}
                    className="w-15 h-[86px] rounded-xl object-cover border border-white/20 shadow-[0_14px_30px_rgba(0,0,0,0.7)]"
                  />
                  <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-md bg-gradient-to-br from-accent-hover to-accent-deep border border-white/30 flex items-center justify-center font-serif text-[10px] text-accent-fg shadow">
                    栞
                  </span>
                </motion.div>

                <div className="min-w-0 flex-1 pb-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.18em] text-accent-soft">
                    <Bookmark className="w-3 h-3 fill-current" />
                    {existing ? "Modifier dans Shiori" : "Ajouter à Shiori"} ·{" "}
                    {info.type === "MANGA" ? "Manga" : "Anime"}
                  </span>
                  <h3 className="text-lg font-bold text-white truncate mt-0.5">
                    {info.title}
                  </h3>
                </div>

                {/* Heart button with burst */}
                <div className="relative shrink-0 pb-1">
                  <AnimatePresence>
                    {heartPulse > 0 && (
                      <motion.div
                        key={heartPulse}
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 0 }}
                        transition={{ duration: 0.55 }}
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                      >
                        {[0, 60, 120, 180, 240, 300].map((deg) => (
                          <motion.span
                            key={deg}
                            initial={{ scale: 0, x: 0, y: 0 }}
                            animate={{
                              scale: [0, 1.2, 0],
                              x: Math.cos((deg * Math.PI) / 180) * 20,
                              y: Math.sin((deg * Math.PI) / 180) * 20,
                            }}
                            transition={{ duration: 0.5, ease: CINEMA_EASE }}
                            className="absolute w-1.5 h-1.5 rounded-full bg-accent-hover"
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.85 }}
                    onClick={() => {
                      const next = !isFavorite;
                      setIsFavorite(next);
                      if (next) setHeartPulse(Date.now());
                    }}
                    title="Coup de cœur"
                    className={cn(
                      "w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer",
                      isFavorite
                        ? "bg-accent/25 border-accent/60 text-accent-soft shadow-[0_0_20px_rgb(var(--shiori-accent-rgb)/0.45)]"
                        : "bg-white/[0.06] border-white/[0.12] text-[#9A9EAE] hover:text-white"
                    )}
                  >
                    <Heart className={cn("w-4 h-4", isFavorite && "fill-current")} />
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-5 max-h-[64vh] overflow-y-auto">
              {/* Animated Status Cards with sliding layoutId highlight */}
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-[0.16em] text-[#858A9E] mb-2.5">
                  Catégorie
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STATUS_ITEMS.map(({ id: s, icon: Icon }) => {
                    const cfg = STATUS_CONFIG[s];
                    const active = status === s;
                    return (
                      <motion.button
                        key={s}
                        type="button"
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleStatusChange(s)}
                        className={cn(
                          "relative px-3 py-2.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-2 cursor-pointer overflow-hidden",
                          active
                            ? `${cfg.border} ${cfg.color}`
                            : "bg-white/[0.025] border-white/[0.07] text-[#9A9EAE] hover:bg-white/[0.06] hover:text-white"
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="quick-edit-status-active"
                            transition={{ type: "spring", stiffness: 380, damping: 28 }}
                            className={cn("absolute inset-0 rounded-xl", cfg.bg)}
                          />
                        )}
                        <Icon className="w-3.5 h-3.5 relative z-10 shrink-0" />
                        <span className="relative z-10 truncate">
                          {getStatusLabel(s, info.type)}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Progress Card */}
              <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.07] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono uppercase tracking-[0.15em] text-[#858A9E]">
                    {unitLabel}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#9A9EAE]">
                      {info.totalUnits ? `${progress} / ${info.totalUnits} (${pct}%)` : `${progress} lus/vus`}
                    </span>
                    {info.totalUnits && progress < info.totalUnits && (
                      <button
                        type="button"
                        onClick={() => {
                          setProgress(info.totalUnits!);
                          setStatus("COMPLETED");
                        }}
                        className="text-[10.5px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
                      >
                        Tout finir
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Glowing Progress Fill */}
                <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                  <motion.div
                    initial={false}
                    animate={{ width: `${pct}%` }}
                    transition={{ type: "spring", stiffness: 220, damping: 24 }}
                    className="h-full rounded-full bg-gradient-to-r from-accent via-accent-hover to-[#F0B95B]"
                  />
                </div>

                <div className="flex items-center gap-2.5">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setProgress((p) => Math.max(0, p - 1))}
                    className="w-10 h-10 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </motion.button>
                  <input
                    type="number"
                    min={0}
                    max={info.totalUnits ?? 9999}
                    value={progress}
                    onChange={(e) => {
                      const v = Math.max(0, Number(e.target.value) || 0);
                      setProgress(info.totalUnits ? Math.min(info.totalUnits, v) : v);
                    }}
                    className="flex-1 h-10 rounded-xl bg-[#08090E] border border-white/[0.09] text-center font-mono text-sm font-semibold text-white focus:outline-none focus:border-accent"
                  />
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() =>
                      setProgress((p) =>
                        info.totalUnits ? Math.min(info.totalUnits, p + 1) : p + 1
                      )
                    }
                    className="w-10 h-10 rounded-xl bg-accent/22 hover:bg-accent/40 border border-accent/40 flex items-center justify-center text-[#FF8A8E] cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              {/* Interactive Visual 1–10 Score Picker (+0.5 Precision Toggle) */}
              <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.07] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-mono uppercase tracking-[0.15em] text-[#858A9E] flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-[#F0B95B] fill-[#F0B95B]" />
                    <span>Note personnelle</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-[#F0B95B]">
                      {score !== null
                        ? `${score.toFixed(1)} / 10${SCORE_VERDICT[Math.round(score)] ? ` · ${SCORE_VERDICT[Math.round(score)]}` : ""}`
                        : previewInt
                          ? `${previewInt}.0 · ${SCORE_VERDICT[previewInt]}`
                          : "Non noté"}
                    </span>
                    {score !== null && (
                      <button
                        type="button"
                        onClick={() => setScore(null)}
                        className="text-[10.5px] text-[#858A9E] hover:text-white px-2 py-0.5 rounded bg-white/[0.06] cursor-pointer"
                      >
                        Effacer
                      </button>
                    )}
                  </div>
                </div>

                <div
                  onMouseLeave={() => setHoverScore(null)}
                  className="grid grid-cols-10 gap-1.5"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => {
                    const active = previewInt !== null && val <= previewInt;
                    const exact = score !== null && Math.floor(score) === val;
                    return (
                      <motion.button
                        key={val}
                        type="button"
                        whileHover={{ y: -2, scale: 1.12 }}
                        whileTap={{ scale: 0.9 }}
                        onMouseEnter={() => setHoverScore(val)}
                        onClick={() => setScore(val)}
                        className={cn(
                          "h-9 rounded-lg font-mono text-xs font-semibold border transition-all cursor-pointer",
                          exact
                            ? "bg-[#F0B95B] border-[#F0B95B] text-[#090A0F] shadow-[0_0_16px_rgba(240,185,91,0.55)]"
                            : active
                              ? "bg-[#F0B95B]/22 border-[#F0B95B]/45 text-[#F7D08A]"
                              : "bg-[#08090E] border-white/[0.08] text-[#7D8296] hover:text-white"
                        )}
                      >
                        {val}
                      </motion.button>
                    );
                  })}
                </div>

                {score !== null && score < 10 && (
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[11px] text-[#7D8296]">Affiner au demi-point :</span>
                    <button
                      type="button"
                      onClick={() =>
                        setScore((s) => {
                          if (s === null) return null;
                          return s % 1 === 0 ? Math.min(10, s + 0.5) : Math.floor(s);
                        })
                      }
                      className={cn(
                        "px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold border transition-all cursor-pointer",
                        hasHalf
                          ? "bg-[#F0B95B]/20 border-[#F0B95B]/45 text-[#F0B95B]"
                          : "bg-white/[0.04] border-white/[0.08] text-[#9A9EAE] hover:text-white"
                      )}
                    >
                      {hasHalf ? `−0.5 (${Math.floor(score)}.0)` : `+0.5 (${Math.floor(score)}.5)`}
                    </button>
                  </div>
                )}
              </div>

              {/* Personal Notes */}
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-[0.15em] text-[#858A9E] mb-2">
                  Notes & critique personnelle
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Vos impressions, épisodes mémorables, citation favorite..."
                  className="w-full rounded-xl bg-[#08090E] border border-white/[0.09] px-3.5 py-2.5 text-sm text-[#ECEBE6] placeholder:text-[#5F6477] focus:outline-none focus:border-accent/60 resize-none"
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
                <span className="text-[11px] font-mono text-[#6E7387] flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[#F0B95B]" />
                  <span>Sauvegarde instantanée</span>
                </span>
              )}

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={closeQuickEdit}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#A1A5B7] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-semibold transition-all cursor-pointer",
                    savedFlash
                      ? "bg-emerald-500 shadow-[0_8px_24px_rgba(52,211,153,0.45)]"
                      : "bg-gradient-to-r from-accent to-accent-deep hover:from-accent-hover hover:to-accent text-accent-fg shadow-[0_10px_28px_rgb(var(--shiori-accent-rgb)/0.42)]"
                  )}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {savedFlash
                      ? "Enregistré !"
                      : existing
                        ? "Enregistrer"
                        : "Ajouter à ma bibliothèque"}
                  </span>
                </motion.button>
              </div>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}
