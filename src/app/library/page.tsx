"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Table2,
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
  Clock,
  ArrowDownAZ,
  TrendingUp,
  ListOrdered,
  FolderHeart,
  Filter,
  RotateCcw,
  FileSpreadsheet,
  StickyNote,
  Calendar,
  MoreHorizontal,
  Tag,
  Building2,
  Layers,
  Film,
  Disc,
  Clapperboard,
  Snowflake,
  Flower2,
  Sun,
  Leaf,
  X,
  CheckCircle2,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { CINEMA_EASE } from "@/components/motion/MotionPrimitives";
import { LuxurySelect, type LuxurySelectOption } from "@/components/ui/LuxurySelect";
import { ContinueWatchingSection } from "@/components/media/ContinueWatchingSection";
import { FavoritesOrganizer } from "@/components/favorites/FavoritesOrganizer";
import { CollectionsManagerPanel } from "@/components/library/CollectionsManagerPanel";
import {
  DEFAULT_LIBRARY_FILTERS,
  filterAndSortLibrary,
  getProgressPercent,
  libraryToCsv,
  type LibraryFilterState,
  type LibrarySortKey,
  type ProgressFilter,
  type ScoreFilter,
} from "@/lib/library-utils";
import {
  clearSessionState,
  FILTER_STORAGE_KEYS,
  isFreshScrollSnapshot,
  libraryStateToSearchParams,
  readSessionState,
  sanitizeLibraryState,
  searchParamsToLibraryState,
  syncUrlSearchParams,
  writeSessionState,
  type LibraryScrollSnapshot,
  type LibraryViewMode,
  type PersistedLibraryState,
} from "@/lib/filter-persistence";
import { cn, STATUS_CONFIG } from "@/lib/utils";
import {
  getYearEraOptions,
  getYearFilterCopy,
  getYearFilterLabel,
  matchesYearFilter,
} from "@/lib/year-eras";
import type { LibraryStatus, MediaType } from "@/types/media";

type FilterTab = "ALL" | LibraryStatus;
type ViewMode = LibraryViewMode;

const TABS: { id: FilterTab }[] = [
  { id: "ALL" },
  { id: "WATCHING" },
  { id: "COMPLETED" },
  { id: "PLAN_TO_WATCH" },
  { id: "ON_HOLD" },
  { id: "DROPPED" },
];

const LIBRARY_SORTS: LuxurySelectOption[] = [
  { id: "UPDATED", label: "Récents", icon: Clock, accent: "text-sky-400" },
  {
    id: "FAVORITE_RANK",
    label: "Classement favoris",
    icon: ListOrdered,
    accent: "text-rose-400",
  },
  { id: "SCORE", label: "Meilleures notes", icon: Star, accent: "text-[#F0B95B]" },
  { id: "PROGRESS", label: "Progression", icon: TrendingUp, accent: "text-emerald-400" },
  { id: "YEAR", label: "Année", icon: Calendar, accent: "text-amber-400" },
  { id: "TITLE", label: "Titre (A → Z)", icon: ArrowDownAZ, accent: "text-violet-400" },
];

const LIBRARY_SEASON_OPTIONS: LuxurySelectOption[] = [
  { id: "ALL", label: "Toutes les saisons", icon: Sparkles },
  { id: "WINTER", label: "Hiver", hint: "Janvier – Mars", icon: Snowflake, accent: "text-sky-300" },
  { id: "SPRING", label: "Printemps", hint: "Avril – Juin", icon: Flower2, accent: "text-pink-300" },
  { id: "SUMMER", label: "Été", hint: "Juillet – Septembre", icon: Sun, accent: "text-amber-300" },
  { id: "FALL", label: "Automne", hint: "Octobre – Décembre", icon: Leaf, accent: "text-orange-400" },
];

const SCORE_PILLS: { id: ScoreFilter; label: string; short: string }[] = [
  { id: "ALL", label: "Toutes notes", short: "Toutes" },
  { id: "9", label: "9.0+", short: "9+" },
  { id: "8", label: "8.0+", short: "8+" },
  { id: "7", label: "7.0+", short: "7+" },
  { id: "6", label: "6.0+", short: "6+" },
  { id: "UNRATED", label: "Non notées", short: "Sans note" },
];

const PROGRESS_PILLS: { id: ProgressFilter; label: string; short: string }[] = [
  { id: "ALL", label: "Toute progression", short: "Toute" },
  { id: "STARTED", label: "Débutées (> 0)", short: "Débutées" },
  { id: "ALMOST_DONE", label: "Bientôt terminées (≥ 75%)", short: "≥ 75 %" },
  { id: "COMPLETE", label: "Complètes", short: "Complètes" },
  { id: "NOT_STARTED", label: "Non commencées (0)", short: "À 0" },
];

function getFormatMeta(format: string): {
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
} {
  switch (format) {
    case "TV":
    case "TV_SHORT":
      return { icon: Tv, accent: "text-sky-400" };
    case "MOVIE":
      return { icon: Film, accent: "text-[#F0B95B]" };
    case "MANGA":
    case "NOVEL":
    case "ONE_SHOT":
      return { icon: BookOpen, accent: "text-violet-400" };
    case "OVA":
      return { icon: Disc, accent: "text-pink-400" };
    case "ONA":
      return { icon: Clapperboard, accent: "text-emerald-400" };
    default:
      return { icon: Layers, accent: "text-[#9A9EAE]" };
  }
}

function LibraryPageInner() {
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();

  const {
    library,
    orderedFavorites,
    collections,
    displayPrefs,
    incrementProgress,
    incrementVolumeProgress,
    toggleFavorite,
    openQuickEdit,
    removeEntry,
    exportLibraryJson,
    setCommandOpen,
    contentLanguage,
    toast,
  } = useShiori();
  const { t, tr, tStatus, tFormat, tGenre, tSeason, locale } = useTranslation();
  const yearCopy = useMemo(() => getYearFilterCopy(contentLanguage), [contentLanguage]);
  const yearEraOptions = useMemo(() => getYearEraOptions(contentLanguage), [contentLanguage]);

  const librarySorts = useMemo<LuxurySelectOption[]>(
    () => LIBRARY_SORTS.map((o) => ({ ...o, label: tr(o.label) })),
    [tr]
  );
  const librarySeasonOptions = useMemo<LuxurySelectOption[]>(
    () =>
      LIBRARY_SEASON_OPTIONS.map((o) => ({
        ...o,
        label: o.id === "ALL" ? tr("Toutes les saisons") : tSeason(o.id),
        hint: o.hint ? tr(o.hint) : undefined,
      })),
    [tSeason, tr]
  );
  const scorePills = useMemo(
    () => SCORE_PILLS.map((p) => ({ ...p, label: tr(p.label), short: tr(p.short) })),
    [tr]
  );
  const progressPills = useMemo(
    () => PROGRESS_PILLS.map((p) => ({ ...p, label: tr(p.label), short: tr(p.short) })),
    [tr]
  );

  const [filters, setFilters] = useState<LibraryFilterState>(DEFAULT_LIBRARY_FILTERS);
  const [sortBy, setSortBy] = useState<LibrarySortKey>("UPDATED");
  const [view, setView] = useState<ViewMode>("grid");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filtersReady, setFiltersReady] = useState(false);
  const [organizingFavorites, setOrganizingFavorites] = useState(false);
  const [managingCollections, setManagingCollections] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(36);
  const toolsRef = useRef<HTMLDivElement>(null);
  const didInitRef = useRef(false);
  const lastWrittenQsRef = useRef<string | null>(null);
  const visibleCountRef = useRef(36);
  const isRestoringScrollRef = useRef(false);
  const navigatingAwayRef = useRef(false);
  const pendingLibraryScrollYRef = useRef<number | null>(null);

  useEffect(() => {
    visibleCountRef.current = visibleCount;
  }, [visibleCount]);

  // Restore filters from URL query params (Priority 1: Back button & deep links like /library?favorites=1)
  // or sessionStorage fallback (Priority 2: returning via Navbar link after viewing an anime)
  useEffect(() => {
    if (didInitRef.current && lastWrittenQsRef.current === searchParamsKey) {
      return;
    }

    const saved = readSessionState<PersistedLibraryState>(FILTER_STORAGE_KEYS.library);

    if (!didInitRef.current) {
      didInitRef.current = true;
      const restored = searchParamsKey
        ? searchParamsToLibraryState(new URLSearchParams(searchParamsKey), {
            showAdvancedFilters: saved?.showAdvancedFilters,
            view: saved?.view,
          })
        : saved
          ? sanitizeLibraryState(saved)
          : null;

      if (restored) {
        setFilters(restored.filters);
        setSortBy(restored.sortBy);
        setView(restored.view);
        setShowAdvancedFilters(restored.showAdvancedFilters);
      }

      const savedScroll = readSessionState<LibraryScrollSnapshot>(
        FILTER_STORAGE_KEYS.libraryScroll
      );
      if (savedScroll && isFreshScrollSnapshot(savedScroll)) {
        if (savedScroll.visibleCount > 36) {
          setVisibleCount(savedScroll.visibleCount);
          visibleCountRef.current = savedScroll.visibleCount;
        }
        if (savedScroll.scrollY > 0) {
          pendingLibraryScrollYRef.current = savedScroll.scrollY;
        }
      }

      setFiltersReady(true);
      return;
    }

    // Subsequent external URL navigation while mounted (e.g. clicking "Mes favoris" -> /library?favorites=1)
    if (searchParamsKey) {
      const parsed = searchParamsToLibraryState(new URLSearchParams(searchParamsKey), {
        showAdvancedFilters: saved?.showAdvancedFilters,
        view: saved?.view,
      });
      setFilters(parsed.filters);
      setSortBy(parsed.sortBy);
      setView(parsed.view);
    }
  }, [searchParamsKey]);

  // Persist active library filters to URL (replaceState) & sessionStorage so Back / revisit never loses them
  useEffect(() => {
    if (!filtersReady) return;
    const snapshot: PersistedLibraryState = {
      filters,
      sortBy,
      view,
      showAdvancedFilters,
    };
    const qs = syncUrlSearchParams("/library", libraryStateToSearchParams(snapshot));
    lastWrittenQsRef.current = qs;

    if (qs || showAdvancedFilters) {
      writeSessionState(FILTER_STORAGE_KEYS.library, snapshot);
    } else {
      clearSessionState(FILTER_STORAGE_KEYS.library);
    }
  }, [filtersReady, filters, sortBy, view, showAdvancedFilters]);

  // Restore saved library scroll position on Back navigation after visible items mount
  useEffect(() => {
    if (!filtersReady || typeof window === "undefined") return;
    const targetY = pendingLibraryScrollYRef.current;
    if (!targetY || targetY <= 0) return;
    pendingLibraryScrollYRef.current = null;

    isRestoringScrollRef.current = true;
    let cancelled = false;
    const timers: number[] = [];
    const cancel = () => {
      if (cancelled) return;
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("pointerdown", cancel);
      isRestoringScrollRef.current = false;
    };
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("pointerdown", cancel, { passive: true });

    const jump = () => {
      if (cancelled) return;
      window.scrollTo({ top: targetY, left: 0, behavior: "instant" as ScrollBehavior });
    };
    window.requestAnimationFrame(jump);
    timers.push(window.setTimeout(jump, 70));
    timers.push(window.setTimeout(jump, 180));
    timers.push(window.setTimeout(cancel, 320));
    return cancel;
  }, [filtersReady, visibleCount]);

  // Save library scroll + expanded visibleCount continuously so Back never resets to top
  useEffect(() => {
    if (!filtersReady || typeof window === "undefined") return;
    let timer: number | null = null;
    const onScroll = () => {
      if (isRestoringScrollRef.current || navigatingAwayRef.current || timer !== null) return;
      if (window.location.pathname !== "/library") return;
      timer = window.setTimeout(() => {
        timer = null;
        if (isRestoringScrollRef.current || navigatingAwayRef.current) return;
        if (window.location.pathname !== "/library") return;
        const y = Math.round(window.scrollY);
        if (y <= 0 && visibleCountRef.current <= 36) {
          clearSessionState(FILTER_STORAGE_KEYS.libraryScroll);
          return;
        }
        writeSessionState<LibraryScrollSnapshot>(FILTER_STORAGE_KEYS.libraryScroll, {
          scrollY: Math.max(0, y),
          visibleCount: visibleCountRef.current,
          savedAt: Date.now(),
        });
      }, 140);
    };
    const onLinkClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest('a[href^="/media/"], a[href^="/anime/"]');
      if (!anchor || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      navigatingAwayRef.current = true;
      window.setTimeout(() => {
        navigatingAwayRef.current = false;
      }, 2500);
      writeSessionState<LibraryScrollSnapshot>(FILTER_STORAGE_KEYS.libraryScroll, {
        scrollY: Math.max(0, Math.round(window.scrollY)),
        visibleCount: visibleCountRef.current,
        savedAt: Date.now(),
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onLinkClick, true);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onLinkClick, true);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [filtersReady]);

  useEffect(() => {
    if (!toolsMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setToolsMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [toolsMenuOpen]);

  const updateFilters = (patch: Partial<LibraryFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const resetAllFilters = () => {
    setFilters(DEFAULT_LIBRARY_FILTERS);
    setSortBy("UPDATED");
    clearSessionState(FILTER_STORAGE_KEYS.library);
    lastWrittenQsRef.current = syncUrlSearchParams("/library", new URLSearchParams());
  };

  const favoriteRankMap = useMemo(() => {
    const map = new Map<number, number>();
    orderedFavorites.forEach((e, idx) => map.set(e.mediaId, idx + 1));
    return map;
  }, [orderedFavorites]);

  // Dynamic facet options with real library counts for sleek LuxurySelect dropdowns
  const filterOptions = useMemo(() => {
    const genreCounts = new Map<string, number>();
    const studioCounts = new Map<string, number>();
    const years = new Set<number>();
    const formatCounts = new Map<string, number>();

    for (const e of library) {
      for (const g of e.genres) {
        if (g) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
      }
      if (e.studio) {
        studioCounts.set(e.studio, (studioCounts.get(e.studio) ?? 0) + 1);
      }
      if (e.seasonYear && e.seasonYear > 1950) years.add(e.seasonYear);
      if (e.format) {
        formatCounts.set(e.format, (formatCounts.get(e.format) ?? 0) + 1);
      }
    }

    const genreOptions: LuxurySelectOption[] = [
      { id: "ALL", label: tr("Tous les genres"), icon: Tag },
      ...Array.from(genreCounts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([g, count]) => ({ id: g, label: tGenre(g), count, icon: Tag })),
    ];

    const eraDropdownOptions: LuxurySelectOption[] = yearEraOptions.map((era) => ({
      id: era.id,
      label: era.label,
      hint: era.hint,
      count: library.filter((e) => matchesYearFilter(e.seasonYear, era.id)).length,
      colSpan: 2 as const,
    }));

    const yearOptions: LuxurySelectOption[] = [
      { id: "ALL", label: yearCopy.allLabel },
      { id: "__eras_header__", label: yearCopy.erasGroupLabel, groupHeader: true },
      ...eraDropdownOptions,
      ...(years.size > 0
        ? [{ id: "__years_header__", label: yearCopy.yearsGroupLabel, groupHeader: true }]
        : []),
      ...Array.from(years)
        .sort((a, b) => b - a)
        .map((y) => ({ id: String(y), label: String(y) })),
    ];

    const studioOptions: LuxurySelectOption[] = [
      { id: "ALL", label: tr("Tous les studios"), icon: Building2 },
      ...Array.from(studioCounts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([s, count]) => ({ id: s, label: s, count, icon: Building2 })),
    ];

    const formatOptions: LuxurySelectOption[] = [
      { id: "ALL", label: tr("Tous les formats"), icon: Layers },
      ...Array.from(formatCounts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([f, count]) => {
          const meta = getFormatMeta(f);
          return {
            id: f,
            label: tFormat(f),
            count,
            icon: meta.icon,
            accent: meta.accent,
          };
        }),
    ];

    const collectionOptions: LuxurySelectOption[] = [
      { id: "ALL", label: tr("Toutes les collections"), icon: FolderHeart },
      ...collections.map((c) => ({
        id: c.id,
        label: c.name,
        count: c.mediaIds.length,
        icon: FolderHeart,
        accent: "text-violet-400",
      })),
    ];

    return {
      genreOptions,
      yearOptions,
      studioOptions,
      formatOptions,
      collectionOptions,
    };
  }, [library, collections, yearCopy, yearEraOptions, tFormat, tGenre, tr]);

  const activeAdvancedCount = useMemo(() => {
    let count = 0;
    if (filters.genre !== "ALL") count++;
    if (filters.year !== "ALL") count++;
    if (filters.season !== "ALL") count++;
    if (filters.studio !== "ALL") count++;
    if (filters.format !== "ALL") count++;
    if (filters.scoreFilter !== "ALL") count++;
    if (filters.progressFilter !== "ALL") count++;
    if (filters.collectionId !== "ALL") count++;
    return count;
  }, [filters]);

  React.useEffect(() => {
    setVisibleCount(36);
  }, [filters, sortBy, view]);

  const counts = useMemo(() => {
    const base = library.filter((e) =>
      filters.mediaType === "ALL" ? true : e.type === filters.mediaType
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
  }, [library, filters.mediaType]);

  const filtered = useMemo(
    () =>
      filterAndSortLibrary(library, filters, sortBy, {
        favoriteRankMap,
        collections,
      }),
    [library, filters, sortBy, favoriteRankMap, collections]
  );

  const visibleEntries = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );
  const remainingCount = Math.max(0, filtered.length - visibleEntries.length);

  const handleExportJson = () => {
    const json = exportLibraryJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shiori-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: tr("Export JSON téléchargé"),
      description: `${library.length} ${t("common.titles")}`,
      variant: "success",
    });
  };

  const handleExportCsv = () => {
    const csv = libraryToCsv(filtered);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shiori-library-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: tr("Export CSV téléchargé"),
      description: `${filtered.length} ${t("common.titles")}`,
      variant: "success",
    });
  };

  const gridColsClass =
    displayPrefs.posterSize === "compact"
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      : displayPrefs.posterSize === "large"
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  const isCompactDensity = displayPrefs.libraryDensity === "compact";

  return (
    <div className="pt-[calc(5rem+env(safe-area-inset-top))] sm:pt-24 pb-24 md:pb-16 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
      {/* Header — 1 clear goal: manage your library & add titles */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gradient-editorial">
            {t("library.title")}
          </h1>
          <p className="text-sm text-[#8A8FA4] mt-1">
            {library.length.toLocaleString(locale)} {t("common.titles")}
            {orderedFavorites.length > 0
              ? ` · ${orderedFavorites.length} ${t("library.favoritesOnly").toLowerCase()}`
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Media type segmented switch */}
          <div className="inline-flex items-center p-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
            {[
              { id: "ALL", label: t("common.all") },
              { id: "ANIME", label: t("common.anime") },
              { id: "MANGA", label: t("common.manga") },
            ].map((typeOpt) => {
              const active = filters.mediaType === typeOpt.id;
              return (
                <button
                  key={typeOpt.id}
                  type="button"
                  onClick={() => updateFilters({ mediaType: typeOpt.id as "ALL" | MediaType })}
                  className={cn(
                    "relative px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer",
                    active ? "text-white" : "text-[#9A9EAE] hover:text-white"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="library-type-pill"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      className="absolute inset-0 rounded-full bg-accent shadow-[0_4px_16px_rgb(var(--shiori-accent-rgb)/0.35)]"
                    />
                  )}
                  <span className="relative z-10">{typeOpt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Primary CTA: instant Search & Add without leaving Bibliothèque */}
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-white text-[#0A0C12] hover:bg-[#ECEBE6] text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("common.add")}</span>
          </button>

          {/* Secondary Tools Dropdown (Collections, Favorite Order, Import/Export) */}
          <div className="relative" ref={toolsRef}>
            <button
              type="button"
              onClick={() => setToolsMenuOpen((v) => !v)}
              aria-label={tr("Outils")}
              aria-expanded={toolsMenuOpen}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-xs font-medium transition-colors cursor-pointer",
                toolsMenuOpen || organizingFavorites || managingCollections
                  ? "bg-white/[0.12] border-white/[0.2] text-white"
                  : "bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.09] text-[#D8DBE6] hover:text-white"
              )}
            >
              <MoreHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">{tr("Outils")}</span>
            </button>

            <AnimatePresence>
              {toolsMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.97 }}
                  transition={{ duration: 0.14 }}
                  className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-surface-solid border border-white/[0.13] shadow-[0_24px_60px_rgba(0,0,0,0.88)] p-1.5 z-40 space-y-0.5"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOrganizingFavorites((v) => !v);
                      setToolsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#D8DBE5] hover:bg-white/[0.08] hover:text-white cursor-pointer"
                  >
                    <ListOrdered className="w-3.5 h-3.5 text-rose-400" />
                    <span>{tr("Classer mes favoris")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManagingCollections((v) => !v);
                      setToolsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#D8DBE5] hover:bg-white/[0.08] hover:text-white cursor-pointer"
                  >
                    <FolderHeart className="w-3.5 h-3.5 text-violet-400" />
                    <span>{tr("Collections")} ({collections.length})</span>
                  </button>
                  <div className="my-1 border-t border-white/[0.07]" />
                  <Link
                    href="/settings#anilist-import"
                    onClick={() => setToolsMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#D8DBE5] hover:bg-white/[0.08] hover:text-white"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>{tr("Importer depuis AniList")}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      handleExportJson();
                      setToolsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#D8DBE5] hover:bg-white/[0.08] hover:text-white cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#9A9EAE]" />
                    <span>{tr("Exporter en JSON")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleExportCsv();
                      setToolsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#D8DBE5] hover:bg-white/[0.08] hover:text-white cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{tr("Exporter en CSV")}</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Reprendre la lecture — placé tout en haut de la Bibliothèque avec boutons rapides + Ép. / + Ch. */}
      <ContinueWatchingSection embeddedInLibrary />

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 border-b border-white/[0.07]">
        {TABS.map((tab) => {
          const isActive = filters.status === tab.id;
          const statusDot =
            tab.id !== "ALL" ? STATUS_CONFIG[tab.id].dot : "bg-white/70";
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => updateFilters({ status: tab.id })}
              className={cn(
                "relative px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap flex items-center gap-2 transition-colors cursor-pointer",
                isActive ? "text-white" : "text-[#8A8FA4] hover:text-[#D9DCE8]"
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", statusDot)} />
              <span>
                {tab.id === "ALL"
                  ? t("common.all")
                  : tStatus(tab.id, filters.mediaType === "MANGA" ? "MANGA" : "ANIME")}
              </span>
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
                  className="absolute bottom-0 inset-x-2 h-0.5 bg-accent rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Streamlined Single-Row Toolbar (Search + Favorites + Filters + Sort + View) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#74798E] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            placeholder={t("library.searchPlaceholder")}
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-surface border border-white/[0.08] text-base sm:text-sm text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent/60"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !filters.favoritesOnly;
              updateFilters({ favoritesOnly: next });
              if (next) setSortBy("FAVORITE_RANK");
              else if (sortBy === "FAVORITE_RANK") setSortBy("UPDATED");
            }}
            className={cn(
              "inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer",
              filters.favoritesOnly
                ? "bg-accent/18 border-accent/45 text-accent-soft"
                : "bg-surface border-white/[0.08] text-[#9A9EAE] hover:text-white"
            )}
          >
            <Heart className={cn("w-3.5 h-3.5", filters.favoritesOnly && "fill-current")} />
            <span>
              {t("library.favoritesOnly")} ({orderedFavorites.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowAdvancedFilters((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer",
              showAdvancedFilters || activeAdvancedCount > 0
                ? "bg-accent/18 border-accent/45 text-accent-soft"
                : "bg-surface border-white/[0.08] text-[#C8CCE0] hover:text-white"
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{t("library.filters")}</span>
            {activeAdvancedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-accent text-accent-fg font-mono text-[10px] font-bold">
                {activeAdvancedCount}
              </span>
            )}
          </button>

          <LuxurySelect
            value={sortBy}
            onChange={(val) => setSortBy(val as LibrarySortKey)}
            options={librarySorts}
            defaultValue="UPDATED"
            align="right"
            className="flex-1 sm:flex-none min-w-[155px] sm:w-44"
          />

          {/* 3-Mode View Switch: Grille / Liste / Tableau */}
          <div className="inline-flex items-center p-1 rounded-xl bg-surface border border-white/[0.08]">
            {(
              [
                { id: "grid", label: tr("Vue grille"), icon: LayoutGrid },
                { id: "list", label: tr("Vue liste"), icon: ListIcon },
                { id: "table", label: tr("Vue tableau"), icon: Table2 },
              ] as const
            ).map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setView(mode.id)}
                  aria-label={mode.label}
                  title={mode.label}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer",
                    view === mode.id
                      ? "bg-white/[0.12] text-white"
                      : "text-[#7D8296] hover:text-white"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Frosted Glass Filter Studio (ZERO native <select>, tactile pills + LuxurySelect) */}
      <AnimatePresence initial={false}>
        {showAdvancedFilters && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.22, ease: CINEMA_EASE }}
            className="relative rounded-2xl card-surface border border-white/[0.11] ring-1 ring-inset ring-white/[0.04] p-4 sm:p-5 space-y-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] overflow-visible"
          >
            {/* Subtle top ambient accent sheen */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/55 to-transparent"
            />

            {/* Filter Studio Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/35 flex items-center justify-center text-accent-soft">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-white">
                    {tr("Affiner ma bibliothèque")}
                  </p>
                  <p className="text-[11px] text-[#858A9E]">
                    {filtered.length.toLocaleString(locale)} {t("common.titles")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {(activeAdvancedCount > 0 || filters.favoritesOnly || filters.search) && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-accent/14 hover:bg-accent/25 border border-accent/35 text-xs font-medium text-accent-soft hover:text-white transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{tr("Réinitialiser")}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(false)}
                  aria-label={t("common.close")}
                  className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center text-[#9A9EAE] hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Row 1: Tactile 1-Click Quick Pills (Note personnelle + Progression) */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
              {/* Personal Score Quick Pills */}
              <div className="xl:col-span-6 rounded-xl bg-obsidian/70 border border-white/[0.07] p-3.5 space-y-2.5">
                <span className="text-[11px] font-medium text-[#9A9EAE] flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-[#F0B95B] fill-[#F0B95B]" />
                  <span>{tr("Note personnelle")}</span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {scorePills.map((opt) => {
                    const active = filters.scoreFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateFilters({ scoreFilter: opt.id })}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer inline-flex items-center gap-1",
                          active
                            ? "bg-[#F0B95B] text-[#090A0F] border-[#F0B95B] shadow-[0_6px_18px_rgba(240,185,91,0.32)]"
                            : "bg-white/[0.03] border-white/[0.08] text-[#B8BCCB] hover:text-white hover:border-white/[0.18]"
                        )}
                      >
                        {opt.id !== "ALL" && opt.id !== "UNRATED" && (
                          <Star className="w-3 h-3 fill-current" />
                        )}
                        <span>{opt.id === "ALL" ? t("common.all") : opt.short}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Progress Quick Pills */}
              <div className="xl:col-span-6 rounded-xl bg-obsidian/70 border border-white/[0.07] p-3.5 space-y-2.5">
                <span className="text-[11px] font-medium text-[#9A9EAE] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{tr("Progression")}</span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {progressPills.map((opt) => {
                    const active = filters.progressFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateFilters({ progressFilter: opt.id })}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer",
                          active
                            ? "bg-accent text-accent-fg border-accent shadow-accent"
                            : "bg-white/[0.03] border-white/[0.08] text-[#B8BCCB] hover:text-white hover:border-white/[0.18]"
                        )}
                      >
                        {opt.id === "ALL" ? t("common.all") : opt.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Era & Year Categories Quick Pills */}
            <div className="rounded-xl bg-obsidian/70 border border-white/[0.07] p-3.5 space-y-2.5">
              <span className="text-[11px] font-medium text-[#9A9EAE] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-accent" />
                <span>{yearCopy.sectionTitle}</span>
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto touch-rail no-scrollbar pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0">
                <button
                  type="button"
                  onClick={() => updateFilters({ year: "ALL" })}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap shrink-0 transition-all cursor-pointer",
                    filters.year === "ALL"
                      ? "bg-accent text-accent-fg border-accent shadow-accent"
                      : "bg-white/[0.03] border-white/[0.08] text-[#B8BCCB] hover:text-white hover:border-white/[0.18]"
                  )}
                >
                  {yearCopy.allShort}
                </button>
                {yearEraOptions.map((era) => {
                  const active = filters.year === era.id;
                  return (
                    <button
                      key={era.id}
                      type="button"
                      title={era.hint}
                      onClick={() => updateFilters({ year: active ? "ALL" : era.id })}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap shrink-0 transition-all cursor-pointer",
                        active
                          ? "bg-accent text-accent-fg border-accent shadow-accent"
                          : "bg-white/[0.03] border-white/[0.08] text-[#B8BCCB] hover:text-white hover:border-white/[0.18]"
                      )}
                    >
                      {era.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 2: Custom Frosted Glass LuxurySelect Dropdowns (with counts, icons & search!) */}
            <div
              className={cn(
                "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3",
                collections.length > 0 ? "xl:grid-cols-6" : "xl:grid-cols-5"
              )}
            >
              <LuxurySelect
                label={tr("Genre")}
                value={filters.genre}
                onChange={(val) => updateFilters({ genre: val })}
                options={filterOptions.genreOptions}
                icon={Tag}
                searchPlaceholder={tr("Chercher un genre...")}
              />

              <LuxurySelect
                label={yearCopy.sectionTitle}
                value={filters.year}
                onChange={(val) => updateFilters({ year: val })}
                options={filterOptions.yearOptions}
                icon={Calendar}
                columns={4}
              />

              <LuxurySelect
                label={tr("Saison")}
                value={filters.season}
                onChange={(val) => updateFilters({ season: val })}
                options={librarySeasonOptions}
                icon={Sparkles}
              />

              <LuxurySelect
                label={tr("Studio / Auteur")}
                value={filters.studio}
                onChange={(val) => updateFilters({ studio: val })}
                options={filterOptions.studioOptions}
                icon={Building2}
                searchPlaceholder={tr("Chercher un studio...")}
              />

              <LuxurySelect
                label={tr("Format")}
                value={filters.format}
                onChange={(val) => updateFilters({ format: val })}
                options={filterOptions.formatOptions}
                icon={Layers}
                align={collections.length === 0 ? "right" : "left"}
              />

              {collections.length > 0 && (
                <LuxurySelect
                  label={tr("Collection")}
                  value={filters.collectionId}
                  onChange={(val) => updateFilters({ collectionId: val })}
                  options={filterOptions.collectionOptions}
                  icon={FolderHeart}
                  align="right"
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Filter Chips Bar (always visible when any advanced filter is active!) */}
      <AnimatePresence>
        {activeAdvancedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex flex-wrap items-center gap-2"
          >
            <span className="text-[11px] font-medium text-[#7D8296]">{tr("Filtres actifs :")}</span>

            {filters.genre !== "ALL" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/18 border border-accent/40 text-xs font-medium text-white">
                <Tag className="w-3 h-3 text-accent-soft" />
                <span>{tGenre(filters.genre)}</span>
                <button
                  type="button"
                  onClick={() => updateFilters({ genre: "ALL" })}
                  aria-label={tr("Retirer")}
                  className="text-accent-soft hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filters.year !== "ALL" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] border border-white/[0.15] text-xs font-mono text-white">
                <Calendar className="w-3 h-3 text-accent-soft" />
                <span>{getYearFilterLabel(filters.year, contentLanguage)}</span>
                <button
                  type="button"
                  onClick={() => updateFilters({ year: "ALL" })}
                  aria-label={tr("Retirer")}
                  className="text-[#9A9EAE] hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filters.season !== "ALL" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] border border-white/[0.15] text-xs text-white">
                <span>{tSeason(filters.season)}</span>
                <button
                  type="button"
                  onClick={() => updateFilters({ season: "ALL" })}
                  aria-label={tr("Retirer")}
                  className="text-[#9A9EAE] hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filters.studio !== "ALL" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] border border-white/[0.15] text-xs text-white">
                <Building2 className="w-3 h-3 text-sky-400" />
                <span>{filters.studio}</span>
                <button
                  type="button"
                  onClick={() => updateFilters({ studio: "ALL" })}
                  aria-label={tr("Retirer")}
                  className="text-[#9A9EAE] hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filters.format !== "ALL" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] border border-white/[0.15] text-xs text-white">
                <span>{tFormat(filters.format)}</span>
                <button
                  type="button"
                  onClick={() => updateFilters({ format: "ALL" })}
                  aria-label={tr("Retirer")}
                  className="text-[#9A9EAE] hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filters.scoreFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F0B95B]/16 border border-[#F0B95B]/40 text-xs font-mono text-[#F0B95B]">
                <span>
                  {scorePills.find((s) => s.id === filters.scoreFilter)?.label ??
                    filters.scoreFilter}
                </span>
                <button
                  type="button"
                  onClick={() => updateFilters({ scoreFilter: "ALL" })}
                  aria-label={tr("Retirer")}
                  className="hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filters.progressFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/16 border border-emerald-400/40 text-xs text-emerald-200">
                <span>
                  {progressPills.find((p) => p.id === filters.progressFilter)?.label ??
                    filters.progressFilter}
                </span>
                <button
                  type="button"
                  onClick={() => updateFilters({ progressFilter: "ALL" })}
                  aria-label={tr("Retirer")}
                  className="hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filters.collectionId !== "ALL" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/18 border border-violet-400/40 text-xs text-violet-100">
                <FolderHeart className="w-3 h-3 text-violet-300" />
                <span>
                  {collections.find((c) => c.id === filters.collectionId)?.name ?? tr("Collection")}
                </span>
                <button
                  type="button"
                  onClick={() => updateFilters({ collectionId: "ALL" })}
                  aria-label={tr("Retirer")}
                  className="text-violet-300 hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={resetAllFilters}
              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-accent-soft hover:text-white hover:bg-accent/18 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{tr("Tout effacer")}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Collection Pills Row (when collections exist) */}
      {collections.length > 0 && !managingCollections && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => updateFilters({ collectionId: "ALL" })}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap shrink-0 cursor-pointer",
              filters.collectionId === "ALL"
                ? "bg-white text-[#090A0F] border-white"
                : "bg-surface border-white/[0.08] text-[#9A9EAE] hover:text-white"
            )}
          >
            {tr("Toute la bibliothèque")}
          </button>
          {collections.map((col) => {
            const active = filters.collectionId === col.id;
            return (
              <button
                key={col.id}
                type="button"
                onClick={() =>
                  updateFilters({ collectionId: active ? "ALL" : col.id })
                }
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer transition-colors",
                  active
                    ? "bg-accent/20 border-accent/55 text-white"
                    : "bg-surface border-white/[0.08] text-[#C8CCE0] hover:text-white"
                )}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: col.color }}
                />
                <span>{col.name}</span>
                <span className="font-mono text-[10px] opacity-75">
                  ({col.mediaIds.length})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Inline Interactive Collections Manager */}
      {managingCollections && (
        <CollectionsManagerPanel
          activeCollectionId={filters.collectionId}
          onSelectCollection={(id) => updateFilters({ collectionId: id })}
          onClose={() => setManagingCollections(false)}
        />
      )}

      {/* Inline Interactive Top Favorites Organizer (#1 -> last) */}
      {organizingFavorites && (
        <div className="rounded-3xl card-surface border border-rose-500/25 p-5 sm:p-6">
          <FavoritesOrganizer
            editable
            defaultEditMode
            title={tr("Mon Top Favoris")}
          />
        </div>
      )}

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl card-surface py-16 px-6 text-center space-y-3">
          <Sparkles className="w-8 h-8 text-[#52576B] mx-auto" />
          <h3 className="text-base font-semibold text-white">
            {t("library.emptyTitle")}
          </h3>
          <p className="text-sm text-[#868B9F] max-w-md mx-auto">
            {t("library.emptySub")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {(activeAdvancedCount > 0 || filters.favoritesOnly || filters.search || filters.status !== "ALL") && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-4 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-white cursor-pointer"
              >
                {t("discover.resetFilters")}
              </button>
            )}
            <Link
              href="/discover"
              className="px-5 py-2 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold transition-colors"
            >
              {t("library.exploreCatalog")}
            </Link>
          </div>
        </div>
      ) : view === "grid" ? (
        /* GRID VIEW */
        <div className="space-y-6">
          <div className={cn("grid gap-4 sm:gap-5", gridColsClass)}>
            {visibleEntries.map((entry) => {
              const cfg = STATUS_CONFIG[entry.status];
              const exactPct = getProgressPercent(entry);
              const barPct = exactPct ?? Math.min(85, Math.max(8, entry.progress * 3));
              const unit = entry.type === "MANGA" ? t("common.chShort") : t("common.epShort");
              const atCap = Boolean(entry.totalUnits && entry.progress >= entry.totalUnits);

              return (
                <div key={entry.mediaId} className="group h-full">
                  <div className="h-full rounded-2xl overflow-hidden isolate [transform:translateZ(0)] card-surface group-hover:border-white/[0.18] group-hover:-translate-y-1 group-hover:shadow-[0_18px_38px_rgba(0,0,0,0.58)] transition-[transform,border-color,box-shadow] duration-200 ease-out flex flex-col will-change-transform">
                    <div
                      className={cn(
                        "relative bg-[#131621] overflow-hidden isolate",
                        displayPrefs.posterSize === "large" ? "h-44" : isCompactDensity ? "h-28" : "h-36"
                      )}
                    >
                      <Link href={`/media/${entry.mediaId}`} className="block w-full h-full">
                        <img
                          src={entry.bannerImage || entry.coverImage}
                          alt={entry.title}
                          loading="lazy"
                          decoding="async"
                          className="relative z-0 w-full h-full object-cover opacity-72 transform-gpu will-change-transform group-hover:scale-[1.06] transition-transform duration-500 ease-out"
                        />
                        <div className="absolute inset-0 z-[1] bg-gradient-to-t from-surface via-surface/45 to-black/25 pointer-events-none" />
                      </Link>

                      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 pointer-events-none">
                        {sortBy === "FAVORITE_RANK" && favoriteRankMap.has(entry.mediaId) && (
                          <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#FDE047] to-[#F0B95B] text-[#090A0F] font-mono text-[10.5px] font-extrabold shadow">
                            #{favoriteRankMap.get(entry.mediaId)}
                          </span>
                        )}
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full border bg-[#0A0C14]/90 text-[10.5px] font-semibold flex items-center gap-1.5",
                            cfg.border,
                            cfg.color
                          )}
                        >
                          <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                          {tStatus(entry.status, entry.type)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleFavorite(entry.mediaId)}
                        aria-label={tr("Coup de cœur")}
                        className={cn(
                          "absolute top-3 right-3 z-10 w-8 h-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer active:scale-90",
                          entry.isFavorite
                            ? "bg-[#2A1015]/95 border-accent/55 text-accent-soft"
                            : "bg-[#0A0C14]/88 border-white/15 text-white/75 hover:text-white"
                        )}
                      >
                        <Heart className={cn("w-3.5 h-3.5", entry.isFavorite && "fill-current")} />
                      </button>

                      <div className="absolute bottom-2.5 left-3.5 right-3.5 z-10 flex items-end justify-between pointer-events-none">
                        <img
                          src={entry.coverImage}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="w-12 h-16 rounded-lg object-cover border border-white/20 shadow-lg"
                        />
                        {entry.score !== null && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0A0C14]/92 border border-[#F0B95B]/35 font-mono text-xs font-semibold text-[#F0B95B]">
                            <Star className="w-3 h-3 fill-current" />
                            {entry.score.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      className={cn(
                        "flex-1 flex flex-col justify-between gap-3",
                        isCompactDensity ? "p-3" : "p-4"
                      )}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-[#7D8296] uppercase mb-1">
                          {entry.type === "MANGA" ? (
                            <BookOpen className="w-3 h-3 text-violet-400" />
                          ) : (
                            <Tv className="w-3 h-3 text-sky-400" />
                          )}
                          <span>{entry.format ? tFormat(entry.format) : entry.type}</span>
                          {entry.seasonYear && <span>· {entry.seasonYear}</span>}
                          {entry.notes && (
                            <span title={entry.notes} className="ml-auto text-kinpaku">
                              <StickyNote className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <Link
                          href={`/media/${entry.mediaId}`}
                          className="text-sm font-semibold text-[#F4F3EE] hover:text-accent-hover transition-colors line-clamp-2 leading-snug"
                        >
                          {entry.title}
                        </Link>
                        {entry.notes && (
                          <p className="text-[11px] text-[#8E93A6] line-clamp-1 mt-1 italic">
                            « {entry.notes} »
                          </p>
                        )}
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2 text-xs font-mono">
                          <span className="text-[#B6BAC9] truncate">
                            {unit} <strong className="text-white">{entry.progress}</strong>
                            {entry.totalUnits ? ` / ${entry.totalUnits}` : " / ?"}
                            {entry.type === "MANGA" &&
                              ((entry.progressVolumes ?? 0) > 0 || entry.totalVolumes) && (
                                <span className="ml-1.5 text-violet-300">
                                  · {tr("Tome")} {entry.progressVolumes ?? 0}
                                  {entry.totalVolumes ? `/${entry.totalVolumes}` : ""}
                                </span>
                              )}
                          </span>
                          <span className="text-[11px] text-[#7D8296] shrink-0">
                            {exactPct !== null ? `${exactPct}%` : t("home.inProgress")}
                          </span>
                        </div>

                        <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                          <div
                            style={{ width: `${barPct}%` }}
                            className="h-full rounded-full bg-gradient-to-r from-accent to-[#F0B95B] transition-all duration-300"
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => incrementProgress(entry.mediaId, -1)}
                            disabled={entry.progress <= 0}
                            aria-label="-1"
                            className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] disabled:opacity-35 border border-white/[0.08] flex items-center justify-center text-white cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => incrementProgress(entry.mediaId, 1)}
                            disabled={atCap}
                            className="flex-1 h-8 px-2 rounded-xl bg-white/[0.06] hover:bg-accent disabled:opacity-40 border border-white/[0.09] hover:border-accent text-xs font-semibold text-white hover:text-accent-fg flex items-center justify-center gap-1 whitespace-nowrap transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 shrink-0" />
                            <span>+1 {unit}</span>
                          </button>
                          {entry.type === "MANGA" && (
                            <button
                              type="button"
                              onClick={() => incrementVolumeProgress(entry.mediaId, 1)}
                              disabled={Boolean(
                                entry.totalVolumes &&
                                  (entry.progressVolumes ?? 0) >= entry.totalVolumes
                              )}
                              title={tr("+1 tome")}
                              className="h-8 px-2 rounded-xl bg-violet-500/16 hover:bg-violet-500/30 disabled:opacity-40 border border-violet-400/35 text-[11px] font-mono font-semibold text-violet-200 flex items-center justify-center gap-0.5 whitespace-nowrap transition-colors cursor-pointer"
                            >
                              {tr("+1 tome")}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openQuickEdit(entry)}
                            title={tr("Éditer & collections")}
                            className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center text-[#B2B6C6] hover:text-white cursor-pointer"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : view === "list" ? (
        /* LIST VIEW */
        <div className="rounded-2xl card-surface overflow-hidden divide-y divide-white/[0.06]">
          {visibleEntries.map((entry) => {
            const cfg = STATUS_CONFIG[entry.status];
            const unit = entry.type === "MANGA" ? t("common.chShort") : t("common.epShort");
            const atCap = Boolean(entry.totalUnits && entry.progress >= entry.totalUnits);

            return (
              <div
                key={entry.mediaId}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center gap-3.5 sm:gap-4 hover:bg-white/[0.03] transition-colors",
                  isCompactDensity ? "p-2.5 sm:px-4" : "p-3.5 sm:px-5"
                )}
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <Link href={`/media/${entry.mediaId}`} className="shrink-0">
                    <img
                      src={entry.coverImage}
                      alt={entry.title}
                      loading="lazy"
                      className="w-11 h-16 rounded-lg object-cover border border-white/10"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/media/${entry.mediaId}`}
                        className="text-sm font-semibold text-white hover:text-accent-hover transition-colors truncate"
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
                        {tStatus(entry.status, entry.type)}
                      </span>
                    </div>
                    <p className="text-xs text-[#83889C] mt-1 truncate">
                      {entry.format ? tFormat(entry.format) : entry.type}
                      {entry.seasonYear ? ` · ${entry.seasonYear}` : ""}
                      {entry.studio ? ` · ${entry.studio}` : ""}
                      {entry.notes ? ` — ${entry.notes}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-4 shrink-0">
                  <div className="w-12 sm:w-14 text-center font-mono text-xs">
                    {entry.score !== null ? (
                      <span className="inline-flex items-center gap-1 text-[#F0B95B] font-semibold">
                        <Star className="w-3 h-3 fill-current" />
                        {entry.score.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-[#5F6477]">—</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <button
                      type="button"
                      onClick={() => incrementProgress(entry.mediaId, -1)}
                      disabled={entry.progress <= 0}
                      className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] disabled:opacity-35 flex items-center justify-center text-white cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-20 sm:w-24 text-center font-mono text-xs text-[#D8DBE6]">
                      {unit} <strong className="text-white">{entry.progress}</strong>
                      {entry.totalUnits ? `/${entry.totalUnits}` : "/?"}
                    </span>
                    <button
                      type="button"
                      onClick={() => incrementProgress(entry.mediaId, 1)}
                      disabled={atCap}
                      className="w-7 h-7 rounded-lg bg-accent/25 hover:bg-accent disabled:opacity-35 flex items-center justify-center text-accent-fg cursor-pointer transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleFavorite(entry.mediaId)}
                      className={cn(
                        "p-2 rounded-lg transition-colors cursor-pointer",
                        entry.isFavorite
                          ? "text-accent-hover"
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
      ) : (
        /* TABLE VIEW (Responsive scrollable data table) */
        <div className="rounded-2xl card-surface border border-white/[0.08] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[780px]">
              <thead>
                <tr className="border-b border-white/[0.08] bg-obsidian/70 text-[10.5px] font-mono uppercase tracking-wider text-[#858A9E]">
                  <th className="py-3 px-4">{tr("Œuvre")}</th>
                  <th className="py-3 px-3">{tr("Format / Année")}</th>
                  <th className="py-3 px-3">{tr("Statut")}</th>
                  <th className="py-3 px-3">{tr("Progression")}</th>
                  <th className="py-3 px-3 text-center">{tr("Note")}</th>
                  <th className="py-3 px-3">Studio</th>
                  <th className="py-3 px-4 text-right">{tr("Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-xs">
                {visibleEntries.map((entry) => {
                  const cfg = STATUS_CONFIG[entry.status];
                  const unit = entry.type === "MANGA" ? t("common.chShort") : t("common.epShort");
                  const atCap = Boolean(entry.totalUnits && entry.progress >= entry.totalUnits);
                  return (
                    <tr
                      key={entry.mediaId}
                      className="hover:bg-white/[0.03] transition-colors"
                    >
                      <td className={cn("px-4", isCompactDensity ? "py-2" : "py-3")}>
                        <div className="flex items-center gap-3 max-w-[280px]">
                          <Link href={`/media/${entry.mediaId}`} className="shrink-0">
                            <img
                              src={entry.coverImage}
                              alt={entry.title}
                              loading="lazy"
                              className="w-8 h-11 rounded-md object-cover border border-white/10"
                            />
                          </Link>
                          <div className="min-w-0">
                            <Link
                              href={`/media/${entry.mediaId}`}
                              className="font-semibold text-white hover:text-accent-hover truncate block"
                            >
                              {entry.title}
                            </Link>
                            {entry.notes && (
                              <p className="text-[10.5px] text-[#858A9E] truncate">
                                {entry.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 font-mono text-[#A6AAB8] whitespace-nowrap">
                        {entry.format ? tFormat(entry.format) : entry.type}
                        {entry.seasonYear ? ` · ${entry.seasonYear}` : ""}
                      </td>
                      <td className="px-3 whitespace-nowrap">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full border text-[10px] font-semibold",
                            cfg.bg,
                            cfg.border,
                            cfg.color
                          )}
                        >
                          {tStatus(entry.status, entry.type)}
                        </span>
                      </td>
                      <td className="px-3 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 font-mono">
                          <button
                            type="button"
                            onClick={() => incrementProgress(entry.mediaId, -1)}
                            disabled={entry.progress <= 0}
                            className="w-6 h-6 rounded bg-white/[0.05] hover:bg-white/[0.12] disabled:opacity-35 flex items-center justify-center text-white cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="min-w-[68px] text-center text-[#D8DBE6]">
                            {unit} <strong className="text-white">{entry.progress}</strong>
                            {entry.totalUnits ? `/${entry.totalUnits}` : "/?"}
                          </span>
                          <button
                            type="button"
                            onClick={() => incrementProgress(entry.mediaId, 1)}
                            disabled={atCap}
                            className="w-6 h-6 rounded bg-accent/25 hover:bg-accent disabled:opacity-35 flex items-center justify-center text-accent-fg cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 text-center font-mono whitespace-nowrap">
                        {entry.score !== null ? (
                          <span className="inline-flex items-center gap-1 text-[#F0B95B] font-semibold">
                            <Star className="w-3 h-3 fill-current" />
                            {entry.score.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-[#5F6477]">—</span>
                        )}
                      </td>
                      <td className="px-3 text-[#9A9EAE] max-w-[150px] truncate">
                        {entry.studio || "—"}
                      </td>
                      <td className="px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleFavorite(entry.mediaId)}
                            className={cn(
                              "p-1.5 rounded-lg cursor-pointer",
                              entry.isFavorite
                                ? "text-accent-hover"
                                : "text-[#6D7287] hover:text-white"
                            )}
                          >
                            <Heart className={cn("w-3.5 h-3.5", entry.isFavorite && "fill-current")} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openQuickEdit(entry)}
                            className="p-1.5 rounded-lg text-[#9A9EAE] hover:text-white hover:bg-white/[0.08] cursor-pointer"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeEntry(entry.mediaId)}
                            className="p-1.5 rounded-lg text-[#7D8296] hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {remainingCount > 0 && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-xs font-mono text-[#7D8296]">
            {visibleEntries.length.toLocaleString(locale)} /{" "}
            {filtered.length.toLocaleString(locale)} {t("common.titles")}
          </p>
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + 40)}
            className="px-6 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.13] border border-white/[0.12] text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            {tr("Afficher plus (+{n})", { n: Math.min(40, remainingCount) })}
          </button>
        </div>
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="pt-[calc(5rem+env(safe-area-inset-top))] sm:pt-24 pb-24 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-10 w-64 rounded-xl bg-white/[0.06] animate-pulse" />
        </div>
      }
    >
      <LibraryPageInner />
    </Suspense>
  );
}
