"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  BookOpen,
  Check,
  CheckCircle2,
  Loader2,
  Plus,
  Sparkles,
  Star,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { mangaContinuationCache } from "@/lib/client-cache";
import {
  detectSourceMediumKind,
  findSourceMangaRelation,
  getCuratedMangaContinuation,
  getSourceKindLabel,
  shouldShowMangaContinuation,
  type MangaContinuationInfo,
} from "@/lib/manga-continuation";
import { cn, formatScore, getDisplayTitle } from "@/lib/utils";
import type { ContentLanguage, MediaDetail, MediaItem } from "@/types/media";

interface MangaContinuationSectionProps {
  media: MediaDetail;
}

function formatChapterValue(num: number, chapterLabel: string, lang: ContentLanguage): string {
  return lang === "ja" ? `第${num}話` : `${chapterLabel} ${num}`;
}

function formatVolumeValue(num: number, volumeLabel: string, lang: ContentLanguage): string {
  return lang === "ja" ? `${num}巻` : `${volumeLabel} ${num}`;
}

export function MangaContinuationSection({ media }: MangaContinuationSectionProps) {
  const { getEntry, upsertEntry, toast } = useShiori();
  const { t, lang } = useTranslation();

  const eligible = useMemo(() => shouldShowMangaContinuation(media), [media]);
  const sourceRelation = useMemo(
    () => findSourceMangaRelation(media.relations, media.source),
    [media.relations, media.source]
  );

  const curated = useMemo(
    () => (eligible ? getCuratedMangaContinuation(media.id, lang) : null),
    [eligible, media.id, lang]
  );

  const cacheKey = `${media.id}:${lang}`;
  const [resolvedInfo, setResolvedInfo] = useState<MangaContinuationInfo | null>(() => {
    if (curated) return curated;
    if (!eligible) return null;
    const hit = mangaContinuationCache.get(cacheKey);
    return hit ? (hit as unknown as MangaContinuationInfo) : null;
  });
  const [loading, setLoading] = useState(false);

  // Sync immediate curated / cache hits when media.id or language changes
  useEffect(() => {
    if (!eligible) {
      setResolvedInfo(null);
      setLoading(false);
      return;
    }

    if (curated) {
      setResolvedInfo(curated);
      setLoading(false);
      return;
    }

    const hit = mangaContinuationCache.get(cacheKey);
    if (hit) {
      setResolvedInfo(hit as unknown as MangaContinuationInfo);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const res = await fetch("/api/manga-continuation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaId: media.id,
            title: getDisplayTitle(media),
            romajiTitle: media.title.romaji,
            sourceType: media.source,
            sourceTitle: sourceRelation?.title ?? null,
            sourceCountry: sourceRelation?.countryOfOrigin ?? null,
            sourceFormat: sourceRelation?.format ?? null,
            episodes: media.episodes,
            status: media.status,
            seasonYear: media.seasonYear ?? media.startYear,
            language: lang,
          }),
        });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (cancelled) return;
        if (json?.data) {
          const info = json.data as MangaContinuationInfo;
          setResolvedInfo(info);
          if (info.confidence !== "low") {
            mangaContinuationCache.set(
              cacheKey,
              info as unknown as Record<string, unknown>
            );
          }
        }
      } catch {
        // Non-fatal: still render source manga link card gracefully
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eligible, curated, cacheKey, media, sourceRelation, lang]);

  if (!eligible) return null;

  const activeInfo = curated ?? resolvedInfo;
  const sourceKind =
    activeInfo?.sourceKind ?? detectSourceMediumKind(media.source, sourceRelation);
  const sourceKindLabel = getSourceKindLabel(sourceKind, lang);

  // If neither a verified/AI breakpoint nor a linked source relation exists and loading finished, hide cleanly
  const hasBreakpoint = Boolean(
    activeInfo &&
      (activeInfo.isFullyAdapted ||
        activeInfo.endedAtChapter !== null ||
        activeInfo.continueAtChapter !== null ||
        activeInfo.endedAtVolume !== null ||
        activeInfo.continueAtVolume !== null)
  );
  if (!loading && !hasBreakpoint && !sourceRelation) {
    return null;
  }

  const trackedSourceEntry = sourceRelation ? getEntry(sourceRelation.id) : undefined;
  const suggestedProgress = activeInfo?.endedAtChapter ?? 0;

  const handleTrackSourceFromBreakpoint = () => {
    if (!sourceRelation) return;
    const sourceMediaItem: MediaItem = {
      id: sourceRelation.id,
      type: "MANGA",
      title: {
        romaji: sourceRelation.title,
        english: sourceRelation.title,
        native: null,
      },
      coverImage: {
        extraLarge: sourceRelation.coverImage,
        large: sourceRelation.coverImage,
        color: null,
      },
      bannerImage: media.bannerImage,
      description: null,
      format: sourceRelation.format ?? "MANGA",
      status: sourceRelation.status ?? "RELEASING",
      episodes: null,
      chapters: sourceRelation.chapters ?? null,
      volumes: sourceRelation.volumes ?? null,
      duration: null,
      season: null,
      seasonYear: null,
      startYear: null,
      averageScore: sourceRelation.averageScore,
      meanScore: sourceRelation.averageScore,
      popularity: null,
      favourites: null,
      genres: media.genres,
      studio: null,
      trailer: null,
      nextAiringEpisode: null,
    };

    const nextProgress = Math.max(trackedSourceEntry?.progress ?? 0, suggestedProgress);
    upsertEntry(sourceMediaItem, {
      status: activeInfo?.isFullyAdapted ? "COMPLETED" : "WATCHING",
      progress: nextProgress,
      progressVolumes: activeInfo?.endedAtVolume ?? trackedSourceEntry?.progressVolumes,
    });

    toast({
      title: sourceRelation.title,
      description:
        activeInfo?.continueAtChapter != null
          ? `${t("detail.continueAt")} ${formatChapterValue(
              activeInfo.continueAtChapter,
              t("detail.chapterLabel"),
              lang
            )}`
          : t("detail.alreadyReadingInList"),
      variant: "success",
      coverImage: sourceRelation.coverImage,
      mediaId: sourceRelation.id,
    });
  };

  const isSourceKindManhwa = sourceKind === "MANHWA" || sourceKind === "MANHUA";

  return (
    <section
      aria-label={t("detail.mangaBridgeEyebrow")}
      className="relative overflow-hidden rounded-2xl card-surface border border-white/[0.11] p-4 sm:p-6 space-y-4"
    >
      {/* Subtle warm kinpaku/violet editorial top hairline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-kinpaku/65 to-transparent"
      />

      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.18em] text-kinpaku">
              <BookMarked className="w-3.5 h-3.5" />
              <span>{t("detail.mangaBridgeEyebrow")}</span>
            </span>

            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider border",
                isSourceKindManhwa
                  ? "bg-sky-500/14 border-sky-400/35 text-sky-300"
                  : sourceKind === "NOVEL" || sourceKind === "WEB_NOVEL"
                    ? "bg-amber-500/14 border-amber-400/35 text-amber-200"
                    : "bg-violet-500/14 border-violet-400/35 text-violet-200"
              )}
            >
              {sourceKindLabel}
            </span>

            {activeInfo?.verified ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/14 border border-emerald-400/35 text-[10px] font-mono font-semibold text-emerald-300">
                <CheckCircle2 className="w-3 h-3" />
                <span>{t("detail.verifiedBadge")}</span>
              </span>
            ) : activeInfo && hasBreakpoint ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.12] text-[10px] font-mono text-[#C8CCE0]">
                <Sparkles className="w-3 h-3 text-kinpaku" />
                <span>{t("detail.aiEstimateBadge")}</span>
              </span>
            ) : null}
          </div>

          <h2 className="text-base sm:text-lg font-semibold text-white mt-1">
            {lang === "ja"
              ? `${sourceKindLabel} · ${t("detail.mangaBridgeTitle")}`
              : `${t("detail.mangaBridgeTitle")} ${sourceKindLabel}`}
          </h2>
        </div>

        {activeInfo?.adaptedArc && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.045] border border-white/[0.08] text-[11px] text-[#C8CCE0]">
            <span className="text-[#858A9E]">{t("detail.coveredArc")} :</span>
            <span className="font-medium text-white">{activeInfo.adaptedArc}</span>
          </span>
        )}
      </div>

      {/* Main Content Body */}
      {loading && !activeInfo ? (
        <div className="flex items-center gap-2.5 py-3 px-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-[#9A9EAE]">
          <Loader2 className="w-4 h-4 animate-spin text-kinpaku shrink-0" />
          <span>{t("common.loading")}</span>
        </div>
      ) : activeInfo?.isFullyAdapted ? (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-emerald-200">
                {t("detail.fullyAdapted")}
              </p>
              <p className="text-xs text-[#C6CAD8] mt-0.5 leading-relaxed">
                {activeInfo.note || t("detail.fullyAdaptedSub")}
              </p>
            </div>
          </div>
          {activeInfo.coveredRange && (
            <span className="shrink-0 self-start sm:self-center px-3 py-1 rounded-lg bg-black/30 border border-emerald-400/25 font-mono text-xs text-emerald-200">
              {activeInfo.coveredRange}
            </span>
          )}
        </div>
      ) : hasBreakpoint && activeInfo ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Box 1: Where the anime ends */}
            <div className="rounded-xl bg-white/[0.035] border border-white/[0.09] p-3.5 sm:p-4 flex flex-col justify-between gap-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#8E93A6]">
                {t("detail.animeStopsAt")}
              </span>
              <div className="flex items-baseline flex-wrap gap-2 mt-0.5">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">
                  {activeInfo.endedAtChapter !== null
                    ? formatChapterValue(
                        activeInfo.endedAtChapter,
                        t("detail.chapterLabel"),
                        lang
                      )
                    : activeInfo.endedAtVolume !== null
                      ? formatVolumeValue(
                          activeInfo.endedAtVolume,
                          t("detail.volumeLabel"),
                          lang
                        )
                      : "—"}
                </span>
                {activeInfo.endedAtChapter !== null && activeInfo.endedAtVolume !== null && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-white/[0.06] text-[#C8CCE0]">
                    {formatVolumeValue(
                      activeInfo.endedAtVolume,
                      t("detail.volumeLabel"),
                      lang
                    )}
                  </span>
                )}
              </div>
              {activeInfo.coveredRange && (
                <p className="text-[11px] font-mono text-[#7E8397] mt-0.5">
                  {activeInfo.coveredRange}
                </p>
              )}
            </div>

            {/* Box 2: Exact chapter to continue reading */}
            <div className="rounded-xl bg-gradient-to-br from-kinpaku/[0.14] via-accent/[0.08] to-transparent border border-kinpaku/40 p-3.5 sm:p-4 flex flex-col justify-between gap-1 shadow-[0_8px_28px_rgba(240,185,91,0.12)]">
              <span className="text-[11px] font-mono uppercase tracking-wider text-kinpaku flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span>{t("detail.continueAt")}</span>
              </span>
              <div className="flex items-baseline flex-wrap gap-2 mt-0.5">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-[#FFF7E0] font-mono">
                  {activeInfo.continueAtChapter !== null
                    ? formatChapterValue(
                        activeInfo.continueAtChapter,
                        t("detail.chapterLabel"),
                        lang
                      )
                    : activeInfo.continueAtVolume !== null
                      ? formatVolumeValue(
                          activeInfo.continueAtVolume,
                          t("detail.volumeLabel"),
                          lang
                        )
                      : "—"}
                </span>
                {activeInfo.continueAtChapter !== null &&
                  activeInfo.continueAtVolume !== null && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-kinpaku/20 border border-kinpaku/35 text-kinpaku">
                      {formatVolumeValue(
                        activeInfo.continueAtVolume,
                        t("detail.volumeLabel"),
                        lang
                      )}
                    </span>
                  )}
              </div>
              <p className="text-[11px] text-[#D7D2C3]">
                {sourceKindLabel}
                {sourceRelation?.chapters ? ` · ${sourceRelation.chapters} ${t("common.chShort")}` : ""}
              </p>
            </div>
          </div>

          {activeInfo.note && (
            <p className="text-xs sm:text-[13px] text-[#C6CAD8] leading-relaxed px-1">
              {activeInfo.note}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs sm:text-sm text-[#9A9EAE] leading-relaxed">
          {media.status === "NOT_YET_RELEASED"
            ? t("detail.notReleasedYet")
            : t("detail.unknownChapterHint")}
        </p>
      )}

      {/* Linked Source Manga / Manhwa Card + 1-Click Track & Open CTAs */}
      {sourceRelation && (
        <div className="pt-3 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Link
            href={`/media/${sourceRelation.id}`}
            className="group flex items-center gap-3 min-w-0"
          >
            <img
              src={sourceRelation.coverImage}
              alt={sourceRelation.title}
              loading="lazy"
              decoding="async"
              className="w-11 h-15 rounded-lg object-cover border border-white/15 shrink-0 group-hover:scale-105 transition-transform duration-200"
            />
            <div className="min-w-0">
              <p className="text-[10.5px] font-mono uppercase tracking-wider text-[#8E93A6]">
                {sourceKindLabel}
                {sourceRelation.averageScore ? (
                  <span className="inline-flex items-center gap-0.5 ml-2 text-kinpaku">
                    <Star className="w-2.5 h-2.5 fill-current" />
                    {formatScore(sourceRelation.averageScore)}
                  </span>
                ) : null}
              </p>
              <p className="text-sm font-semibold text-[#F4F3EE] group-hover:text-white truncate mt-0.5">
                {sourceRelation.title}
              </p>
              <p className="text-[11px] text-[#858A9E] font-mono">
                {sourceRelation.chapters
                  ? `${sourceRelation.chapters} ${t("common.chapters").toLowerCase()}`
                  : sourceRelation.volumes
                    ? `${sourceRelation.volumes} ${t("detail.volumeLabel").toLowerCase()}s`
                    : t("detail.openSourceSheet")}
              </p>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleTrackSourceFromBreakpoint}
              className={cn(
                "h-9 px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer",
                trackedSourceEntry &&
                  (!suggestedProgress || trackedSourceEntry.progress >= suggestedProgress)
                  ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/25"
                  : "bg-kinpaku/18 hover:bg-kinpaku/28 border-kinpaku/45 text-kinpaku"
              )}
            >
              {trackedSourceEntry &&
              (!suggestedProgress || trackedSourceEntry.progress >= suggestedProgress) ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {t("detail.alreadyReadingInList")}
                    {trackedSourceEntry.progress > 0
                      ? ` · ${t("common.chShort")} ${trackedSourceEntry.progress}`
                      : ""}
                  </span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {t("detail.startReadingInList")}
                    {suggestedProgress > 0 ? ` (${t("common.chShort")} ${suggestedProgress})` : ""}
                  </span>
                </>
              )}
            </button>

            <Link
              href={`/media/${sourceRelation.id}`}
              className="group h-9 px-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.13] border border-white/[0.11] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors"
            >
              <span>{t("detail.openSourceSheet")}</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
