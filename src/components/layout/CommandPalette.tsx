"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  Compass,
  Library,
  CalendarDays,
  BarChart3,
  Loader2,
  ArrowRight,
  Sparkles,
  Plus,
  Check,
  Heart,
  Palette,
  Wand2,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import {
  getInstantAliasSuggestions,
  resolveSearchAlias,
} from "@/lib/searchAliases";
import {
  rankMediaByFuzzySearch,
  searchLibraryEntriesFuzzy,
} from "@/lib/fuzzy-search";
import { formatScore, getDisplayTitle } from "@/lib/utils";
import type { MediaItem, MediaType } from "@/types/media";

type SearchScope = "ALL" | MediaType;

const QUICK_ROUTES = [
  { href: "/library", label: "Ma Bibliothèque", sub: "En cours, Terminés et À voir", icon: Library },
  { href: "/library?favorites=1", label: "Mes Favoris", sub: "Vos coups de cœur classés", icon: Heart },
  { href: "/discover", label: "Découvrir", sub: "Explorer le catalogue animés & mangas", icon: Compass },
  { href: "/episodes", label: "Épisodes de la semaine", sub: "Suivi rapide +1 Vu", icon: CalendarDays },
  { href: "/stats", label: "Statistiques", sub: "Notes, genres et temps passé", icon: BarChart3 },
  { href: "/settings", label: "Paramètres & Apparence", sub: "Thèmes, profil et sauvegardes", icon: Palette },
];

export function CommandPalette() {
  const router = useRouter();
  const {
    commandOpen,
    setCommandOpen,
    library,
    getEntry,
    quickAdd,
    openQuickEdit,
  } = useShiori();
  const { t, tr, tFormat, tStatus } = useTranslation();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("ALL");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const aliasResolution = useMemo(() => resolveSearchAlias(query), [query]);
  const instantAliases = useMemo(
    () => getInstantAliasSuggestions(query, 3),
    [query]
  );

  useEffect(() => {
    if (commandOpen) {
      setTimeout(() => inputRef.current?.focus(), 40);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [commandOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && commandOpen) {
        setCommandOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commandOpen, setCommandOpen]);

  useEffect(() => {
    if (!commandOpen) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const effectiveQuery = aliasResolution.resolvedQuery || trimmed;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (scope === "ALL") {
          const [animeRes, mangaRes] = await Promise.all([
            fetch(
              `/api/anilist?action=discover&type=ANIME&search=${encodeURIComponent(effectiveQuery)}&perPage=6`,
              { signal: controller.signal }
            ),
            fetch(
              `/api/anilist?action=discover&type=MANGA&search=${encodeURIComponent(effectiveQuery)}&perPage=4`,
              { signal: controller.signal }
            ),
          ]);
          const [animeData, mangaData] = await Promise.all([
            animeRes.ok ? animeRes.json() : { items: [] },
            mangaRes.ok ? mangaRes.json() : { items: [] },
          ]);
          const combined: MediaItem[] = [
            ...(animeData.items ?? []),
            ...(mangaData.items ?? []),
          ];
          const ranked = rankMediaByFuzzySearch(combined, trimmed, effectiveQuery);
          setResults(ranked.slice(0, 8));
        } else {
          const res = await fetch(
            `/api/anilist?action=discover&type=${scope}&search=${encodeURIComponent(effectiveQuery)}&perPage=8`,
            { signal: controller.signal }
          );
          if (res.ok) {
            const data = await res.json();
            const ranked = rankMediaByFuzzySearch(
              data.items ?? [],
              trimmed,
              effectiveQuery
            );
            setResults(ranked.slice(0, 8));
          }
        }
      } catch {
        // aborted or offline
      } finally {
        setLoading(false);
      }
    }, 210);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, aliasResolution.resolvedQuery, scope, commandOpen]);

  // Instant fuzzy multilingual library matches (zero network wait)
  const localMatches = useMemo(() => {
    if (query.trim().length < 2) return [];
    const scoped =
      scope === "ALL" ? library : library.filter((e) => e.type === scope);
    return searchLibraryEntriesFuzzy(scoped, query, 3);
  }, [library, query, scope]);

  const go = (href: string) => {
    setCommandOpen(false);
    router.push(href);
  };

  return (
    <AnimatePresence>
      {commandOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[calc(3.5rem+env(safe-area-inset-top))] sm:pt-[10vh] pb-[max(1rem,env(safe-area-inset-bottom))] px-2.5 sm:px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCommandOpen(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-2xl rounded-2xl bg-[#10121B] border border-white/[0.11] shadow-[0_32px_90px_rgba(0,0,0,0.85)] overflow-hidden"
          >
            {/* Input Bar */}
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 sm:py-3.5 border-b border-white/[0.08]">
              <Search className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-accent shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr("Titre FR, EN, JP, abréviation (snk, jjk)...")}
                className="min-w-0 flex-1 bg-transparent text-base sm:text-[15px] text-white placeholder:text-[#6E7387] focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={tr("Effacer")}
                  className="p-1 rounded-md text-[#7D8296] hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {/* Scope toggle: Tous / Anime / Manga */}
              <div className="hidden xs:flex sm:flex items-center rounded-lg bg-white/[0.05] p-0.5 border border-white/[0.07] shrink-0">
                {(
                  [
                    { id: "ALL", label: t("common.all") },
                    { id: "ANIME", label: t("common.anime") },
                    { id: "MANGA", label: t("common.manga") },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setScope(tab.id)}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      scope === tab.id
                        ? "bg-accent text-accent-fg"
                        : "text-[#9A9EAE] hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setCommandOpen(false)}
                aria-label={t("common.close")}
                className="p-1.5 rounded-lg text-[#8D92A4] hover:text-white hover:bg-white/[0.07] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile compact scope bar */}
            <div className="flex sm:hidden items-center gap-1 px-3 py-2 border-b border-white/[0.06] bg-white/[0.015]">
              {(
                [
                  { id: "ALL", label: t("common.all") },
                  { id: "ANIME", label: t("common.anime") },
                  { id: "MANGA", label: t("common.manga") },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setScope(tab.id)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                    scope === tab.id
                      ? "bg-accent text-accent-fg"
                      : "bg-white/[0.04] text-[#9A9EAE]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Smart Alias Enrichment Banner */}
            {aliasResolution.didExpand && aliasResolution.canonicalLabel && (
              <div className="px-3.5 py-2 border-b border-white/[0.06] bg-kinpaku/[0.07] flex items-center gap-2 text-xs text-[#F5D68E]">
                <Wand2 className="w-3.5 h-3.5 text-kinpaku shrink-0" />
                <span className="truncate">
                  {tr("Alias détecté :")}{" "}
                  <strong className="text-white">{aliasResolution.canonicalLabel}</strong>
                </span>
              </div>
            )}

            {/* Instant Alias Suggestions while typing (before full match) */}
            {!aliasResolution.didExpand &&
              query.trim().length >= 2 &&
              instantAliases.length > 0 && (
                <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <span className="text-[10.5px] font-mono uppercase text-[#7A7F94] shrink-0">
                    {tr("Suggestions :")}
                  </span>
                  {instantAliases.map((a) => (
                    <button
                      key={a.canonical}
                      type="button"
                      onClick={() => setQuery(a.canonical)}
                      className="px-2.5 py-1 rounded-full bg-white/[0.05] hover:bg-accent/20 border border-white/[0.09] hover:border-accent/40 text-[11px] text-[#DCE0EC] hover:text-white whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                    >
                      {a.displayLabel}
                    </button>
                  ))}
                </div>
              )}

            {/* Body */}
            <div className="max-h-[62vh] overflow-y-auto p-2.5 sm:p-3 space-y-4">
              {/* Instant fuzzy matches from user's Library (never waits on API) */}
              {localMatches.length > 0 && (
                <div>
                  <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7D8296]">
                    {tr("Dans votre bibliothèque")}
                  </p>
                  <div className="space-y-1">
                    {localMatches.map((entry) => (
                      <div
                        key={entry.mediaId}
                        className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-white/[0.06] transition-colors group"
                      >
                        <button
                          type="button"
                          onClick={() => go(`/media/${entry.mediaId}`)}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <img
                            src={entry.coverImage}
                            alt={entry.title}
                            className="w-9 h-12 rounded-lg object-cover shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white truncate group-hover:text-accent-hover transition-colors">
                              {entry.title}
                            </p>
                            <p className="text-xs text-[#8D92A4] font-mono truncate">
                              {entry.type === "MANGA"
                                ? `${t("common.manga")} · ${t("common.chShort")}`
                                : `${t("common.anime")} · ${t("common.epShort")}`}{" "}
                              {entry.progress}
                              {entry.totalUnits ? `/${entry.totalUnits}` : ""} ·{" "}
                              {tStatus(entry.status, entry.type)}
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCommandOpen(false);
                            openQuickEdit(entry);
                          }}
                          className="h-8 px-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] text-xs font-medium text-white shrink-0 cursor-pointer"
                        >
                          {tr("Modifier")}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {loading && (
                <div className="py-6 flex items-center justify-center gap-2.5 text-sm text-[#9A9EAE]">
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  <span>{tr("Recherche multilingue en cours...")}</span>
                </div>
              )}

              {/* Live catalog results with inline 1-click "+ Ajouter" */}
              {!loading && results.length > 0 && (
                <div>
                  <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7D8296] flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-accent" />
                    <span>
                      {tr("Catalogue")}{" "}
                      {scope === "ALL"
                        ? `(${t("common.anime")} & ${t("common.manga")})`
                        : scope === "ANIME"
                          ? `(${t("common.anime")})`
                          : `(${t("common.manga")})`}
                    </span>
                  </p>
                  <div className="space-y-1">
                    {results.map((item) => {
                      const existing = getEntry(item.id);
                      const displayTitle = getDisplayTitle(item);
                      const altTitle =
                        item.title.romaji && item.title.romaji !== displayTitle
                          ? item.title.romaji
                          : item.title.native || null;

                      return (
                        <div
                          key={item.id}
                          className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-white/[0.06] transition-colors group"
                        >
                          <button
                            type="button"
                            onClick={() => go(`/media/${item.id}`)}
                            className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <img
                              src={item.coverImage.large}
                              alt={displayTitle}
                              className="w-10 h-14 rounded-lg object-cover shrink-0 border border-white/[0.08]"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-[#F4F3EE] truncate group-hover:text-white">
                                {displayTitle}
                              </p>
                              {altTitle && (
                                <p className="text-[11px] text-[#7A7F94] truncate">
                                  {altTitle}
                                </p>
                              )}
                              <p className="text-xs text-[#8E93A6] mt-0.5 truncate">
                                <span
                                  className={
                                    item.type === "MANGA"
                                      ? "text-violet-300 font-medium"
                                      : "text-sky-300 font-medium"
                                  }
                                >
                                  {item.type === "MANGA" ? t("common.manga") : t("common.anime")}
                                </span>
                                {item.format ? ` · ${tFormat(item.format)}` : ""}
                                {item.seasonYear ? ` · ${item.seasonYear}` : ""}
                                {item.averageScore ? ` · ★ ${formatScore(item.averageScore)}` : ""}
                              </p>
                            </div>
                          </button>

                          {existing ? (
                            <button
                              type="button"
                              onClick={() => {
                                setCommandOpen(false);
                                openQuickEdit(existing);
                              }}
                              className="h-8 px-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer hover:bg-emerald-500/25"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">{tr("Dans ma liste")}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => quickAdd(item, "WATCHING")}
                              title={t("common.add")}
                              className="h-8 px-2.5 sm:px-3 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{t("common.add")}</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      go(
                        `/discover?search=${encodeURIComponent(query.trim())}${
                          scope !== "ALL" ? `&type=${scope}` : ""
                        }`
                      )
                    }
                    className="mt-2 w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-[#D6D9E5] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>{tr("Voir tous les résultats pour « {q} »", { q: query.trim() })}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Empty state when searching */}
              {!loading &&
                query.trim().length >= 2 &&
                results.length === 0 &&
                localMatches.length === 0 && (
                  <div className="py-10 text-center text-sm text-[#8D92A4]">
                    {tr("Aucun résultat trouvé")} « {query} »
                  </div>
                )}

              {/* Quick routes when query is empty */}
              {!loading && query.trim().length < 2 && (
                <div>
                  <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7D8296]">
                    {tr("Accès rapide")}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {QUICK_ROUTES.map((r) => {
                      const Icon = r.icon;
                      return (
                        <button
                          key={r.href}
                          type="button"
                          onClick={() => go(r.href)}
                          className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.06] text-left transition-colors cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-[#9A9EAE] group-hover:text-accent shrink-0 transition-colors">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">
                              {tr(r.label)}
                            </p>
                            <p className="text-[11px] text-[#7D8296] truncate">{tr(r.sub)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Subtle Footer Hint */}
            <div className="px-4 py-2 border-t border-white/[0.06] bg-white/[0.02] flex items-center justify-between text-[11px] text-[#74798E]">
              <span className="truncate">
                {tr("Tolérant aux fautes · Titres FR, EN, JP & alias (snk, jjk, mha...)")}
              </span>
              <span className="hidden sm:inline font-mono shrink-0 ml-2">{tr("Échap")}</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
