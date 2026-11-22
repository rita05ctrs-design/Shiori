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
  fetchCloudLibrary,
  removeEntryFromCloud,
  syncEntryToCloud,
} from "@/lib/supabase/sync";
import { getDisplayTitle, getStatusLabel } from "@/lib/utils";
import type {
  ActivityEvent,
  LibraryEntry,
  LibraryStatus,
  MediaItem,
  NotificationPrefs,
  ShioriNotification,
  ToastMessage,
  UserProfile,
} from "@/types/media";

const STORAGE_KEYS = {
  library: "shiori_library_v1",
  profile: "shiori_profile_v1",
  notifications: "shiori_notifications_v1",
  activity: "shiori_activity_v1",
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

  // Profile & Auth (Local + Supabase ready)
  profile: UserProfile;
  supabaseReady: boolean;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updateNotificationPrefs: (prefs: Partial<NotificationPrefs>) => void;
  signInWithSupabase: (email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  signUpWithSupabase: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<{ ok: boolean; message: string }>;
  signOutSupabase: () => Promise<void>;

  // Notifications & Activity
  notifications: ShioriNotification[];
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  pushNotification: (n: Omit<ShioriNotification, "id" | "isRead" | "createdAt">) => void;
  activity: ActivityEvent[];

  // Modals & UI Overlays
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
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

  // Overlays
  const [commandOpen, setCommandOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [editingMedia, setEditingMedia] = useState<MediaItem | LibraryEntry | null>(null);
  const [trailerVideo, setTrailerVideo] = useState<{ id: string; title: string } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const supabaseReady = isSupabaseConfigured();

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
    } catch {
      // ignore corrupted storage
    } finally {
      setHydrated(true);
    }
  }, []);

  // Listen to Supabase auth session if configured
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const user = data.user;
        const name =
          (user.user_metadata?.display_name as string) ||
          user.email?.split("@")[0] ||
          "Membre Shiori";
        setProfile((prev) => ({
          ...prev,
          id: user.id,
          email: user.email ?? prev.email,
          displayName: name,
          username: (user.user_metadata?.username as string) || name.toLowerCase().replace(/\s+/g, "_"),
          avatarInitials: name.slice(0, 2).toUpperCase(),
          mode: "supabase",
        }));
        const cloudLib = await fetchCloudLibrary(user.id);
        if (cloudLib && cloudLib.length > 0) {
          setLibrary(cloudLib);
        }
      }
    });
  }, []);

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

      toast({
        title: existing ? "Bibliothèque mise à jour" : "Ajouté à Shiori",
        description: `${merged.title} — ${getStatusLabel(merged.status, merged.type)}`,
        variant: "success",
      });
    },
    [library, addActivity, pushNotification, profile, toast]
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

      toast({
        title: reachedEnd ? "Terminé !" : `+${delta} ${unit.toLowerCase()}`,
        description: `${existing.title} · ${unit} ${nextProg}${existing.totalUnits ? `/${existing.totalUnits}` : ""}`,
        variant: reachedEnd ? "success" : "info",
      });
    },
    [library, addActivity, pushNotification, profile, toast]
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
      toast({
        title: updated.isFavorite ? "Ajouté aux favoris" : "Retiré des favoris",
        description: existing.title,
      });
    },
    [library, profile, toast]
  );

  const removeEntry = useCallback(
    (mediaId: number) => {
      const existing = library.find((e) => e.mediaId === mediaId);
      setLibrary((prev) => prev.filter((e) => e.mediaId !== mediaId));
      if (profile.mode === "supabase") {
        void removeEntryFromCloud(profile.id, mediaId);
      }
      if (existing) {
        toast({
          title: "Retiré de la bibliothèque",
          description: existing.title,
          variant: "warning",
        });
      }
    },
    [library, profile, toast]
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
    toast({
      title: "Données de démonstration restaurées",
      description: `${defLib.length} animés et mangas réinitialisés.`,
      variant: "info",
    });
  }, [toast]);

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
      if (!supabase) {
        return {
          ok: false,
          message:
            "Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY non configurées. Utilisez le mode local ou renseignez .env.local.",
        };
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        return { ok: false, message: error?.message || "Échec de la connexion." };
      }
      const name =
        (data.user.user_metadata?.display_name as string) ||
        email.split("@")[0];
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
      toast({ title: "Connecté via Supabase", description: `Bienvenue, ${name}`, variant: "success" });
      return { ok: true, message: "Connexion réussie !" };
    },
    [toast]
  );

  const signUpWithSupabase = useCallback(
    async (email: string, password: string, displayName: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        return {
          ok: false,
          message:
            "Supabase n'est pas encore configuré dans .env.local. Votre profil a été mis à jour en mode local.",
        };
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            username: displayName.toLowerCase().replace(/\s+/g, "_"),
          },
        },
      });
      if (error) {
        return { ok: false, message: error.message };
      }
      toast({
        title: "Compte créé",
        description: "Vérifiez votre boîte e-mail pour confirmer votre inscription.",
        variant: "success",
      });
      return { ok: true, message: "Vérifiez votre e-mail de confirmation." };
    },
    [toast]
  );

  const signOutSupabase = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setProfile(createDefaultProfile());
    toast({ title: "Déconnecté", description: "Passage en session locale Shiori." });
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
    profile,
    supabaseReady,
    updateProfile,
    updateNotificationPrefs,
    signInWithSupabase,
    signUpWithSupabase,
    signOutSupabase,
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    pushNotification,
    activity,
    commandOpen,
    setCommandOpen,
    authModalOpen,
    setAuthModalOpen,
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
