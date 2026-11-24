import type { LibraryEntry } from "@/types/media";

const ENABLED_STORAGE_KEY = "shiori_browser_alerts_v1";
const NOTIFIED_EPISODES_KEY = "shiori_notified_eps_v1";
const MAX_NOTIFIED_MEMORY = 150;

export type BrowserNotifPermission = NotificationPermission | "unsupported";

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getBrowserNotificationPermission(): BrowserNotifPermission {
  if (!isBrowserNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export function isBrowserAlertsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ENABLED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setBrowserAlertsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) window.localStorage.setItem(ENABLED_STORAGE_KEY, "1");
    else window.localStorage.removeItem(ENABLED_STORAGE_KEY);
  } catch {
    // Ignore private browsing quota errors
  }
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotifPermission> {
  if (!isBrowserNotificationSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function sendShioriSystemNotification(payload: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}): Promise<boolean> {
  if (!isBrowserNotificationSupported() || Notification.permission !== "granted") {
    return false;
  }

  const icon = payload.icon || "/icon-192.png";
  const url = payload.url || "/episodes";

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration("/");
      if (reg && "showNotification" in reg) {
        await reg.showNotification(payload.title, {
          body: payload.body,
          icon,
          badge: "/icon-192.png",
          tag: payload.tag || `shiori-${Date.now()}`,
          data: { url },
        });
        return true;
      }
    }
  } catch {
    // Fall back to direct Notification constructor below
  }

  try {
    const n = new Notification(payload.title, {
      body: payload.body,
      icon,
      tag: payload.tag,
    });
    n.onclick = () => {
      window.focus();
      if (url && typeof window !== "undefined") {
        window.location.href = url;
      }
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

function readNotifiedKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTIFIED_EPISODES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeNotifiedKeys(keys: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      NOTIFIED_EPISODES_KEY,
      JSON.stringify(keys.slice(-MAX_NOTIFIED_MEMORY))
    );
  } catch {
    // Ignore storage errors
  }
}

interface AiringCheckResponse {
  items?: Array<{
    mediaId: number;
    title: { romaji: string; english: string | null };
    coverImage?: { large?: string; extraLarge?: string };
    latestAiredEpisode: number;
    latestAiredAt: number | null;
    nextAiringEpisode: {
      episode: number;
      airingAt: number;
      timeUntilAiring: number;
    } | null;
  }>;
}

/**
 * Checks currently tracked `WATCHING` anime for newly aired episodes (last 36h)
 * or imminent releases (< 30 min) and emits deduplicated PWA/OS notifications.
 */
export async function checkAndNotifyEpisodeReleases(
  library: LibraryEntry[]
): Promise<number> {
  if (
    !isBrowserNotificationSupported() ||
    Notification.permission !== "granted" ||
    !isBrowserAlertsEnabled()
  ) {
    return 0;
  }

  const watchingAnime = library
    .filter((e) => e.type === "ANIME" && e.status === "WATCHING")
    .slice(0, 50);

  if (watchingAnime.length === 0) return 0;

  try {
    const res = await fetch("/api/anilist/watching-airing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: watchingAnime.map((e) => e.mediaId) }),
    });
    if (!res.ok) return 0;

    const data = (await res.json()) as AiringCheckResponse;
    const items = Array.isArray(data?.items) ? data.items : [];
    if (items.length === 0) return 0;

    const entryById = new Map(watchingAnime.map((e) => [e.mediaId, e]));
    const alreadyNotified = new Set(readNotifiedKeys());
    const nowSec = Math.floor(Date.now() / 1000);
    let sent = 0;

    for (const item of items) {
      if (sent >= 3) break; // Never spam OS notifications at once
      const entry = entryById.get(item.mediaId);
      if (!entry) continue;

      const displayTitle = item.title.english || item.title.romaji || entry.title;

      // 1) Newly aired episode (within last 36 hours) that user hasn't watched yet
      if (
        item.latestAiredEpisode > entry.progress &&
        item.latestAiredAt &&
        nowSec - item.latestAiredAt <= 36 * 3600
      ) {
        const key = `aired:${item.mediaId}:${item.latestAiredEpisode}`;
        if (!alreadyNotified.has(key)) {
          const ok = await sendShioriSystemNotification({
            title: `Nouvel épisode disponible · ${displayTitle}`,
            body: `L'épisode ${item.latestAiredEpisode} vient de sortir !`,
            url: `/media/${item.mediaId}`,
            tag: key,
            icon: item.coverImage?.large || entry.coverImage || "/icon-192.png",
          });
          if (ok) {
            alreadyNotified.add(key);
            sent++;
          }
        }
        continue;
      }

      // 2) Imminent release (within 30 minutes)
      if (
        item.nextAiringEpisode &&
        item.nextAiringEpisode.timeUntilAiring > 0 &&
        item.nextAiringEpisode.timeUntilAiring <= 1800
      ) {
        const ep = item.nextAiringEpisode.episode;
        const mins = Math.max(1, Math.round(item.nextAiringEpisode.timeUntilAiring / 60));
        const key = `soon:${item.mediaId}:${ep}`;
        if (!alreadyNotified.has(key)) {
          const ok = await sendShioriSystemNotification({
            title: `Bientôt diffusé · ${displayTitle}`,
            body: `L'épisode ${ep} sort dans environ ${mins} min.`,
            url: `/media/${item.mediaId}`,
            tag: key,
            icon: item.coverImage?.large || entry.coverImage || "/icon-192.png",
          });
          if (ok) {
            alreadyNotified.add(key);
            sent++;
          }
        }
      }
    }

    if (sent > 0) {
      writeNotifiedKeys(Array.from(alreadyNotified));
    }
    return sent;
  } catch {
    return 0;
  }
}
