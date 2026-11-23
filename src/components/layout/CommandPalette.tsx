"use client";

import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { formatFormat, formatScore, getDisplayTitle, getStatusLabel } from "@/lib/utils";
import type { MediaItem, MediaType } from "@/types/media";

type SearchScope = "ALL" | MediaType;

const QUICK_ROUTES = [
  { href: "/library", label: "Ma Bibliothèque", sub: "En cours, Terminés et À voir", icon: Library },
  { href: "/library?favorites=1", label: "Mes Favoris", sub: "Vos coups de cœur classés", icon: Heart },
  { href: "/discover", label: "Découvrir", sub: "Explorer le catalogue animés & mangas", icon: Compass },
  { href: "/calendar", label: "Sorties & Calendrier", sub: "Épisodes de la semaine", icon: CalendarDays },
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
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("ALL");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (scope === "ALL") {
          const [animeRes, mangaRes] = await Promise.all([
            fetch(
              `/api/anilist?action=discover&type=ANIME&search=${encodeURIComponent(trimmed)}&perPage=4`,
              { signal: controller.signal }
            ),
            fetch(
              `/api/anilist?action=discover&type=MANGA&search=${encodeURIComponent(trimmed)}&perPage=4`,
              { signal: controller.signal }
            ),
          ]);
          const [animeData, mangaData] = await Promise.all([
            animeRes.ok ? animeRes.json() : { items: [] },
            mangaRes.ok ? mangaRes.json() : { items: [] },
          ]);
          // Interleave anime & manga results cleanly so both are immediately visible
          const aItems: MediaItem[] = animeData.items ?? [];
          const mItems: MediaItem[] = mangaData.items ?? [];
          const merged: MediaItem[] = [];
          const maxLen = Math.max(aItems.length, mItems.length);
          for (let i = 0; i < maxLen; i++) {
            if (aItems[i]) merged.push(aItems[i]);
            if (mItems[i]) merged.push(mItems[i]);
          }
          setResults(merged.slice(0, 8));
        } else {
          const res = await fetch(
            `/api/anilist?action=discover&type=${scope}&search=${encodeURIComponent(trimmed)}&perPage=6`,
            { signal: controller.signal }
          );
          if (res.ok) {
            const data = await res.json();
            setResults(data.items ?? []);
          }
        }
      } catch {
        // aborted or offline
      } finally {
        setLoading(false);
      }
    }, 240);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, scope, commandOpen]);

  const localMatches = query.trim()
    ? library
        .filter((e) => {
          if (scope !== "ALL" && e.type !== scope) return false;
          return e.title.toLowerCase().includes(query.trim().toLowerCase());
        })
        .slice(0, 3)
    : [];

  const go = (href: string) => {
    setCommandOpen(false);
    router.push(href);
  };

  return (
    <AnimatePresence>
      {commandOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[calc(4.25rem+env(safe-area-inset-top))] sm:pt-[10vh] pb-[max(1rem,env(safe-area-inset-bottom))] px-3 sm:px-4">
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
                placeholder="Rechercher ou ajouter un anime / manga..."
                className="min-w-0 flex-1 bg-transparent text-sm sm:text-[15px] text-white placeholder:text-[#6E7387] focus:outline-none"
              />
              {/* Scope toggle: Tous / Anime / Manga */}
              <div className="flex items-center rounded-lg bg-white/[0.05] p-0.5 border border-white/[0.07] shrink-0">
                {(
                  [
                    { id: "ALL", label: "Tous" },
                    { id: "ANIME", label: "Anime" },
                    { id: "MANGA", label: "Manga" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setScope(t.id)}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      scope === t.id
                        ? "bg-accent text-accent-fg"
                        : "text-[#9A9EAE] hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setCommandOpen(false)}
                aria-label="Fermer la recherche"
                className="p-1.5 rounded-lg text-[#8D92A4] hover:text-white hover:bg-white/[0.07] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[65vh] overflow-y-auto p-3 space-y-4">
              {loading && (
                <div className="py-8 flex items-center justify-center gap-2.5 text-sm text-[#9A9EAE]">
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  <span>Recherche en cours...</span>
                </div>
              )}

              {/* Library instant matches */}
              {!loading && localMatches.length > 0 && (
                <div>
                  <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7D8296]">
                    Dans votre bibliothèque
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
                            <p className="text-xs text-[#8D92A4] font-mono">
                              {entry.type === "MANGA" ? "Manga · Ch." : "Anime · Ép."} {entry.progress}
                              {entry.totalUnits ? `/${entry.totalUnits}` : ""} ·{" "}
                              {getStatusLabel(entry.status, entry.type)}
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
                          Modifier
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live catalog results with inline 1-click "+ Ajouter" */}
              {!loading && results.length > 0 && (
                <div>
                  <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7D8296] flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-accent" />
                    <span>
                      Catalogue{" "}
                      {scope === "ALL"
                        ? "(Animes & Mangas)"
                        : scope === "ANIME"
                          ? "(Animes)"
                          : "(Mangas)"}
                    </span>
                  </p>
                  <div className="space-y-1">
                    {results.map((item) => {
                      const existing = getEntry(item.id);
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
                              alt={getDisplayTitle(item)}
                              className="w-10 h-14 rounded-lg object-cover shrink-0 border border-white/[0.08]"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-[#F4F3EE] truncate group-hover:text-white">
                                {getDisplayTitle(item)}
                              </p>
                              <p className="text-xs text-[#8E93A6] mt-0.5 truncate">
                                <span
                                  className={
                                    item.type === "MANGA"
                                      ? "text-violet-300 font-medium"
                                      : "text-sky-300 font-medium"
                                  }
                                >
                                  {item.type === "MANGA" ? "Manga" : "Anime"}
                                </span>
                                {item.format ? ` · ${formatFormat(item.format)}` : ""}
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
                              <span className="hidden sm:inline">Dans ma liste</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => quickAdd(item, "WATCHING")}
                              title="Ajouter directement en cours"
                              className="h-8 px-3 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Ajouter</span>
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
                    <span>Voir tous les résultats pour &laquo; {query.trim()} &raquo;</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Empty state when searching */}
              {!loading && query.trim().length >= 2 && results.length === 0 && localMatches.length === 0 && (
                <div className="py-10 text-center text-sm text-[#8D92A4]">
                  Aucun résultat trouvé pour &laquo; {query} &raquo;.
                </div>
              )}

              {/* Quick routes when query is empty */}
              {!loading && query.trim().length < 2 && (
                <div>
                  <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7D8296]">
                    Accès rapide
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
                              {r.label}
                            </p>
                            <p className="text-[11px] text-[#7D8296] truncate">{r.sub}</p>
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
              <span>Tapez un titre pour ajouter directement un anime ou un manga</span>
              <span className="hidden sm:inline font-mono">Échap pour fermer</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
