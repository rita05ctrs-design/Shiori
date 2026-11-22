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
  Settings,
  Star,
  Loader2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { formatFormat, formatScore, getDisplayTitle } from "@/lib/utils";
import type { MediaItem, MediaType } from "@/types/media";

const QUICK_ROUTES = [
  { href: "/discover", label: "Explorer le catalogue", sub: "Recherche & filtres avancés", icon: Compass },
  { href: "/library", label: "Ma Bibliothèque", sub: "Watching, Completed, Plan to Watch", icon: Library },
  { href: "/calendar", label: "Calendrier hebdomadaire", sub: "Sorties de la semaine en cours", icon: CalendarDays },
  { href: "/stats", label: "Statistiques personnelles", sub: "Scores, genres, temps passé", icon: BarChart3 },
  { href: "/settings", label: "Compte & Supabase", sub: "Synchronisation et notifications", icon: Settings },
];

export function CommandPalette() {
  const router = useRouter();
  const { commandOpen, setCommandOpen, library } = useShiori();
  const [query, setQuery] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("ANIME");
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
        const res = await fetch(
          `/api/anilist?action=discover&type=${mediaType}&search=${encodeURIComponent(trimmed)}&perPage=6`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.items ?? []);
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
  }, [query, mediaType, commandOpen]);

  const localMatches = query.trim()
    ? library
        .filter((e) => e.title.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 3)
    : [];

  const go = (href: string) => {
    setCommandOpen(false);
    router.push(href);
  };

  return (
    <AnimatePresence>
      {commandOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[10vh] px-4">
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
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08]">
              <Search className="w-4.5 h-4.5 text-accent shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un anime, un manga, un studio..."
                className="w-full bg-transparent text-[15px] text-white placeholder:text-[#6E7387] focus:outline-none"
              />
              {/* Type toggle */}
              <div className="flex items-center rounded-lg bg-white/[0.05] p-0.5 border border-white/[0.07] shrink-0">
                {(["ANIME", "MANGA"] as MediaType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMediaType(t)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      mediaType === t
                        ? "bg-accent text-accent-fg"
                        : "text-[#9A9EAE] hover:text-white"
                    }`}
                  >
                    {t === "ANIME" ? "Anime" : "Manga"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setCommandOpen(false)}
                className="p-1.5 rounded-lg text-[#8D92A4] hover:text-white hover:bg-white/[0.07] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[62vh] overflow-y-auto p-3 space-y-4">
              {loading && (
                <div className="py-8 flex items-center justify-center gap-2.5 text-sm text-[#9A9EAE]">
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  <span>Recherche dans le catalogue Shiori...</span>
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
                      <button
                        key={entry.mediaId}
                        type="button"
                        onClick={() => go(`/media/${entry.mediaId}`)}
                        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.06] text-left transition-colors cursor-pointer group"
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
                            {entry.type === "MANGA" ? "Ch." : "Ép."} {entry.progress}
                            {entry.totalUnits ? `/${entry.totalUnits}` : ""} · {entry.status}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#6A6F82] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Live AniList results */}
              {!loading && results.length > 0 && (
                <div>
                  <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7D8296] flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-accent" />
                    <span>Résultats catalogue ({mediaType === "ANIME" ? "Animes" : "Mangas"})</span>
                  </p>
                  <div className="space-y-1">
                    {results.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => go(`/media/${item.id}`)}
                        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.06] text-left transition-colors cursor-pointer group"
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
                            {formatFormat(item.format)}
                            {item.seasonYear ? ` · ${item.seasonYear}` : ""}
                            {item.studio ? ` · ${item.studio}` : ""}
                          </p>
                        </div>
                        {item.averageScore && (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F0B95B]/12 text-[#F0B95B] text-xs font-mono shrink-0">
                            <Star className="w-3 h-3 fill-current" />
                            <span>{formatScore(item.averageScore)}</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      go(`/discover?search=${encodeURIComponent(query.trim())}&type=${mediaType}`)
                    }
                    className="mt-2 w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-[#D6D9E5] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Voir tous les résultats pour &laquo; {query.trim()} &raquo;</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Empty state when searching */}
              {!loading && query.trim().length >= 2 && results.length === 0 && (
                <div className="py-10 text-center text-sm text-[#8D92A4]">
                  Aucun résultat trouvé pour &laquo; {query} &raquo;.
                </div>
              )}

              {/* Default quick routes */}
              {query.trim().length < 2 && (
                <div>
                  <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7D8296]">
                    Navigation rapide
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {QUICK_ROUTES.map((r) => {
                      const Icon = r.icon;
                      return (
                        <button
                          key={r.href}
                          type="button"
                          onClick={() => go(r.href)}
                          className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.07] border border-white/[0.05] text-left transition-all cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-[#A4A8BA] group-hover:text-accent-hover transition-colors">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-[#ECEBE6] truncate">
                              {r.label}
                            </p>
                            <p className="text-[11px] text-[#7A7F94] truncate">{r.sub}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.02] flex items-center justify-between text-[11px] text-[#6E7387]">
              <span>Tapez au moins 2 caractères pour lancer la recherche live</span>
              <span className="font-mono">ESC pour fermer</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
