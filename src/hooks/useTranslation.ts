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
import type { LibraryStatus, MediaType } from "@/types/media";

/**
 * React hook giving any client component instant reactive access to Shiori's
 * full multi-language dictionary (FR, EN, ES, DE, IT, PT, JA).
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

  return {
    lang: contentLanguage,
    locale,
    setLang: setContentLanguage,
    t,
    tStatus,
    tGenre,
    tSeason,
  };
}
