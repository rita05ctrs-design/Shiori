"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createDefaultActivity,
  createDefaultLibrary,
  createDefaultNotifications,
  createDefaultProfile,
} from "@/data/default-library";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import {
  fetchCloudAniListStats,
  fetchCloudLibrary,
  removeEntryFromCloud,
  syncAniListImportBrowser,
  syncEntryToCloud,
} from "@/lib/supabase/sync";
import { getDisplayTitle, getStatusLabel } from "@/lib/utils";
import {
  applyThemeToDocument,
  DEFAULT_THEME,
  normalizeHex,
  THEME_PRESETS,
  THEME_STORAGE_KEY,
} from "@/lib/theme";
import type {
  ActivityEvent,
  AmbianceSettings,
  AniListConnectionStatus,
  AniListImportResponse,
  AniListSyncEvent,
  AniListUserStatsSnapshot,
  LibraryEntry,
  LibraryStatus,
  MediaItem,
  MediaType,
  NotificationPrefs,
  ShioriNotification,
  ThemeSettings,
  ToastMessage,
  UserProfile,
} from "@/types/media";

const STORAGE_KEYS = {
  library: "shiori_library_v1",
  profile: "shiori_profile_v1",
  notifications: "shiori_notifications_v1",
  activity: "shiori_activity_v1",
  anilistStats: "shiori_anilist_stats_v1",
  ambiance: "shiori_ambiance_v1",
  theme: THEME_STORAGE_KEY,
  anilistAutoSync: "shiori_anilist_autosync_v1",
};

const DEFAULT_ANILIST_CONNECTION: AniListConnectionStatus = {
  configured: false,
  connected: false,
  storage: null,
  redirectUri: "http://localhost:3000/auth/anilist/callback",
  user: null,
  connectedAt: null,
  expiresAt: null,
};

const DEFAULT_AMBIANCE: AmbianceSettings = {
  effect: "sakura",
  density: "balanced",
  speed: "normal",
};

interface ShioriContextValue {
  // Library state
  library: LibraryEntry[];
  hydrated: boolean;
  getEntry: (mediaId: number) => LibraryEntry | undefined;
  upsertEntry: (
    media: MediaItem | LibraryEntry,
    updates: Partial<
      Pick<
        LibraryEntry,
        "status" | "progress" | "score" | "isFavorite" | "notes" | "startedAt" | "completedAt"
      >
    >
  ) => void;
  quickAdd: (media: MediaItem, status?: LibraryStatus) => void;
  incrementProgress: (mediaId: number, delta?: number) => void;
  toggleFavorite: (mediaId: number) => void;
  removeEntry: (mediaId: number) => void;
  importLibraryJson: (jsonText: string) => { ok: boolean; count: number; error?: string };
  exportLibraryJson: () => string;
  resetDemoData: () => void;

  // AniList public username import (animes, mangas & User.statistics)
  anilistStats: AniListUserStatsSnapshot | null;
  importFromAniList: (
    username: string,
    options?: {
      includeAnime?: boolean;
      includeManga?: boolean;
      mode?: "merge" | "replace";
    }
  ) => Promise<{ ok: boolean; data?: AniListImportResponse; error?: string }>;

  // AniList OAuth 2.0 Bidirectional Sync (SaveMediaListEntry, Delete, Favorite)
  anilistConnection: AniListConnectionStatus;
  anilistAutoSync: boolean;
  setAniListAutoSync: (enabled: boolean) => void;
  lastAniListSync: AniListSyncEvent | null;
  refreshAniListStatus: () => Promise<AniListConnectionStatus | null>;
  disconnectAniList: () => Promise<void>;

  // Profile & Auth (Built-in Shiori Server Accounts + Supabase Cloud Ready)
  profile: UserProfile;
  isAuthenticated: boolean;
  supabaseReady: boolean;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updateNotificationPrefs: (prefs: Partial<NotificationPrefs>) => void;
  signInWithSupabase: (email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  signUpWithSupabase: (
    email: string,
    password: string,
    displayName: string,
    options?: { username?: string; keepCurrentLibrary?: boolean }
  ) => Promise<{ ok: boolean; message: string }>;
  signInWithGoogle: () => Promise<{ ok: boolean; message: string }>;
  signOutSupabase: () => Promise<void>;

  // Notifications & Activity
  notifications: ShioriNotification[];
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  pushNotification: (n: Omit<ShioriNotification, "id" | "isRead" | "createdAt">) => void;
  activity: ActivityEvent[];

  // Atmospheric Ambient Effects (Sakura petals, Momiji, Snow, Fireflies, Rain, Stars, None)
  ambiance: AmbianceSettings;
  updateAmbiance: (updates: Partial<AmbianceSettings>) => void;

  // App-Wide Color & Visual Personalization (Presets, Custom Colors, Surfaces, Corners, Glow)
  theme: ThemeSettings;
  updateTheme: (updates: Partial<ThemeSettings>) => void;
  applyThemePreset: (presetId: string, options?: { syncParticles?: boolean }) => void;
  resetTheme: () => void;

  // Modals & UI Overlays
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  authModalOpen: boolean;
  authModalTab: "signin" | "signup";
  setAuthModalOpen: (open: boolean) => void;
  openAuthModal: (tab?: "signin" | "signup") => void;
  editingMedia: MediaItem | LibraryEntry | null;
  openQuickEdit: (media: MediaItem | LibraryEntry) => void;
  closeQuickEdit: () => void;
  trailerVideo: { id: string; title: string } | null;
  openTrailer: (id: string, title: string) => void;
  closeTrailer: () => void;

  // Toasts
  toasts: ToastMessage[];
  toast: (t: Omit<ToastMessage, "id">) => void;
  dismissToast: (id: string) => void;
}

const ShioriContext = createContext<ShioriContextValue | null>(null);

function isLibraryEntry(item: MediaItem | LibraryEntry): item is LibraryEntry {
  return "mediaId" in item;
}

export function ShioriProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [library, setLibrary] = useState<LibraryEntry[]>(() => createDefaultLibrary());
  const [profile, setProfile] = useState<UserProfile>(() => createDefaultProfile());
  const [notifications, setNotifications] = useState<ShioriNotification[]>(() =>
    createDefaultNotifications()
  );
  const [activity, setActivity] = useState<ActivityEvent[]>(() =>
    createDefaultActivity(createDefaultLibrary())
  );
  const [anilistStats, setAnilistStats] = useState<AniListUserStatsSnapshot | null>(null);
  const [anilistConnection, setAnilistConnection] = useState<AniListConnectionStatus>(
    DEFAULT_ANILIST_CONNECTION
  );
  const [anilistAutoSync, setAnilistAutoSyncState] = useState<boolean>(true);
  const [lastAniListSync, setLastAniListSync] = useState<AniListSyncEvent | null>(null);
  const [ambiance, setAmbiance] = useState<AmbianceSettings>(DEFAULT_AMBIANCE);
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);

  // Overlays
  const [commandOpen, setCommandOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"signin" | "signup">("signup");
  const [editingMedia, setEditingMedia] = useState<MediaItem | LibraryEntry | null>(null);
  const [trailerVideo, setTrailerVideo] = useState<{ id: string; title: string } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const supabaseReady = isSupabaseConfigured();
  const isAuthenticated = profile.mode === "account" || profile.mode === "supabase";

  const openAuthModal = useCallback((tab: "signin" | "signup" = "signup") => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  }, []);

  // Toast helper
  const toast = useCallback((t: Omit<ToastMessage, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3400);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const savedLib = localStorage.getItem(STORAGE_KEYS.library);
      if (savedLib) {
        const parsed = JSON.parse(savedLib);
        if (Array.isArray(parsed)) setLibrary(parsed);
      }
      const savedProfile = localStorage.getItem(STORAGE_KEYS.profile);
      if (savedProfile) {
        setProfile((prev) => ({ ...prev, ...JSON.parse(savedProfile) }));
      }
      const savedNotifs = localStorage.getItem(STORAGE_KEYS.notifications);
      if (savedNotifs) {
        const parsed = JSON.parse(savedNotifs);
        if (Array.isArray(parsed)) setNotifications(parsed);
      }
      const savedActivity = localStorage.getItem(STORAGE_KEYS.activity);
      if (savedActivity) {
        const parsed = JSON.parse(savedActivity);
        if (Array.isArray(parsed)) setActivity(parsed);
      }
      const savedAniListStats = localStorage.getItem(STORAGE_KEYS.anilistStats);
      if (savedAniListStats) {
        setAnilistStats(JSON.parse(savedAniListStats));
      }
      const savedAmbiance = localStorage.getItem(STORAGE_KEYS.ambiance);
      if (savedAmbiance) {
        setAmbiance((prev) => ({ ...prev, ...JSON.parse(savedAmbiance) }));
      }
      const savedAutoSync = localStorage.getItem(STORAGE_KEYS.anilistAutoSync);
      if (savedAutoSync !== null) {
        setAnilistAutoSyncState(savedAutoSync !== "false");
      }
      const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
      if (savedTheme) {
        const mergedTheme: ThemeSettings = { ...DEFAULT_THEME, ...JSON.parse(savedTheme) };
        setTheme(mergedTheme);
        applyThemeToDocument(mergedTheme);
      } else {
        applyThemeToDocument(DEFAULT_THEME);
      }
    } catch {
      // ignore corrupted storage
    } finally {
      setHydrated(true);
    }
  }, []);

  // Listen to active Shiori Server Account session OR Supabase session
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const hydrateSupabaseUser = async (user: {
        id: string;
        email?: string;
        user_metadata?: Record<string, unknown>;
      }) => {
        const name =
          (user.user_metadata?.display_name as string) ||
          (user.user_metadata?.full_name as string) ||
          (user.user_metadata?.name as string) ||
          user.email?.split("@")[0] ||
          "Membre Shiori";
        const username =
          (user.user_metadata?.username as string) ||
          name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
        setProfile((prev) => ({
          ...prev,
          id: user.id,
          email: user.email ?? prev.email,
          displayName: name,
          username,
          avatarInitials: name.slice(0, 2).toUpperCase(),
          mode: "supabase",
        }));
        const [cloudLib, cloudStats] = await Promise.all([
          fetchCloudLibrary(user.id),
          fetchCloudAniListStats(user.id),
        ]);
        if (cloudLib && cloudLib.length > 0) {
          setLibrary(cloudLib);
        }
        if (cloudStats) {
          setAnilistStats(cloudStats);
        }
      };

      supabase.auth.getUser().then(({ data }) => {
        if (data.user) void hydrateSupabaseUser(data.user);
      });

      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          void hydrateSupabaseUser(session.user);
        }
      });

      return () => {
        sub.subscription.unsubscribe();
      };
    }

    // Check built-in Shiori server session cookie
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.authenticated && data.user) {
          setProfile(data.user);
          if (Array.isArray(data.library)) setLibrary(data.library);
          if (Array.isArray(data.notifications)) setNotifications(data.notifications);
          if (Array.isArray(data.activity)) setActivity(data.activity);
        }
      })
      .catch(() => {
        // stay in guest mode on network error
      });
  }, []);

  // Automatically sync signed-in Shiori server account changes to disk
  useEffect(() => {
    if (!hydrated || profile.mode !== "account") return;
    const timer = setTimeout(() => {
      fetch("/api/user/sync", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          library,
          notifications,
          activity: activity.slice(0, 40),
          profile: {
            displayName: profile.displayName,
            username: profile.username,
            bio: profile.bio,
            accentColor: profile.accentColor,
            notificationPrefs: profile.notificationPrefs,
          },
        }),
      }).catch(() => {
        // ignore transient errors
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [hydrated, library, notifications, activity, profile]);

  // Persist to localStorage after hydration
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.library, JSON.stringify(library));
    } catch {
      // ignore quota error
    }
  }, [library, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
    } catch {
      // ignore
    }
  }, [profile, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(notifications));
    } catch {
      // ignore
    }
  }, [notifications, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.activity, JSON.stringify(activity.slice(0, 40)));
    } catch {
      // ignore
    }
  }, [activity, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (anilistStats) {
        localStorage.setItem(STORAGE_KEYS.anilistStats, JSON.stringify(anilistStats));
      } else {
        localStorage.removeItem(STORAGE_KEYS.anilistStats);
      }
    } catch {
      // ignore
    }
  }, [anilistStats, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.ambiance, JSON.stringify(ambiance));
    } catch {
      // ignore
    }
  }, [ambiance, hydrated]);

  const updateAmbiance = useCallback((updates: Partial<AmbianceSettings>) => {
    setAmbiance((prev) => ({ ...prev, ...updates }));
  }, []);

  // Apply & persist Theme Personalization live to documentElement
  useEffect(() => {
    if (!hydrated) return;
    applyThemeToDocument(theme);
    try {
      localStorage.setItem(STORAGE_KEYS.theme, JSON.stringify(theme));
    } catch {
      // ignore
    }
  }, [theme, hydrated]);

  const updateTheme = useCallback((updates: Partial<ThemeSettings>) => {
    setTheme((prev) => {
      const nextAccent = updates.accentColor
        ? normalizeHex(updates.accentColor, prev.accentColor)
        : prev.accentColor;
      const nextSecondary = updates.secondaryColor
        ? normalizeHex(updates.secondaryColor, prev.secondaryColor)
        : prev.secondaryColor;
      const isManualColor =
        updates.accentColor !== undefined || updates.secondaryColor !== undefined;
      const next: ThemeSettings = {
        ...prev,
        ...updates,
        accentColor: nextAccent,
        secondaryColor: nextSecondary,
        presetId: updates.presetId ?? (isManualColor ? "custom" : prev.presetId),
      };
      applyThemeToDocument(next);
      return next;
    });
    if (updates.accentColor) {
      const normalized = normalizeHex(updates.accentColor);
      setProfile((prev) =>
        prev.accentColor === normalized ? prev : { ...prev, accentColor: normalized }
      );
    }
  }, []);

  const applyThemePreset = useCallback(
    (presetId: string, options?: { syncParticles?: boolean }) => {
      const preset = THEME_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      const shouldSyncParticles = options?.syncParticles ?? theme.syncParticles;
      setTheme((prev) => {
        const next: ThemeSettings = {
          ...prev,
          presetId: preset.id,
          accentColor: preset.accentColor,
          secondaryColor: preset.secondaryColor,
          surface: preset.surface,
          glow: preset.glow,
        };
        applyThemeToDocument(next);
        return next;
      });
      setProfile((prev) => ({ ...prev, accentColor: preset.accentColor }));
      if (shouldSyncParticles) {
        setAmbiance((prev) => ({ ...prev, effect: preset.suggestedEffect }));
      }
    },
    [theme.syncParticles]
  );

  const resetTheme = useCallback(() => {
    setTheme(DEFAULT_THEME);
    applyThemeToDocument(DEFAULT_THEME);
    setProfile((prev) => ({ ...prev, accentColor: DEFAULT_THEME.accentColor }));
  }, []);

  // AniList OAuth status & bidirectional write-back helpers
  const setAniListAutoSync = useCallback((enabled: boolean) => {
    setAnilistAutoSyncState(enabled);
    try {
      localStorage.setItem(STORAGE_KEYS.anilistAutoSync, String(enabled));
    } catch {
      // ignore
    }
  }, []);

  const refreshAniListStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/anilist/status", { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as AniListConnectionStatus;
      setAnilistConnection(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  // Hydrate AniList OAuth status on mount & whenever auth session mode/id changes
  useEffect(() => {
    void refreshAniListStatus();
  }, [refreshAniListStatus, profile.mode, profile.id]);

  const disconnectAniList = useCallback(async () => {
    try {
      await fetch("/api/auth/anilist/disconnect", { method: "POST" });
    } catch {
      // ignore
    }
    setAnilistConnection((prev) => ({
      ...prev,
      connected: false,
      storage: null,
      user: null,
      connectedAt: null,
      expiresAt: null,
    }));
    setLastAniListSync(null);
    toast({
      title: "Compte AniList dissocié",
      description: "La synchronisation bidirectionnelle vers AniList est arrêtée.",
      variant: "info",
    });
  }, [toast]);

  const pushMutationToAniList = useCallback(
    async (
      payload:
        | { action: "save"; entry: LibraryEntry }
        | { action: "delete"; mediaId: number; title: string }
        | {
            action: "favorite";
            mediaId: number;
            mediaType: MediaType;
            isFavorite: boolean;
            title: string;
          }
    ) => {
      if (!anilistConnection.connected || !anilistAutoSync) return;

      const title = payload.action === "save" ? payload.entry.title : payload.title;
      const body =
        payload.action === "save"
          ? {
              action: "save",
              mediaId: payload.entry.mediaId,
              status: payload.entry.status,
              progress: payload.entry.progress,
              score: payload.entry.score,
              notes: payload.entry.notes,
              startedAt: payload.entry.startedAt,
              completedAt: payload.entry.completedAt,
            }
          : payload.action === "delete"
            ? { action: "delete", mediaId: payload.mediaId }
            : {
                action: "favorite",
                mediaId: payload.mediaId,
                mediaType: payload.mediaType,
                isFavorite: payload.isFavorite,
              };

      try {
        const res = await fetch("/api/anilist/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data?.ok) {
          const errMsg = data?.error || "Échec de la synchronisation AniList.";
          setLastAniListSync({
            ok: false,
            title,
            action: payload.action,
            detail: errMsg,
            at: new Date().toISOString(),
          });
          if (data?.code === "TOKEN_EXPIRED") {
            void refreshAniListStatus();
            toast({
              title: "Session AniList expirée",
              description: "Reconnectez votre compte AniList dans Paramètres pour reprendre la sync.",
              variant: "warning",
            });
          }
          return;
        }

        const detail =
          payload.action === "save"
            ? `${getStatusLabel(payload.entry.status, payload.entry.type)} · ${
                payload.entry.type === "MANGA" ? "Ch." : "Ép."
              } ${payload.entry.progress}${
                payload.entry.score ? ` · ★ ${payload.entry.score}` : ""
              }`
            : payload.action === "delete"
              ? "Retiré de la liste AniList"
              : payload.isFavorite
                ? "Ajouté aux favoris AniList"
                : "Retiré des favoris AniList";

        setLastAniListSync({
          ok: true,
          title,
          action: payload.action,
          detail,
          at: new Date().toISOString(),
        });
      } catch {
        setLastAniListSync({
          ok: false,
          title,
          action: payload.action,
          detail: "Erreur réseau lors de l'envoi vers AniList.",
          at: new Date().toISOString(),
        });
      }
    },
    [anilistConnection.connected, anilistAutoSync, refreshAniListStatus, toast]
  );

  // Global keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const addActivity = useCallback(
    (entry: Pick<LibraryEntry, "mediaId" | "title" | "type" | "coverImage">, action: string) => {
      const evt: ActivityEvent = {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        mediaId: entry.mediaId,
        mediaTitle: entry.title,
        mediaType: entry.type,
        coverImage: entry.coverImage,
        action,
        createdAt: new Date().toISOString(),
      };
      setActivity((prev) => [evt, ...prev].slice(0, 40));
    },
    []
  );

  const pushNotification = useCallback(
    (n: Omit<ShioriNotification, "id" | "isRead" | "createdAt">) => {
      const notif: ShioriNotification = {
        ...n,
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [notif, ...prev].slice(0, 30));
    },
    []
  );

  const getEntry = useCallback(
    (mediaId: number) => library.find((e) => e.mediaId === mediaId),
    [library]
  );

  const upsertEntry = useCallback(
    (
      media: MediaItem | LibraryEntry,
      updates: Partial<
        Pick<
          LibraryEntry,
          "status" | "progress" | "score" | "isFavorite" | "notes" | "startedAt" | "completedAt"
        >
      >
    ) => {
      const mediaId = isLibraryEntry(media) ? media.mediaId : media.id;
      const existing = library.find((e) => e.mediaId === mediaId);

      const base: LibraryEntry = existing
        ? { ...existing }
        : isLibraryEntry(media)
          ? { ...media }
          : {
              mediaId: media.id,
              type: media.type,
              title: getDisplayTitle(media),
              nativeTitle: media.title.native,
              coverImage: media.coverImage.extraLarge,
              bannerImage: media.bannerImage,
              totalUnits: media.type === "MANGA" ? media.chapters : media.episodes,
              duration: media.duration,
              genres: media.genres,
              studio: media.studio,
              format: media.format,
              seasonYear: media.seasonYear ?? media.startYear,
              averageScore: media.averageScore,
              status: "WATCHING",
              progress: 0,
              score: null,
              isFavorite: false,
              notes: "",
              updatedAt: new Date().toISOString(),
            };

      const nextStatus = updates.status ?? base.status;
      let nextProgress = updates.progress ?? base.progress;
      if (nextProgress < 0) nextProgress = 0;
      if (base.totalUnits && nextProgress > base.totalUnits) {
        nextProgress = base.totalUnits;
      }
      if (nextStatus === "COMPLETED" && base.totalUnits && updates.progress === undefined) {
        nextProgress = base.totalUnits;
      }

      const merged: LibraryEntry = {
        ...base,
        ...updates,
        status: nextStatus,
        progress: nextProgress,
        updatedAt: new Date().toISOString(),
        completedAt:
          nextStatus === "COMPLETED"
            ? updates.completedAt ?? base.completedAt ?? new Date().toISOString().slice(0, 10)
            : base.completedAt,
      };

      setLibrary((prev) => {
        const idx = prev.findIndex((e) => e.mediaId === mediaId);
        if (idx === -1) return [merged, ...prev];
        const copy = [...prev];
        copy[idx] = merged;
        return copy;
      });

      const unitLabel = merged.type === "MANGA" ? "Ch." : "Ép.";
      addActivity(
        merged,
        existing
          ? `${getStatusLabel(merged.status, merged.type)} · ${unitLabel} ${merged.progress}${merged.score ? ` · ★ ${merged.score}` : ""}`
          : `Ajouté dans ${getStatusLabel(merged.status, merged.type)}`
      );

      if (merged.status === "COMPLETED" && existing?.status !== "COMPLETED" && profile.notificationPrefs.milestones) {
        pushNotification({
          kind: "MILESTONE",
          title: `${merged.title} terminé !`,
          body: merged.score
            ? `Enregistré dans Completed avec la note de ${merged.score}/10.`
            : "Enregistré dans votre collection Completed.",
          mediaId: merged.mediaId,
          coverImage: merged.coverImage,
        });
      }

      if (profile.mode === "supabase") {
        void syncEntryToCloud(profile.id, merged);
      }

      // Bidirectional AniList OAuth Sync (SaveMediaListEntry + optional favorite sync)
      void pushMutationToAniList({ action: "save", entry: merged });
      if (updates.isFavorite !== undefined && updates.isFavorite !== existing?.isFavorite) {
        void pushMutationToAniList({
          action: "favorite",
          mediaId: merged.mediaId,
          mediaType: merged.type,
          isFavorite: merged.isFavorite,
          title: merged.title,
        });
      }

      toast({
        title: existing ? "Bibliothèque mise à jour" : "Ajouté à votre bibliothèque",
        description: `${merged.title} · ${getStatusLabel(merged.status, merged.type)}`,
        variant: "success",
        coverImage: merged.coverImage,
        status: merged.status,
        mediaId: merged.mediaId,
        celebrate: !existing || merged.status === "COMPLETED",
      });
    },
    [library, addActivity, pushNotification, profile, pushMutationToAniList, toast]
  );

  const quickAdd = useCallback(
    (media: MediaItem, status: LibraryStatus = "WATCHING") => {
      upsertEntry(media, { status });
    },
    [upsertEntry]
  );

  const incrementProgress = useCallback(
    (mediaId: number, delta = 1) => {
      const existing = library.find((e) => e.mediaId === mediaId);
      if (!existing) return;

      const nextProg = Math.max(
        0,
        existing.totalUnits
          ? Math.min(existing.totalUnits, existing.progress + delta)
          : existing.progress + delta
      );
      if (nextProg === existing.progress) return;

      const reachedEnd = Boolean(existing.totalUnits && nextProg >= existing.totalUnits);
      const nextStatus: LibraryStatus = reachedEnd
        ? "COMPLETED"
        : existing.status === "PLAN_TO_WATCH" && nextProg > 0
          ? "WATCHING"
          : existing.status;

      const updated: LibraryEntry = {
        ...existing,
        progress: nextProg,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
        completedAt: reachedEnd ? new Date().toISOString().slice(0, 10) : existing.completedAt,
      };

      setLibrary((prev) => prev.map((e) => (e.mediaId === mediaId ? updated : e)));

      const unit = existing.type === "MANGA" ? "Chapitre" : "Épisode";
      addActivity(
        updated,
        reachedEnd
          ? `A terminé ${existing.title} (${unit} ${nextProg})`
          : `${unit} ${nextProg}${existing.totalUnits ? ` / ${existing.totalUnits}` : ""}`
      );

      if (reachedEnd && profile.notificationPrefs.milestones) {
        pushNotification({
          kind: "MILESTONE",
          title: `Série terminée : ${existing.title}`,
          body: `Tous les ${existing.type === "MANGA" ? "chapitres" : "épisodes"} ont été complétés !`,
          mediaId: existing.mediaId,
          coverImage: existing.coverImage,
        });
      }

      if (profile.mode === "supabase") {
        void syncEntryToCloud(profile.id, updated);
      }

      // Bidirectional AniList OAuth Sync (SaveMediaListEntry)
      void pushMutationToAniList({ action: "save", entry: updated });

      toast({
        title: reachedEnd ? "Série terminée !" : `+${delta} ${unit.toLowerCase()}`,
        description: `${existing.title} · ${unit} ${nextProg}${existing.totalUnits ? `/${existing.totalUnits}` : ""}`,
        variant: reachedEnd ? "success" : "info",
        coverImage: existing.coverImage,
        status: updated.status,
        mediaId: existing.mediaId,
        celebrate: reachedEnd,
      });
    },
    [library, addActivity, pushNotification, profile, pushMutationToAniList, toast]
  );

  const toggleFavorite = useCallback(
    (mediaId: number) => {
      const existing = library.find((e) => e.mediaId === mediaId);
      if (!existing) return;
      const updated: LibraryEntry = {
        ...existing,
        isFavorite: !existing.isFavorite,
        updatedAt: new Date().toISOString(),
      };
      setLibrary((prev) => prev.map((e) => (e.mediaId === mediaId ? updated : e)));
      if (profile.mode === "supabase") {
        void syncEntryToCloud(profile.id, updated);
      }
      void pushMutationToAniList({
        action: "favorite",
        mediaId: existing.mediaId,
        mediaType: existing.type,
        isFavorite: updated.isFavorite,
        title: existing.title,
      });
      toast({
        title: updated.isFavorite ? "Ajouté aux coups de cœur" : "Retiré des coups de cœur",
        description: existing.title,
        coverImage: existing.coverImage,
        mediaId: existing.mediaId,
        celebrate: updated.isFavorite,
      });
    },
    [library, profile, pushMutationToAniList, toast]
  );

  const removeEntry = useCallback(
    (mediaId: number) => {
      const existing = library.find((e) => e.mediaId === mediaId);
      setLibrary((prev) => prev.filter((e) => e.mediaId !== mediaId));
      if (profile.mode === "supabase") {
        void removeEntryFromCloud(profile.id, mediaId);
      }
      void pushMutationToAniList({
        action: "delete",
        mediaId,
        title: existing?.title ?? `Média #${mediaId}`,
      });
      if (existing) {
        toast({
          title: "Retiré de la bibliothèque",
          description: existing.title,
          variant: "warning",
        });
      }
    },
    [library, profile, pushMutationToAniList, toast]
  );

  const exportLibraryJson = useCallback(() => {
    return JSON.stringify(
      {
        app: "Shiori",
        version: 1,
        exportedAt: new Date().toISOString(),
        profile: { username: profile.username, displayName: profile.displayName },
        entries: library,
      },
      null,
      2
    );
  }, [library, profile]);

  const importLibraryJson = useCallback(
    (jsonText: string) => {
      try {
        const parsed = JSON.parse(jsonText);
        const entries: LibraryEntry[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.entries)
            ? parsed.entries
            : [];
        if (!entries.length) {
          return { ok: false, count: 0, error: "Aucune entrée valide trouvée dans le fichier JSON." };
        }
        setLibrary(entries);
        toast({
          title: "Bibliothèque importée",
          description: `${entries.length} titres chargés avec succès.`,
          variant: "success",
        });
        return { ok: true, count: entries.length };
      } catch {
        return { ok: false, count: 0, error: "Format JSON invalide." };
      }
    },
    [toast]
  );

  const resetDemoData = useCallback(() => {
    const defLib = createDefaultLibrary();
    setLibrary(defLib);
    setNotifications(createDefaultNotifications());
    setActivity(createDefaultActivity(defLib));
    setAnilistStats(null);
    toast({
      title: "Données de démonstration restaurées",
      description: `${defLib.length} animés et mangas réinitialisés.`,
      variant: "info",
    });
  }, [toast]);

  const importFromAniList = useCallback(
    async (
      username: string,
      options?: {
        includeAnime?: boolean;
        includeManga?: boolean;
        mode?: "merge" | "replace";
      }
    ): Promise<{ ok: boolean; data?: AniListImportResponse; error?: string }> => {
      const mode = options?.mode ?? "merge";
      try {
        const res = await fetch("/api/anilist/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            includeAnime: options?.includeAnime ?? true,
            includeManga: options?.includeManga ?? true,
            mode,
          }),
        });
        const payload = await res.json();
        if (!res.ok) {
          return {
            ok: false,
            error: payload.error || "Erreur lors de l'importation AniList.",
          };
        }

        const data = payload as AniListImportResponse;

        // If server cookie wasn't present but browser Supabase client IS signed in, persist from client
        let finalSupabaseSync = data.supabaseSync;
        if (!finalSupabaseSync.authenticated) {
          const browserSync = await syncAniListImportBrowser(
            data.entries,
            data.statistics,
            mode
          );
          if (browserSync.authenticated) {
            finalSupabaseSync = browserSync;
          }
        }

        const mergedResponse: AniListImportResponse = {
          ...data,
          supabaseSync: finalSupabaseSync,
        };

        // Update Shiori library (merge or replace)
        setLibrary((prev) => {
          if (mode === "replace") {
            return data.entries;
          }
          const map = new Map<number, LibraryEntry>();
          for (const e of prev) map.set(e.mediaId, e);
          for (const e of data.entries) map.set(e.mediaId, e);
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });

        setAnilistStats(data.statistics);

        pushNotification({
          kind: "SYSTEM",
          title: `Import AniList réussi (@${data.user.name})`,
          body: `${data.counts.anime} animes, ${data.counts.manga} mangas et vos statistiques ont été importés.`,
          coverImage: data.entries[0]?.coverImage,
        });

        toast({
          title: `Profil @${data.user.name} importé !`,
          description: `${data.counts.anime} animes · ${data.counts.manga} mangas${
            finalSupabaseSync.authenticated && finalSupabaseSync.statsSaved
              ? " · Sauvegardé dans Supabase"
              : ""
          }`,
          variant: "success",
          coverImage: data.entries[0]?.coverImage,
          celebrate: true,
        });

        return { ok: true, data: mergedResponse };
      } catch {
        return {
          ok: false,
          error: "Impossible de joindre l'API AniList. Vérifiez votre connexion internet.",
        };
      }
    },
    [pushNotification, toast]
  );

  const updateProfile = useCallback(
    (updates: Partial<UserProfile>) => {
      setProfile((prev) => {
        const next = { ...prev, ...updates };
        if (updates.displayName) {
          next.avatarInitials = updates.displayName.trim().slice(0, 2).toUpperCase() || "SH";
        }
        return next;
      });
      toast({
        title: "Profil enregistré",
        variant: "success",
      });
    },
    [toast]
  );

  const updateNotificationPrefs = useCallback(
    (prefs: Partial<NotificationPrefs>) => {
      setProfile((prev) => ({
        ...prev,
        notificationPrefs: { ...prev.notificationPrefs, ...prefs },
      }));
      toast({
        title: "Préférences de notifications mises à jour",
      });
    },
    [toast]
  );

  const signInWithSupabase = useCallback(
    async (email: string, password: string) => {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.user) {
          return { ok: false, message: error?.message || "Échec de la connexion." };
        }
        const name =
          (data.user.user_metadata?.display_name as string) || email.split("@")[0];
        setProfile((prev) => ({
          ...prev,
          id: data.user.id,
          email,
          displayName: name,
          avatarInitials: name.slice(0, 2).toUpperCase(),
          mode: "supabase",
        }));
        const cloudLib = await fetchCloudLibrary(data.user.id);
        if (cloudLib && cloudLib.length > 0) setLibrary(cloudLib);
        toast({
          title: "Connecté via Supabase",
          description: `Bienvenue, ${name}`,
          variant: "success",
          celebrate: true,
        });
        return { ok: true, message: "Connexion réussie !" };
      }

      // Built-in Shiori Server Auth
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, message: data.error || "Identifiants incorrects." };
      }

      setProfile(data.user);
      if (Array.isArray(data.library)) setLibrary(data.library);
      if (Array.isArray(data.notifications)) setNotifications(data.notifications);
      if (Array.isArray(data.activity)) setActivity(data.activity);

      toast({
        title: `Bon retour, ${data.user.displayName} !`,
        description: `Session synchronisée (@${data.user.username})`,
        variant: "success",
        celebrate: true,
      });
      return { ok: true, message: "Connexion réussie !" };
    },
    [toast]
  );

  const signUpWithSupabase = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
      options?: { username?: string; keepCurrentLibrary?: boolean }
    ) => {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const username =
          options?.username || displayName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              display_name: displayName,
              username,
            },
          },
        });
        if (error) {
          return { ok: false, message: error.message };
        }

        // If email confirmation is disabled on the Supabase project, session is live right away
        if (data.session && data.user) {
          const keepLib = options?.keepCurrentLibrary ?? true;
          const nextLib = keepLib ? library : [];
          setProfile((prev) => ({
            ...prev,
            id: data.user!.id,
            email,
            displayName,
            username,
            avatarInitials: displayName.slice(0, 2).toUpperCase(),
            mode: "supabase",
          }));
          setLibrary(nextLib);
          if (keepLib && nextLib.length > 0) {
            for (const entry of nextLib) {
              void syncEntryToCloud(data.user.id, entry);
            }
          }
          toast({
            title: `Bienvenue sur Shiori, ${displayName} !`,
            description: "Compte Supabase créé et connecté.",
            variant: "success",
            celebrate: true,
          });
          return { ok: true, message: "Compte créé et connecté !" };
        }

        toast({
          title: "Compte Supabase créé",
          description: "Vérifiez votre boîte e-mail pour confirmer votre inscription.",
          variant: "success",
          celebrate: true,
        });
        return { ok: true, message: "Vérifiez votre e-mail de confirmation." };
      }

      // Built-in Shiori Server Registration (active immediately!)
      const keepLib = options?.keepCurrentLibrary ?? true;
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          displayName,
          username: options?.username,
          initialLibrary: keepLib ? library : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, message: data.error || "Impossible de créer le compte." };
      }

      setProfile(data.user);
      setLibrary(Array.isArray(data.library) ? data.library : []);
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setActivity(Array.isArray(data.activity) ? data.activity : []);

      toast({
        title: `Bienvenue sur Shiori, ${data.user.displayName} !`,
        description: `Compte @${data.user.username} créé et activé.`,
        variant: "success",
        celebrate: true,
      });
      return { ok: true, message: `Compte @${data.user.username} créé avec succès !` };
    },
    [library, toast]
  );

  const signInWithGoogle = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return {
        ok: false,
        message:
          "Google OAuth utilise Supabase : renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local puis activez le fournisseur Google dans votre tableau de bord Supabase.",
      };
    }

    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, message: "Redirection vers Google en cours..." };
  }, []);

  const signOutSupabase = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    } else {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    }
    const defLib = createDefaultLibrary();
    setProfile(createDefaultProfile());
    setLibrary(defLib);
    setNotifications(createDefaultNotifications());
    setActivity(createDefaultActivity(defLib));
    toast({ title: "Déconnecté", description: "Vous êtes repassé en session invité." });
  }, [toast]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const value: ShioriContextValue = {
    library,
    hydrated,
    getEntry,
    upsertEntry,
    quickAdd,
    incrementProgress,
    toggleFavorite,
    removeEntry,
    importLibraryJson,
    exportLibraryJson,
    resetDemoData,
    anilistStats,
    importFromAniList,
    anilistConnection,
    anilistAutoSync,
    setAniListAutoSync,
    lastAniListSync,
    refreshAniListStatus,
    disconnectAniList,
    profile,
    isAuthenticated,
    supabaseReady,
    updateProfile,
    updateNotificationPrefs,
    signInWithSupabase,
    signUpWithSupabase,
    signInWithGoogle,
    signOutSupabase,
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    pushNotification,
    activity,
    ambiance,
    updateAmbiance,
    theme,
    updateTheme,
    applyThemePreset,
    resetTheme,
    commandOpen,
    setCommandOpen,
    authModalOpen,
    authModalTab,
    setAuthModalOpen,
    openAuthModal,
    editingMedia,
    openQuickEdit: (media) => setEditingMedia(media),
    closeQuickEdit: () => setEditingMedia(null),
    trailerVideo,
    openTrailer: (id, title) => setTrailerVideo({ id, title }),
    closeTrailer: () => setTrailerVideo(null),
    toasts,
    toast,
    dismissToast,
  };

  return <ShioriContext.Provider value={value}>{children}</ShioriContext.Provider>;
}

export function useShiori() {
  const ctx = useContext(ShioriContext);
  if (!ctx) throw new Error("useShiori must be used within a ShioriProvider");
  return ctx;
}
