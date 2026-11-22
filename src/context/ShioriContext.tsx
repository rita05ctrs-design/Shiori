"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  backfillCloudActivities,
  ensureSupabaseProfile,
  fetchCloudAniListStats,
  fetchCloudLibrary,
  fetchCloudUserBadges,
  removeEntryFromCloud,
  syncAniListImportBrowser,
  syncEntryToCloud,
  syncPublicProfileToCloud,
  syncUserBadgesToCloud,
  uploadProfileAvatar,
  type ActivityBackfillItem,
} from "@/lib/supabase/sync";
import {
  evaluateAllBadges,
  extractBadgeMetrics,
  isRareBadge,
  RARITY_RANK,
} from "@/lib/badges";
import { getDisplayTitle, getStatusLabel } from "@/lib/utils";
import {
  applyThemeToDocument,
  DEFAULT_THEME,
  normalizeHex,
  THEME_PRESETS,
  THEME_STORAGE_KEY,
} from "@/lib/theme";
import {
  CONTENT_LANGUAGE_MAP,
  DEFAULT_CONTENT_LANGUAGE,
  normalizeContentLanguage,
} from "@/lib/i18n";
import type {
  ActivityEvent,
  AmbianceSettings,
  AniListConnectionStatus,
  AniListImportResponse,
  AniListSyncEvent,
  AniListUserStatsSnapshot,
  BadgeRarity,
  CommunityActivityKind,
  ContentLanguage,
  EvaluatedBadge,
  FavoriteVoiceActor,
  FriendRelationState,
  FriendRequestWithProfile,
  LibraryEntry,
  LibraryStatus,
  MediaItem,
  MediaType,
  NotificationPrefs,
  PublicProfileLibraryItem,
  PublicUserProfile,
  ShioriNotification,
  ThemeSettings,
  ToastMessage,
  UnlockedBadgeRecord,
  UserProfile,
} from "@/types/media";

const STORAGE_KEYS = {
  library: "shiori_library_v1",
  profile: "shiori_profile_v1",
  notifications: "shiori_notifications_v1",
  readNotifs: "shiori_read_notifs_v1",
  dismissedNotifs: "shiori_dismissed_notifs_v1",
  activity: "shiori_activity_v1",
  anilistStats: "shiori_anilist_stats_v1",
  ambiance: "shiori_ambiance_v1",
  theme: THEME_STORAGE_KEY,
  contentLanguage: "shiori_content_lang_v1",
  anilistAutoSync: "shiori_anilist_autosync_v1",
  favoriteStaff: "shiori_favorite_staff_v1",
  favoriteOrder: "shiori_favorite_order_v1",
  badges: "shiori_badges_v1",
  pinnedBadges: "shiori_pinned_badges_v1",
  socialCount: "shiori_social_count_v1",
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
  uploadAvatar: (file: File) => Promise<{ ok: boolean; url?: string; storage?: string; error?: string }>;
  updateNotificationPrefs: (prefs: Partial<NotificationPrefs>) => void;

  // Favorite Voice Actors (Seiyuu), Ordered Favorites (#1 -> N) & Friends / Social / DM
  favoriteStaff: FavoriteVoiceActor[];
  toggleFavoriteStaff: (staff: FavoriteVoiceActor) => void;
  favoriteOrder: number[];
  orderedFavorites: LibraryEntry[];
  reorderFavorites: (nextOrderedIds: number[], scopeType?: "ALL" | MediaType) => void;
  moveFavorite: (
    mediaId: number,
    direction: "up" | "down" | "top" | "bottom",
    scopeType?: "ALL" | MediaType
  ) => void;
  setFavoriteRank: (
    mediaId: number,
    rank1Based: number,
    scopeType?: "ALL" | MediaType
  ) => void;
  friends: PublicUserProfile[];
  incomingFriendRequests: FriendRequestWithProfile[];
  outgoingFriendRequests: FriendRequestWithProfile[];
  refreshFriendships: () => Promise<void>;
  getFriendRelation: (targetUserId: string, targetUsername: string) => FriendRelationState;
  addFriend: (target: {
    id?: string;
    username: string;
    displayName?: string;
    avatarUrl?: string | null;
  }) => Promise<{ ok: boolean; status?: string; error?: string; message?: string }>;
  acceptFriend: (target: { id?: string; username: string; displayName?: string }) => Promise<void>;
  removeFriend: (target: { id?: string; username: string; displayName?: string }) => Promise<void>;
  unreadMessagesCount: number;
  refreshUnreadMessages: () => Promise<number>;

  // Gamification — Badges & Trophies
  unlockedBadges: UnlockedBadgeRecord[];
  pinnedBadges: string[];
  evaluatedBadges: EvaluatedBadge[];
  socialInteractionsCount: number;
  badgeUnlockQueue: EvaluatedBadge[];
  dismissBadgeUnlock: () => void;
  previewBadgeUnlock: (badgeId: string) => void;
  togglePinBadge: (badgeId: string) => void;
  recordSocialInteraction: () => void;
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
  refreshNotifications: () => Promise<void>;
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

  // Synopsis Content Language (FR Auto default, EN Original, ES Auto, IT Auto)
  contentLanguage: ContentLanguage;
  setContentLanguage: (lang: ContentLanguage, options?: { silent?: boolean }) => void;

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
  const [socialNotifications, setSocialNotifications] = useState<ShioriNotification[]>([]);
  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);
  const [dismissedNotifIds, setDismissedNotifIds] = useState<string[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>(() =>
    createDefaultActivity(createDefaultLibrary())
  );
  const [anilistStats, setAnilistStats] = useState<AniListUserStatsSnapshot | null>(null);
  const [anilistConnection, setAnilistConnection] = useState<AniListConnectionStatus>(
    DEFAULT_ANILIST_CONNECTION
  );
  const [anilistAutoSync, setAnilistAutoSyncState] = useState<boolean>(true);
  const [lastAniListSync, setLastAniListSync] = useState<AniListSyncEvent | null>(null);
  const [favoriteStaff, setFavoriteStaff] = useState<FavoriteVoiceActor[]>([]);
  const [favoriteOrder, setFavoriteOrder] = useState<number[]>([]);
  const [friends, setFriends] = useState<PublicUserProfile[]>([]);
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<FriendRequestWithProfile[]>(
    []
  );
  const [outgoingFriendRequests, setOutgoingFriendRequests] = useState<FriendRequestWithProfile[]>(
    []
  );
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [unlockedBadges, setUnlockedBadges] = useState<UnlockedBadgeRecord[]>([]);
  const [pinnedBadges, setPinnedBadges] = useState<string[]>([]);
  const [socialInteractionsCount, setSocialInteractionsCount] = useState<number>(0);
  const [badgeUnlockQueue, setBadgeUnlockQueue] = useState<EvaluatedBadge[]>([]);
  const hasStoredBadgesRef = useRef(false);
  const initialBadgeEvalDoneRef = useRef(false);
  const publishedRareBadgesRef = useRef<Set<string>>(new Set());
  const backfilledActivityKeyRef = useRef<string | null>(null);
  const [ambiance, setAmbiance] = useState<AmbianceSettings>(DEFAULT_AMBIANCE);
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const [contentLanguage, setContentLanguageState] = useState<ContentLanguage>(
    DEFAULT_CONTENT_LANGUAGE
  );

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
        const parsedProfile = JSON.parse(savedProfile);
        setProfile((prev) => ({ ...prev, ...parsedProfile }));
        if (parsedProfile?.preferredLanguage) {
          setContentLanguageState(normalizeContentLanguage(parsedProfile.preferredLanguage));
        }
      }
      const savedLang = localStorage.getItem(STORAGE_KEYS.contentLanguage);
      if (savedLang) {
        setContentLanguageState(normalizeContentLanguage(savedLang));
      }
      const savedNotifs = localStorage.getItem(STORAGE_KEYS.notifications);
      if (savedNotifs) {
        const parsed = JSON.parse(savedNotifs);
        if (Array.isArray(parsed)) setNotifications(parsed);
      }
      const savedReadNotifs = localStorage.getItem(STORAGE_KEYS.readNotifs);
      if (savedReadNotifs) {
        const parsed = JSON.parse(savedReadNotifs);
        if (Array.isArray(parsed)) setReadNotifIds(parsed.map(String));
      }
      const savedDismissedNotifs = localStorage.getItem(STORAGE_KEYS.dismissedNotifs);
      if (savedDismissedNotifs) {
        const parsed = JSON.parse(savedDismissedNotifs);
        if (Array.isArray(parsed)) setDismissedNotifIds(parsed.map(String));
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
      const savedStaff = localStorage.getItem(STORAGE_KEYS.favoriteStaff);
      if (savedStaff) {
        const parsed = JSON.parse(savedStaff);
        if (Array.isArray(parsed)) setFavoriteStaff(parsed);
      }
      const savedFavOrder = localStorage.getItem(STORAGE_KEYS.favoriteOrder);
      if (savedFavOrder) {
        const parsed = JSON.parse(savedFavOrder);
        if (Array.isArray(parsed)) {
          setFavoriteOrder(
            parsed.map((x) => Number(x)).filter((n) => Number.isFinite(n))
          );
        }
      }
      const savedBadges = localStorage.getItem(STORAGE_KEYS.badges);
      if (savedBadges !== null) {
        hasStoredBadgesRef.current = true;
        const parsed = JSON.parse(savedBadges);
        if (Array.isArray(parsed)) setUnlockedBadges(parsed);
      }
      const savedPinned = localStorage.getItem(STORAGE_KEYS.pinnedBadges);
      if (savedPinned) {
        const parsed = JSON.parse(savedPinned);
        if (Array.isArray(parsed)) setPinnedBadges(parsed.slice(0, 3));
      }
      const savedSocialCount = localStorage.getItem(STORAGE_KEYS.socialCount);
      if (savedSocialCount !== null) {
        const n = Number(savedSocialCount);
        if (Number.isFinite(n) && n >= 0) setSocialInteractionsCount(Math.floor(n));
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
        const fallbackName =
          (user.user_metadata?.display_name as string) ||
          (user.user_metadata?.full_name as string) ||
          (user.user_metadata?.name as string) ||
          user.email?.split("@")[0] ||
          "Membre Shiori";
        const fallbackUsername =
          ((user.user_metadata?.username as string) || fallbackName)
            .toLowerCase()
            .replace(/[^a-z0-9_]+/g, "_")
            .replace(/^_+|_+$/g, "") || `user_${user.id.slice(0, 6)}`;

        // 1) Guarantee user immediately has a row in `public.profiles` (& `public_profiles`)!
        const ensured = await ensureSupabaseProfile(supabase, user);
        const cloudProf = ensured.profile;

        const finalDisplayName = cloudProf?.displayName || fallbackName;
        const finalUsername = cloudProf?.username || fallbackUsername;

        setProfile((prev) => ({
          ...prev,
          id: user.id,
          email: user.email ?? prev.email,
          displayName: finalDisplayName,
          username: finalUsername,
          bio: cloudProf?.bio !== undefined ? cloudProf.bio : prev.bio,
          avatarUrl:
            cloudProf?.avatarUrl !== undefined
              ? cloudProf.avatarUrl
              : (user.user_metadata?.avatar_url as string) ?? prev.avatarUrl ?? null,
          accentColor: cloudProf?.accentColor || prev.accentColor,
          isActivityPublic:
            cloudProf?.isActivityPublic !== undefined
              ? cloudProf.isActivityPublic
              : prev.isActivityPublic ?? true,
          preferredLanguage:
            cloudProf?.preferredLanguage ?? prev.preferredLanguage ?? DEFAULT_CONTENT_LANGUAGE,
          joinedAt: cloudProf?.joinedAt || prev.joinedAt,
          avatarInitials: finalDisplayName.slice(0, 2).toUpperCase(),
          mode: "supabase",
        }));

        if (cloudProf?.preferredLanguage) {
          setContentLanguageState(cloudProf.preferredLanguage);
          try {
            localStorage.setItem(STORAGE_KEYS.contentLanguage, cloudProf.preferredLanguage);
          } catch {
            // ignore
          }
        }

        if (cloudProf?.favoriteStaff && cloudProf.favoriteStaff.length > 0) {
          setFavoriteStaff(cloudProf.favoriteStaff);
        }

        const [cloudLib, cloudStats, cloudBadges] = await Promise.all([
          fetchCloudLibrary(user.id),
          fetchCloudAniListStats(user.id),
          fetchCloudUserBadges(user.id),
        ]);
        if (cloudLib && cloudLib.length > 0) {
          setLibrary(cloudLib);
        }
        if (cloudStats) {
          setAnilistStats(cloudStats);
        }
        if (cloudBadges) {
          if (cloudBadges.unlockedBadges.length > 0) {
            hasStoredBadgesRef.current = true;
            setUnlockedBadges((prev) => {
              const map = new Map<string, string>();
              for (const b of prev) map.set(b.badgeId, b.unlockedAt);
              for (const b of cloudBadges.unlockedBadges) {
                if (!map.has(b.badgeId)) map.set(b.badgeId, b.unlockedAt);
              }
              return Array.from(map.entries()).map(([badgeId, unlockedAt]) => ({
                badgeId,
                unlockedAt,
              }));
            });
          }
          if (cloudBadges.pinnedBadges.length > 0) {
            setPinnedBadges(cloudBadges.pinnedBadges.slice(0, 3));
          }
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
          if (Array.isArray(data.favoriteStaff)) setFavoriteStaff(data.favoriteStaff);
          if (Array.isArray(data.favoriteOrder)) setFavoriteOrder(data.favoriteOrder);
          if (Array.isArray(data.unlockedBadges) && data.unlockedBadges.length > 0) {
            hasStoredBadgesRef.current = true;
            setUnlockedBadges(data.unlockedBadges);
          }
          if (Array.isArray(data.pinnedBadges) && data.pinnedBadges.length > 0) {
            setPinnedBadges(data.pinnedBadges.slice(0, 3));
          }
          if (typeof data.socialInteractionsCount === "number") {
            setSocialInteractionsCount(data.socialInteractionsCount);
          }
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
            avatarUrl: profile.avatarUrl ?? null,
            isActivityPublic: profile.isActivityPublic ?? true,
            preferredLanguage: contentLanguage,
            notificationPrefs: profile.notificationPrefs,
          },
          favoriteStaff,
          favoriteOrder,
          unlockedBadges,
          pinnedBadges,
          socialInteractionsCount,
        }),
      }).catch(() => {
        // ignore transient errors
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [
    hydrated,
    library,
    notifications,
    activity,
    profile,
    favoriteStaff,
    favoriteOrder,
    unlockedBadges,
    pinnedBadges,
    socialInteractionsCount,
  ]);

  // Persist favoriteStaff & favoriteOrder to localStorage
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.favoriteStaff, JSON.stringify(favoriteStaff));
    } catch {
      // ignore
    }
  }, [favoriteStaff, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.favoriteOrder, JSON.stringify(favoriteOrder));
    } catch {
      // ignore
    }
  }, [favoriteOrder, hydrated]);

  // Compute user's favorites ordered cleanly from #1 -> last according to favoriteOrder
  const orderedFavorites = useMemo(() => {
    const favs = library.filter((e) => e.isFavorite);
    if (favs.length <= 1) return favs;
    const rankMap = new Map<number, number>();
    favoriteOrder.forEach((id, idx) => {
      if (!rankMap.has(id)) rankMap.set(id, idx);
    });
    return [...favs].sort((a, b) => {
      const ra = rankMap.get(a.mediaId);
      const rb = rankMap.get(b.mediaId);
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra !== undefined) return -1;
      if (rb !== undefined) return 1;
      return (b.score ?? -1) - (a.score ?? -1);
    });
  }, [library, favoriteOrder]);

  const reorderFavorites = useCallback(
    (nextOrderedIds: number[], scopeType: "ALL" | MediaType = "ALL") => {
      const currentFullIds = orderedFavorites.map((e) => e.mediaId);
      if (scopeType === "ALL") {
        const seen = new Set(nextOrderedIds);
        const merged = [
          ...nextOrderedIds,
          ...currentFullIds.filter((id) => !seen.has(id)),
        ];
        setFavoriteOrder(merged);
        return;
      }

      // Preserve relative slots of other mediaType items while replacing the scoped subset slots!
      const scopedSet = new Set(
        orderedFavorites.filter((e) => e.type === scopeType).map((e) => e.mediaId)
      );
      const queue = [...nextOrderedIds];
      const nextFull = currentFullIds.map((id) => {
        if (!scopedSet.has(id)) return id;
        return queue.shift() ?? id;
      });
      for (const rem of queue) {
        if (!nextFull.includes(rem)) nextFull.push(rem);
      }
      setFavoriteOrder(nextFull);
    },
    [orderedFavorites]
  );

  const moveFavorite = useCallback(
    (
      mediaId: number,
      direction: "up" | "down" | "top" | "bottom",
      scopeType: "ALL" | MediaType = "ALL"
    ) => {
      const scoped =
        scopeType === "ALL"
          ? orderedFavorites
          : orderedFavorites.filter((e) => e.type === scopeType);
      const ids = scoped.map((e) => e.mediaId);
      const idx = ids.indexOf(mediaId);
      if (idx === -1) return;

      let targetIdx = idx;
      if (direction === "up") targetIdx = Math.max(0, idx - 1);
      else if (direction === "down") targetIdx = Math.min(ids.length - 1, idx + 1);
      else if (direction === "top") targetIdx = 0;
      else if (direction === "bottom") targetIdx = ids.length - 1;

      if (targetIdx === idx) return;
      const copy = [...ids];
      const [moved] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, moved);
      reorderFavorites(copy, scopeType);
    },
    [orderedFavorites, reorderFavorites]
  );

  const setFavoriteRank = useCallback(
    (mediaId: number, rank1Based: number, scopeType: "ALL" | MediaType = "ALL") => {
      const scoped =
        scopeType === "ALL"
          ? orderedFavorites
          : orderedFavorites.filter((e) => e.type === scopeType);
      const ids = scoped.map((e) => e.mediaId);
      const idx = ids.indexOf(mediaId);
      if (idx === -1) return;
      const targetIdx = Math.max(0, Math.min(ids.length - 1, Math.floor(rank1Based) - 1));
      if (targetIdx === idx) return;
      const copy = [...ids];
      const [moved] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, moved);
      reorderFavorites(copy, scopeType);
    },
    [orderedFavorites, reorderFavorites]
  );

  // Debounced sync of user's public profile snapshot (for /profile/[username] & /community)
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      const scored = library.filter((e) => e.score !== null);
      const meanScore = scored.length
        ? Math.round((scored.reduce((a, b) => a + (b.score ?? 0), 0) / scored.length) * 10) / 10
        : null;
      const favoriteMediaPayload = orderedFavorites.slice(0, 40).map((e) => ({
        mediaId: e.mediaId,
        type: e.type,
        title: e.title,
        coverImage: e.coverImage,
        score: e.score,
      }));
      const favIds = new Set(orderedFavorites.map((e) => e.mediaId));
      const libraryPreviewPayload: PublicProfileLibraryItem[] = [
        ...orderedFavorites.slice(0, 30),
        ...library
          .filter((e) => !favIds.has(e.mediaId))
          .sort(
            (a, b) =>
              (b.score ?? -1) - (a.score ?? -1) ||
              Number(b.status === "COMPLETED") - Number(a.status === "COMPLETED") ||
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )
          .slice(0, 50),
      ]
        .slice(0, 80)
        .map((e) => ({
          mediaId: e.mediaId,
          type: e.type,
          title: e.title,
          coverImage: e.coverImage,
          score: e.score,
          status: e.status,
          isFavorite: e.isFavorite,
          genres: Array.isArray(e.genres) ? e.genres.slice(0, 5) : undefined,
        }));
      const statsPayload = {
        totalEntries: library.length,
        animeCount: library.filter((e) => e.type === "ANIME").length,
        mangaCount: library.filter((e) => e.type === "MANGA").length,
        episodesWatched: library
          .filter((e) => e.type === "ANIME")
          .reduce((a, b) => a + b.progress, 0),
        chaptersRead: library
          .filter((e) => e.type === "MANGA")
          .reduce((a, b) => a + b.progress, 0),
        completedCount: library.filter((e) => e.status === "COMPLETED").length,
        meanScore,
      };

      // 1) Direct authenticated Supabase JWT upsert into `public.profiles`
      if (profile.mode === "supabase") {
        void syncPublicProfileToCloud(profile.id, {
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl ?? null,
          bio: profile.bio,
          accentColor: profile.accentColor,
          isActivityPublic: profile.isActivityPublic ?? true,
          preferredLanguage: contentLanguage,
          favoriteStaff,
          favoriteMedia: favoriteMediaPayload,
          libraryPreview: libraryPreviewPayload,
          stats: statsPayload,
          unlockedBadges,
          pinnedBadges,
        });
      }

      // 2) Server API sync (also updates local/community discovery)
      fetch("/api/community/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: profile.id,
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl ?? null,
          bio: profile.bio,
          accentColor: profile.accentColor,
          isActivityPublic: profile.isActivityPublic ?? true,
          joinedAt: profile.joinedAt,
          favoriteStaff,
          favoriteMedia: favoriteMediaPayload,
          libraryPreview: libraryPreviewPayload,
          stats: statsPayload,
          unlockedBadges,
          pinnedBadges,
          socialInteractionsCount,
        }),
      }).catch(() => {});
    }, 650);
    return () => clearTimeout(timer);
  }, [
    hydrated,
    profile,
    favoriteStaff,
    orderedFavorites,
    library,
    unlockedBadges,
    pinnedBadges,
    socialInteractionsCount,
  ]);

  // Automatic idempotent backfill of existing library actions (favorites, scores, completed series, Seiyuu)
  // into `activity_events` whenever the user's profile is public!
  useEffect(() => {
    if (!hydrated || profile.isActivityPublic === false) return;
    if (library.length === 0 && favoriteStaff.length === 0) return;

    const backfillKey = `${profile.id}:${profile.mode}:${profile.username}`;
    if (backfilledActivityKeyRef.current === backfillKey) return;

    const timer = setTimeout(() => {
      const highlights: ActivityBackfillItem[] = [];
      const usedMediaIds = new Set<number>();

      // 1) Top favorites (#1, #2)
      for (const fav of orderedFavorites.slice(0, 2)) {
        usedMediaIds.add(fav.mediaId);
        highlights.push({
          kind: "FAVORITE_MEDIA",
          mediaId: fav.mediaId,
          mediaTitle: fav.title,
          mediaType: fav.type,
          coverImage: fav.coverImage,
          action: "A ajouté en coup de cœur",
          score: fav.score,
        });
      }

      // 2) Recently completed series
      const completed = [...library]
        .filter((e) => e.status === "COMPLETED" && !usedMediaIds.has(e.mediaId))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 2);
      for (const item of completed) {
        usedMediaIds.add(item.mediaId);
        highlights.push({
          kind: "COMPLETED",
          mediaId: item.mediaId,
          mediaTitle: item.title,
          mediaType: item.type,
          coverImage: item.coverImage,
          action: item.score ? `A terminé la série · ★ ${item.score}/10` : "A terminé la série",
          score: item.score,
        });
      }

      // 3) Highest scored titles
      const scored = [...library]
        .filter((e) => e.score !== null && e.score > 0 && !usedMediaIds.has(e.mediaId))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 2);
      for (const item of scored) {
        usedMediaIds.add(item.mediaId);
        highlights.push({
          kind: "SCORED",
          mediaId: item.mediaId,
          mediaTitle: item.title,
          mediaType: item.type,
          coverImage: item.coverImage,
          action: `A attribué la note de ${item.score}/10`,
          score: item.score,
        });
      }

      // 4) Favorite Voice Actor (Seiyuu)
      if (favoriteStaff.length > 0) {
        const s = favoriteStaff[0];
        highlights.push({
          kind: "FAVORITE_STAFF",
          mediaId: s.id,
          mediaTitle: s.name,
          mediaType: "STAFF",
          coverImage: s.image || null,
          action: "A ajouté en Voice Actor favori (Seiyuu)",
        });
      }

      if (highlights.length === 0) return;
      backfilledActivityKeyRef.current = backfillKey;

      // Sync via API route (updates Supabase server-side + local store)
      fetch("/api/community/activity/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPublic: true,
          userId: profile.id,
          actorUsername: profile.username,
          actorDisplayName: profile.displayName,
          actorAvatarUrl: profile.avatarUrl ?? null,
          actorAccentColor: profile.accentColor,
          actorPinnedBadges: pinnedBadges.slice(0, 3),
          events: highlights,
        }),
      }).catch(() => {});

      // Also guarantee direct browser Supabase JWT backfill when signed in with Supabase
      if (profile.mode === "supabase") {
        void backfillCloudActivities(
          profile.id,
          {
            username: profile.username,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl ?? null,
            accentColor: profile.accentColor,
            pinnedBadges: pinnedBadges.slice(0, 3),
          },
          highlights
        );
      }
    }, 1100);

    return () => clearTimeout(timer);
  }, [
    hydrated,
    profile.id,
    profile.mode,
    profile.username,
    profile.displayName,
    profile.avatarUrl,
    profile.accentColor,
    profile.isActivityPublic,
    library,
    orderedFavorites,
    favoriteStaff,
    pinnedBadges,
  ]);

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
      localStorage.setItem(
        STORAGE_KEYS.readNotifs,
        JSON.stringify(readNotifIds.slice(-250))
      );
    } catch {
      // ignore
    }
  }, [readNotifIds, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEYS.dismissedNotifs,
        JSON.stringify(dismissedNotifIds.slice(-250))
      );
    } catch {
      // ignore
    }
  }, [dismissedNotifIds, hydrated]);

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

  const setContentLanguage = useCallback(
    (lang: ContentLanguage, options?: { silent?: boolean }) => {
      const normalized = normalizeContentLanguage(lang);
      setContentLanguageState(normalized);
      setProfile((prev) =>
        prev.preferredLanguage === normalized ? prev : { ...prev, preferredLanguage: normalized }
      );
      try {
        localStorage.setItem(STORAGE_KEYS.contentLanguage, normalized);
      } catch {
        // ignore
      }
      if (profile.mode === "supabase") {
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          void supabase
            .from("profiles")
            .update({ preferred_language: normalized })
            .eq("id", profile.id);
        }
      }
      if (!options?.silent) {
        const meta = CONTENT_LANGUAGE_MAP.get(normalized);
        toast({
          title: `Langue des synopsis : ${meta?.label ?? normalized.toUpperCase()}`,
          description: meta?.isAutoTranslated
            ? "Les synopsis sont traduits automatiquement à la volée."
            : "Affichage du texte anglais original d'AniList.",
          variant: "info",
        });
      }
    },
    [profile.id, profile.mode, toast]
  );

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

  // Publish public community activity (respects user's isActivityPublic setting!)
  const publishCommunityActivity = useCallback(
    (payload: {
      kind: CommunityActivityKind;
      mediaId: number;
      mediaTitle: string;
      mediaType: MediaType | "STAFF" | "BADGE";
      coverImage: string | null;
      action: string;
      score?: number | null;
      badgeId?: string;
      badgeRarity?: BadgeRarity;
    }) => {
      if (profile.isActivityPublic === false) return;
      fetch("/api/community/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          isPublic: true,
          userId: profile.id,
          actorUsername: profile.username,
          actorDisplayName: profile.displayName,
          actorAvatarUrl: profile.avatarUrl ?? null,
          actorAccentColor: profile.accentColor,
          actorPinnedBadges: pinnedBadges.slice(0, 3),
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          // If server cookies weren't available for Supabase, write directly via browser JWT!
          if (profile.mode === "supabase" && !data?.savedToSupabase) {
            const supabase = getSupabaseBrowserClient();
            if (supabase) {
              void supabase.from("activity_events").insert({
                user_id: profile.id,
                media_id: payload.mediaId,
                media_title: payload.mediaTitle,
                media_type: payload.mediaType === "MANGA" ? "MANGA" : "ANIME",
                cover_image: payload.coverImage ?? null,
                action: payload.action,
                event_kind: payload.kind,
                is_public: true,
                actor_username: profile.username,
                actor_display_name: profile.displayName,
                actor_avatar_url: profile.avatarUrl ?? null,
                metadata: {
                  isStaff: payload.mediaType === "STAFF" || payload.kind === "FAVORITE_STAFF",
                  isBadge: payload.mediaType === "BADGE" || payload.kind === "BADGE_UNLOCKED",
                  badgeId: payload.badgeId,
                  badgeRarity: payload.badgeRarity,
                  pinnedBadges: pinnedBadges.slice(0, 3),
                  score: typeof payload.score === "number" ? payload.score : null,
                  accentColor: profile.accentColor,
                },
              });
            }
          }
        })
        .catch(() => {});
    },
    [profile, pinnedBadges]
  );

  // ============================================================================
  // Gamification — Live Badge Evaluation, Unlock Toast Queue, Pinning & Sync
  // ============================================================================
  const badgeMetrics = useMemo(
    () =>
      extractBadgeMetrics({
        library,
        profile,
        favoriteStaff,
        socialInteractionsCount,
      }),
    [library, profile, favoriteStaff, socialInteractionsCount]
  );

  const evaluatedBadges = useMemo(
    () => evaluateAllBadges(badgeMetrics, unlockedBadges),
    [badgeMetrics, unlockedBadges]
  );

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.pinnedBadges, JSON.stringify(pinnedBadges.slice(0, 3)));
    } catch {
      // ignore
    }
  }, [pinnedBadges, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.socialCount, String(socialInteractionsCount));
    } catch {
      // ignore
    }
  }, [socialInteractionsCount, hydrated]);

  // Automatically unlock badges as soon as their threshold is met
  useEffect(() => {
    if (!hydrated) return;

    const alreadyUnlocked = new Set(unlockedBadges.map((b) => b.badgeId));
    const freshEval = evaluateAllBadges(badgeMetrics, unlockedBadges);
    const newlyEarned = freshEval.filter(
      (b) => b.current >= b.target && !alreadyUnlocked.has(b.id)
    );

    if (newlyEarned.length === 0) {
      initialBadgeEvalDoneRef.current = true;
      return;
    }

    const nowIso = new Date().toISOString();
    const addedRecords: UnlockedBadgeRecord[] = newlyEarned.map((b) => ({
      badgeId: b.id,
      unlockedAt: nowIso,
    }));
    const nextUnlocked = [...unlockedBadges, ...addedRecords];

    const isInitialPass = !initialBadgeEvalDoneRef.current;
    const isInitialMigration = isInitialPass && !hasStoredBadgesRef.current;
    initialBadgeEvalDoneRef.current = true;
    hasStoredBadgesRef.current = true;

    setUnlockedBadges(nextUnlocked);
    try {
      localStorage.setItem(STORAGE_KEYS.badges, JSON.stringify(nextUnlocked));
    } catch {
      // ignore
    }

    const sortedNew = [...newlyEarned]
      .map((b) => ({ ...b, unlocked: true, unlockedAt: nowIso, progressPct: 100 }))
      .sort((a, b) => {
        if (RARITY_RANK[b.rarity] !== RARITY_RANK[a.rarity]) {
          return RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity];
        }
        return b.target - a.target;
      });

    let nextPinned = pinnedBadges;
    if (isInitialMigration && pinnedBadges.length === 0) {
      nextPinned = sortedNew.slice(0, 3).map((b) => b.id);
      setPinnedBadges(nextPinned);
      try {
        localStorage.setItem(STORAGE_KEYS.pinnedBadges, JSON.stringify(nextPinned));
      } catch {
        // ignore
      }
    }

    if (profile.mode === "supabase") {
      void syncUserBadgesToCloud(profile.id, nextUnlocked, nextPinned);
    }

    // Show celebratory trophy unlock popup:
    // - On initial pass / bulk import / catalog expansion (> 2 unlocked at once): show the #1 rarest badge once (no popup flood)
    // - On live incremental unlocks (1–2): queue each newly unlocked badge
    const toAnnounce =
      isInitialPass || sortedNew.length > 2 ? sortedNew.slice(0, 1) : sortedNew;
    if (toAnnounce.length > 0) {
      setBadgeUnlockQueue((prev) => {
        const existingIds = new Set(prev.map((x) => x.id));
        return [...prev, ...toAnnounce.filter((x) => !existingIds.has(x.id))];
      });
    }

    // Auto-publish Gold, Legendary & Mythic badge unlocks to /community on live actions
    if (!isInitialPass && profile.isActivityPublic !== false) {
      const rareCap = sortedNew.length > 2 ? 1 : 2;
      const rareToPublish = sortedNew
        .filter((b) => isRareBadge(b.rarity))
        .slice(0, rareCap);
      for (const b of rareToPublish) {
        if (!publishedRareBadgesRef.current.has(b.id)) {
          publishedRareBadgesRef.current.add(b.id);
          publishCommunityActivity({
            kind: "BADGE_UNLOCKED",
            mediaId: 0,
            mediaTitle: b.title,
            mediaType: "BADGE",
            coverImage: null,
            action: `a débloqué le badge ${b.title} !`,
            badgeId: b.id,
            badgeRarity: b.rarity,
          });
        }
      }
    }
  }, [
    hydrated,
    badgeMetrics,
    unlockedBadges,
    pinnedBadges,
    profile.id,
    profile.mode,
    profile.isActivityPublic,
    publishCommunityActivity,
  ]);

  const dismissBadgeUnlock = useCallback(() => {
    setBadgeUnlockQueue((prev) => prev.slice(1));
  }, []);

  const previewBadgeUnlock = useCallback(
    (badgeId: string) => {
      const target = evaluatedBadges.find((b) => b.id === badgeId);
      if (!target) return;
      setBadgeUnlockQueue((prev) => [
        { ...target, unlocked: true, unlockedAt: new Date().toISOString() },
        ...prev.filter((x) => x.id !== target.id),
      ]);
    },
    [evaluatedBadges]
  );

  const togglePinBadge = useCallback(
    (badgeId: string) => {
      const target = evaluatedBadges.find((b) => b.id === badgeId);
      if (!target || !target.unlocked) {
        toast({
          title: "Badge verrouillé",
          description: "Débloquez ce badge avant de pouvoir l'épingler sur votre profil.",
          variant: "warning",
        });
        return;
      }

      const isPinned = pinnedBadges.includes(badgeId);
      let nextPinned: string[];
      if (isPinned) {
        nextPinned = pinnedBadges.filter((id) => id !== badgeId);
        toast({
          title: "Badge désépinglé",
          description: `${target.title} a été retiré de votre vitrine rapide.`,
          variant: "info",
        });
      } else {
        if (pinnedBadges.length >= 3) {
          toast({
            title: "Maximum 3 badges épinglés",
            description: "Retirez un badge épinglé pour en mettre un autre en avant.",
            variant: "warning",
          });
          return;
        }
        nextPinned = [...pinnedBadges, badgeId];
        toast({
          title: "Badge épinglé sur votre profil !",
          description: `${target.title} apparaît maintenant à côté de @${profile.username}.`,
          variant: "success",
        });
      }

      setPinnedBadges(nextPinned);
      if (profile.mode === "supabase") {
        void syncUserBadgesToCloud(profile.id, unlockedBadges, nextPinned);
      }
    },
    [evaluatedBadges, pinnedBadges, profile.id, profile.mode, profile.username, toast, unlockedBadges]
  );

  const recordSocialInteraction = useCallback(() => {
    setSocialInteractionsCount((prev) => prev + 1);
  }, []);

  const toggleFavoriteStaff = useCallback(
    (staff: FavoriteVoiceActor) => {
      const exists = favoriteStaff.some((s) => s.id === staff.id);
      if (exists) {
        setFavoriteStaff((prev) => prev.filter((s) => s.id !== staff.id));
        toast({
          title: "Voice Actor retiré des favoris",
          description: staff.name,
          variant: "info",
        });
      } else {
        setFavoriteStaff((prev) => [staff, ...prev]);
        publishCommunityActivity({
          kind: "FAVORITE_STAFF",
          mediaId: staff.id,
          mediaTitle: staff.name,
          mediaType: "STAFF",
          coverImage: staff.image || null,
          action: "A ajouté en Voice Actor favori (Seiyuu)",
        });
        toast({
          title: "Voice Actor ajouté aux favoris !",
          description: staff.name,
          coverImage: staff.image,
          variant: "success",
          celebrate: true,
        });
      }
    },
    [favoriteStaff, publishCommunityActivity, toast]
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      try {
        const res = await uploadProfileAvatar(profile.id, file);
        setProfile((prev) => ({ ...prev, avatarUrl: res.url }));
        toast({
          title: "Photo de profil mise à jour",
          description:
            res.storage === "supabase"
              ? "Image hébergée sur Supabase Storage et appliquée partout."
              : "Photo appliquée partout dans Shiori.",
          variant: "success",
        });
        return { ok: true, url: res.url, storage: res.storage };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload impossible";
        toast({ title: "Erreur avatar", description: msg, variant: "warning" });
        return { ok: false, error: msg };
      }
    },
    [profile.id, toast]
  );

  const refreshUnreadMessages = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        userId: profile.id,
        username: profile.username,
      });
      const res = await fetch(`/api/messages?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) return 0;
      const data = await res.json();
      const count = Number(data?.unreadCount ?? 0);
      setUnreadMessagesCount(count);
      return count;
    } catch {
      return 0;
    }
  }, [profile.id, profile.username]);

  // ============================================================================
  // Friends System — Search, Add, Accept, Remove & Realtime Sync
  // ============================================================================
  const refreshFriendships = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        userId: profile.id,
        username: profile.username,
      });
      const res = await fetch(`/api/community/friends?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.friends)) setFriends(data.friends);
      if (Array.isArray(data?.incomingRequests)) {
        setIncomingFriendRequests(data.incomingRequests);
      }
      if (Array.isArray(data?.outgoingRequests)) {
        setOutgoingFriendRequests(data.outgoingRequests);
      }
    } catch {
      // ignore transient errors
    }
  }, [profile.id, profile.username]);

  useEffect(() => {
    if (!hydrated) return;
    void refreshFriendships();

    const supabase = getSupabaseBrowserClient();
    if (!supabase || profile.mode !== "supabase") return;

    const channel = supabase
      .channel(`shiori-friendships-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => {
          void refreshFriendships();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [hydrated, profile.id, profile.mode, refreshFriendships]);

  const getFriendRelation = useCallback(
    (targetUserId: string, targetUsername: string): FriendRelationState => {
      const uLower = targetUsername.toLowerCase();
      if (
        friends.some(
          (f) => f.id === targetUserId || f.username.toLowerCase() === uLower
        )
      ) {
        return "FRIENDS";
      }
      if (
        incomingFriendRequests.some(
          (r) =>
            r.user.id === targetUserId || r.user.username.toLowerCase() === uLower
        )
      ) {
        return "PENDING_INCOMING";
      }
      if (
        outgoingFriendRequests.some(
          (r) =>
            r.user.id === targetUserId || r.user.username.toLowerCase() === uLower
        )
      ) {
        return "PENDING_OUTGOING";
      }
      return "NONE";
    },
    [friends, incomingFriendRequests, outgoingFriendRequests]
  );

  const addFriend = useCallback(
    async (target: {
      id?: string;
      username: string;
      displayName?: string;
      avatarUrl?: string | null;
    }) => {
      try {
        const res = await fetch("/api/community/friends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add",
            userId: profile.id,
            username: profile.username,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl ?? null,
            accentColor: profile.accentColor,
            targetUserId: target.id,
            targetUsername: target.username,
            targetDisplayName: target.displayName,
            targetAvatarUrl: target.avatarUrl ?? null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) {
          const errMsg =
            data?.error ||
            "Impossible d'envoyer la demande d'ami. Vérifiez le pseudo et réessayez.";
          toast({
            title: "Ajout d'ami impossible",
            description: errMsg,
            variant: "warning",
          });
          return { ok: false, error: errMsg };
        }
        await refreshFriendships();
        const label = target.displayName || `@${target.username}`;
        if (data?.alreadyFriends) {
          const msg = data?.message || `Vous êtes déjà ami avec ${label}.`;
          toast({ title: "Déjà amis", description: msg, variant: "info" });
          return { ok: true, status: "ACCEPTED", message: msg };
        }
        if (data?.alreadyPending) {
          const msg = data?.message || `Une demande est déjà en attente pour ${label}.`;
          toast({ title: "Demande déjà envoyée", description: msg, variant: "info" });
          return { ok: true, status: "PENDING", message: msg };
        }
        if (data?.status === "ACCEPTED") {
          const msg = `${label} est maintenant votre ami !`;
          toast({
            title: msg,
            description: "Retrouvez vos amis dans Communauté → Amis et Messagerie.",
            variant: "success",
            celebrate: true,
          });
          return { ok: true, status: "ACCEPTED", message: msg };
        } else {
          const msg = `Demande d'ami envoyée à ${label}.`;
          toast({
            title: "Demande d'ami envoyée",
            description: `En attente de confirmation de ${label}.`,
            variant: "info",
          });
          return { ok: true, status: "PENDING", message: msg };
        }
      } catch {
        const errMsg = "Erreur réseau : impossible de joindre le serveur Shiori.";
        toast({ title: "Erreur réseau", description: errMsg, variant: "warning" });
        return { ok: false, error: errMsg };
      }
    },
    [profile, refreshFriendships, toast]
  );

  const acceptFriend = useCallback(
    async (target: { id?: string; username: string; displayName?: string }) => {
      try {
        const res = await fetch("/api/community/friends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "accept",
            userId: profile.id,
            username: profile.username,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl ?? null,
            targetUserId: target.id,
            targetUsername: target.username,
          }),
        });
        if (res.ok) {
          await refreshFriendships();
          toast({
            title: `${target.displayName || `@${target.username}`} ajouté à vos amis !`,
            variant: "success",
            celebrate: true,
          });
        }
      } catch {
        // ignore
      }
    },
    [profile, refreshFriendships, toast]
  );

  const removeFriend = useCallback(
    async (target: { id?: string; username: string; displayName?: string }) => {
      try {
        const res = await fetch("/api/community/friends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "remove",
            userId: profile.id,
            username: profile.username,
            targetUserId: target.id,
            targetUsername: target.username,
          }),
        });
        if (res.ok) {
          await refreshFriendships();
          toast({
            title: "Relation mise à jour",
            description: `${target.displayName || `@${target.username}`} retiré.`,
            variant: "info",
          });
        }
      } catch {
        // ignore
      }
    },
    [profile.id, profile.username, refreshFriendships, toast]
  );

  // Hydrate unread DM badge + unified real-time notifications bell (friend requests, messages, likes/comments)
  const refreshNotifications = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        userId: profile.id,
        username: profile.username,
      });
      const res = await fetch(`/api/notifications/realtime?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.notifications)) {
        setSocialNotifications(data.notifications);
      }
    } catch {
      // ignore transient network errors
    }
  }, [profile.id, profile.username]);

  useEffect(() => {
    if (!hydrated) return;
    void refreshUnreadMessages();
    void refreshNotifications();

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void refreshNotifications();
      void refreshUnreadMessages();
    }, 12000);

    const supabase = getSupabaseBrowserClient();
    if (!supabase || profile.mode !== "supabase") {
      return () => clearInterval(interval);
    }

    const channel = supabase
      .channel(`shiori-bell-realtime-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_messages",
          filter: `recipient_id=eq.${profile.id}`,
        },
        () => {
          void refreshUnreadMessages();
          void refreshNotifications();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
        },
        () => {
          void refreshFriendships();
          void refreshNotifications();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_likes",
        },
        () => {
          void refreshNotifications();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_comments",
        },
        () => {
          void refreshNotifications();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [
    hydrated,
    profile.id,
    profile.mode,
    refreshUnreadMessages,
    refreshNotifications,
    refreshFriendships,
  ]);

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
        setFavoriteOrder((prev) =>
          merged.isFavorite
            ? prev.includes(merged.mediaId)
              ? prev
              : [...prev, merged.mediaId]
            : prev.filter((id) => id !== merged.mediaId)
        );
        void pushMutationToAniList({
          action: "favorite",
          mediaId: merged.mediaId,
          mediaType: merged.type,
          isFavorite: merged.isFavorite,
          title: merged.title,
        });
      }

      // Publish to public realtime community feed (if user enabled public activity)
      if (updates.isFavorite === true && !existing?.isFavorite) {
        publishCommunityActivity({
          kind: "FAVORITE_MEDIA",
          mediaId: merged.mediaId,
          mediaTitle: merged.title,
          mediaType: merged.type,
          coverImage: merged.coverImage,
          action: "A ajouté en coup de cœur",
          score: merged.score,
        });
      }
      if (merged.status === "COMPLETED" && existing?.status !== "COMPLETED") {
        publishCommunityActivity({
          kind: "COMPLETED",
          mediaId: merged.mediaId,
          mediaTitle: merged.title,
          mediaType: merged.type,
          coverImage: merged.coverImage,
          action: merged.score
            ? `A terminé la série · ★ ${merged.score}/10`
            : "A terminé la série",
          score: merged.score,
        });
      } else if (
        updates.score !== undefined &&
        updates.score !== null &&
        updates.score !== existing?.score
      ) {
        publishCommunityActivity({
          kind: "SCORED",
          mediaId: merged.mediaId,
          mediaTitle: merged.title,
          mediaType: merged.type,
          coverImage: merged.coverImage,
          action: `A attribué la note de ${updates.score}/10`,
          score: updates.score,
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
    [
      library,
      addActivity,
      pushNotification,
      profile,
      pushMutationToAniList,
      publishCommunityActivity,
      toast,
    ]
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

      if (reachedEnd) {
        publishCommunityActivity({
          kind: "COMPLETED",
          mediaId: existing.mediaId,
          mediaTitle: existing.title,
          mediaType: existing.type,
          coverImage: existing.coverImage,
          action: `A terminé la série (${unit} ${nextProg})`,
          score: updated.score,
        });
      }

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
    [
      library,
      addActivity,
      pushNotification,
      profile,
      pushMutationToAniList,
      publishCommunityActivity,
      toast,
    ]
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
      setFavoriteOrder((prev) =>
        updated.isFavorite
          ? prev.includes(mediaId)
            ? prev
            : [...prev, mediaId]
          : prev.filter((id) => id !== mediaId)
      );
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
      if (updated.isFavorite) {
        publishCommunityActivity({
          kind: "FAVORITE_MEDIA",
          mediaId: existing.mediaId,
          mediaTitle: existing.title,
          mediaType: existing.type,
          coverImage: existing.coverImage,
          action: "A ajouté en coup de cœur",
          score: existing.score,
        });
      }
      toast({
        title: updated.isFavorite ? "Ajouté aux coups de cœur" : "Retiré des coups de cœur",
        description: existing.title,
        coverImage: existing.coverImage,
        mediaId: existing.mediaId,
        celebrate: updated.isFavorite,
      });
    },
    [library, profile, pushMutationToAniList, publishCommunityActivity, toast]
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
      if (Array.isArray(data.favoriteStaff)) setFavoriteStaff(data.favoriteStaff);
      if (Array.isArray(data.favoriteOrder)) setFavoriteOrder(data.favoriteOrder);
      if (Array.isArray(data.unlockedBadges) && data.unlockedBadges.length > 0) {
        hasStoredBadgesRef.current = true;
        setUnlockedBadges(data.unlockedBadges);
      }
      if (Array.isArray(data.pinnedBadges)) {
        setPinnedBadges(data.pinnedBadges.slice(0, 3));
      }
      if (typeof data.socialInteractionsCount === "number") {
        setSocialInteractionsCount(data.socialInteractionsCount);
      }

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

  const readNotifSet = useMemo(() => new Set(readNotifIds), [readNotifIds]);
  const dismissedNotifSet = useMemo(() => new Set(dismissedNotifIds), [dismissedNotifIds]);

  const badgeNotifications = useMemo<ShioriNotification[]>(() => {
    const unlocked = evaluatedBadges
      .filter((b) => b.unlocked)
      .sort((a, b) => {
        const ta = a.unlockedAt ? new Date(a.unlockedAt).getTime() : 0;
        const tb = b.unlockedAt ? new Date(b.unlockedAt).getTime() : 0;
        if (tb !== ta) return tb - ta;
        if (RARITY_RANK[b.rarity] !== RARITY_RANK[a.rarity]) {
          return RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity];
        }
        return b.target - a.target;
      })
      .slice(0, 3);

    return unlocked.map((b) => ({
      id: `badge-${b.id}`,
      kind: "BADGE" as const,
      title: `Badge débloqué · ${b.title}`,
      body: b.description,
      href: `/profile/${encodeURIComponent(profile.username)}#badges`,
      isRead: false,
      createdAt: b.unlockedAt || profile.joinedAt || new Date().toISOString(),
    }));
  }, [evaluatedBadges, profile.username, profile.joinedAt]);

  const mergedNotifications = useMemo<ShioriNotification[]>(() => {
    const map = new Map<string, ShioriNotification>();
    for (const item of [...socialNotifications, ...badgeNotifications, ...notifications]) {
      if (dismissedNotifSet.has(item.id)) continue;
      if (!map.has(item.id)) {
        map.set(item.id, {
          ...item,
          isRead: item.isRead || readNotifSet.has(item.id),
        });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 45);
  }, [socialNotifications, badgeNotifications, notifications, readNotifSet, dismissedNotifSet]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setReadNotifIds((prev) => (prev.includes(id) ? prev : [...prev.slice(-249), id]));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    const allIds = mergedNotifications.map((n) => n.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setReadNotifIds((prev) => {
      const set = new Set([...prev, ...allIds]);
      return Array.from(set).slice(-250);
    });
  }, [mergedNotifications]);

  const clearNotifications = useCallback(() => {
    const allIds = mergedNotifications.map((n) => n.id);
    setNotifications([]);
    setDismissedNotifIds((prev) => {
      const set = new Set([...prev, ...allIds]);
      return Array.from(set).slice(-250);
    });
  }, [mergedNotifications]);

  const unreadCount = useMemo(
    () => mergedNotifications.filter((n) => !n.isRead).length,
    [mergedNotifications]
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
    uploadAvatar,
    updateNotificationPrefs,
    favoriteStaff,
    toggleFavoriteStaff,
    favoriteOrder,
    orderedFavorites,
    reorderFavorites,
    moveFavorite,
    setFavoriteRank,
    friends,
    incomingFriendRequests,
    outgoingFriendRequests,
    refreshFriendships,
    getFriendRelation,
    addFriend,
    acceptFriend,
    removeFriend,
    unreadMessagesCount,
    refreshUnreadMessages,
    unlockedBadges,
    pinnedBadges,
    evaluatedBadges,
    socialInteractionsCount,
    badgeUnlockQueue,
    dismissBadgeUnlock,
    previewBadgeUnlock,
    togglePinBadge,
    recordSocialInteraction,
    signInWithSupabase,
    signUpWithSupabase,
    signInWithGoogle,
    signOutSupabase,
    notifications: mergedNotifications,
    unreadCount,
    refreshNotifications,
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
    contentLanguage,
    setContentLanguage,
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
