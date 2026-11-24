"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Languages, Loader2, RotateCcw } from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import {
  CONTENT_LANGUAGES,
  CONTENT_LANGUAGE_MAP,
  sanitizeSynopsisHtml,
  synopsisHtmlToPlainText,
} from "@/lib/i18n";
import { synopsisPersistentCache } from "@/lib/client-cache";
import { cn } from "@/lib/utils";
import type { ContentLanguage } from "@/types/media";

interface CachedClientTranslation {
  html: string;
  translated: boolean;
}

// Instant client-side memory cache shared across slides & pages during the session
const clientTranslationCache = new Map<string, CachedClientTranslation>();

interface TranslatedSynopsisProps {
  mediaId: number;
  description: string | null | undefined;
  /**
   * "detail": Full HTML-formatted synopsis on /media/[id] with expand/collapse + header controls
   * "hero": Compact clamped preview on Home HeroShowcase
   * "compact": Tight 2-line preview on Home roulette / small preview cards
   */
  variant?: "detail" | "hero" | "compact";
  expandable?: boolean;
  /** Only trigger translation once scrolled into viewport (ideal for dense lists like /calendar) */
  lazy?: boolean;
  className?: string;
}

export function TranslatedSynopsis({
  mediaId,
  description,
  variant = "detail",
  expandable = false,
  lazy = false,
  className,
}: TranslatedSynopsisProps) {
  const { contentLanguage, setContentLanguage, hydrated } = useShiori();
  const [showOriginal, setShowOriginal] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [inView, setInView] = useState(!lazy);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lazy || inView) return;
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: "160px" }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [lazy, inView]);

  const originalHtml = useMemo(() => sanitizeSynopsisHtml(description), [description]);
  const originalPlain = useMemo(
    () => synopsisHtmlToPlainText(originalHtml),
    [originalHtml]
  );

  const cacheKey = `${mediaId}:${contentLanguage}`;
  const cachedImmediate =
    contentLanguage !== "en" ? clientTranslationCache.get(cacheKey) : undefined;

  const [translatedHtml, setTranslatedHtml] = useState<string | null>(
    cachedImmediate?.html ?? null
  );
  const [isTranslated, setIsTranslated] = useState<boolean>(
    Boolean(cachedImmediate?.translated)
  );
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  // Reset per-card "Voir l'original" toggle whenever user changes global language or mediaId
  useEffect(() => {
    setShowOriginal(false);
    setExpanded(false);
    setFailed(false);
  }, [mediaId, contentLanguage]);

  useEffect(() => {
    if (!hydrated || !originalHtml || !inView) {
      setTranslatedHtml(null);
      setIsTranslated(false);
      setLoading(false);
      setFailed(false);
      return;
    }

    if (contentLanguage === "en") {
      setTranslatedHtml(originalHtml);
      setIsTranslated(false);
      setLoading(false);
      setFailed(false);
      return;
    }

    const hit =
      clientTranslationCache.get(cacheKey) ?? synopsisPersistentCache.get(cacheKey);
    if (hit) {
      clientTranslationCache.set(cacheKey, hit);
      setTranslatedHtml(hit.html);
      setIsTranslated(hit.translated);
      setLoading(false);
      setFailed(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    setTranslatedHtml(null);
    setIsTranslated(false);

    const requestTranslation = async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (controller.signal.aborted) return;
        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mediaId,
              text: description ?? "",
              targetLang: contentLanguage as ContentLanguage,
            }),
            signal: controller.signal,
          });
          const data = res.ok ? await res.json() : null;
          if (controller.signal.aborted) return;

          if (data?.ok && data.translated && typeof data.translatedText === "string" && data.translatedText) {
            const entry: CachedClientTranslation = {
              html: data.translatedText,
              translated: true,
            };
            clientTranslationCache.set(cacheKey, entry);
            synopsisPersistentCache.set(cacheKey, entry);
            setTranslatedHtml(entry.html);
            setIsTranslated(true);
            setFailed(false);
            return;
          }
        } catch {
          if (controller.signal.aborted) return;
        }

        // Wait briefly before single automatic retry on transient failure
        if (attempt === 0 && !controller.signal.aborted) {
          await new Promise((r) => setTimeout(r, 450));
        }
      }

      if (!controller.signal.aborted) {
        setTranslatedHtml(originalHtml);
        setIsTranslated(false);
        setFailed(true);
      }
    };

    void requestTranslation().finally(() => {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    });

    return () => {
      controller.abort();
    };
  }, [hydrated, inView, mediaId, description, originalHtml, contentLanguage, cacheKey, retryNonce]);

  if (!originalHtml) {
    return (
      <p className="text-sm text-[#858A9E] italic">
        Aucun synopsis disponible pour ce titre.
      </p>
    );
  }

  const langMeta = CONTENT_LANGUAGE_MAP.get(contentLanguage);
  const showingTranslated = contentLanguage !== "en" && isTranslated && !showOriginal;
  const activeHtml = showingTranslated && translatedHtml ? translatedHtml : originalHtml;
  const activePlain = showingTranslated && translatedHtml
    ? synopsisHtmlToPlainText(translatedHtml)
    : originalPlain;

  // HERO / COMPACT PREVIEW MODE
  if (variant === "hero" || variant === "compact") {
    return (
      <div ref={containerRef} className={cn("space-y-1.5", className)}>
        <p
          className={cn(
            variant === "hero"
              ? "text-sm sm:text-[15px] text-[#B9BDCC] leading-relaxed max-w-2xl line-clamp-3"
              : "text-xs text-[#A6AAB8] line-clamp-2 leading-relaxed",
            loading && "opacity-75 transition-opacity"
          )}
        >
          {activePlain}
        </p>

        {(loading || (contentLanguage !== "en" && isTranslated)) && (
          <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
            {loading ? (
              <span className="inline-flex items-center gap-1 text-[#9A9EAE] font-mono">
                <Loader2 className="w-3 h-3 animate-spin text-accent-soft" />
                <span>Traduction en {langMeta?.shortLabel ?? contentLanguage.toUpperCase()}...</span>
              </span>
            ) : (
              <>
                {showingTranslated && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-[#AEB3C6] font-mono text-[10px]">
                    <Languages className="w-2.5 h-2.5 text-accent-soft" />
                    <span>Traduit automatiquement</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOriginal((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 text-[#C8CCE0] hover:text-white underline underline-offset-2 decoration-white/25 hover:decoration-white cursor-pointer font-medium"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>
                    {showOriginal
                      ? `Voir la traduction (${langMeta?.code ?? contentLanguage.toUpperCase()})`
                      : "Voir l'original (EN)"}
                  </span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // DETAIL PAGE FULL EDITORIAL MODE (preserves <br /> and <i>/<b> formatting!)
  return (
    <div className={cn("space-y-3", className)}>
      {/* Header Row with Inline Language Selector, Auto Translation Badge & 1-Click Original Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xs font-mono uppercase tracking-[0.18em] text-accent">
            Synopsis
          </h2>

          {loading && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.09] text-[10.5px] font-mono text-[#B5B9C9]">
              <Loader2 className="w-3 h-3 animate-spin text-accent-soft" />
              <span>Traduction ({langMeta?.shortLabel ?? contentLanguage.toUpperCase()})...</span>
            </span>
          )}

          {!loading && showingTranslated && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/14 border border-accent/35 text-[10px] font-mono text-accent-soft">
              <Languages className="w-3 h-3" />
              <span>Auto · {langMeta?.code ?? contentLanguage.toUpperCase()}</span>
            </span>
          )}

          {!loading && failed && contentLanguage !== "en" && (
            <button
              type="button"
              onClick={() => setRetryNonce((n) => n + 1)}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 text-[10.5px] font-medium text-amber-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Réessayer ({langMeta?.code ?? contentLanguage.toUpperCase()})</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Direct 1-click Synopsis Language Picker (FR / EN / ES / IT) */}
          <div
            role="group"
            aria-label="Choisir la langue du synopsis"
            className="inline-flex items-center p-0.5 rounded-full bg-white/[0.04] border border-white/[0.09]"
          >
            {CONTENT_LANGUAGES.map((lang) => {
              const isSelected =
                lang.id === "en"
                  ? contentLanguage === "en" || showOriginal
                  : contentLanguage === lang.id && !showOriginal;
              return (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => {
                    setShowOriginal(false);
                    if (lang.id !== contentLanguage) {
                      setContentLanguage(lang.id);
                    } else if (failed) {
                      setRetryNonce((n) => n + 1);
                    }
                  }}
                  title={lang.label}
                  aria-pressed={isSelected}
                  className={cn(
                    "px-2.5 py-0.5 rounded-full font-mono text-[10.5px] font-bold transition-all cursor-pointer",
                    isSelected
                      ? "bg-accent text-accent-fg shadow-[0_2px_10px_rgb(var(--shiori-accent-rgb)/0.38)]"
                      : "text-[#9A9EAE] hover:text-white"
                  )}
                >
                  {lang.code}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sanitized HTML Synopsis preserving <br /> and <i> / <b> */}
      <div
        className={cn(
          "text-sm sm:text-[15px] text-[#C6CAD8] leading-[1.78] [&_i]:italic [&_i]:text-[#E4E6F0] [&_em]:italic [&_b]:font-semibold [&_b]:text-white [&_strong]:font-semibold [&_strong]:text-white",
          expandable && !expanded && "line-clamp-5",
          loading && "opacity-70 transition-opacity"
        )}
        dangerouslySetInnerHTML={{ __html: activeHtml }}
      />

      {expandable && activePlain.length > 360 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-semibold text-accent-hover hover:text-[#FF858A] cursor-pointer"
        >
          {expanded ? "Réduire" : "Lire le synopsis complet"}
        </button>
      )}
    </div>
  );
}
