"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpToLine,
  Award,
  BookOpen,
  Check,
  ChevronDown,
  Crown,
  GripVertical,
  Heart,
  ListOrdered,
  Medal,
  Plus,
  Search,
  Sparkles,
  Star,
  Tv,
  X,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { cn } from "@/lib/utils";
import type { MediaType, PublicProfileMediaSummary } from "@/types/media";

interface FavoritesOrganizerProps {
  /** For visitors viewing someone else's profile (read-only ranked display) */
  externalFavorites?: PublicProfileMediaSummary[];
  /** Enable interactive drag-and-drop & #1 -> last ranking controls */
  editable?: boolean;
  /** Start directly in edit/reorder mode (e.g. inside /library Favorites drawer) */
  defaultEditMode?: boolean;
  /** Optional title override */
  title?: string;
}

function getRankBadgeClass(rank: number): string {
  if (rank === 1) {
    return "bg-gradient-to-br from-[#FEF08A] via-[#F0B95B] to-[#B45309] text-[#090A0F] border-[#FEF08A]/80 shadow-[0_0_20px_rgba(240,185,91,0.58)]";
  }
  if (rank === 2) {
    return "bg-gradient-to-br from-[#F8FAFC] via-[#CBD5E1] to-[#64748B] text-[#090A0F] border-white/70 shadow-[0_0_14px_rgba(226,232,240,0.4)]";
  }
  if (rank === 3) {
    return "bg-gradient-to-br from-[#FDBA74] via-[#CD7F32] to-[#7C2D12] text-[#090A0F] border-[#FDBA74]/70 shadow-[0_0_14px_rgba(205,127,50,0.45)]";
  }
  return "bg-[#111420]/95 text-[#E5E7F0] border-white/18";
}

function getPodiumRowStyle(rank: number): string {
  if (rank === 1) {
    return "border-[#F0B95B]/45 bg-gradient-to-r from-[#281E0E]/85 via-[#13141E]/92 to-[#0D0F18]/92 shadow-[0_10px_30px_-14px_rgba(240,185,91,0.42)]";
  }
  if (rank === 2) {
    return "border-slate-300/30 bg-gradient-to-r from-[#1D2332]/85 via-[#131520]/92 to-[#0D0F18]/92 shadow-[0_10px_28px_-14px_rgba(203,213,225,0.28)]";
  }
  if (rank === 3) {
    return "border-[#CD7F32]/38 bg-gradient-to-r from-[#271810]/85 via-[#14141E]/92 to-[#0D0F18]/92 shadow-[0_10px_28px_-14px_rgba(205,127,50,0.3)]";
  }
  return "border-white/[0.08] bg-obsidian/80 hover:border-white/[0.18]";
}

interface RankPopoverPickerProps {
  currentRank: number;
  total: number;
  mediaTitle: string;
  coverImage: string;
  open: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  openUpward?: boolean;
  onSelectRank: (nextRank: number) => void;
  compactTrigger?: boolean;
}

function RankPopoverPicker({
  currentRank,
  total,
  mediaTitle,
  coverImage,
  open,
  onOpenChange,
  openUpward = false,
  onSelectRank,
  compactTrigger = false,
}: RankPopoverPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onOpenChange]);

  const podiumSlots = [1, 2, 3].filter((n) => n <= total);
  const restSlots = Array.from({ length: Math.max(0, total - 3) }, (_, i) => i + 4);

  const pick = (rank: number) => {
    onSelectRank(rank);
    onOpenChange(false);
  };

  return (
    <div ref={rootRef} className="relative">
      {compactTrigger ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenChange(!open);
          }}
          title={`Changer la place de ${mediaTitle}`}
          className={cn(
            "min-w-[34px] h-7 px-2 rounded-lg border font-mono text-[11px] font-extrabold inline-flex items-center justify-center gap-0.5 transition-transform hover:scale-105 cursor-pointer",
            getRankBadgeClass(currentRank)
          )}
        >
          <span>#{currentRank}</span>
          <ChevronDown className="w-2.5 h-2.5 opacity-80" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-label={`Choisir la place de ${mediaTitle} (actuellement #${currentRank})`}
          className={cn(
            "h-9 px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer",
            open
              ? "bg-accent/22 border-accent text-white shadow-[0_0_18px_rgb(var(--shiori-accent-rgb)/0.35)]"
              : currentRank === 1
                ? "bg-[#F0B95B]/16 hover:bg-[#F0B95B]/26 border-[#F0B95B]/45 text-[#FDE68A]"
                : currentRank === 2
                  ? "bg-slate-200/12 hover:bg-slate-200/20 border-slate-300/35 text-slate-100"
                  : currentRank === 3
                    ? "bg-[#CD7F32]/16 hover:bg-[#CD7F32]/26 border-[#E5A96F]/45 text-[#F0BE8A]"
                    : "bg-white/[0.06] hover:bg-white/[0.13] border-white/[0.12] text-white"
          )}
        >
          {currentRank === 1 ? (
            <Crown className="w-3.5 h-3.5 text-[#FDE047]" />
          ) : currentRank === 2 ? (
            <Medal className="w-3.5 h-3.5 text-slate-200" />
          ) : currentRank === 3 ? (
            <Award className="w-3.5 h-3.5 text-[#F0B37E]" />
          ) : (
            <Sparkles className="w-3 h-3 text-accent-soft" />
          )}
          <span className="font-mono font-bold">Place #{currentRank}</span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 opacity-75 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: openUpward ? 8 : -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: openUpward ? 6 : -6 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "absolute z-50 w-[min(calc(100vw-2rem),272px)] rounded-2xl bg-[#0D101A]/98 border border-white/[0.14] shadow-[0_24px_60px_rgba(0,0,0,0.82)] p-3.5 space-y-3",
              compactTrigger ? "left-0" : "right-0",
              openUpward ? "bottom-full mb-2" : "top-full mt-2"
            )}
          >
            {/* Mini Header with Cover Thumbnail */}
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-white/[0.08]">
              <img
                src={coverImage}
                alt=""
                className="w-7 h-10 rounded-md object-cover border border-white/15 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-accent-soft">
                  Choisir sa place
                </p>
                <p className="text-xs font-semibold text-white truncate">
                  {mediaTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="w-6 h-6 rounded-full bg-white/[0.06] hover:bg-white/[0.14] flex items-center justify-center text-[#9A9EAE] hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Podium Top 3 Metallic Tiles */}
            {podiumSlots.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[#858A9E]">
                  Podium d&apos;honneur
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {podiumSlots.map((slot) => {
                    const isCurrent = slot === currentRank;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => pick(slot)}
                        className={cn(
                          "relative py-2 px-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer",
                          slot === 1
                            ? "bg-gradient-to-b from-[#F0B95B]/25 to-[#2A1E0B]/80 border-[#F0B95B]/55 text-[#FEF08A] hover:scale-[1.04]"
                            : slot === 2
                              ? "bg-gradient-to-b from-slate-300/20 to-[#1A202E]/85 border-slate-300/45 text-slate-100 hover:scale-[1.04]"
                              : "bg-gradient-to-b from-[#CD7F32]/25 to-[#28160C]/85 border-[#E5A96F]/50 text-[#FDBA74] hover:scale-[1.04]",
                          isCurrent && "ring-2 ring-white shadow-lg"
                        )}
                      >
                        {slot === 1 ? (
                          <Crown className="w-3.5 h-3.5" />
                        ) : slot === 2 ? (
                          <Medal className="w-3.5 h-3.5" />
                        ) : (
                          <Award className="w-3.5 h-3.5" />
                        )}
                        <span className="font-mono text-xs font-extrabold leading-none">
                          #{slot}
                        </span>
                        <span className="text-[9px] font-mono opacity-80 leading-none">
                          {slot === 1 ? "Or" : slot === 2 ? "Argent" : "Bronze"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Remaining Rank Chips Grid (#4 -> #N) */}
            {restSlots.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[#858A9E]">
                  Autres places (#4 → #{total})
                </p>
                <div className="grid grid-cols-5 gap-1.5 max-h-40 overflow-y-auto pr-0.5">
                  {restSlots.map((slot) => {
                    const isCurrent = slot === currentRank;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => pick(slot)}
                        className={cn(
                          "h-8 rounded-lg border font-mono text-xs font-semibold transition-all cursor-pointer",
                          isCurrent
                            ? "bg-accent border-accent text-accent-fg shadow-accent scale-105"
                            : "bg-white/[0.04] hover:bg-white/[0.14] border-white/[0.09] hover:border-white/[0.25] text-[#D2D6E6] hover:text-white"
                        )}
                      >
                        #{slot}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Extremes Footer */}
            <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={currentRank === 1}
                onClick={() => pick(1)}
                className="flex-1 h-7 rounded-lg bg-[#F0B95B]/15 hover:bg-[#F0B95B]/25 disabled:opacity-30 border border-[#F0B95B]/35 text-[#FDE68A] text-[11px] font-semibold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <ArrowUpToLine className="w-3 h-3" />
                <span>Mettre #1</span>
              </button>
              <button
                type="button"
                disabled={currentRank === total}
                onClick={() => pick(total)}
                className="flex-1 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] disabled:opacity-30 border border-white/[0.1] text-[#C8CCE0] hover:text-white text-[11px] font-semibold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <span>Fin (#{total})</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FavoritesOrganizer({
  externalFavorites,
  editable = false,
  defaultEditMode = false,
  title = "Animés & Mangas favoris",
}: FavoritesOrganizerProps) {
  const {
    library,
    orderedFavorites,
    reorderFavorites,
    moveFavorite,
    setFavoriteRank,
    toggleFavorite,
    toast,
  } = useShiori();

  const [scope, setScope] = useState<"ALL" | MediaType>("ALL");
  const [editMode, setEditMode] = useState(defaultEditMode);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [openPickerId, setOpenPickerId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const sourceList: PublicProfileMediaSummary[] = useMemo(() => {
    if (!editable && externalFavorites) {
      return externalFavorites;
    }
    return orderedFavorites.map((e) => ({
      mediaId: e.mediaId,
      type: e.type,
      title: e.title,
      coverImage: e.coverImage,
      score: e.score,
    }));
  }, [editable, externalFavorites, orderedFavorites]);

  const scopedFavorites = useMemo(() => {
    if (scope === "ALL") return sourceList;
    return sourceList.filter((m) => m.type === scope);
  }, [sourceList, scope]);

  const pickerCandidates = useMemo(() => {
    if (!editable || !pickerOpen) return [];
    const q = pickerQuery.trim().toLowerCase();
    return library
      .filter((e) => !e.isFavorite)
      .filter((e) => (scope === "ALL" ? true : e.type === scope))
      .filter((e) => (q ? e.title.toLowerCase().includes(q) : true))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      .slice(0, 12);
  }, [editable, pickerOpen, pickerQuery, library, scope]);

  const handleDropOn = (targetMediaId: number) => {
    if (!editable || draggingId === null || draggingId === targetMediaId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    const ids = scopedFavorites.map((m) => m.mediaId);
    const fromIdx = ids.indexOf(draggingId);
    const toIdx = ids.indexOf(targetMediaId);
    if (fromIdx === -1 || toIdx === -1) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    const copy = [...ids];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    reorderFavorites(copy, scope);
    setDraggingId(null);
    setDragOverId(null);
  };

  const animeCount = sourceList.filter((m) => m.type === "ANIME").length;
  const mangaCount = sourceList.filter((m) => m.type === "MANGA").length;

  return (
    <section id="favoris" className="space-y-4 scroll-mt-24">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-rose-400 flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 fill-current" />
            <span>Top Classement Personnel · #1 → Dernier</span>
          </p>
          <h2 className="text-lg sm:text-xl font-bold text-white mt-0.5">
            {title} ({scopedFavorites.length})
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Scope Tabs */}
          <div className="inline-flex items-center p-0.5 rounded-full bg-surface border border-white/[0.08] text-xs">
            <button
              type="button"
              onClick={() => setScope("ALL")}
              className={cn(
                "px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer",
                scope === "ALL" ? "bg-white text-[#090A0F]" : "text-[#9A9EAE] hover:text-white"
              )}
            >
              Tous ({sourceList.length})
            </button>
            <button
              type="button"
              onClick={() => setScope("ANIME")}
              className={cn(
                "px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer inline-flex items-center gap-1",
                scope === "ANIME"
                  ? "bg-white text-[#090A0F]"
                  : "text-[#9A9EAE] hover:text-white"
              )}
            >
              <Tv className="w-3 h-3" />
              <span>Animés ({animeCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setScope("MANGA")}
              className={cn(
                "px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer inline-flex items-center gap-1",
                scope === "MANGA"
                  ? "bg-white text-[#090A0F]"
                  : "text-[#9A9EAE] hover:text-white"
              )}
            >
              <BookOpen className="w-3 h-3" />
              <span>Mangas ({mangaCount})</span>
            </button>
          </div>

          {editable && (
            <>
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="h-8 px-3 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-rose-400" />
                <span>Ajouter</span>
              </button>

              {scopedFavorites.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const next = !editMode;
                    setEditMode(next);
                    if (!next) {
                      toast({
                        title: "Classement favoris enregistré !",
                        description:
                          "Votre Top #1 → dernier est sauvegardé et visible sur votre profil.",
                        variant: "success",
                      });
                    }
                  }}
                  className={cn(
                    "h-8 px-3.5 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer",
                    editMode
                      ? "bg-emerald-500 text-[#071510] border-emerald-400 shadow-lg"
                      : "bg-accent hover:bg-accent-hover text-accent-fg border-accent shadow-accent"
                  )}
                >
                  {editMode ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Terminer le tri</span>
                    </>
                  ) : (
                    <>
                      <ListOrdered className="w-3.5 h-3.5" />
                      <span>Trier mon classement</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quick Add Favorite Picker */}
      {editable && pickerOpen && (
        <div className="rounded-2xl card-surface border border-white/[0.1] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-white">
              Ajouter un titre de votre bibliothèque aux favoris
            </p>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="text-[#8A8FA4] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#7D8296] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="Rechercher dans votre bibliothèque..."
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-obsidian/80 border border-white/[0.09] text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
            />
          </div>
          {pickerCandidates.length === 0 ? (
            <p className="text-xs text-[#858A9E]">
              Aucun autre titre disponible dans cette catégorie.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {pickerCandidates.map((entry) => (
                <button
                  key={entry.mediaId}
                  type="button"
                  onClick={() => toggleFavorite(entry.mediaId)}
                  className="p-2 rounded-xl bg-obsidian/70 hover:bg-white/[0.08] border border-white/[0.07] hover:border-rose-400/40 flex items-center gap-2.5 text-left transition-colors cursor-pointer"
                >
                  <img
                    src={entry.coverImage}
                    alt={entry.title}
                    className="w-8 h-11 rounded object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">
                      {entry.title}
                    </p>
                    <p className="text-[10px] font-mono text-[#858A9E]">
                      {entry.type === "MANGA" ? "Manga" : "Animé"}
                      {entry.score !== null ? ` · ★ ${entry.score.toFixed(1)}` : ""}
                    </p>
                  </div>
                  <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content: Empty / Luxury Podium Reorder Mode / Ranked Poster Showcase Grid */}
      {scopedFavorites.length === 0 ? (
        <div className="rounded-2xl card-surface p-6 text-xs text-[#858A9E]">
          Aucun coup de cœur sélectionné dans cette catégorie pour le moment.
          {editable &&
            " Cliquez sur « Ajouter » ou sur le cœur d'un titre dans votre bibliothèque."}
        </div>
      ) : editable && editMode ? (
        /* LUXURY EDITORIAL PODIUM REORDER LIST */
        <div className="rounded-2xl card-surface border border-white/[0.1] p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/[0.07]">
            <p className="text-xs text-[#C2C6D8] flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-accent shrink-0" />
              <span>
                <strong className="text-white">Glissez-déposez</strong> une carte ou cliquez sur{" "}
                <span className="px-1.5 py-0.5 rounded-md bg-white/[0.08] border border-white/[0.12] font-mono text-[11px] text-white">
                  Place #
                </span>{" "}
                pour choisir sa position exacte du <strong className="text-kinpaku">#1</strong> au{" "}
                <strong className="text-white">#{scopedFavorites.length}</strong>.
              </span>
            </p>
          </div>

          <div className="space-y-2.5">
            {scopedFavorites.map((m, idx) => {
              const rank = idx + 1;
              const isDragging = draggingId === m.mediaId;
              const isOver = dragOverId === m.mediaId && draggingId !== m.mediaId;
              const isPickerOpen = openPickerId === m.mediaId;
              const openUpward = scopedFavorites.length > 4 && idx >= scopedFavorites.length - 2;

              return (
                <motion.div
                  layout
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  key={m.mediaId}
                  draggable={!isPickerOpen}
                  onDragStart={(e) => {
                    setDraggingId(m.mediaId);
                    setOpenPickerId(null);
                    const dt = (e as unknown as React.DragEvent).dataTransfer;
                    if (dt) {
                      dt.effectAllowed = "move";
                      dt.setData("text/plain", String(m.mediaId));
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverId !== m.mediaId) setDragOverId(m.mediaId);
                  }}
                  onDragLeave={() => {
                    if (dragOverId === m.mediaId) setDragOverId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropOn(m.mediaId);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDragOverId(null);
                  }}
                  className={cn(
                    "group relative p-3 sm:p-3.5 rounded-2xl border flex items-center gap-3.5 transition-all select-none cursor-grab active:cursor-grabbing",
                    isPickerOpen ? "z-40" : "z-0",
                    isDragging
                      ? "opacity-45 bg-accent/15 border-accent"
                      : isOver
                        ? "bg-accent/14 border-accent ring-1 ring-accent"
                        : getPodiumRowStyle(rank)
                  )}
                >
                  {/* Subtle clipped podium ambient shine bar */}
                  {rank <= 3 && (
                    <div
                      aria-hidden="true"
                      className={cn(
                        "pointer-events-none absolute inset-y-2 left-0 w-1 rounded-r-full",
                        rank === 1
                          ? "bg-gradient-to-b from-[#FEF08A] via-[#F0B95B] to-[#B45309]"
                          : rank === 2
                            ? "bg-gradient-to-b from-white via-slate-300 to-slate-500"
                            : "bg-gradient-to-b from-[#FDBA74] via-[#CD7F32] to-[#7C2D12]"
                      )}
                    />
                  )}

                  {/* Drag Grip */}
                  <GripVertical className="w-4 h-4 text-[#6D7288] group-hover:text-white/75 transition-colors shrink-0 hidden sm:block" />

                  {/* Gleaming Rank Medallion */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl border font-mono text-xs font-extrabold flex flex-col items-center justify-center shrink-0 leading-none",
                      getRankBadgeClass(rank)
                    )}
                  >
                    {rank === 1 && <Crown className="w-3 h-3 mb-0.5" />}
                    <span>#{rank}</span>
                  </div>

                  {/* Cover Poster */}
                  <Link href={`/media/${m.mediaId}`} className="shrink-0">
                    <img
                      src={m.coverImage}
                      alt={m.title}
                      className="w-11 h-16 rounded-xl object-cover border border-white/15 shadow-md"
                    />
                  </Link>

                  {/* Title & Badges */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {rank === 1 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#F0B95B]/20 border border-[#F0B95B]/45 text-[9.5px] font-mono font-bold uppercase tracking-wider text-[#FDE68A]">
                          N°1 Absolu
                        </span>
                      )}
                      {rank === 2 && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-300/15 border border-slate-300/35 text-[9.5px] font-mono font-bold uppercase tracking-wider text-slate-200">
                          Top 2
                        </span>
                      )}
                      {rank === 3 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#CD7F32]/20 border border-[#E5A96F]/40 text-[9.5px] font-mono font-bold uppercase tracking-wider text-[#FDBA74]">
                          Top 3
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/media/${m.mediaId}`}
                      className="text-sm font-bold text-white hover:text-accent-hover line-clamp-1 block"
                    >
                      {m.title}
                    </Link>

                    <div className="flex items-center gap-2 text-[11px] font-mono text-[#8E93A6]">
                      <span className="inline-flex items-center gap-1">
                        {m.type === "MANGA" ? (
                          <BookOpen className="w-3 h-3 text-violet-400" />
                        ) : (
                          <Tv className="w-3 h-3 text-sky-400" />
                        )}
                        {m.type === "MANGA" ? "Manga" : "Animé"}
                      </span>
                      {m.score !== null && (
                        <span className="inline-flex items-center gap-0.5 text-kinpaku font-semibold">
                          <Star className="w-3 h-3 fill-current" />
                          {m.score.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Clean Luxury Control Cluster: Custom Glass Rank Picker + Connected Up/Down Pill + Subtle Remove */}
                  <div className="flex items-center gap-2 shrink-0">
                    <RankPopoverPicker
                      currentRank={rank}
                      total={scopedFavorites.length}
                      mediaTitle={m.title}
                      coverImage={m.coverImage}
                      open={isPickerOpen}
                      onOpenChange={(next) =>
                        setOpenPickerId(next ? m.mediaId : null)
                      }
                      openUpward={openUpward}
                      onSelectRank={(nextRank) =>
                        setFavoriteRank(m.mediaId, nextRank, scope)
                      }
                    />

                    {/* Connected Segmented Up / Down Pill */}
                    <div className="inline-flex items-center rounded-xl bg-white/[0.05] border border-white/[0.1] p-0.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveFavorite(m.mediaId, "up", scope)}
                        title="Monter d'une place"
                        className="w-7 h-8 rounded-lg hover:bg-white/[0.14] disabled:opacity-25 text-white flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-px h-4 bg-white/[0.08]" />
                      <button
                        type="button"
                        disabled={idx === scopedFavorites.length - 1}
                        onClick={() => moveFavorite(m.mediaId, "down", scope)}
                        title="Descendre d'une place"
                        className="w-7 h-8 rounded-lg hover:bg-white/[0.14] disabled:opacity-25 text-white flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleFavorite(m.mediaId)}
                      title="Retirer des favoris"
                      className="w-8 h-8 rounded-xl bg-transparent hover:bg-rose-500/20 text-[#6F7489] hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : (
        /* RANKED POSTER SHOWCASE GRID (with Direct Drag-and-Drop + Clickable #Rank Popover Picker on Own Profile!) */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {scopedFavorites.map((m, idx) => {
            const rank = idx + 1;
            const isDragging = draggingId === m.mediaId;
            const isOver = dragOverId === m.mediaId && draggingId !== m.mediaId;
            const isPickerOpen = openPickerId === m.mediaId;

            return (
              <div
                key={m.mediaId}
                draggable={editable && !isPickerOpen}
                onDragStart={(e) => {
                  if (!editable) return;
                  setDraggingId(m.mediaId);
                  setOpenPickerId(null);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(m.mediaId));
                }}
                onDragOver={(e) => {
                  if (!editable) return;
                  e.preventDefault();
                  if (dragOverId !== m.mediaId) setDragOverId(m.mediaId);
                }}
                onDragLeave={() => {
                  if (dragOverId === m.mediaId) setDragOverId(null);
                }}
                onDrop={(e) => {
                  if (!editable) return;
                  e.preventDefault();
                  handleDropOn(m.mediaId);
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDragOverId(null);
                }}
                className={cn(
                  "group relative rounded-2xl card-surface border flex flex-col transition-all",
                  isPickerOpen ? "z-40" : "z-0",
                  isDragging
                    ? "opacity-45 border-accent"
                    : isOver
                      ? "border-accent ring-2 ring-accent scale-[1.02]"
                      : rank === 1
                        ? "border-[#F0B95B]/45 hover:border-[#FDE047]/70"
                        : "border-white/[0.08] hover:border-white/[0.22]",
                  editable && "cursor-grab active:cursor-grabbing"
                )}
              >
                {/* Top-left Rank Medallion (clickable popover picker when editable!) */}
                <div className="absolute top-2 left-2 z-20">
                  {editable && scopedFavorites.length > 1 ? (
                    <RankPopoverPicker
                      currentRank={rank}
                      total={scopedFavorites.length}
                      mediaTitle={m.title}
                      coverImage={m.coverImage}
                      open={isPickerOpen}
                      onOpenChange={(next) =>
                        setOpenPickerId(next ? m.mediaId : null)
                      }
                      compactTrigger
                      onSelectRank={(nextRank) =>
                        setFavoriteRank(m.mediaId, nextRank, scope)
                      }
                    />
                  ) : (
                    <span
                      className={cn(
                        "min-w-[28px] h-6 px-1.5 rounded-lg border font-mono text-[11px] font-extrabold flex items-center justify-center",
                        getRankBadgeClass(rank)
                      )}
                    >
                      #{rank}
                    </span>
                  )}
                </div>

                <Link
                  href={`/media/${m.mediaId}`}
                  className="relative aspect-[2/3] overflow-hidden rounded-t-2xl bg-[#121521] block"
                >
                  <img
                    src={m.coverImage}
                    alt={m.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {m.score !== null && (
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-obsidian/85 border border-white/15 font-mono text-[10.5px] font-bold text-kinpaku">
                      ★ {m.score.toFixed(1)}
                    </span>
                  )}
                </Link>

                <div className="p-2.5 flex-1 flex flex-col justify-between gap-2">
                  <Link
                    href={`/media/${m.mediaId}`}
                    className="text-xs font-semibold text-white group-hover:text-accent-hover line-clamp-2 leading-snug"
                  >
                    {m.title}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
