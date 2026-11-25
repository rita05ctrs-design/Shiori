"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListChecks,
  Plus,
  Check,
  ArrowRight,
  Loader2,
  Flame,
  Tv,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { cn } from "@/lib/utils";
import type { WatchingAiringItem } from "@/app/api/anilist/watching-airing/route";

interface CachedAiring {
  key: string;
  at: number;
  items: WatchingAiringItem[];
}

let airingMemCache: CachedAiring | null = null;
const CACHE_TTL_MS = 3 * 60 * 1000;

function formatShortBroadcastDay(unixSec: number | null): string {
  if (!unixSec) return "En cours";
  const dt = new Date(unixSec * 1000);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startTarget = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diffDays = Math.round((startTarget - startToday) / 86400000);
  const timeStr = dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return `Aujourd'hui · ${timeStr}`;
  if (diffDays === -1) return `Hier · ${timeStr}`;
  const day = dt.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
  return `${day.charAt(0).toUpperCase() + day.slice(1)} · ${timeStr}`;
}

/**
 * PC (`>= 768px`) Quick Access Shortcut for "Épisodes de la semaine / À voir".
 * Lets desktop users mark "+1 Vu" directly from any page without opening a modal,
 * while preserving the complete existing PC interface.
 */
export function QuickEpisodesPopover() {
  const { library, hydrated, incrementProgress } = useShiori();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [airingItems, setAiringItems] = useState<WatchingAiringItem[]>([]);
  const [flashId, setFlashId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const watchingAnime = useMemo(
    () =>
      library
        .filter((e) => e.type === "ANIME" && e.status === "WATCHING")
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [library]
  );

  const watchingIds = useMemo(
    () => watchingAnime.slice(0, 40).map((e) => e.mediaId),
    [watchingAnime]
  );
  const idsKey = watchingIds.join(",");

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Fetch live airing status for Watching anime (cached 3 min)
  useEffect(() => {
    if (!hydrated || watchingIds.length === 0) {
      setAiringItems([]);
      return;
    }
    if (
      airingMemCache &&
      airingMemCache.key === idsKey &&
      Date.now() - airingMemCache.at < CACHE_TTL_MS
    ) {
      setAiringItems(airingMemCache.items);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch("/api/anilist/watching-airing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: watchingIds }),
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.items)) {
          airingMemCache = { key: idsKey, at: Date.now(), items: data.items };
          setAiringItems(data.items);
        }
      })
      .catch(() => {
        // non-fatal
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, idsKey]);

  const airingById = useMemo(() => {
    const map = new Map<number, WatchingAiringItem>();
    for (const item of airingItems) {
      map.set(item.mediaId, item);
    }
    return map;
  }, [airingItems]);

  // Build prioritized quick-watch rows: unwatched aired episodes first, then remaining Watching anime
  const quickRows = useMemo(() => {
    return watchingAnime
      .map((entry) => {
        const live = airingById.get(entry.mediaId);
        const latestAiredEpisode = live?.latestAiredEpisode ?? 0;
        const behindCount =
          latestAiredEpisode > 0 ? Math.max(0, latestAiredEpisode - entry.progress) : 0;
        const hasNewAired = behindCount > 0;

        return {
          entry,
          latestAiredEpisode,
          latestAiredAt: live?.latestAiredAt ?? null,
          behindCount,
          hasNewAired,
        };
      })
      .sort((a, b) => {
        if (a.hasNewAired !== b.hasNewAired) return a.hasNewAired ? -1 : 1;
        if (a.hasNewAired && b.hasNewAired) {
          return (b.latestAiredAt ?? 0) - (a.latestAiredAt ?? 0);
        }
        return (
          new Date(b.entry.updatedAt).getTime() - new Date(a.entry.updatedAt).getTime()
        );
      });
  }, [watchingAnime, airingById]);

  const unwatchedAiredCount = useMemo(
    () => quickRows.filter((r) => r.hasNewAired).length,
    [quickRows]
  );

  const handleQuickPlusOne = (mediaId: number) => {
    incrementProgress(mediaId, 1);
    setFlashId(mediaId);
    setTimeout(() => setFlashId((prev) => (prev === mediaId ? null : prev)), 650);
  };

  return (
    <div className="hidden md:block relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Accès rapide aux épisodes de la semaine et animés à voir"
        aria-expanded={open}
        title="Épisodes de la semaine / À voir (+1 Vu rapide)"
        className={cn(
          "relative flex items-center justify-center gap-1.5 h-9 px-2 xl:px-2.5 rounded-full border text-xs font-medium transition-all cursor-pointer shrink-0",
          open
            ? "bg-accent/20 border-accent/55 text-white"
            : "bg-white/[0.045] hover:bg-white/[0.1] border-white/[0.09] hover:border-white/[0.18] text-[#CFD3E2] hover:text-white"
        )}
      >
        <ListChecks className="w-3.5 h-3.5 text-accent-soft shrink-0" />
        <span className="hidden 2xl:inline whitespace-nowrap">À voir</span>
        {(unwatchedAiredCount > 0 || watchingAnime.length > 0) && (
          <span
            className={cn(
              "min-w-[17px] h-[17px] px-1 rounded-full font-mono text-[10px] font-bold flex items-center justify-center",
              unwatchedAiredCount > 0
                ? "bg-accent text-accent-fg shadow-[0_0_10px_rgba(229,72,77,0.6)]"
                : "bg-white/[0.1] text-[#D8DBE8]"
            )}
          >
            {unwatchedAiredCount > 0 ? unwatchedAiredCount : watchingAnime.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-full mt-2.5 w-[395px] max-w-[calc(100vw-1.5rem)] rounded-2xl bg-surface-solid border border-white/[0.13] shadow-[0_28px_72px_rgba(0,0,0,0.92)] overflow-hidden z-50"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/[0.08] bg-surface-solid-header flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-accent" />
                  <span>Épisodes de la semaine · À voir</span>
                </p>
                <p className="text-[11px] text-[#8A8FA4] mt-0.5">
                  {unwatchedAiredCount > 0
                    ? `${unwatchedAiredCount} nouvel épisode sorti à cocher en 1 clic`
                    : `${watchingAnime.length} anime${watchingAnime.length > 1 ? "s" : ""} en cours`}
                </p>
              </div>
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-accent shrink-0" />}
            </div>

            {/* Direct +1 Vu List */}
            <div className="max-h-[380px] overflow-y-auto overscroll-contain p-2 space-y-1.5">
              {quickRows.length === 0 ? (
                <div className="py-8 px-4 text-center space-y-2">
                  <Tv className="w-7 h-7 text-[#6E7387] mx-auto" />
                  <p className="text-xs font-medium text-[#CFD3E2]">
                    Aucun anime en cours pour le moment.
                  </p>
                  <Link
                    href="/episodes"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-accent-soft hover:text-white"
                  >
                    <span>Explorer les sorties de la semaine</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ) : (
                quickRows.slice(0, 8).map((row) => {
                  const e = row.entry;
                  const canInc = !e.totalUnits || e.progress < e.totalUnits;
                  const isFlashing = flashId === e.mediaId;

                  return (
                    <div
                      key={e.mediaId}
                      className={cn(
                        "p-2 rounded-xl border flex items-center gap-2.5 transition-all",
                        row.hasNewAired
                          ? "bg-accent/[0.07] border-accent/35"
                          : "bg-obsidian/65 border-white/[0.07] hover:border-white/[0.15]",
                        isFlashing && "ring-2 ring-emerald-400/70"
                      )}
                    >
                      <Link
                        href={`/media/${e.mediaId}`}
                        onClick={() => setOpen(false)}
                        className="shrink-0"
                      >
                        <img
                          src={e.coverImage}
                          alt={e.title}
                          loading="lazy"
                          decoding="async"
                          className="w-10 h-14 rounded-lg object-cover border border-white/12"
                        />
                      </Link>

                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/media/${e.mediaId}`}
                          onClick={() => setOpen(false)}
                          className="text-xs font-semibold text-[#F4F3EE] hover:text-accent-hover transition-colors line-clamp-1"
                        >
                          {e.title}
                        </Link>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {row.hasNewAired ? (
                            <span className="px-1.5 py-0.2 rounded bg-accent/20 border border-accent/40 font-mono text-[10px] font-bold text-accent-soft">
                              Ép. {row.latestAiredEpisode} sorti
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] text-[#8E93A6]">
                              {formatShortBroadcastDay(row.latestAiredAt)}
                            </span>
                          )}
                          <span className="font-mono text-[10.5px] text-white/80">
                            Ép. {e.progress}
                            {e.totalUnits ? `/${e.totalUnits}` : ""}
                          </span>
                        </div>
                      </div>

                      {canInc ? (
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.92 }}
                          onClick={() => handleQuickPlusOne(e.mediaId)}
                          aria-label={`Marquer +1 épisode vu pour ${e.title}`}
                          className="shrink-0 h-8.5 px-3 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg text-[11.5px] font-bold inline-flex items-center gap-1 shadow-[0_6px_16px_rgba(229,72,77,0.35)] transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.8]" />
                          <span>+1 Vu</span>
                        </motion.button>
                      ) : (
                        <span className="shrink-0 h-8 px-2.5 rounded-lg bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-[11px] font-semibold inline-flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Fini</span>
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Link */}
            <div className="p-2.5 border-t border-white/[0.08] bg-surface-solid-header">
              <Link
                href="/episodes"
                onClick={() => setOpen(false)}
                className="w-full py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.11] border border-white/[0.08] text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Ouvrir toute la semaine</span>
                <ArrowRight className="w-3.5 h-3.5 text-accent-soft" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
