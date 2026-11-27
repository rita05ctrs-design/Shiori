"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  applyServerSuggestions,
  ingestLiveSuggestion,
  resetCreatorSuggestionsBus,
  setSuggestionsLiveConnected,
  SUGGESTIONS_BROADCAST_NAME,
  SUGGESTIONS_LOCAL_EVENT,
  SUGGESTIONS_REALTIME_CHANNEL,
  SUGGESTIONS_REALTIME_EVENT,
} from "@/lib/suggestions-live-bus";
import { sanitizeStoredSuggestion } from "@/lib/suggestions-utils";
import type { UserSuggestionRecord } from "@/types/media";

const POLL_INTERVAL_MS = 6_000;

function mapRealtimePgRow(raw: unknown): UserSuggestionRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return sanitizeStoredSuggestion({
    id: r.id,
    userId: r.user_id ?? r.userId,
    username: r.username,
    displayName: r.display_name ?? r.displayName,
    avatarUrl: r.avatar_url ?? r.avatarUrl,
    accentColor: r.accent_color ?? r.accentColor,
    category: r.category,
    title: r.title,
    message: r.message,
    device: r.device,
    pagePath: r.page_path ?? r.pagePath,
    status: r.status ?? "new",
    createdAt: r.created_at ?? r.createdAt,
    updatedAt: r.updated_at ?? r.updatedAt,
  });
}

/**
 * Headless global real-time listener mounted whenever the Creator (`6t79`) is logged in.
 * Receives incoming suggestions instantly (<100ms) on EVERY page of Shiori via:
 *   1) Supabase Realtime Broadcast (pushed directly by the server on `POST /api/suggestions`)
 *   2) Supabase Realtime Postgres Changes (`public.user_suggestions`, if migrated)
 *   3) Same-browser `BroadcastChannel` + same-tab `CustomEvent`
 *   4) Fast visibility-aware polling + focus/visibility sync
 * Also archives guest Realtime suggestions into Creator cloud storage automatically.
 */
export function CreatorSuggestionsWatcher() {
  const { isCreator, toast } = useShiori();
  const { tr } = useTranslation();
  const router = useRouter();

  const toastRef = useRef(toast);
  const trRef = useRef(tr);
  const routerRef = useRef(router);
  const archivedIdsRef = useRef(new Set<string>());

  useEffect(() => {
    toastRef.current = toast;
    trRef.current = tr;
    routerRef.current = router;
  }, [toast, tr, router]);

  useEffect(() => {
    if (!isCreator) {
      resetCreatorSuggestionsBus();
      return;
    }

    let cancelled = false;

    const showIncomingToast = (item: UserSuggestionRecord) => {
      const author = item.username ? `@${item.username}` : item.displayName || trRef.current("Invité");
      const preview = item.title
        ? `${author} — ${item.title}`
        : `${author} — ${item.message.slice(0, 72)}`;

      toastRef.current({
        title: trRef.current("Nouvelle suggestion reçue"),
        description: preview,
        variant: "info",
        durationMs: 7000,
        action: {
          label: trRef.current("Ouvrir"),
          onClick: () => routerRef.current.push("/admin?tab=suggestions"),
        },
      });
    };

    const archiveToCloudIfNeeded = async (item: UserSuggestionRecord) => {
      if (archivedIdsRef.current.has(item.id)) return;
      archivedIdsRef.current.add(item.id);
      try {
        const res = await fetch("/api/admin/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestion: item }),
        });
        if (res.ok && !cancelled) {
          const data = await res.json().catch(() => null);
          if (data && Array.isArray(data.suggestions)) {
            applyServerSuggestions(data.suggestions as UserSuggestionRecord[]);
          }
        }
      } catch {
        // non-fatal — already in live memory
      }
    };

    const handleLiveIncoming = (raw: unknown, shouldArchive = true) => {
      if (cancelled) return;
      const clean = mapRealtimePgRow(raw);
      if (!clean) return;
      const isNew = ingestLiveSuggestion(clean);
      if (isNew) {
        showIncomingToast(clean);
      }
      if (shouldArchive) {
        void archiveToCloudIfNeeded(clean);
      }
    };

    const fetchLatest = async () => {
      if (cancelled) return;
      try {
        const res = await fetch("/api/admin/suggestions", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json().catch(() => null);
        if (!data || !Array.isArray(data.suggestions) || cancelled) return;
        const newlyDiscovered = applyServerSuggestions(
          data.suggestions as UserSuggestionRecord[]
        );
        if (newlyDiscovered.length === 1) {
          showIncomingToast(newlyDiscovered[0]);
        } else if (newlyDiscovered.length > 1) {
          toastRef.current({
            title: trRef.current("Nouvelle suggestion reçue"),
            description: `${newlyDiscovered.length} ${trRef.current("Suggestions").toLowerCase()}`,
            variant: "info",
            durationMs: 7000,
            action: {
              label: trRef.current("Ouvrir"),
              onClick: () => routerRef.current.push("/admin?tab=suggestions"),
            },
          });
        }
      } catch {
        // non-fatal
      }
    };

    // Initial hydration
    void fetchLatest();

    // 1) Same-tab instant CustomEvent
    const onLocalEvent = (e: Event) => {
      const custom = e as CustomEvent<UserSuggestionRecord | undefined>;
      if (custom.detail) {
        handleLiveIncoming(custom.detail, true);
      }
    };
    window.addEventListener(SUGGESTIONS_LOCAL_EVENT, onLocalEvent);

    // 2) Same-browser cross-tab BroadcastChannel
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel(SUGGESTIONS_BROADCAST_NAME);
        bc.onmessage = (event: MessageEvent) => {
          const payload = event.data as { suggestion?: UserSuggestionRecord } | undefined;
          if (payload?.suggestion) {
            handleLiveIncoming(payload.suggestion, true);
          }
        };
      }
    } catch {
      // ignore
    }

    // 3) Cross-device real-time via Supabase Realtime (Broadcast + Postgres Changes)
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      ? supabase
          .channel(SUGGESTIONS_REALTIME_CHANNEL, {
            config: { broadcast: { self: true } },
          })
          .on("broadcast", { event: SUGGESTIONS_REALTIME_EVENT }, (msg) => {
            const payload = msg?.payload as { suggestion?: unknown } | undefined;
            if (payload?.suggestion) {
              handleLiveIncoming(payload.suggestion, true);
            } else {
              void fetchLatest();
            }
          })
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "user_suggestions",
            },
            (payload) => {
              if (payload?.new) {
                handleLiveIncoming(payload.new, false);
              } else {
                void fetchLatest();
              }
            }
          )
          .subscribe((status) => {
            if (!cancelled) {
              setSuggestionsLiveConnected(status === "SUBSCRIBED");
            }
          })
      : null;

    // 4) Fast visibility-aware polling + focus refresh (resilient if mobile WS sleeps)
    const pollTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchLatest();
      }
    }, POLL_INTERVAL_MS);

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void fetchLatest();
      }
    };
    window.addEventListener("focus", onVisibilityOrFocus);
    document.addEventListener("visibilitychange", onVisibilityOrFocus);

    return () => {
      cancelled = true;
      setSuggestionsLiveConnected(false);
      window.removeEventListener(SUGGESTIONS_LOCAL_EVENT, onLocalEvent);
      window.removeEventListener("focus", onVisibilityOrFocus);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.clearInterval(pollTimer);
      try {
        bc?.close();
      } catch {
        // ignore
      }
      if (supabase && channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [isCreator]);

  return null;
}
