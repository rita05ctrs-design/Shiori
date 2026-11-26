"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Megaphone, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SiteAnnouncement, SiteConfig } from "@/types/media";

const DISMISS_STORAGE_KEY = "shiori_dismissed_announcement_v1";

export const SITE_CONFIG_UPDATED_EVENT = "shiori:site-config-updated";

export function GlobalAnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<SiteAnnouncement | null>(null);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissedKey(sessionStorage.getItem(DISMISS_STORAGE_KEY));
    } catch {
      // ignore
    }

    let cancelled = false;
    const loadConfig = async () => {
      try {
        const res = await fetch("/api/site-config", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { config?: SiteConfig };
        if (!cancelled && data.config?.announcement) {
          setAnnouncement(data.config.announcement);
        }
      } catch {
        // non-fatal
      }
    };

    void loadConfig();

    const onUpdated = (e: Event) => {
      const custom = e as CustomEvent<SiteConfig | undefined>;
      if (custom.detail?.announcement) {
        setAnnouncement(custom.detail.announcement);
        setDismissedKey(null);
      } else {
        void loadConfig();
      }
    };

    window.addEventListener(SITE_CONFIG_UPDATED_EVENT, onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(SITE_CONFIG_UPDATED_EVENT, onUpdated);
    };
  }, []);

  if (!announcement || !announcement.enabled || !announcement.message.trim()) {
    return null;
  }

  const fingerprint = `${announcement.tone}:${announcement.message.trim()}`;
  if (dismissedKey === fingerprint) {
    return null;
  }

  const toneStyles =
    announcement.tone === "crimson"
      ? "bg-gradient-to-r from-[#1A0A0D]/95 via-[#250E13]/95 to-[#1A0A0D]/95 border-[#E5484D]/35 text-[#FDE8E8]"
      : announcement.tone === "info"
      ? "bg-gradient-to-r from-[#0B1220]/95 via-[#101C33]/95 to-[#0B1220]/95 border-sky-400/35 text-sky-100"
      : "bg-gradient-to-r from-[#19130A]/95 via-[#241B0D]/95 to-[#19130A]/95 border-[#F0B95B]/40 text-[#FEF3C7]";

  const badgeStyles =
    announcement.tone === "crimson"
      ? "bg-[#E5484D]/22 text-[#FCA5A5] border-[#E5484D]/45"
      : announcement.tone === "info"
      ? "bg-sky-400/20 text-sky-200 border-sky-400/40"
      : "bg-[#F0B95B]/20 text-[#FDE68A] border-[#F0B95B]/50";

  const isExternal = Boolean(
    announcement.ctaHref && /^https?:\/\//i.test(announcement.ctaHref)
  );

  const handleDismiss = () => {
    setDismissedKey(fingerprint);
    try {
      sessionStorage.setItem(DISMISS_STORAGE_KEY, fingerprint);
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "w-full border-y backdrop-blur-xl transition-all",
        toneStyles
      )}
    >
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-center sm:justify-start">
          <span
            className={cn(
              "hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider shrink-0",
              badgeStyles
            )}
          >
            {announcement.tone === "gold" ? (
              <Sparkles className="w-2.5 h-2.5" />
            ) : (
              <Megaphone className="w-2.5 h-2.5" />
            )}
            Annonce
          </span>
          <p className="text-xs sm:text-[13px] font-medium leading-snug truncate sm:whitespace-normal">
            {announcement.message}
          </p>
          {announcement.ctaLabel && announcement.ctaHref && (
            isExternal ? (
              <a
                href={announcement.ctaHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold shrink-0 hover:brightness-110 transition-all",
                  badgeStyles
                )}
              >
                <span>{announcement.ctaLabel}</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            ) : (
              <Link
                href={announcement.ctaHref}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold shrink-0 hover:brightness-110 transition-all",
                  badgeStyles
                )}
              >
                <span>{announcement.ctaLabel}</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            )
          )}
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Fermer l'annonce"
          className="w-6 h-6 rounded-full hover:bg-white/[0.1] flex items-center justify-center opacity-75 hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
