"use client";

import React from "react";
import { BookOpen, ExternalLink, Search, Tv } from "lucide-react";
import {
  buildRegionalSearchLinks,
  formatStreamingDisplayName,
  formatStreamingLanguageTag,
  getStreamingPlatformMeta,
} from "@/lib/streaming";
import { cn } from "@/lib/utils";
import type { MediaType, StreamingLink } from "@/types/media";

function PlatformAvatar({
  link,
  size = "md",
}: {
  link: StreamingLink;
  size?: "xs" | "sm" | "md";
}) {
  const color = link.color || getStreamingPlatformMeta(link.site).fallbackColor;
  const label = formatStreamingDisplayName(link.site);
  const initials = label.slice(0, 2).toUpperCase();

  const boxClass =
    size === "xs"
      ? "w-4 h-4 rounded-full text-[8px]"
      : size === "sm"
        ? "w-5 h-5 rounded-md text-[9px]"
        : "w-8 h-8 rounded-lg text-[11px]";

  if (link.icon) {
    return (
      <span
        style={{ backgroundColor: `${color}26`, borderColor: `${color}55` }}
        className={cn(
          "inline-flex items-center justify-center overflow-hidden border shrink-0",
          boxClass
        )}
      >
        <img
          src={link.icon}
          alt={label}
          loading="lazy"
          decoding="async"
          className={cn(
            "object-contain",
            size === "xs" ? "w-3 h-3" : size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5"
          )}
        />
      </span>
    );
  }

  return (
    <span
      style={{ backgroundColor: `${color}28`, borderColor: `${color}55`, color }}
      className={cn(
        "inline-flex items-center justify-center font-mono font-bold border shrink-0",
        boxClass
      )}
    >
      {initials}
    </span>
  );
}

/**
 * Ultra-compact brand icon strip for MediaCard / Calendar slots (max 3 icons, zero clutter).
 */
export function StreamingIconsStrip({
  links,
  max = 3,
  className,
}: {
  links?: StreamingLink[];
  max?: number;
  className?: string;
}) {
  if (!links || links.length === 0) return null;
  const visible = links.slice(0, max);
  const titleText = `Disponible sur ${links
    .slice(0, 5)
    .map((l) => formatStreamingDisplayName(l.site))
    .join(", ")}`;

  return (
    <span
      title={titleText}
      className={cn("inline-flex items-center gap-1 shrink-0", className)}
    >
      {visible.map((link) => (
        <PlatformAvatar key={`${link.id}-${link.site}`} link={link} size="xs" />
      ))}
    </span>
  );
}

/**
 * Clickable inline streaming pills for HeroShowcase and above-the-fold MediaDetail header.
 */
export function StreamingPillsInline({
  links,
  max = 3,
  className,
}: {
  links?: StreamingLink[];
  max?: number;
  className?: string;
}) {
  if (!links || links.length === 0) return null;
  const visible = links.slice(0, max);

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {visible.map((link) => {
        const color = link.color || getStreamingPlatformMeta(link.site).fallbackColor;
        const name = formatStreamingDisplayName(link.site);
        return (
          <a
            key={`${link.id}-${link.site}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              borderColor: `${color}48`,
              backgroundColor: `${color}16`,
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold text-white hover:brightness-125 transition-all"
          >
            <PlatformAvatar link={link} size="xs" />
            <span>{name}</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-65" />
          </a>
        );
      })}
      {links.length > max && (
        <span className="text-[11px] font-mono text-[#9A9EAE] px-1">
          +{links.length - max}
        </span>
      )}
    </div>
  );
}

/**
 * Full "Où regarder" / "Où lire officiellement" section for /media/[id] detail pages.
 */
export function WhereToWatchSection({
  title,
  type,
  links,
}: {
  title: string;
  type: MediaType;
  links?: StreamingLink[];
}) {
  const verifiedLinks = links ?? [];
  const regionalShortcuts = buildRegionalSearchLinks(title, type);
  const isManga = type === "MANGA";

  return (
    <section
      id="where-to-watch"
      className="rounded-2xl card-surface p-5 sm:p-6 space-y-4 scroll-mt-24"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-mono uppercase tracking-[0.18em] text-accent flex items-center gap-1.5">
            {isManga ? <BookOpen className="w-3.5 h-3.5" /> : <Tv className="w-3.5 h-3.5" />}
            <span>{isManga ? "Où lire officiellement" : "Où regarder"}</span>
          </h2>
          <p className="text-xs text-[#9A9EAE] mt-1">
            {verifiedLinks.length > 0
              ? isManga
                ? "Plateformes officielles référencées sur AniList pour ce manga."
                : "Plateformes de streaming officielles référencées sur AniList (la disponibilité peut varier selon le pays)."
              : isManga
                ? "Aucune plateforme de lecture officielle n'est encore référencée sur AniList pour ce titre."
                : "Aucune plateforme de streaming officielle n'est encore référencée sur AniList pour cet animé."}
          </p>
        </div>

        {verifiedLinks.length > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.09] font-mono text-[10.5px] text-[#C8CCE0] shrink-0">
            {verifiedLinks.length} plateforme{verifiedLinks.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Verified Official Platforms Grid */}
      {verifiedLinks.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {verifiedLinks.map((link) => {
            const color = link.color || getStreamingPlatformMeta(link.site).fallbackColor;
            const displayName = formatStreamingDisplayName(link.site);
            const tag = formatStreamingLanguageTag(link.language, link.notes);

            return (
              <a
                key={`${link.id}-${link.url}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ borderColor: `${color}40` }}
                className="group p-3 rounded-xl bg-obsidian/75 hover:bg-white/[0.06] border transition-all flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <PlatformAvatar link={link} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-white group-hover:text-accent-hover transition-colors truncate">
                        {displayName}
                      </span>
                      {tag && (
                        <span className="px-1.5 py-0.2 rounded bg-white/[0.07] border border-white/[0.1] font-mono text-[9.5px] text-[#C8CCE0] shrink-0">
                          {tag}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#858A9E] truncate">
                      {isManga ? "Lire sur la plateforme" : "Regarder officiellement"}
                    </p>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[#7E8397] group-hover:text-white shrink-0 transition-colors" />
              </a>
            );
          })}
        </div>
      )}

      {/* Transparent Regional Search Helper (explicitly labeled as Search — never fake availability) */}
      <div className="pt-3 border-t border-white/[0.07] flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-[#858A9E] inline-flex items-center gap-1.5 mr-1">
          <Search className="w-3 h-3 text-[#F0B95B]" />
          <span>Vérifier la disponibilité en France :</span>
        </span>
        {regionalShortcuts.map((sc) => (
          <a
            key={sc.id}
            href={sc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.09] hover:border-white/[0.2] text-[11px] font-medium text-[#D6D9E6] hover:text-white transition-colors"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: sc.color }}
            />
            <span>{sc.label}</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </a>
        ))}
      </div>
    </section>
  );
}
