"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Plus,
  Minus,
  Star,
  Heart,
  SlidersHorizontal,
  Download,
  BookOpen,
  Tv,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { cn, getStatusLabel, STATUS_CONFIG } from "@/lib/utils";
import type { LibraryStatus, MediaType } from "@/types/media";

type FilterTab = "ALL" | LibraryStatus;
type SortKey = "UPDATED" | "SCORE" | "TITLE" | "PROGRESS";

const TABS: { id: FilterTab; label: string }[] = [
  { id: "ALL", label: "Tous" },
  { id: "WATCHING", label: "Watching" },
  { id: "COMPLETED", label: "Completed" },
  { id: "ON_HOLD", label: "On Hold" },
  { id: "DROPPED", label: "Dropped" },
  { id: "PLAN_TO_WATCH", label: "Plan to Watch" },
];

export default function LibraryPage() {
  const {
    library,
    incrementProgress,
    toggleFavorite,
    openQuickEdit,
    removeEntry,
    exportLibraryJson,
    toast,
  } = useShiori();

  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [mediaFilter, setMediaFilter] = useState<"ALL" | MediaType>("ALL");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("UPDATED");
  const [view, setView] = useState<"grid" | "list">("grid");

  const counts = useMemo(() => {
    const base = library.filter((e) =>
      mediaFilter === "ALL" ? true : e.type === mediaFilter
    );
    const res: Record<FilterTab, number> = {
      ALL: base.length,
      WATCHING: 0,
      COMPLETED: 0,
      ON_HOLD: 0,
      DROPPED: 0,
      PLAN_TO_WATCH: 0,
    };
    for (const entry of base) {
      res[entry.status] = (res[entry.status] ?? 0) + 1;
    }
    return res;
  }, [library, mediaFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return library
      .filter((e) => (activeTab === "ALL" ? true : e.status === activeTab))
      .filter((e) => (mediaFilter === "ALL" ? true : e.type === mediaFilter))
      .filter((e) => (favoritesOnly ? e.isFavorite : true))
      .filter((e) =>
        q
          ? e.title.toLowerCase().includes(q) ||
            (e.studio ?? "").toLowerCase().includes(q) ||
            e.genres.some((g) => g.toLowerCase().includes(q))
          : true
      )
      .sort((a, b) => {
        if (sortBy === "SCORE") return (b.score ?? -1) - (a.score ?? -1);
        if (sortBy === "TITLE") return a.title.localeCompare(b.title);
        if (sortBy === "PROGRESS") return b.progress - a.progress;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [library, activeTab, mediaFilter, favoritesOnly, search, sortBy]);

  const handleExport = () => {
    const json = exportLibraryJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shiori-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Export JSON téléchargé",
      description: `${library.length} œuvres sauvegardées.`,
      variant: "success",
    });
  };

  return (
    <div className="pt-24 pb-16 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#E5484D] mb-1.5">
            Collection personnelle
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gradient-editorial">
            Ma Bibliothèque
          </h1>
          <p className="text-sm text-[#8A8FA4] mt-1.5">
            Organisez vos animés et mangas, ajustez votre progression en un clic et gardez vos notes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Media type segmented switch */}
          <div className="inline-flex items-center p-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
            {[
              { id: "ALL", label: "Tous" },
              { id: "ANIME", label: "Animes" },
              { id: "MANGA", label: "Mangas" },
            ].map((t) => {
              const active = mediaFilter === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMediaFilter(t.id as "ALL" | MediaType)}
                  className={cn(
                    "relative px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer",
                    active ? "text-white" : "text-[#9A9EAE] hover:text-white"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="library-type-pill"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      className="absolute inset-0 rounded-full bg-[#E5484D] shadow-[0_4px_16px_rgba(229,72,77,0.35)]"
                    />
                  )}
                  <span className="relative z-10">{t.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.09] text-xs font-medium text-[#D8DBE6] hover:text-white transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter</span>
          </button>

          <Link
            href="/discover"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-white text-[#0A0C12] hover:bg-[#ECEBE6] text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter un titre</span>
          </Link>
        </div>
      </div>

      {/* Category Tabs (Watching / Completed / On Hold / Dropped / Plan to Watch) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 border-b border-white/[0.07]">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const statusDot =
            tab.id !== "ALL" ? STATUS_CONFIG[tab.id].dot : "bg-white/70";
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-4 py-2.5 text-[13px] font-medium whitespace-nowrap flex items-center gap-2 transition-colors cursor-pointer",
                isActive ? "text-white" : "text-[#8A8FA4] hover:text-[#D9DCE8]"
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", statusDot)} />
              <span>{tab.label}</span>
              <span
                className={cn(
                  "text-[11px] font-mono px-1.5 py-0.5 rounded-md",
                  isActive
                    ? "bg-white/[0.12] text-white"
                    : "bg-white/[0.04] text-[#7D8296]"
                )}
              >
                {counts[tab.id]}
              </span>
              {isActive && (
                <motion.span
                  layoutId="library-tab-underline"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className="absolute bottom-0 inset-x-2 h-0.5 bg-[#E5484D] rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Toolbar: Search, Favorites toggle, Sort, View switch */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#74798E] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer par titre, studio ou genre..."
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-[#0E1017] border border-white/[0.08] text-sm text-white placeholder:text-[#656A7E] focus:outline-none focus:border-[#E5484D]/60"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border text-xs font-medium transition-all cursor-pointer",
              favoritesOnly
                ? "bg-[#E5484D]/18 border-[#E5484D]/45 text-[#FF8C90]"
                : "bg-[#0E1017] border-white/[0.08] text-[#9A9EAE] hover:text-white"
            )}
          >
            <Heart className={cn("w-3.5 h-3.5", favoritesOnly && "fill-current")} />
            <span>Favoris</span>
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            aria-label="Trier la bibliothèque"
            className="h-10 px-3.5 rounded-xl bg-[#0E1017] border border-white/[0.08] text-xs font-medium text-[#D8DBE6] focus:outline-none focus:border-[#E5484D]/60 cursor-pointer"
          >
            <option value="UPDATED">Tri : Mis à jour récemment</option>
            <option value="SCORE">Tri : Ma note décroissante</option>
            <option value="PROGRESS">Tri : Progression</option>
            <option value="TITLE">Tri : Titre (A → Z)</option>
          </select>

          <div className="inline-flex items-center p-1 rounded-xl bg-[#0E1017] border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label="Vue grille"
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer",
                view === "grid"
                  ? "bg-white/[0.12] text-white"
                  : "text-[#7D8296] hover:text-white"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="Vue liste"
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer",
                view === "list"
                  ? "bg-white/[0.12] text-white"
                  : "text-[#7D8296] hover:text-white"
              )}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl card-surface py-16 px-6 text-center">
          <Sparkles className="w-8 h-8 text-[#52576B] mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">
            Aucun titre dans cette vue
          </h3>
          <p className="text-sm text-[#868B9F] mt-1 max-w-md mx-auto">
            Modifiez vos filtres ou explorez le catalogue Shiori pour ajouter de nouveaux animés et mangas.
          </p>
          <Link
            href="/discover"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#E5484D] hover:bg-[#F2545B] text-white text-xs font-semibold transition-colors"
          >
            Découvrir des œuvres
          </Link>
        </div>
      ) : view === "grid" ? (
        /* GRID VIEW */
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((entry) => {
              const cfg = STATUS_CONFIG[entry.status];
              const pct = entry.totalUnits
                ? Math.min(100, Math.round((entry.progress / entry.totalUnits) * 100))
                : entry.status === "COMPLETED"
                  ? 100
                  : Math.min(85, Math.max(12, entry.progress * 3));
              const unit = entry.type === "MANGA" ? "Ch." : "Ép.";

              return (
                <motion.div
                  key={entry.mediaId}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="group rounded-2xl overflow-hidden card-surface hover:border-white/[0.16] transition-all flex flex-col"
                >
                  {/* Visual Banner Header */}
                  <div className="relative h-36 bg-[#131621] overflow-hidden">
                    <Link href={`/media/${entry.mediaId}`} className="block w-full h-full">
                      <img
                        src={entry.bannerImage || entry.coverImage}
                        alt={entry.title}
                        className="w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0E1017] via-[#0E1017]/45 to-black/25" />
                    </Link>

                    {/* Status Pill */}
                    <span
                      className={cn(
                        "absolute top-3 left-3 px-2.5 py-0.5 rounded-full border backdrop-blur-md text-[10.5px] font-semibold flex items-center gap-1.5",
                        cfg.bg,
                        cfg.border,
                        cfg.color
                      )}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                      {getStatusLabel(entry.status, entry.type)}
                    </span>

                    {/* Favorite Heart */}
                    <button
                      type="button"
                      onClick={() => toggleFavorite(entry.mediaId)}
                      aria-label="Basculer favori"
                      className={cn(
                        "absolute top-3 right-3 w-8 h-8 rounded-full backdrop-blur-md border flex items-center justify-center transition-all cursor-pointer",
                        entry.isFavorite
                          ? "bg-[#E5484D]/25 border-[#E5484D]/50 text-[#FF7E82]"
                          : "bg-black/45 border-white/15 text-white/70 hover:text-white"
                      )}
                    >
                      <Heart
                        className={cn("w-3.5 h-3.5", entry.isFavorite && "fill-current")}
                      />
                    </button>

                    {/* Inset Poster + Score */}
                    <div className="absolute bottom-2.5 left-3.5 right-3.5 flex items-end justify-between pointer-events-none">
                      <img
                        src={entry.coverImage}
                        alt=""
                        className="w-12 h-16 rounded-lg object-cover border border-white/20 shadow-lg"
                      />
                      {entry.score !== null && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-[#F0B95B]/30 font-mono text-xs font-semibold text-[#F0B95B]">
                          <Star className="w-3 h-3 fill-current" />
                          {entry.score.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3.5">
                    <div>
                      <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-[#7D8296] uppercase mb-1">
                        {entry.type === "MANGA" ? (
                          <BookOpen className="w-3 h-3 text-violet-400" />
                        ) : (
                          <Tv className="w-3 h-3 text-sky-400" />
                        )}
                        <span>{entry.type}</span>
                        {entry.studio && (
                          <>
                            <span>·</span>
                            <span className="truncate">{entry.studio}</span>
                          </>
                        )}
                      </div>

                      <Link
                        href={`/media/${entry.mediaId}`}
                        className="text-[15px] font-semibold text-[#F4F3EE] hover:text-[#F45B62] transition-colors line-clamp-1"
                      >
                        {entry.title}
                      </Link>

                      {entry.notes && (
                        <p className="mt-1.5 text-xs text-[#8A8FA4] line-clamp-2 leading-relaxed italic">
                          &laquo; {entry.notes} &raquo;
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      {/* Progress bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                          <span className="text-[#B8BCCB]">
                            {unit}{" "}
                            <strong className="text-white">{entry.progress}</strong>
                            {entry.totalUnits ? ` / ${entry.totalUnits}` : ""}
                          </span>
                          <span className="text-[11px] text-[#7D8296]">
                            {entry.totalUnits ? `${pct}%` : "En cours"}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className="h-full rounded-full bg-gradient-to-r from-[#E5484D] to-[#F48766] transition-all duration-300"
                          />
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => incrementProgress(entry.mediaId, -1)}
                          disabled={entry.progress <= 0}
                          aria-label="Diminuer la progression"
                          className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] disabled:opacity-35 border border-white/[0.08] flex items-center justify-center text-[#C2C6D6] cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => incrementProgress(entry.mediaId, 1)}
                          disabled={
                            Boolean(entry.totalUnits && entry.progress >= entry.totalUnits)
                          }
                          className="flex-1 h-8 rounded-xl bg-white/[0.06] hover:bg-[#E5484D] disabled:opacity-40 border border-white/[0.09] hover:border-[#E5484D] text-xs font-semibold text-white flex items-center justify-center gap-1 transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+1 {entry.type === "MANGA" ? "ch." : "ép."}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openQuickEdit(entry)}
                          title="Éditer"
                          className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center text-[#B2B6C6] hover:text-white cursor-pointer"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      ) : (
        /* LIST VIEW */
        <div className="rounded-2xl card-surface overflow-hidden divide-y divide-white/[0.06]">
          {filtered.map((entry) => {
            const cfg = STATUS_CONFIG[entry.status];
            const unit = entry.type === "MANGA" ? "Ch." : "Ép.";

            return (
              <div
                key={entry.mediaId}
                className="p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <Link href={`/media/${entry.mediaId}`} className="shrink-0">
                    <img
                      src={entry.coverImage}
                      alt={entry.title}
                      className="w-11 h-16 rounded-lg object-cover border border-white/10"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/media/${entry.mediaId}`}
                        className="text-sm font-semibold text-white hover:text-[#F45B62] transition-colors truncate"
                      >
                        {entry.title}
                      </Link>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full border text-[10px] font-semibold",
                          cfg.bg,
                          cfg.border,
                          cfg.color
                        )}
                      >
                        {getStatusLabel(entry.status, entry.type)}
                      </span>
                    </div>
                    <p className="text-xs text-[#83889C] mt-1 truncate">
                      {entry.type} {entry.studio ? `· ${entry.studio}` : ""}
                      {entry.notes ? ` — ${entry.notes}` : ""}
                    </p>
                  </div>
                </div>

                {/* Right controls */}
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  {/* Score */}
                  <div className="w-14 text-center font-mono text-xs">
                    {entry.score !== null ? (
                      <span className="inline-flex items-center gap-1 text-[#F0B95B] font-semibold">
                        <Star className="w-3 h-3 fill-current" />
                        {entry.score.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-[#5F6477]">—</span>
                    )}
                  </div>

                  {/* Stepper */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => incrementProgress(entry.mediaId, -1)}
                      disabled={entry.progress <= 0}
                      className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] disabled:opacity-35 flex items-center justify-center text-white cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-24 text-center font-mono text-xs text-[#D8DBE6]">
                      {unit} <strong className="text-white">{entry.progress}</strong>
                      {entry.totalUnits ? `/${entry.totalUnits}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => incrementProgress(entry.mediaId, 1)}
                      disabled={Boolean(entry.totalUnits && entry.progress >= entry.totalUnits)}
                      className="w-7 h-7 rounded-lg bg-[#E5484D]/25 hover:bg-[#E5484D] disabled:opacity-35 flex items-center justify-center text-white cursor-pointer transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Fav / Edit / Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleFavorite(entry.mediaId)}
                      className={cn(
                        "p-2 rounded-lg transition-colors cursor-pointer",
                        entry.isFavorite
                          ? "text-[#F45B62]"
                          : "text-[#6D7287] hover:text-white"
                      )}
                    >
                      <Heart className={cn("w-4 h-4", entry.isFavorite && "fill-current")} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openQuickEdit(entry)}
                      className="p-2 rounded-lg text-[#9A9EAE] hover:text-white hover:bg-white/[0.07] cursor-pointer"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.mediaId)}
                      className="p-2 rounded-lg text-[#7D8296] hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
