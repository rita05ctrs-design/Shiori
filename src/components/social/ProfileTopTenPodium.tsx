"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Crown, Share2, Star, Trophy } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { MediaType, PublicProfileMediaSummary } from "@/types/media";

interface ProfileTopTenPodiumProps {
  displayName: string;
  username: string;
  favorites: PublicProfileMediaSummary[];
}

const PODIUM_BADGES = [
  {
    rank: 1,
    ring: "border-[#F0B95B]/70 shadow-[0_14px_38px_-10px_rgba(240,185,91,0.45)]",
    pill: "bg-gradient-to-r from-[#F0B95B] to-[#FDE68A] text-[#0A0B0F]",
    label: "#1",
  },
  {
    rank: 2,
    ring: "border-slate-300/45 shadow-[0_12px_30px_-10px_rgba(226,232,240,0.22)]",
    pill: "bg-slate-200 text-[#0A0B0F]",
    label: "#2",
  },
  {
    rank: 3,
    ring: "border-amber-600/55 shadow-[0_12px_30px_-10px_rgba(217,119,6,0.28)]",
    pill: "bg-amber-600 text-white",
    label: "#3",
  },
];

export function ProfileTopTenPodium({
  displayName,
  username,
  favorites,
}: ProfileTopTenPodiumProps) {
  const { t, tr } = useTranslation();
  const [scope, setScope] = useState<"ALL" | MediaType>("ALL");
  const [copied, setCopied] = useState(false);

  const topTen = useMemo(() => {
    return favorites
      .filter((f) => (scope === "ALL" ? true : f.type === scope))
      .slice(0, 10);
  }, [favorites, scope]);

  if (favorites.length === 0) return null;

  const podium = topTen.slice(0, 3);
  const runnersUp = topTen.slice(3, 10);

  const handleShareTopTen = async () => {
    const scopeLabel =
      scope === "ANIME"
        ? t("common.anime")
        : scope === "MANGA"
          ? t("common.manga")
          : `${t("common.anime")} & ${t("common.manga")}`;
    const lines = [
      `🏆 Top ${topTen.length} ${scopeLabel} — ${displayName} (@${username}) · Shiori`,
      "",
      ...topTen.map(
        (m, idx) =>
          `${idx + 1}. ${m.title}${m.score ? ` (★ ${m.score.toFixed(1)}/10)` : ""}`
      ),
      "",
      typeof window !== "undefined" ? window.location.href : "",
    ];
    const text = lines.join("\n").trim();

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: `Top ${topTen.length} — ${displayName} · Shiori`,
          text,
        });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    } catch {
      // User dismissed native share sheet
    }
  };

  return (
    <section className="rounded-3xl card-surface border border-white/[0.09] p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#F0B95B] flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" />
            <span>{tr("Vitrine Top 10")}</span>
          </p>
          <h2 className="text-lg sm:text-xl font-bold text-white mt-0.5">
            {tr("Podium de {name}", { name: displayName })}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px]">
            {(
              [
                { id: "ALL", label: t("common.all") },
                { id: "ANIME", label: t("common.anime") },
                { id: "MANGA", label: t("common.manga") },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setScope(opt.id)}
                className={cn(
                  "px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer",
                  scope === opt.id
                    ? "bg-accent text-accent-fg font-semibold"
                    : "text-[#9A9EAE] hover:text-white"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={topTen.length === 0}
            onClick={() => void handleShareTopTen()}
            className="h-8 px-3 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{tr("Copié !")}</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-[#F0B95B]" />
                <span>{tr("Partager")}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {topTen.length === 0 ? (
        <p className="text-xs text-[#858A9E]">
          {tr("Aucun favori dans cette catégorie pour le moment.")}
        </p>
      ) : (
        <div className="space-y-4">
          {/* Podium #1 - #3 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {podium.map((item, idx) => {
              const style = PODIUM_BADGES[idx] ?? PODIUM_BADGES[2];
              return (
                <Link
                  key={`podium-${item.mediaId}`}
                  href={`/media/${item.mediaId}`}
                  className={cn(
                    "group relative rounded-2xl bg-obsidian/75 border overflow-hidden flex sm:flex-col transition-transform hover:-translate-y-1",
                    style.ring
                  )}
                >
                  <div className="relative w-24 sm:w-full aspect-[2/3] sm:aspect-[16/10] shrink-0 overflow-hidden bg-[#121522]">
                    <img
                      src={item.coverImage}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/20 to-transparent" />
                    <span
                      className={cn(
                        "absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full font-mono text-[11px] font-extrabold inline-flex items-center gap-1 shadow-md",
                        style.pill
                      )}
                    >
                      {idx === 0 && <Crown className="w-3 h-3" />}
                      {style.label}
                    </span>
                    {item.score !== null && (
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/15 font-mono text-[11px] font-bold text-[#F0B95B] inline-flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        {item.score.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="p-3.5 flex flex-col justify-center min-w-0">
                    <p className="text-sm font-bold text-white group-hover:text-accent-hover line-clamp-2 leading-snug">
                      {item.title}
                    </p>
                    <p className="text-[10.5px] font-mono uppercase tracking-wider text-[#858A9E] mt-1">
                      {item.type === "MANGA" ? t("common.manga") : t("common.anime")}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Ranks #4 -> #10 */}
          {runnersUp.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {runnersUp.map((item, idx) => (
                <Link
                  key={`top-${item.mediaId}`}
                  href={`/media/${item.mediaId}`}
                  className="group relative rounded-xl overflow-hidden bg-obsidian/70 border border-white/[0.08] hover:border-accent/45 transition-all"
                >
                  <div className="relative aspect-[2/3] overflow-hidden bg-[#121522]">
                    <img
                      src={item.coverImage}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-transparent to-transparent" />
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/75 border border-white/15 font-mono text-[10px] font-bold text-white">
                      #{idx + 4}
                    </span>
                    {item.score !== null && (
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/75 font-mono text-[10px] font-semibold text-[#F0B95B]">
                        ★ {item.score.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <p className="p-2 text-[11px] font-medium text-[#E4E6F0] group-hover:text-white line-clamp-1">
                    {item.title}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
