"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  SlidersHorizontal,
  X,
  Loader2,
  Tv,
  BookOpen,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { MediaCard } from "@/components/media/MediaCard";
import { CINEMA_EASE } from "@/components/motion/MotionPrimitives";
import { ALL_GENRES, cn, GENRE_LABELS_FR } from "@/lib/utils";
import type { MediaItem, MediaType } from "@/types/media";

const YEARS = Array.from({ length: 32 }, (_, i) => 2026 - i);

const ANIME_FORMATS = [
  { id: "ALL", label: "Tous formats" },
  { id: "TV", label: "Série TV" },
  { id: "MOVIE", label: "Film" },
  { id: "OVA", label: "OVA" },
  { id: "ONA", label: "ONA" },
  { id: "SPECIAL", label: "Spécial" },
];

const MANGA_FORMATS = [
  { id: "ALL", label: "Tous formats" },
  { id: "MANGA", label: "Manga" },
  { id: "NOVEL", label: "Light Novel" },
  { id: "ONE_SHOT", label: "One-Shot" },
];

const SEASONS = [
  { id: "ALL", label: "Toutes saisons" },
  { id: "WINTER", label: "Hiver" },
  { id: "SPRING", label: "Printemps" },
  { id: "SUMMER", label: "Été" },
  { id: "FALL", label: "Automne" },
];

const STATUSES = [
  { id: "ALL", label: "Tous statuts" },
  { id: "RELEASING", label: "En cours" },
  { id: "FINISHED", label: "Terminé" },
  { id: "NOT_YET_RELEASED", label: "À venir" },
];

const SORTS = [
  { id: "TRENDING_DESC", label: "Tendances" },
  { id: "POPULARITY_DESC", label: "Popularité" },
  { id: "SCORE_DESC", label: "Meilleures notes" },
  { id: "FAVOURITES_DESC", label: "Plus aimés" },
  { id: "START_DATE_DESC", label: "Plus récents" },
];

interface DiscoverClientProps {
  initialItems: MediaItem[];
  initialTotal: number;
}

export function DiscoverClient({ initialItems, initialTotal }: DiscoverClientProps) {
  const searchParams = useSearchParams();

  const [type, setType] = useState<MediaType>(
    searchParams.get("type") === "MANGA" ? "MANGA" : "ANIME"
  );
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [genre, setGenre] = useState(searchParams.get("genre") ?? "ALL");
  const [year, setYear] = useState(searchParams.get("year") ?? "ALL");
  const [season, setSeason] = useState(searchParams.get("season") ?? "ALL");
  const [format, setFormat] = useState(searchParams.get("format") ?? "ALL");
  const [status, setStatus] = useState(searchParams.get("status") ?? "ALL");
  const [sort, setSort] = useState(searchParams.get("sort") ?? "TRENDING_DESC");
  const [showFilters, setShowFilters] = useState(true);

  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [total, setTotal] = useState<number>(initialTotal);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Debounce search text
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 320);
    return () => clearTimeout(t);
  }, [search]);

  const fetchResults = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const qs = new URLSearchParams({
          action: "discover",
          type,
          sort,
          page: String(targetPage),
          perPage: "24",
        });
        if (debouncedSearch.trim()) qs.set("search", debouncedSearch.trim());
        if (genre !== "ALL") qs.set("genre", genre);
        if (year !== "ALL") qs.set("year", year);
        if (season !== "ALL" && type === "ANIME") qs.set("season", season);
        if (format !== "ALL") qs.set("format", format);
        if (status !== "ALL") qs.set("status", status);

        const res = await fetch(`/api/anilist?${qs.toString()}`);
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();

        setItems((prev) => (append ? [...prev, ...(data.items ?? [])] : data.items ?? []));
        setHasNextPage(Boolean(data.hasNextPage));
        setTotal(Number(data.total ?? data.items?.length ?? 0));
        setPage(targetPage);
      } catch {
        // keep current items on error
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [type, debouncedSearch, genre, year, season, format, status, sort]
  );

  // Refetch whenever filters change
  useEffect(() => {
    void fetchResults(1, false);
  }, [fetchResults]);

  const handleTypeSwitch = (next: MediaType) => {
    setType(next);
    setFormat("ALL");
    if (next === "MANGA") setSeason("ALL");
  };

  const resetAll = () => {
    setSearch("");
    setDebouncedSearch("");
    setGenre("ALL");
    setYear("ALL");
    setSeason("ALL");
    setFormat("ALL");
    setStatus("ALL");
    setSort("TRENDING_DESC");
  };

  const hasActiveFilters =
    Boolean(debouncedSearch.trim()) ||
    genre !== "ALL" ||
    year !== "ALL" ||
    season !== "ALL" ||
    format !== "ALL" ||
    status !== "ALL";

  const formats = type === "ANIME" ? ANIME_FORMATS : MANGA_FORMATS;

  return (
    <div className="pt-24 pb-16 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-7">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#E5484D] mb-1.5">
            Catalogue mondial en direct
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gradient-editorial">
            Découvrir {type === "ANIME" ? "les Animes" : "les Mangas"}
          </h1>
          <p className="text-sm text-[#8A8FA4] mt-1.5">
            Recherche instantanée et filtres multi-critères pour trouver votre prochaine obsession.
          </p>
        </div>

        {/* Anime / Manga Switcher */}
        <div className="inline-flex items-center p-1 rounded-full bg-white/[0.04] border border-white/[0.08] self-start md:self-auto">
          {(["ANIME", "MANGA"] as MediaType[]).map((t) => {
            const active = type === t;
            const Icon = t === "ANIME" ? Tv : BookOpen;
            return (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeSwitch(t)}
                className={cn(
                  "relative inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer",
                  active ? "text-white" : "text-[#9A9EAE] hover:text-white"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="discover-type-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className="absolute inset-0 rounded-full bg-[#E5484D] shadow-[0_6px_20px_rgba(229,72,77,0.38)]"
                  />
                )}
                <Icon className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">{t === "ANIME" ? "Animes" : "Mangas"}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search + Filters Panel */}
      <div className="rounded-2xl card-surface p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4.5 h-4.5 text-[#E5484D] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Rechercher un ${type === "ANIME" ? "anime" : "manga"} (ex: Frieren, Berserk, Dandadan, Chainsaw Man)...`}
              className="w-full h-11 pl-11 pr-10 rounded-xl bg-[#08090E] border border-white/[0.09] text-sm text-white placeholder:text-[#656A7E] focus:outline-none focus:border-[#E5484D]/70"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#7D8296] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Trier par"
              className="h-11 px-3.5 rounded-xl bg-[#08090E] border border-white/[0.09] text-xs font-medium text-[#E0E2EC] focus:outline-none focus:border-[#E5484D] cursor-pointer"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  Tri : {s.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                "inline-flex items-center gap-2 h-11 px-4 rounded-xl border text-xs font-medium transition-colors cursor-pointer",
                showFilters
                  ? "bg-white/[0.09] border-white/[0.16] text-white"
                  : "bg-[#08090E] border-white/[0.09] text-[#9A9EAE] hover:text-white"
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filtres</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: CINEMA_EASE }}
              className="overflow-hidden"
            >
              <div className="pt-3 border-t border-white/[0.06] space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10.5px] font-mono uppercase tracking-wider text-[#7A7F94] mb-1.5">
                  Format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-[#08090E] border border-white/[0.08] text-xs text-[#E4E6F0] focus:outline-none focus:border-[#E5484D] cursor-pointer"
                >
                  {formats.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] font-mono uppercase tracking-wider text-[#7A7F94] mb-1.5">
                  Année
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-[#08090E] border border-white/[0.08] text-xs text-[#E4E6F0] focus:outline-none focus:border-[#E5484D] cursor-pointer"
                >
                  <option value="ALL">Toutes années</option>
                  {YEARS.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {type === "ANIME" && (
                <div>
                  <label className="block text-[10.5px] font-mono uppercase tracking-wider text-[#7A7F94] mb-1.5">
                    Saison
                  </label>
                  <select
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-[#08090E] border border-white/[0.08] text-xs text-[#E4E6F0] focus:outline-none focus:border-[#E5484D] cursor-pointer"
                  >
                    {SEASONS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10.5px] font-mono uppercase tracking-wider text-[#7A7F94] mb-1.5">
                  Diffusion
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-[#08090E] border border-white/[0.08] text-xs text-[#E4E6F0] focus:outline-none focus:border-[#E5484D] cursor-pointer"
                >
                  {STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Genre Chips */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10.5px] font-mono uppercase tracking-wider text-[#7A7F94]">
                  Genres
                </span>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetAll}
                    className="inline-flex items-center gap-1 text-[11px] text-[#F45B62] hover:text-[#FF858A] cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Réinitialiser les filtres</span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setGenre("ALL")}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer",
                    genre === "ALL"
                      ? "bg-[#E5484D] border-[#E5484D] text-white"
                      : "bg-white/[0.03] border-white/[0.07] text-[#9A9EAE] hover:text-white hover:bg-white/[0.07]"
                  )}
                >
                  Tous
                </button>
                {ALL_GENRES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenre(genre === g ? "ALL" : g)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer",
                      genre === g
                        ? "bg-[#E5484D] border-[#E5484D] text-white"
                        : "bg-white/[0.03] border-white/[0.07] text-[#9A9EAE] hover:text-white hover:bg-white/[0.07]"
                    )}
                  >
                    {GENRE_LABELS_FR[g] ?? g}
                  </button>
                ))}
              </div>
            </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results meta bar */}
      <div className="flex items-center justify-between text-xs text-[#858A9E]">
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="inline-flex items-center gap-2 text-white">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E5484D]" />
              Actualisation du catalogue...
            </span>
          ) : (
            <span>
              <strong className="text-white font-mono">{items.length}</strong> affichés
              {total > items.length ? ` sur ${total.toLocaleString("fr-FR")} œuvres` : ""}
            </span>
          )}
        </div>
        {genre !== "ALL" && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E5484D]/15 text-[#FF8C90] border border-[#E5484D]/30">
            Genre : {GENRE_LABELS_FR[genre] ?? genre}
            <button type="button" onClick={() => setGenre("ALL")} className="ml-1 cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
      </div>

      {/* Results Grid */}
      {loading && items.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-2.5 animate-pulse">
              <div className="aspect-[2/3] rounded-xl bg-white/[0.05]" />
              <div className="h-3.5 w-3/4 rounded bg-white/[0.05]" />
              <div className="h-3 w-1/2 rounded bg-white/[0.04]" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl card-surface py-16 px-6 text-center">
          <Sparkles className="w-8 h-8 text-[#52576B] mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">Aucun résultat trouvé</h3>
          <p className="text-sm text-[#868B9F] mt-1">
            Essayez d&apos;élargir votre recherche ou de réinitialiser vos filtres.
          </p>
          <button
            type="button"
            onClick={resetAll}
            className="mt-5 px-5 py-2 rounded-full bg-[#E5484D] text-white text-xs font-semibold hover:bg-[#F2545B] cursor-pointer"
          >
            Réinitialiser
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
            {items.map((item, idx) => (
              <motion.div
                key={`${item.id}-${item.type}`}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.38,
                  delay: Math.min((idx % 24) * 0.025, 0.35),
                  ease: CINEMA_EASE,
                }}
              >
                <MediaCard media={item} />
              </motion.div>
            ))}
          </div>

          {hasNextPage && (
            <div className="pt-4 flex justify-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void fetchResults(page + 1, true)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-sm font-medium text-white transition-all cursor-pointer disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#E5484D]" />
                    <span>Chargement...</span>
                  </>
                ) : (
                  <span>Charger plus de titres</span>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
