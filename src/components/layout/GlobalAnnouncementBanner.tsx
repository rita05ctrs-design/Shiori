"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Megaphone, Sparkles, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { SiteAnnouncement, SiteConfig } from "@/types/media";

const DISMISS_STORAGE_KEY = "shiori_dismissed_announcement_v2";
const BROADCAST_CHANNEL_NAME = "shiori_site_config_v1";
export const SITE_CONFIG_UPDATED_EVENT = "shiori:site-config-updated";
export const SUPABASE_ANNOUNCEMENT_CHANNEL = "shiori:site-config-live";
export const SUPABASE_ANNOUNCEMENT_EVENT = "site_config_updated";

const POLL_INTERVAL_MS = 8_000;

/**
 * Broadcasts a freshly updated SiteConfig immediately across same-tab & same-browser tabs.
 * Cross-device worldwide Realtime broadcast is pushed directly by the server (`PUT /api/admin/site-config`)
 * via Supabase Realtime REST so active client WebSocket subscriptions are never torn down.
 */
export function broadcastSiteConfigLive(config: SiteConfig): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<SiteConfig>(SITE_CONFIG_UPDATED_EVENT, { detail: config })
  );

  try {
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.postMessage({ type: "site_config_updated", config });
      bc.close();
    }
  } catch {
    // ignore unsupported BroadcastChannel
  }
}

export function GlobalAnnouncementBanner() {
  const { tr } = useTranslation();
  const [announcement, setAnnouncement] = useState<SiteAnnouncement | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const lastUpdatedAtRef = useRef<string>("");

  const applyConfig = (cfg: SiteConfig | undefined, clearDismissIfChanged = true) => {
    if (!cfg?.announcement) return;
    const nextStamp = cfg.updatedAt || "";
    const stampChanged = Boolean(nextStamp && nextStamp !== lastUpdatedAtRef.current);
    lastUpdatedAtRef.current = nextStamp;
    setAnnouncement(cfg.announcement);
    setUpdatedAt(nextStamp);
    if (clearDismissIfChanged && stampChanged) {
      setDismissedKey(null);
      try {
        sessionStorage.removeItem(DISMISS_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    try {
      setDismissedKey(sessionStorage.getItem(DISMISS_STORAGE_KEY));
    } catch {
      // ignore
    }

    let cancelled = false;
    const loadConfig = async (initial = false) => {
      try {
        const res = await fetch("/api/site-config", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { config?: SiteConfig };
        if (!cancelled && data.config) {
          applyConfig(data.config, !initial);
        }
      } catch {
        // non-fatal
      }
    };

    void loadConfig(true);

    // 1) Same-tab instant event
    const onUpdated = (e: Event) => {
      const custom = e as CustomEvent<SiteConfig | undefined>;
      if (custom.detail?.announcement) {
        applyConfig(custom.detail, true);
        setDismissedKey(null);
      } else {
        void loadConfig(false);
      }
    };
    window.addEventListener(SITE_CONFIG_UPDATED_EVENT, onUpdated);

    // 2) Cross-tab instant BroadcastChannel
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        bc.onmessage = (event: MessageEvent) => {
          const payload = event.data as { config?: SiteConfig } | undefined;
          if (payload?.config) {
            applyConfig(payload.config, true);
          }
        };
      }
    } catch {
      // ignore
    }

    // 3) Cross-device REAL-TIME via Supabase Realtime (Broadcast + Postgres changes)
    const supabase = getSupabaseBrowserClient();
    const realtimeChannel = supabase
      ? supabase
          .channel(SUPABASE_ANNOUNCEMENT_CHANNEL)
          .on("broadcast", { event: SUPABASE_ANNOUNCEMENT_EVENT }, (msg) => {
            const payload = msg?.payload as { config?: SiteConfig } | undefined;
            if (payload?.config) {
              applyConfig(payload.config, true);
            } else {
              void loadConfig(false);
            }
          })
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "site_settings",
            },
            () => {
              void loadConfig(false);
            }
          )
          .subscribe()
      : null;

    // 4) Resilient visibility-aware polling + focus refresh (works even if WS sleeps on mobile)
    const pollTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadConfig(false);
      }
    }, POLL_INTERVAL_MS);

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void loadConfig(false);
      }
    };
    window.addEventListener("focus", onVisibilityOrFocus);
    document.addEventListener("visibilitychange", onVisibilityOrFocus);

    return () => {
      cancelled = true;
      window.removeEventListener(SITE_CONFIG_UPDATED_EVENT, onUpdated);
      window.removeEventListener("focus", onVisibilityOrFocus);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.clearInterval(pollTimer);
      try {
        bc?.close();
      } catch {
        // ignore
      }
      if (supabase && realtimeChannel) {
        void supabase.removeChannel(realtimeChannel);
      }
    };
  }, []);

  const fingerprint = announcement
    ? `${updatedAt}:${announcement.tone}:${announcement.message.trim()}`
    : "";
  const isVisible = Boolean(
    announcement &&
      announcement.enabled &&
      announcement.message.trim() &&
      dismissedKey !== fingerprint
  );

  // Sync live banner height into CSS var --shiori-banner-h so full-viewport pages (/assistant) never overlap
  useEffect(() => {
    const root = document.documentElement;
    if (!isVisible || !bannerRef.current) {
      root.style.setProperty("--shiori-banner-h", "0px");
      return;
    }

    const updateHeight = () => {
      const h = bannerRef.current?.getBoundingClientRect().height ?? 0;
      root.style.setProperty("--shiori-banner-h", `${Math.ceil(h)}px`);
    };
    updateHeight();

    const ro = new ResizeObserver(updateHeight);
    ro.observe(bannerRef.current);
    return () => {
      ro.disconnect();
      root.style.setProperty("--shiori-banner-h", "0px");
    };
  }, [isVisible, announcement?.message, announcement?.ctaLabel]);

  if (!isVisible || !announcement) {
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
      ref={bannerRef}
      role="status"
      aria-live="polite"
      data-shiori-announcement="visible"
      className={cn(
        "w-full border-y backdrop-blur-xl transition-all",
        toneStyles
      )}
    >
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 justify-start">
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider shrink-0",
              badgeStyles
            )}
          >
            {announcement.tone === "gold" ? (
              <Sparkles className="w-2.5 h-2.5" />
            ) : (
              <Megaphone className="w-2.5 h-2.5" />
            )}
            <span className="hidden xs:inline sm:inline">{tr("Annonce")}</span>
          </span>
          <p className="text-xs sm:text-[13px] font-medium leading-snug line-clamp-2 sm:line-clamp-none break-words min-w-0">
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
          aria-label={tr("Fermer l'annonce")}
          className="w-6 h-6 rounded-full hover:bg-white/[0.1] flex items-center justify-center opacity-75 hover:opacity-100 transition-opacity shrink-0 cursor-pointer touch-manipulation"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
