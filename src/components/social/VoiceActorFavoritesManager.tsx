"use client";

import React, { useEffect, useState } from "react";
import { Search, Heart, Mic2, Loader2, ExternalLink, X } from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { FavoriteVoiceActor } from "@/types/media";

interface VoiceActorFavoritesManagerProps {
  compact?: boolean;
}

export function VoiceActorFavoritesManager({
  compact = false,
}: VoiceActorFavoritesManagerProps) {
  const { favoriteStaff, toggleFavoriteStaff } = useShiori();
  const { tr } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FavoriteVoiceActor[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(!compact);

  useEffect(() => {
    if (!searchOpen) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      fetch(`/api/anilist/staff${qs}`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((data) => {
          if (!cancelled && Array.isArray(data?.items)) {
            setResults(data.items);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, query.trim() ? 280 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, searchOpen]);

  return (
    <section
      id="voice-actors"
      className="rounded-2xl card-surface border-accent/20 p-6 space-y-5 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-mono uppercase tracking-[0.16em] text-accent-soft">
            <Mic2 className="w-3.5 h-3.5 text-accent" />
            {tr("Seiyuu & Doublage · API AniList")}
          </span>
          <h2 className="text-base sm:text-lg font-semibold text-white mt-0.5">
            {tr("Voice Actors favoris ({n})", { n: favoriteStaff.length })}
          </h2>
          <p className="text-xs text-[#8A8FA4] mt-0.5">
            {tr("Recherchez vos doubleurs (Seiyuu) préférés et ajoutez-les en favoris pour les afficher sur votre profil public.")}
          </p>
        </div>

        {compact && (
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="px-3.5 py-1.5 rounded-full bg-accent/18 hover:bg-accent/30 border border-accent/40 text-xs font-semibold text-accent-soft transition-colors cursor-pointer self-start sm:self-auto"
          >
            {searchOpen ? tr("Fermer la recherche") : tr("+ Ajouter un Seiyuu")}
          </button>
        )}
      </div>

      {/* Currently Saved Favorite Voice Actors */}
      {favoriteStaff.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[10.5px] font-mono uppercase tracking-wider text-[#8E93A6]">
            {tr("Vos favoris affichés sur votre profil public")}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {favoriteStaff.map((staff) => (
              <div
                key={staff.id}
                className="group relative rounded-xl p-2.5 bg-obsidian/75 border border-accent/35 flex items-center gap-2.5"
              >
                <img
                  src={staff.image}
                  alt={staff.name}
                  loading="lazy"
                  decoding="async"
                  className="w-11 h-14 rounded-lg object-cover border border-white/12 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">{staff.name}</p>
                  {staff.nativeName && (
                    <p className="text-[10px] text-[#858A9E] truncate">{staff.nativeName}</p>
                  )}
                  {staff.notableRoles?.[0]?.name && (
                    <p className="text-[10px] text-accent-soft truncate mt-0.5">
                      {staff.notableRoles[0].name}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleFavoriteStaff(staff)}
                  title={tr("Retirer des favoris")}
                  className="w-6 h-6 rounded-full bg-white/[0.06] hover:bg-rose-500/25 text-[#9A9EAE] hover:text-rose-300 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AniList Voice Actor Search */}
      {searchOpen && (
        <div className="space-y-3.5 pt-2 border-t border-white/[0.07]">
          <div className="relative">
            <Search className="w-4 h-4 text-[#7D8296] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr("Rechercher un Voice Actor / Seiyuu (ex: Kenjiro Tsuda, Atsumi Tanezaki, Kana Hanazawa...)")}
              className="w-full h-10 pl-10 pr-10 rounded-xl bg-obsidian/80 border border-white/[0.1] text-base sm:text-sm text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
            />
            {loading && (
              <Loader2 className="w-4 h-4 text-accent animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
            {results.map((staff) => {
              const isFav = favoriteStaff.some((s) => s.id === staff.id);
              return (
                <div
                  key={staff.id}
                  className={cn(
                    "p-2.5 rounded-xl border transition-all flex items-center gap-3",
                    isFav
                      ? "bg-accent/12 border-accent/45"
                      : "bg-obsidian/60 border-white/[0.07] hover:border-white/[0.16]"
                  )}
                >
                  <img
                    src={staff.image}
                    alt={staff.name}
                    loading="lazy"
                    decoding="async"
                    className="w-11 h-14 rounded-lg object-cover border border-white/10 shrink-0 bg-[#121522]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-semibold text-white truncate">{staff.name}</p>
                      {staff.siteUrl && (
                        <a
                          href={staff.siteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#7D8296] hover:text-white shrink-0"
                          title={tr("Voir sur AniList")}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    {staff.nativeName && (
                      <p className="text-[10px] text-[#858A9E] truncate">{staff.nativeName}</p>
                    )}
                    {staff.notableRoles?.[0]?.name && (
                      <p className="text-[10px] text-[#A6AAB8] truncate mt-0.5">
                        {staff.notableRoles[0].name}
                        {staff.notableRoles[0].mediaTitle
                          ? ` · ${staff.notableRoles[0].mediaTitle}`
                          : ""}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFavoriteStaff(staff)}
                    aria-label={
                      isFav
                        ? tr("Retirer {name} des favoris", { name: staff.name })
                        : tr("Ajouter {name} aux favoris", { name: staff.name })
                    }
                    className={cn(
                      "w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer shrink-0",
                      isFav
                        ? "bg-accent border-accent text-accent-fg shadow-accent"
                        : "bg-white/[0.05] hover:bg-accent/25 border-white/[0.1] hover:border-accent/50 text-[#B8BCCB] hover:text-white"
                    )}
                  >
                    <Heart className={cn("w-3.5 h-3.5", isFav && "fill-current")} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
