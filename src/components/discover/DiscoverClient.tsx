"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Flame,
  TrendingUp,
  Star,
  Heart,
  Clock,
  Film,
  Disc,
  Clapperboard,
  Layers,
  Calendar,
  Snowflake,
  Flower2,
  Sun,
  Leaf,
  Radio,
  CheckCircle2,
  Hourglass,
  Check,
  Tag,
  EyeOff,
  Eye,
  Wand2,
  Gauge,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { MediaCard } from "@/components/media/MediaCard";
import { MoodCarousel } from "@/components/discover/MoodCarousel";
import { CINEMA_EASE } from "@/components/motion/MotionPrimitives";
import { LuxurySelect, type LuxurySelectOption } from "@/components/ui/LuxurySelect";
import {
  FILTER_CATEGORIES,
  getTaxonomyLabel,
  MOOD_PRESETS,
  SITUATION_GROUPS,
  type MoodPreset,
  type SituationGroupId,
  type TagCategory,
} from "@/lib/discover-taxonomy";
import {
  clearSessionState,
  DEFAULT_DISCOVER_STATE,
  discoverStateToSearchParams,
  FILTER_STORAGE_KEYS,
  readSessionState,
  sanitizeDiscoverState,
  searchParamsToDiscoverState,
  syncUrlSearchParams,
  writeSessionState,
  type PersistedDiscoverState,
} from "@/lib/filter-persistence";
import { discoverQueryCache } from "@/lib/client-cache";
import { resolveSearchAlias } from "@/lib/searchAliases";
import {
  normalizeGenreMinRanks,
  serializeGenreMinRanks,
} from "@/lib/genre-intensity";
import { cn } from "@/lib/utils";
import type { MediaItem, MediaType } from "@/types/media";

const YEAR_OPTIONS: LuxurySelectOption[] = [
  { id: "ALL", label: "Toutes années" },
  ...Array.from({ length: 42 }, (_, i) => {
    const y = String(2026 - i);
    return { id: y, label: y };
  }),
];

const ANIME_FORMATS: LuxurySelectOption[] = [
  { id: "ALL", label: "Tous formats", icon: Layers },
  { id: "TV", label: "Série TV", hint: "Saisons diffusées à la TV", icon: Tv, accent: "text-sky-400" },
  { id: "MOVIE", label: "Film", hint: "Long-métrage cinéma", icon: Film, accent: "text-[#F0B95B]" },
  { id: "OVA", label: "OVA", hint: "Épisodes spéciaux vidéo", icon: Disc, accent: "text-violet-400" },
  { id: "ONA", label: "ONA", hint: "Diffusion streaming originale", icon: Clapperboard, accent: "text-emerald-400" },
  { id: "SPECIAL", label: "Spécial", hint: "Hors-série & bonus", icon: Sparkles, accent: "text-pink-400" },
];

const MANGA_FORMATS: LuxurySelectOption[] = [
  { id: "ALL", label: "Tous formats", icon: Layers },
  { id: "MANGA", label: "Manga", hint: "Série manga classique", icon: BookOpen, accent: "text-violet-400" },
  { id: "NOVEL", label: "Light Novel", hint: "Roman illustré japonais", icon: Sparkles, accent: "text-[#F0B95B]" },
  { id: "ONE_SHOT", label: "One-Shot", hint: "Histoire complète unique", icon: Film, accent: "text-sky-400" },
];

const SEASON_OPTIONS: LuxurySelectOption[] = [
  { id: "ALL", label: "Toutes saisons", icon: Calendar },
  { id: "WINTER", label: "Hiver", hint: "Janvier – Mars", icon: Snowflake, accent: "text-sky-300" },
  { id: "SPRING", label: "Printemps", hint: "Avril – Juin", icon: Flower2, accent: "text-pink-300" },
  { id: "SUMMER", label: "Été", hint: "Juillet – Septembre", icon: Sun, accent: "text-amber-300" },
  { id: "FALL", label: "Automne", hint: "Octobre – Décembre", icon: Leaf, accent: "text-orange-400" },
];

const STATUS_OPTIONS: LuxurySelectOption[] = [
  { id: "ALL", label: "Tous statuts", icon: Radio },
  { id: "RELEASING", label: "En cours", hint: "Actuellement diffusé / publié", icon: Radio, accent: "text-emerald-400" },
  { id: "FINISHED", label: "Terminé", hint: "Œuvre complète", icon: CheckCircle2, accent: "text-sky-400" },
  { id: "NOT_YET_RELEASED", label: "À venir", hint: "Prochainement annoncé", icon: Hourglass, accent: "text-amber-400" },
];

const MIN_SCORE_OPTIONS: LuxurySelectOption[] = [
  { id: "ALL", label: "Toutes notes", icon: Star },
  { id: "60", label: "6.0+ · Correct", icon: Star, accent: "text-[#9A9EAE]" },
  { id: "70", label: "7.0+ · Bon", icon: Star, accent: "text-[#F0B95B]" },
  { id: "75", label: "7.5+ · Très bon", icon: Star, accent: "text-[#F0B95B]" },
  { id: "80", label: "8.0+ · Excellent", icon: Star, accent: "text-[#F0B95B]" },
  { id: "85", label: "8.5+ · Chef-d'œuvre", icon: Star, accent: "text-[#F0B95B]" },
  { id: "90", label: "9.0+ · Légendaire", icon: Star, accent: "text-[#F0B95B]" },
];

interface LengthPreset {
  id: string;
  label: string;
  hint: string;
  min: string;
  max: string;
}

const ANIME_LENGTH_PRESETS: LengthPreset[] = [
  { id: "ALL", label: "Tous", hint: "Aucune limite d'épisodes", min: "", max: "" },
  { id: "UNDER_13", label: "≤ 13 ép.", hint: "Format court · 1 saison", min: "1", max: "13" },
  { id: "14_26", label: "14 – 26 ép.", hint: "Format 2 cours", min: "14", max: "26" },
  { id: "27_50", label: "27 – 50 ép.", hint: "Série moyenne", min: "27", max: "50" },
  { id: "51_100", label: "51 – 100 ép.", hint: "Grande saga", min: "51", max: "100" },
  { id: "OVER_100", label: "100+ ép.", hint: "Shōnen fleuve", min: "100", max: "" },
];

const MANGA_LENGTH_PRESETS: LengthPreset[] = [
  { id: "ALL", label: "Tous", hint: "Aucune limite de chapitres", min: "", max: "" },
  { id: "UNDER_50", label: "≤ 50 ch.", hint: "Série courte", min: "1", max: "50" },
  { id: "51_150", label: "51 – 150 ch.", hint: "Format moyen", min: "51", max: "150" },
  { id: "151_300", label: "151 – 300 ch.", hint: "Longue série", min: "151", max: "300" },
  { id: "OVER_300", label: "300+ ch.", hint: "Grande épopée", min: "300", max: "" },
];

const QUICK_SCORE_PILLS: { id: string; label: string }[] = [
  { id: "ALL", label: "Toutes" },
  { id: "60", label: "6+" },
  { id: "70", label: "7+" },
  { id: "75", label: "7.5+" },
  { id: "80", label: "8+" },
  { id: "85", label: "8.5+" },
  { id: "90", label: "9+" },
];

const SORT_OPTIONS: LuxurySelectOption[] = [
  { id: "TRENDING_DESC", label: "Tendances", hint: "Les plus actifs maintenant", icon: Flame, accent: "text-accent-hover" },
  { id: "POPULARITY_DESC", label: "Popularité", hint: "Les plus suivis", icon: TrendingUp, accent: "text-sky-400" },
  { id: "SCORE_DESC", label: "Meilleures notes", hint: "Classement critique", icon: Star, accent: "text-[#F0B95B]" },
  { id: "FAVOURITES_DESC", label: "Coups de cœur", hint: "Les plus aimés", icon: Heart, accent: "text-pink-400" },
  { id: "START_DATE_DESC", label: "Plus récents", hint: "Nouvelles sorties", icon: Clock, accent: "text-emerald-400" },
];

interface DiscoverClientProps {
  initialItems: MediaItem[];
  initialTotal: number;
}

export function DiscoverClient({ initialItems, initialTotal }: DiscoverClientProps) {
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const { library } = useShiori();
  const { t, tGenre } = useTranslation();

  // Compute initial state synchronously from URL params when present (Back button & deep links)
  const initialStateRef = useRef<PersistedDiscoverState | null>(null);
  if (initialStateRef.current === null) {
    initialStateRef.current = searchParamsKey
      ? searchParamsToDiscoverState(
          new URLSearchParams(searchParamsKey),
          undefined,
          MOOD_PRESETS
        )
      : DEFAULT_DISCOVER_STATE;
  }
  const init = initialStateRef.current;

  const [hideInLibrary, setHideInLibrary] = useState(init.hideInLibrary);
  const [type, setType] = useState<MediaType>(init.type);
  const [search, setSearch] = useState(init.search);
  const [debouncedSearch, setDebouncedSearch] = useState(init.search);

  // Multi-select Genres & Independent Per-Genre Min Intensity (Record<string, number>)
  const [selectedGenres, setSelectedGenres] = useState<string[]>(init.selectedGenres);
  const [genreMinRanks, setGenreMinRanks] = useState<Record<string, number>>(
    init.genreMinRanks
  );
  const [debouncedGenreMinRanks, setDebouncedGenreMinRanks] = useState<
    Record<string, number>
  >(init.genreMinRanks);
  const [selectedTags, setSelectedTags] = useState<string[]>(init.selectedTags);
  const [activeMoodId, setActiveMoodId] = useState<string | null>(init.activeMoodId);
  const [activeCategory, setActiveCategory] = useState<TagCategory["id"]>(init.activeCategory);
  const [situationGroup, setSituationGroup] = useState<SituationGroupId>(init.situationGroup);
  const [tagSearch, setTagSearch] = useState("");

  // Structured Luxury Dropdown Filters
  const [year, setYear] = useState(init.year);
  const [season, setSeason] = useState(init.season);
  const [format, setFormat] = useState(init.format);
  const [status, setStatus] = useState(init.status);
  const [minScore, setMinScore] = useState(init.minScore);
  const [maxScore, setMaxScore] = useState(init.maxScore);
  const [minUnits, setMinUnits] = useState(init.minUnits);
  const [maxUnits, setMaxUnits] = useState(init.maxUnits);
  const [debouncedMinUnits, setDebouncedMinUnits] = useState(init.minUnits);
  const [debouncedMaxUnits, setDebouncedMaxUnits] = useState(init.maxUnits);
  const [sort, setSort] = useState(init.sort);
  const [showFilters, setShowFilters] = useState(init.showFilters);
  const [showMoods, setShowMoods] = useState(init.showMoods);
  const [filtersReady, setFiltersReady] = useState(false);

  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [total, setTotal] = useState<number>(initialTotal);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const reqIdRef = useRef(0);
  const didInitRef = useRef(false);
  const lastWrittenQsRef = useRef<string | null>(null);

  const applyDiscoverState = useCallback((next: PersistedDiscoverState) => {
    setType(next.type);
    setSearch(next.search);
    setDebouncedSearch(next.search);
    setSelectedGenres(next.selectedGenres);
    setGenreMinRanks(next.genreMinRanks);
    setDebouncedGenreMinRanks(next.genreMinRanks);
    setSelectedTags(next.selectedTags);
    setActiveMoodId(next.activeMoodId);
    setActiveCategory(next.activeCategory);
    setSituationGroup(next.situationGroup);
    setYear(next.year);
    setSeason(next.season);
    setFormat(next.format);
    setStatus(next.status);
    setMinScore(next.minScore);
    setMaxScore(next.maxScore);
    setMinUnits(next.minUnits);
    setMaxUnits(next.maxUnits);
    setDebouncedMinUnits(next.minUnits.trim());
    setDebouncedMaxUnits(next.maxUnits.trim());
    setSort(next.sort);
    setHideInLibrary(next.hideInLibrary);
    setShowFilters(next.showFilters);
    setShowMoods(next.showMoods);
  }, []);

  // Restore saved filters on mount (Priority 1: URL query params; Priority 2: sessionStorage fallback)
  useEffect(() => {
    if (didInitRef.current && lastWrittenQsRef.current === searchParamsKey) {
      return;
    }

    const saved = readSessionState<PersistedDiscoverState>(FILTER_STORAGE_KEYS.discover);

    if (!didInitRef.current) {
      didInitRef.current = true;
      if (searchParamsKey) {
        const parsed = searchParamsToDiscoverState(
          new URLSearchParams(searchParamsKey),
          {
            activeCategory: saved?.activeCategory,
            situationGroup: saved?.situationGroup,
            showFilters: saved?.showFilters,
            showMoods: saved?.showMoods,
          },
          MOOD_PRESETS
        );
        applyDiscoverState(parsed);
      } else if (saved) {
        applyDiscoverState(sanitizeDiscoverState(saved, MOOD_PRESETS));
      }
      setFiltersReady(true);
      return;
    }

    // Subsequent external URL navigation while mounted (e.g. clicking a genre or mood deep link)
    if (searchParamsKey) {
      applyDiscoverState(
        searchParamsToDiscoverState(
          new URLSearchParams(searchParamsKey),
          undefined,
          MOOD_PRESETS
        )
      );
    }
  }, [searchParamsKey, applyDiscoverState]);

  // Persist active discover filters to URL (replaceState) & sessionStorage so Back / revisit never loses them
  useEffect(() => {
    if (!filtersReady) return;
    const snapshot: PersistedDiscoverState = {
      type,
      search: debouncedSearch,
      selectedGenres,
      genreMinRanks: normalizeGenreMinRanks(debouncedGenreMinRanks, selectedGenres),
      selectedTags,
      activeMoodId,
      activeCategory,
      situationGroup,
      year,
      season,
      format,
      status,
      minScore,
      maxScore,
      minUnits: debouncedMinUnits,
      maxUnits: debouncedMaxUnits,
      sort,
      hideInLibrary,
      showFilters,
      showMoods,
    };
    const qs = syncUrlSearchParams("/discover", discoverStateToSearchParams(snapshot));
    lastWrittenQsRef.current = qs;

    if (qs || showFilters || showMoods) {
      writeSessionState(FILTER_STORAGE_KEYS.discover, snapshot);
    } else {
      clearSessionState(FILTER_STORAGE_KEYS.discover);
    }
  }, [
    filtersReady,
    type,
    debouncedSearch,
    selectedGenres,
    debouncedGenreMinRanks,
    selectedTags,
    activeMoodId,
    activeCategory,
    situationGroup,
    year,
    season,
    format,
    status,
    minScore,
    maxScore,
    debouncedMinUnits,
    debouncedMaxUnits,
    sort,
    hideInLibrary,
    showFilters,
    showMoods,
  ]);

  // Debounce search text, genre intensity slider & episode/chapter custom inputs
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 260);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedGenreMinRanks(genreMinRanks), 180);
    return () => clearTimeout(t);
  }, [genreMinRanks]);

  const encodedDebouncedGenreRanks = useMemo(
    () => serializeGenreMinRanks(debouncedGenreMinRanks, selectedGenres),
    [debouncedGenreMinRanks, selectedGenres]
  );

  const searchAliasPreview = useMemo(() => resolveSearchAlias(search), [search]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedMinUnits(minUnits.trim());
      setDebouncedMaxUnits(maxUnits.trim());
    }, 260);
    return () => clearTimeout(t);
  }, [minUnits, maxUnits]);

  const fetchResults = useCallback(
    async (targetPage: number, append: boolean) => {
      const reqId = ++reqIdRef.current;
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
        if (selectedGenres.length > 0) {
          qs.set("genres", selectedGenres.join(","));
          if (encodedDebouncedGenreRanks) {
            qs.set("genreRanks", encodedDebouncedGenreRanks);
          }
        }
        if (selectedTags.length > 0) qs.set("tags", selectedTags.join(","));
        if (minScore !== "ALL") qs.set("minScore", minScore);
        if (maxScore !== "ALL") qs.set("maxScore", maxScore);
        if (type === "ANIME") {
          if (debouncedMinUnits && Number(debouncedMinUnits) > 0) {
            qs.set("minEpisodes", debouncedMinUnits);
          }
          if (debouncedMaxUnits && Number(debouncedMaxUnits) > 0) {
            qs.set("maxEpisodes", debouncedMaxUnits);
          }
        } else {
          if (debouncedMinUnits && Number(debouncedMinUnits) > 0) {
            qs.set("minChapters", debouncedMinUnits);
          }
          if (debouncedMaxUnits && Number(debouncedMaxUnits) > 0) {
            qs.set("maxChapters", debouncedMaxUnits);
          }
        }
        if (year !== "ALL") qs.set("year", year);
        if (season !== "ALL" && type === "ANIME") qs.set("season", season);
        if (format !== "ALL") qs.set("format", format);
        if (status !== "ALL") qs.set("status", status);

        const queryKey = qs.toString();
        if (!append && targetPage === 1) {
          const cached = discoverQueryCache.get(queryKey);
          if (cached && Array.isArray(cached.items) && cached.items.length > 0) {
            setItems(cached.items as MediaItem[]);
            setHasNextPage(Boolean(cached.hasNextPage));
            setTotal(Number(cached.total ?? cached.items.length));
            setPage(1);
            setLoading(false);
          }
        }

        const res = await fetch(`/api/anilist?${queryKey}`);
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        if (reqId !== reqIdRef.current) return;

        const nextItems: MediaItem[] = data.items ?? [];
        const nextHasPage = Boolean(data.hasNextPage);
        const nextTotal = Number(data.total ?? nextItems.length ?? 0);

        if (!append && targetPage === 1 && nextItems.length > 0) {
          discoverQueryCache.set(queryKey, {
            items: nextItems,
            hasNextPage: nextHasPage,
            total: nextTotal,
          });
        }

        setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
        setHasNextPage(nextHasPage);
        setTotal(nextTotal);
        setPage(targetPage);
      } catch {
        // keep current items on error
      } finally {
        if (reqId === reqIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [
      type,
      debouncedSearch,
      selectedGenres,
      encodedDebouncedGenreRanks,
      selectedTags,
      minScore,
      maxScore,
      debouncedMinUnits,
      debouncedMaxUnits,
      year,
      season,
      format,
      status,
      sort,
    ]
  );

  useEffect(() => {
    if (!filtersReady) return;
    void fetchResults(1, false);
  }, [filtersReady, fetchResults]);

  const handleTypeSwitch = (next: MediaType) => {
    setType(next);
    setFormat("ALL");
    setMinUnits("");
    setMaxUnits("");
    if (next === "MANGA") setSeason("ALL");
  };

  const toggleGenre = (id: string) => {
    setActiveMoodId(null);
    setSelectedGenres((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((g) => g !== id) : [...prev, id];
      setGenreMinRanks((curr) => {
        if (exists) {
          const rest = { ...curr };
          delete rest[id];
          return rest;
        }
        return { ...curr, [id]: curr[id] ?? 0 };
      });
      if (exists) {
        setDebouncedGenreMinRanks((curr) => {
          const rest = { ...curr };
          delete rest[id];
          return rest;
        });
      }
      return next;
    });
  };

  const updateGenreMinRank = (genreId: string, value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value / 5) * 5));
    setGenreMinRanks((prev) => ({ ...prev, [genreId]: clamped }));
  };

  const resetAllGenreMinRanks = () => {
    const zeroed = Object.fromEntries(selectedGenres.map((g) => [g, 0]));
    setGenreMinRanks(zeroed);
    setDebouncedGenreMinRanks(zeroed);
  };

  const toggleTag = (id: string) => {
    setActiveMoodId(null);
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleSelectMood = (mood: MoodPreset | null) => {
    if (!mood) {
      setActiveMoodId(null);
      setSelectedGenres([]);
      setGenreMinRanks({});
      setDebouncedGenreMinRanks({});
      setSelectedTags([]);
      setMinScore("ALL");
      setSort("TRENDING_DESC");
      return;
    }
    setActiveMoodId(mood.id);
    setSelectedGenres(mood.genres);
    const moodZeroRanks = Object.fromEntries(mood.genres.map((g) => [g, 0]));
    setGenreMinRanks(moodZeroRanks);
    setDebouncedGenreMinRanks(moodZeroRanks);
    setSelectedTags(mood.tags);
    setMinScore(mood.minScore ?? "ALL");
    if (mood.sort) setSort(mood.sort);
  };

  const resetAll = () => {
    setSearch("");
    setDebouncedSearch("");
    setActiveMoodId(null);
    setSelectedGenres([]);
    setGenreMinRanks({});
    setDebouncedGenreMinRanks({});
    setSelectedTags([]);
    setTagSearch("");
    setYear("ALL");
    setSeason("ALL");
    setFormat("ALL");
    setStatus("ALL");
    setMinScore("ALL");
    setMaxScore("ALL");
    setMinUnits("");
    setMaxUnits("");
    setDebouncedMinUnits("");
    setDebouncedMaxUnits("");
    setSort("TRENDING_DESC");
  };

  const hasUnitFilter = Boolean(debouncedMinUnits || debouncedMaxUnits);
  const lengthPresets = type === "ANIME" ? ANIME_LENGTH_PRESETS : MANGA_LENGTH_PRESETS;
  const unitShortLabel = type === "ANIME" ? "ép." : "ch.";

  const activeLengthPresetId = useMemo(() => {
    const match = lengthPresets.find(
      (p) => p.min === minUnits.trim() && p.max === maxUnits.trim()
    );
    if (match) return match.id;
    // Also match when user came from URL ?maxEpisodes=13 without minEpisodes
    if (!minUnits.trim() && maxUnits.trim() === "13" && type === "ANIME") {
      return "UNDER_13";
    }
    return hasUnitFilter ? "CUSTOM" : "ALL";
  }, [lengthPresets, minUnits, maxUnits, type, hasUnitFilter]);

  const formatUnitRangeLabel = () => {
    if (debouncedMinUnits && debouncedMaxUnits) {
      return `${debouncedMinUnits} – ${debouncedMaxUnits} ${unitShortLabel}`;
    }
    if (debouncedMaxUnits) return `≤ ${debouncedMaxUnits} ${unitShortLabel}`;
    if (debouncedMinUnits) return `${debouncedMinUnits}+ ${unitShortLabel}`;
    return "";
  };

  const activeGenreRankCount = selectedGenres.filter(
    (g) => (debouncedGenreMinRanks[g] ?? 0) > 0
  ).length;
  const hasAnyLiveGenreRank = selectedGenres.some(
    (g) => (genreMinRanks[g] ?? 0) > 0
  );

  const activeFilterCount =
    selectedGenres.length +
    activeGenreRankCount +
    selectedTags.length +
    (year !== "ALL" ? 1 : 0) +
    (season !== "ALL" ? 1 : 0) +
    (format !== "ALL" ? 1 : 0) +
    (status !== "ALL" ? 1 : 0) +
    (minScore !== "ALL" ? 1 : 0) +
    (maxScore !== "ALL" ? 1 : 0) +
    (hasUnitFilter ? 1 : 0);

  const hasActiveFilters = Boolean(debouncedSearch.trim()) || activeFilterCount > 0;
  const formats = type === "ANIME" ? ANIME_FORMATS : MANGA_FORMATS;

  // Compute counts per category tab
  const categoryCounts = useMemo(() => {
    const counts: Record<TagCategory["id"], number> = {
      genres: selectedGenres.length,
      situations: 0,
      universes: 0,
      themes: 0,
      demographics: 0,
    };
    for (const cat of FILTER_CATEGORIES) {
      if (cat.id === "genres") continue;
      counts[cat.id] = cat.items.filter((i) => selectedTags.includes(i.id)).length;
    }
    return counts;
  }, [selectedGenres, selectedTags]);

  // If user types in mini tag search, search across ALL categories cleanly
  const tagSearchTrimmed = tagSearch.trim().toLowerCase();
  const visibleCategory =
    FILTER_CATEGORIES.find((c) => c.id === activeCategory) ?? FILTER_CATEGORIES[0];

  const searchedAllItems = useMemo(() => {
    if (!tagSearchTrimmed) return null;
    const matches: { id: string; label: string; isGenre: boolean; catLabel: string }[] = [];
    for (const cat of FILTER_CATEGORIES) {
      for (const item of cat.items) {
        if (
          item.label.toLowerCase().includes(tagSearchTrimmed) ||
          item.id.toLowerCase().includes(tagSearchTrimmed)
        ) {
          matches.push({
            id: item.id,
            label: item.label,
            isGenre: cat.id === "genres",
            catLabel: cat.label,
          });
        }
      }
    }
    return matches;
  }, [tagSearchTrimmed]);

  const libraryIds = useMemo(
    () => new Set(library.map((e) => e.mediaId)),
    [library]
  );

  const visibleItems = useMemo(
    () => (hideInLibrary ? items.filter((item) => !libraryIds.has(item.id)) : items),
    [items, hideInLibrary, libraryIds]
  );

  const hiddenCount = items.length - visibleItems.length;

  const QUICK_GENRES = [
    { id: "Action", label: "Action" },
    { id: "Adventure", label: "Aventure" },
    { id: "Drama", label: "Drame" },
    { id: "Fantasy", label: "Fantaisie" },
    { id: "Romance", label: "Romance" },
    { id: "Sci-Fi", label: "Sci-Fi" },
    { id: "Comedy", label: "Comédie" },
    { id: "Slice of Life", label: "Tranche de vie" },
    { id: "Thriller", label: "Thriller" },
  ];

  return (
    <div className="pt-[calc(5rem+env(safe-area-inset-top))] sm:pt-24 pb-24 md:pb-16 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
      {/* Compact Header — immediate focus on search & posters */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gradient-editorial">
            {type === "ANIME" ? t("discover.titleAnime") : t("discover.titleManga")}
          </h1>
          <p className="text-sm text-[#8A8FA4] mt-1">
            {t("discover.subtitle")}
          </p>
        </div>

        {/* Anime / Manga Switcher */}
        <div className="inline-flex items-center p-1 rounded-full bg-white/[0.04] border border-white/[0.08] self-start md:self-auto">
          {(["ANIME", "MANGA"] as MediaType[]).map((mt) => {
            const active = type === mt;
            const Icon = mt === "ANIME" ? Tv : BookOpen;
            return (
              <button
                key={mt}
                type="button"
                onClick={() => handleTypeSwitch(mt)}
                className={cn(
                  "relative inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer",
                  active ? "text-white" : "text-[#9A9EAE] hover:text-white"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="discover-type-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className="absolute inset-0 rounded-full bg-accent shadow-[0_6px_20px_rgb(var(--shiori-accent-rgb)/0.38)]"
                  />
                )}
                <Icon className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">
                  {mt === "ANIME" ? t("common.anime") : t("common.manga")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary Search & Controls Strip — puts posters right above the fold */}
      <div className="rounded-2xl card-surface border-white/[0.09] p-3.5 sm:p-4 space-y-3.5">
        {/* Top Row: Search + Sort + Envies + Filtres avancés */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1 group">
            <Search className="w-4 h-4 text-accent absolute left-3.5 top-1/2 -translate-y-1/2 transition-transform group-focus-within:scale-110" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("discover.searchPlaceholder")}
              className="w-full h-10 pl-10 pr-9 rounded-xl bg-[#080A10] border border-white/[0.09] text-sm text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent/70 transition-all"
            />
            {search && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.85 }}
                onClick={() => setSearch("")}
                aria-label="Effacer la recherche"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/[0.08] text-[#7D8296] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </motion.button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LuxurySelect
              value={sort}
              onChange={setSort}
              options={SORT_OPTIONS}
              defaultValue="TRENDING_DESC"
              align="right"
              className="flex-1 sm:flex-none min-w-[155px] sm:w-44"
            />

            <button
              type="button"
              onClick={() => setShowMoods((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shrink-0",
                showMoods || activeMoodId
                  ? "bg-accent/18 border-accent/45 text-accent-soft"
                  : "bg-[#090B12] border-white/[0.09] text-[#A2A6B8] hover:text-white"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Envies</span>
            </button>

            <motion.button
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                "inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shrink-0",
                showFilters || activeFilterCount > 0
                  ? "bg-white/[0.1] border-white/[0.2] text-white"
                  : "bg-[#090B12] border-white/[0.09] text-[#A2A6B8] hover:text-white"
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-accent-soft" />
              <span>{t("discover.filters")}</span>
              {activeFilterCount > 0 && (
                <motion.span
                  key={activeFilterCount}
                  initial={{ scale: 0.6 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 18 }}
                  className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[10px] font-mono text-accent-fg flex items-center justify-center"
                >
                  {activeFilterCount}
                </motion.span>
              )}
            </motion.button>
          </div>
        </div>

        {/* 1-Click Quick Genres Row (90% of discovery in 1 tap) */}
        {searchAliasPreview.didExpand && searchAliasPreview.canonicalLabel && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-kinpaku/10 border border-kinpaku/25 text-xs text-[#F5D68E]">
            <Wand2 className="w-3.5 h-3.5 text-kinpaku shrink-0" />
            <span className="truncate">
              Alias détecté :{" "}
              <strong className="text-white">{searchAliasPreview.canonicalLabel}</strong>
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => {
              setSelectedGenres([]);
              setGenreMinRanks({});
              setDebouncedGenreMinRanks({});
              setSelectedTags([]);
              setActiveMoodId(null);
            }}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap shrink-0 cursor-pointer transition-colors",
              selectedGenres.length === 0 && selectedTags.length === 0
                ? "bg-white text-[#090A0F] border-white font-semibold"
                : "bg-white/[0.03] border-white/[0.08] text-[#9A9EAE] hover:text-white"
            )}
          >
            {t("common.all")}
          </button>
          {QUICK_GENRES.map((g) => {
            const selected = selectedGenres.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGenre(g.id)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap shrink-0 cursor-pointer transition-colors",
                  selected
                    ? "bg-accent border-accent text-accent-fg font-semibold"
                    : "bg-white/[0.03] border-white/[0.08] text-[#B8BCCB] hover:text-white hover:border-white/[0.16]"
                )}
              >
                {tGenre(g.id)}
              </button>
            );
          })}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAll}
              className="ml-auto px-2.5 py-1 rounded-full text-xs font-medium text-accent-soft hover:text-white inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Effacer</span>
            </button>
          )}
        </div>

        {/* Independent Per-Genre Intensity Sliders — one compact row per selected genre */}
        <AnimatePresence initial={false}>
          {selectedGenres.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: CINEMA_EASE }}
              className="overflow-hidden"
            >
              <div className="rounded-xl bg-obsidian/80 border border-white/[0.08] p-3 sm:p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-[#9A9EAE]">
                    <Gauge className="w-3.5 h-3.5 text-kinpaku shrink-0" />
                    <span>Intensité minimale par genre</span>
                  </span>
                  {hasAnyLiveGenreRank && (
                    <button
                      type="button"
                      onClick={resetAllGenreMinRanks}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-soft hover:text-white transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Réinitialiser</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {selectedGenres.map((genreId) => {
                    const label = getTaxonomyLabel(genreId);
                    const value = genreMinRanks[genreId] ?? 0;
                    const isActive = value > 0;

                    return (
                      <div
                        key={`genre-slider-${genreId}`}
                        className="rounded-lg bg-surface/65 border border-white/[0.06] px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
                      >
                        <div className="flex items-center justify-between sm:w-44 shrink-0 gap-2">
                          <span className="text-xs font-semibold text-[#F4F3EE] truncate">
                            {label}
                          </span>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full font-mono text-[10.5px] font-bold border whitespace-nowrap shrink-0",
                              isActive
                                ? "bg-kinpaku/15 border-kinpaku/40 text-kinpaku"
                                : "bg-white/[0.04] border-white/[0.08] text-[#8E93A6]"
                            )}
                          >
                            {isActive ? `min ${value}%` : "min 0%"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <span className="font-mono text-[10px] text-[#7A7F94] shrink-0">
                            0%
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={value}
                            onChange={(e) =>
                              updateGenreMinRank(genreId, Number(e.target.value))
                            }
                            aria-label={`Intensité minimale pour ${label} (${value}%)`}
                            className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/[0.12] accent-[#E5484D]"
                          />
                          <span className="font-mono text-[10px] text-kinpaku shrink-0">
                            100%
                          </span>
                          {isActive && (
                            <button
                              type="button"
                              onClick={() => updateGenreMinRank(genreId, 0)}
                              title={`Réinitialiser ${label} à 0%`}
                              aria-label={`Réinitialiser l'intensité de ${label}`}
                              className="p-1 rounded-md bg-white/[0.05] hover:bg-white/[0.12] text-[#9A9EAE] hover:text-white transition-colors cursor-pointer shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* On-Demand Moods Carousel (collapsed by default so posters appear immediately!) */}
        <AnimatePresence initial={false}>
          {showMoods && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: CINEMA_EASE }}
              className="overflow-hidden pt-3 border-t border-white/[0.07]"
            >
              <MoodCarousel activeMoodId={activeMoodId} onSelectMood={handleSelectMood} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsible Advanced Filters Studio (collapsed by default!) */}
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.32, ease: CINEMA_EASE }}
              className="overflow-visible"
            >
              <div className="pt-4 border-t border-white/[0.07] space-y-5">
                {/* 5 Custom Animated Glass Dropdowns (ZERO native <select>) */}
                <div
                  className={cn(
                    "grid grid-cols-2 sm:grid-cols-3 gap-3",
                    type === "ANIME" ? "lg:grid-cols-5" : "lg:grid-cols-4"
                  )}
                >
                  <LuxurySelect
                    label="Format"
                    value={format}
                    onChange={setFormat}
                    options={formats}
                    icon={Layers}
                  />
                  <LuxurySelect
                    label="Année"
                    value={year}
                    onChange={setYear}
                    options={YEAR_OPTIONS}
                    icon={Calendar}
                    columns={4}
                  />
                  {type === "ANIME" && (
                    <LuxurySelect
                      label="Saison"
                      value={season}
                      onChange={setSeason}
                      options={SEASON_OPTIONS}
                      icon={Sparkles}
                    />
                  )}
                  <LuxurySelect
                    label="Diffusion"
                    value={status}
                    onChange={setStatus}
                    options={STATUS_OPTIONS}
                    icon={Radio}
                  />
                  <LuxurySelect
                    label="Note minimale"
                    value={minScore}
                    onChange={setMinScore}
                    options={MIN_SCORE_OPTIONS}
                    icon={Star}
                    align="right"
                  />
                </div>

                {/* Quick Tactile Bar: Episode/Chapter Length + Score Filter */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
                  {/* Episode / Chapter Count Filter */}
                  <div className="xl:col-span-7 rounded-2xl bg-obsidian/75 border border-white/[0.07] p-3.5 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-[#9A9EAE] flex items-center gap-1.5">
                        <Tv className="w-3.5 h-3.5 text-accent" />
                        <span>
                          {type === "ANIME" ? "Nombre d'épisodes" : "Nombre de chapitres"}
                        </span>
                      </span>

                      {/* Custom Min / Max Inputs */}
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <input
                          type="number"
                          min={1}
                          max={2000}
                          value={minUnits}
                          onChange={(e) => setMinUnits(e.target.value)}
                          placeholder="Min"
                          aria-label={type === "ANIME" ? "Épisodes minimum" : "Chapitres minimum"}
                          className="w-16 h-7 px-2 rounded-lg bg-surface border border-white/[0.09] font-mono text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
                        />
                        <span className="text-[#656A7E]">à</span>
                        <input
                          type="number"
                          min={1}
                          max={2000}
                          value={maxUnits}
                          onChange={(e) => setMaxUnits(e.target.value)}
                          placeholder="Max"
                          aria-label={type === "ANIME" ? "Épisodes maximum" : "Chapitres maximum"}
                          className="w-16 h-7 px-2 rounded-lg bg-surface border border-white/[0.09] font-mono text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
                        />
                        <span className="font-mono text-[#7D8296]">{unitShortLabel}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {lengthPresets.map((preset) => {
                        const active = activeLengthPresetId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            title={preset.hint}
                            onClick={() => {
                              setMinUnits(preset.min);
                              setMaxUnits(preset.max);
                            }}
                            className={cn(
                              "px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer",
                              active
                                ? "bg-accent border-accent text-accent-fg shadow-accent"
                                : "bg-white/[0.03] border-white/[0.08] text-[#B8BCCB] hover:text-white hover:border-white/[0.18]"
                            )}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Score / Rating Quick Filter */}
                  <div className="xl:col-span-5 rounded-2xl bg-obsidian/75 border border-white/[0.07] p-3.5 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-[#9A9EAE] flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-kinpaku fill-current" />
                        <span>Filtrer par note (/10)</span>
                      </span>

                      <div className="flex items-center gap-1.5 text-[11px] font-mono">
                        <span className="text-[#7D8296]">Max :</span>
                        {["ALL", "80", "70"].map((cap) => (
                          <button
                            key={cap}
                            type="button"
                            onClick={() => setMaxScore(cap)}
                            className={cn(
                              "px-2 py-0.5 rounded-md border transition-colors cursor-pointer",
                              maxScore === cap
                                ? "bg-kinpaku/20 border-kinpaku/45 text-kinpaku font-semibold"
                                : "bg-white/[0.03] border-white/[0.08] text-[#8E93A6] hover:text-white"
                            )}
                          >
                            {cap === "ALL" ? "Aucun" : `≤ ${Number(cap) / 10}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {QUICK_SCORE_PILLS.map((pill) => {
                        const active = minScore === pill.id;
                        return (
                          <button
                            key={pill.id}
                            type="button"
                            onClick={() => setMinScore(pill.id)}
                            className={cn(
                              "px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer inline-flex items-center gap-1",
                              active
                                ? "bg-kinpaku text-[#090A0F] border-kinpaku shadow-[0_6px_18px_rgba(240,185,91,0.35)]"
                                : "bg-white/[0.03] border-white/[0.08] text-[#B8BCCB] hover:text-white hover:border-white/[0.18]"
                            )}
                          >
                            {pill.id !== "ALL" && <Star className="w-3 h-3 fill-current" />}
                            <span>{pill.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Multi-Genre & Situations Explorer */}
                <div className="rounded-2xl bg-[#090B12]/90 border border-white/[0.07] p-4 space-y-4">
                  {/* Category Tabs + Quick Tag Search */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      {FILTER_CATEGORIES.map((cat) => {
                        const isActive = activeCategory === cat.id && !tagSearchTrimmed;
                        const count = categoryCounts[cat.id];
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setActiveCategory(cat.id);
                              setTagSearch("");
                            }}
                            className={cn(
                              "relative px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer",
                              isActive
                                ? "text-white"
                                : "text-[#8C91A6] hover:text-[#ECEBE6]"
                            )}
                          >
                            {isActive && (
                              <motion.span
                                layoutId="discover-taxonomy-tab"
                                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                className="absolute inset-0 rounded-lg bg-white/[0.11] border border-white/[0.12]"
                              />
                            )}
                            <span className="relative z-10">{cat.label}</span>
                            {count > 0 && (
                              <span className="relative z-10 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-accent text-accent-fg">
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Quick Tag Search */}
                    <div className="relative w-full lg:w-64 shrink-0">
                      <Tag className="w-3.5 h-3.5 text-[#757A8F] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        placeholder="Chercher un genre ou situation..."
                        className="w-full h-9 pl-8 pr-8 rounded-lg bg-[#0F121C] border border-white/[0.08] text-xs text-white placeholder:text-[#63687B] focus:outline-none focus:border-accent/60"
                      />
                      {tagSearch && (
                        <button
                          type="button"
                          onClick={() => setTagSearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7D8296] hover:text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Category Description + Situations Sub-Group Filter */}
                  <div className="space-y-3">
                    <p className="text-[11.5px] text-[#7D8296]">
                      {tagSearchTrimmed
                        ? `Résultats pour « ${tagSearch.trim()} » dans toutes les catégories (${searchedAllItems?.length ?? 0})`
                        : visibleCategory.description}
                    </p>

                    {!tagSearchTrimmed && activeCategory === "situations" && (
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                        {SITUATION_GROUPS.map((grp) => {
                          const isGrpActive = situationGroup === grp.id;
                          const grpCount =
                            grp.id === "ALL"
                              ? visibleCategory.items.length
                              : visibleCategory.items.filter((i) => i.group === grp.id).length;
                          const selectedInGrp =
                            grp.id === "ALL"
                              ? visibleCategory.items.filter((i) => selectedTags.includes(i.id)).length
                              : visibleCategory.items.filter(
                                  (i) => i.group === grp.id && selectedTags.includes(i.id)
                                ).length;

                          return (
                            <motion.button
                              key={grp.id}
                              type="button"
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setSituationGroup(grp.id)}
                              className={cn(
                                "px-3 py-1 rounded-lg text-[11px] font-medium border whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0",
                                isGrpActive
                                  ? "bg-violet-500/20 border-violet-400/50 text-violet-100"
                                  : "bg-white/[0.02] border-white/[0.06] text-[#8E93A6] hover:text-white hover:bg-white/[0.06]"
                              )}
                            >
                              <span>{grp.label}</span>
                              <span className="font-mono text-[10px] opacity-65">
                                {grpCount}
                              </span>
                              {selectedInGrp > 0 && grp.id !== "ALL" && (
                                <span className="w-1.5 h-1.5 rounded-full bg-violet-300" />
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Animated Multi-Select Pills Grid */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={
                        tagSearchTrimmed
                          ? `search-${tagSearchTrimmed}`
                          : activeCategory === "situations"
                            ? `situations-${situationGroup}`
                            : activeCategory
                      }
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18, ease: CINEMA_EASE }}
                      className="flex flex-wrap gap-2"
                    >
                      {searchedAllItems ? (
                        searchedAllItems.length === 0 ? (
                          <span className="text-xs text-[#6E7387] py-2">
                            Aucun genre ou situation ne correspond à &laquo; {tagSearch} &raquo;.
                          </span>
                        ) : (
                          searchedAllItems.map((m) => {
                            const selected = m.isGenre
                              ? selectedGenres.includes(m.id)
                              : selectedTags.includes(m.id);
                            return (
                              <motion.button
                                key={`${m.isGenre ? "g" : "t"}-${m.id}`}
                                type="button"
                                whileHover={{ y: -1 }}
                                whileTap={{ scale: 0.93 }}
                                onClick={() =>
                                  m.isGenre ? toggleGenre(m.id) : toggleTag(m.id)
                                }
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 cursor-pointer",
                                  selected
                                    ? m.isGenre
                                      ? "bg-accent border-accent-hover text-accent-fg shadow-[0_4px_16px_rgb(var(--shiori-accent-rgb)/0.4)]"
                                      : "bg-violet-500/25 border-violet-400/60 text-violet-100 shadow-[0_4px_16px_rgba(139,92,246,0.3)]"
                                    : "bg-white/[0.03] border-white/[0.08] text-[#B8BCCB] hover:text-white hover:bg-white/[0.08]"
                                )}
                              >
                                {selected && <Check className="w-3 h-3" />}
                                <span>{m.label}</span>
                                <span className="text-[10px] opacity-60 font-mono">
                                  · {m.catLabel}
                                </span>
                              </motion.button>
                            );
                          })
                        )
                      ) : (
                        visibleCategory.items
                          .filter((item) =>
                            activeCategory === "situations" && situationGroup !== "ALL"
                              ? item.group === situationGroup
                              : true
                          )
                          .map((item) => {
                            const isGenreCat = visibleCategory.id === "genres";
                            const selected = isGenreCat
                              ? selectedGenres.includes(item.id)
                              : selectedTags.includes(item.id);

                            return (
                              <motion.button
                                key={item.id}
                                type="button"
                                whileHover={{ y: -1.5 }}
                                whileTap={{ scale: 0.93 }}
                                onClick={() =>
                                  isGenreCat ? toggleGenre(item.id) : toggleTag(item.id)
                                }
                                className={cn(
                                  "px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 cursor-pointer",
                                  selected
                                    ? isGenreCat
                                      ? "bg-accent border-accent-hover text-accent-fg shadow-[0_6px_18px_rgb(var(--shiori-accent-rgb)/0.42)]"
                                      : "bg-violet-500/25 border-violet-400/60 text-violet-100 shadow-[0_6px_18px_rgba(139,92,246,0.3)]"
                                    : "bg-white/[0.03] border-white/[0.075] text-[#B8BCCB] hover:text-white hover:border-white/[0.18] hover:bg-white/[0.07]"
                                )}
                              >
                                {selected && <Check className="w-3 h-3" />}
                                <span>{item.label}</span>
                              </motion.button>
                            );
                          })
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Combined Filter Chips Bar — stays visible even when filter drawer is closed */}
        <AnimatePresence>
          {hasActiveFilters && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-white/[0.07]"
            >
              <span className="text-[11px] font-medium text-[#7A7F94] mr-0.5">
                Filtres actifs :
              </span>

              {selectedGenres.map((g) => {
                const rankVal = genreMinRanks[g] ?? 0;
                return (
                  <motion.span
                    key={`active-g-${g}`}
                    layout
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.85, opacity: 0 }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/18 border border-accent/40 text-xs font-medium text-white"
                  >
                    <span>{getTaxonomyLabel(g)}</span>
                    {rankVal > 0 && (
                      <span className="font-mono text-[10.5px] font-bold text-kinpaku">
                        ≥ {rankVal}%
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleGenre(g)}
                      aria-label={`Retirer ${getTaxonomyLabel(g)}`}
                      className="text-accent-soft hover:text-white cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.span>
                );
              })}

              {selectedTags.map((t) => (
                <motion.span
                  key={`active-t-${t}`}
                  layout
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/18 border border-violet-400/40 text-xs font-medium text-violet-100"
                >
                  <span>{getTaxonomyLabel(t)}</span>
                  <button
                    type="button"
                    onClick={() => toggleTag(t)}
                    aria-label={`Retirer ${getTaxonomyLabel(t)}`}
                    className="text-violet-300 hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.span>
              ))}

              {format !== "ALL" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] border border-white/[0.14] text-xs text-white">
                  <span>{formats.find((f) => f.id === format)?.label ?? format}</span>
                  <button type="button" onClick={() => setFormat("ALL")} className="text-[#9A9EAE] hover:text-white cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {year !== "ALL" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] border border-white/[0.14] text-xs font-mono text-white">
                  <span>{year}</span>
                  <button type="button" onClick={() => setYear("ALL")} className="text-[#9A9EAE] hover:text-white cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {season !== "ALL" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] border border-white/[0.14] text-xs text-white">
                  <span>{SEASON_OPTIONS.find((s) => s.id === season)?.label}</span>
                  <button type="button" onClick={() => setSeason("ALL")} className="text-[#9A9EAE] hover:text-white cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {status !== "ALL" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] border border-white/[0.14] text-xs text-white">
                  <span>{STATUS_OPTIONS.find((s) => s.id === status)?.label}</span>
                  <button type="button" onClick={() => setStatus("ALL")} className="text-[#9A9EAE] hover:text-white cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {minScore !== "ALL" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F0B95B]/16 border border-[#F0B95B]/40 text-xs font-mono text-[#F0B95B]">
                  <span>★ {Number(minScore) / 10}+</span>
                  <button type="button" onClick={() => setMinScore("ALL")} className="hover:text-white cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {maxScore !== "ALL" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F0B95B]/16 border border-[#F0B95B]/40 text-xs font-mono text-[#F0B95B]">
                  <span>★ ≤ {Number(maxScore) / 10}</span>
                  <button type="button" onClick={() => setMaxScore("ALL")} className="hover:text-white cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {hasUnitFilter && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/18 border border-sky-400/40 text-xs font-mono text-sky-200">
                  <span>{formatUnitRangeLabel()}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMinUnits("");
                      setMaxUnits("");
                    }}
                    className="hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={resetAll}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-accent-soft hover:text-white hover:bg-accent/20 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Tout effacer</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#858A9E]">
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="inline-flex items-center gap-2 text-white">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
              Actualisation du catalogue...
            </span>
          ) : (
            <span>
              <strong className="text-white font-mono">{visibleItems.length}</strong> affichés
              {total > items.length ? ` sur ${total.toLocaleString("fr-FR")} œuvres` : ""}
              {hideInLibrary && hiddenCount > 0 && (
                <span className="ml-1.5 text-accent-soft">
                  ({hiddenCount} déjà dans ma bibliothèque masqué{hiddenCount > 1 ? "s" : ""})
                </span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {selectedGenres.length + selectedTags.length > 1 && (
            <span className="text-[11px] font-mono text-[#7D8296] hidden sm:inline">
              Mode combiné : {selectedGenres.length + selectedTags.length} critères actifs
            </span>
          )}
          <button
            type="button"
            onClick={() => setHideInLibrary((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors cursor-pointer",
              hideInLibrary
                ? "bg-accent/18 border-accent/45 text-accent-soft"
                : "bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.09] text-[#C8CCE0] hover:text-white"
            )}
          >
            {hideInLibrary ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>Masquer ma bibliothèque</span>
          </button>
        </div>
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
      ) : visibleItems.length === 0 ? (
        <div className="rounded-2xl card-surface py-16 px-6 text-center">
          <Sparkles className="w-8 h-8 text-[#52576B] mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">Aucun résultat trouvé</h3>
          <p className="text-sm text-[#868B9F] mt-1 max-w-md mx-auto">
            {hideInLibrary && items.length > 0
              ? "Toutes les œuvres de cette page figurent déjà dans votre bibliothèque. Chargez la suite ou désactivez le filtre."
              : "Cette combinaison de filtres est très précise. Retirez un critère ou réinitialisez pour élargir les résultats."}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {hideInLibrary && items.length > 0 && (
              <button
                type="button"
                onClick={() => setHideInLibrary(false)}
                className="px-5 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.12] text-white text-xs font-semibold cursor-pointer"
              >
                Afficher ma bibliothèque
              </button>
            )}
            <button
              type="button"
              onClick={resetAll}
              className="px-5 py-2 rounded-full bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover cursor-pointer"
            >
              Tout réinitialiser
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
            {visibleItems.map((item) => (
              <MediaCard key={`${item.id}-${item.type}`} media={item} />
            ))}
          </div>

          {hasNextPage && (
            <div className="pt-4 flex justify-center">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                disabled={loadingMore}
                onClick={() => void fetchResults(page + 1, true)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-sm font-medium text-white transition-all cursor-pointer disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                    <span>Chargement...</span>
                  </>
                ) : (
                  <span>Charger plus de titres</span>
                )}
              </motion.button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
