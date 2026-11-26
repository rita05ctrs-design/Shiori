"use client";

import { useCallback, useMemo } from "react";
import { useShiori } from "@/context/ShioriContext";
import { CONTENT_LANGUAGE_MAP } from "@/lib/i18n";
import {
  translateGenreName,
  translateLibraryStatus,
  translateSeasonName,
  translateUi,
  type UiMessageKey,
} from "@/lib/ui-translations";
import { translatePhrase } from "@/lib/ui-phrases";
import {
  formatCountdown,
  formatFormat,
  formatMediaStatus,
  formatRelativeTime,
  formatSeason,
} from "@/lib/utils";
import type { LibraryStatus, MediaType } from "@/types/media";

/**
 * React hook giving any client component instant reactive access to Shiori's
 * full 7-language dictionary (FR, EN, ES, DE, IT, PT, JA) plus locale-aware formatters.
 */
export function useTranslation() {
  const { contentLanguage, setContentLanguage } = useShiori();

  const locale = useMemo(
    () => CONTENT_LANGUAGE_MAP.get(contentLanguage)?.locale ?? "fr-FR",
    [contentLanguage]
  );

  const t = useCallback(
    (key: UiMessageKey) => translateUi(contentLanguage, key),
    [contentLanguage]
  );

  const tr = useCallback(
    (frKey: string, vars?: Record<string, string | number>) =>
      translatePhrase(contentLanguage, frKey, vars),
    [contentLanguage]
  );

  const tStatus = useCallback(
    (status: LibraryStatus, type: MediaType = "ANIME") =>
      translateLibraryStatus(contentLanguage, status, type),
    [contentLanguage]
  );

  const tGenre = useCallback(
    (genre: string) => translateGenreName(contentLanguage, genre),
    [contentLanguage]
  );

  const tSeason = useCallback(
    (season: string | null | undefined) => translateSeasonName(contentLanguage, season),
    [contentLanguage]
  );

  const tFormat = useCallback(
    (format: string | null | undefined) => formatFormat(format, contentLanguage),
    [contentLanguage]
  );

  const tMediaStatus = useCallback(
    (status: string | null | undefined) => formatMediaStatus(status, contentLanguage),
    [contentLanguage]
  );

  const tSeasonYear = useCallback(
    (season: string | null | undefined, year: number | null | undefined) =>
      formatSeason(season, year, contentLanguage),
    [contentLanguage]
  );

  const tRelativeTime = useCallback(
    (iso: string) => formatRelativeTime(iso, contentLanguage),
    [contentLanguage]
  );

  const tCountdown = useCallback(
    (airingAt: number, nowSec?: number) =>
      formatCountdown(airingAt, nowSec, contentLanguage),
    [contentLanguage]
  );

  return {
    lang: contentLanguage,
    locale,
    setLang: setContentLanguage,
    t,
    tr,
    tStatus,
    tGenre,
    tSeason,
    tFormat,
    tMediaStatus,
    tSeasonYear,
    tRelativeTime,
    tCountdown,
  };
}
