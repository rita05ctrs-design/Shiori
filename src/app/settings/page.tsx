"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  User,
  Bell,
  Cloud,
  HardDrive,
  Download,
  Upload,
  RotateCcw,
  Check,
  Sparkles,
  Link2,
  ArrowLeftRight,
  Camera,
  Trash2,
  Globe,
  Lock,
  ExternalLink,
  Loader2,
  Languages,
  AlertTriangle,
  FileDown,
  Palette,
  Database,
  ShieldBan,
  Unlock,
  Award,
  Mic2,
  ChevronDown,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { CONTENT_LANGUAGES } from "@/lib/i18n";
import { AniListImportCard } from "@/components/settings/AniListImportCard";
import { MalImportCard } from "@/components/settings/MalImportCard";
import { AmbianceSettingsCard } from "@/components/settings/AmbianceSettingsCard";
import { ThemeSettingsCard } from "@/components/settings/ThemeSettingsCard";
import { DisplayPreferencesCard } from "@/components/settings/DisplayPreferencesCard";
import { PwaInstallCard } from "@/components/settings/PwaInstallCard";
import { VoiceActorFavoritesManager } from "@/components/social/VoiceActorFavoritesManager";
import { BadgesShowcase } from "@/components/badges/BadgesShowcase";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  getBrowserNotificationPermission,
  isBrowserAlertsEnabled,
  requestBrowserNotificationPermission,
  sendShioriSystemNotification,
  setBrowserAlertsEnabled,
  type BrowserNotifPermission,
} from "@/lib/push-reminders";
import { cn } from "@/lib/utils";

type SettingsTab = "appearance" | "profile" | "account" | "anilist" | "data";

const SETTINGS_CATEGORIES: {
  id: SettingsTab;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "appearance", label: "Apparence", desc: "Thème, affichage, langue", icon: Palette },
  { id: "profile", label: "Profil", desc: "Avatar, bio, confidentialité", icon: User },
  { id: "account", label: "Compte & Alertes", desc: "Connexion, notifications, app", icon: Bell },
  { id: "anilist", label: "AniList & MAL", desc: "Synchro AniList et import MAL XML", icon: ArrowLeftRight },
  { id: "data", label: "Données", desc: "Exports, sauvegarde, suppression", icon: Database },
];

const ACCENT_SWATCHES = [
  { name: "Akane Crimson", color: "#E5484D" },
  { name: "Sakura Ember", color: "#EC4899" },
  { name: "Indigo Nocturne", color: "#6366F1" },
  { name: "Jade Kyōto", color: "#10B981" },
  { name: "Kinpaku Gold", color: "#D97706" },
];

function resolveTabFromHash(hash: string): SettingsTab | null {
  const h = hash.replace(/^#/, "").toLowerCase();
  if (!h) return null;
  if (["personnalisation", "affichage", "ambiance", "langue"].includes(h)) return "appearance";
  if (["profil", "voice-actors", "badges", "bloques"].includes(h)) return "profile";
  if (["compte", "notifications", "pwa"].includes(h)) return "account";
  if (["anilist-sync", "anilist-import", "anilist", "mal-import"].includes(h)) return "anilist";
  if (["donnees", "sauvegarde"].includes(h)) return "data";
  return null;
}

export default function SettingsPage() {
  const {
    profile,
    isAuthenticated,
    anilistConnection,
    updateProfile,
    uploadAvatar,
    updateNotificationPrefs,
    openAuthModal,
    signOutSupabase,
    pushNotification,
    exportLibraryJson,
    exportFullAccountJson,
    deleteAccount,
    importLibraryJson,
    resetDemoData,
    library,
    evaluatedBadges,
    pinnedBadges,
    togglePinBadge,
    previewBadgeUnlock,
    contentLanguage,
    setContentLanguage,
    blockedUsers,
    unblockUser,
    toast,
  } = useShiori();

  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [accentColor, setAccentColor] = useState(profile.accentColor);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [bannerUrl, setBannerUrl] = useState(profile.bannerUrl ?? "");
  const [isActivityPublic, setIsActivityPublic] = useState(profile.isActivityPublic !== false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showBadgesPanel, setShowBadgesPanel] = useState(false);
  const [showSeiyuuPanel, setShowSeiyuuPanel] = useState(false);
  const [browserNotifPerm, setBrowserNotifPerm] =
    useState<BrowserNotifPermission>("default");
  const [browserAlertsOn, setBrowserAlertsOn] = useState(false);

  useEffect(() => {
    setBrowserNotifPerm(getBrowserNotificationPermission());
    setBrowserAlertsOn(isBrowserAlertsEnabled());
  }, []);

  const handleToggleBrowserAlerts = async () => {
    if (browserAlertsOn) {
      setBrowserAlertsEnabled(false);
      setBrowserAlertsOn(false);
      toast({
        title: "Alertes système désactivées",
        description: "Les notifications restent visibles dans la cloche Shiori.",
        variant: "info",
      });
      return;
    }

    const perm = await requestBrowserNotificationPermission();
    setBrowserNotifPerm(perm);
    if (perm === "granted") {
      setBrowserAlertsEnabled(true);
      setBrowserAlertsOn(true);
      updateNotificationPrefs({ airingAlerts: true });
      await sendShioriSystemNotification({
        title: "Alertes Shiori activées !",
        body: "Vous serez prévenu dès la sortie d'un nouvel épisode suivi.",
        url: "/episodes",
        tag: "shiori-push-enabled",
      });
      toast({
        title: "Notifications système activées",
        description: "Les sorties d'épisodes apparaîtront aussi sur votre appareil.",
        variant: "success",
      });
    } else if (perm === "denied") {
      toast({
        title: "Autorisation bloquée",
        description: "Réactivez les notifications pour Shiori dans les réglages de votre navigateur.",
        variant: "warning",
      });
    }
  };
  const [exportingFull, setExportingFull] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [deleteZoneOpen, setDeleteZoneOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Sync URL hash to the exact Settings category automatically
  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncFromHash = () => {
      const h = window.location.hash;
      const mapped = resolveTabFromHash(h);
      if (mapped) setActiveTab(mapped);
      if (h === "#voice-actors") setShowSeiyuuPanel(true);
      if (h === "#badges") setShowBadgesPanel(true);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  useEffect(() => {
    setDisplayName(profile.displayName);
    setUsername(profile.username);
    setBio(profile.bio);
    setAccentColor(profile.accentColor);
    setAvatarUrl(profile.avatarUrl ?? "");
    setBannerUrl(profile.bannerUrl ?? "");
    setIsActivityPublic(profile.isActivityPublic !== false);
  }, [profile]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedAvatar = avatarUrl.trim();
    const trimmedBanner = bannerUrl.trim();
    updateProfile({
      displayName: displayName.trim() || "Membre Shiori",
      username: username.trim().replace(/\s+/g, "_") || "shiori_user",
      bio: bio.trim(),
      accentColor,
      avatarUrl: trimmedAvatar ? trimmedAvatar : null,
      bannerUrl: trimmedBanner ? trimmedBanner : null,
      isActivityPublic,
    });
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const res = await uploadAvatar(file);
      if (res.ok && res.url) {
        setAvatarUrl(res.url);
      }
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const handleExport = () => {
    const json = exportLibraryJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shiori-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Sauvegarde JSON exportée", variant: "success" });
  };

  const handleFullExport = async () => {
    setExportingFull(true);
    try {
      const json = await exportFullAccountJson();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shiori-export-complet-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Export complet téléchargé",
        description: "Profil, bibliothèque, collections, badges et préférences inclus.",
        variant: "success",
      });
    } catch {
      toast({
        title: "Export complet impossible",
        description: "Réessayez dans un instant.",
        variant: "warning",
      });
    } finally {
      setExportingFull(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== "SUPPRIMER") {
      toast({
        title: "Confirmation invalide",
        description: 'Saisissez exactement "SUPPRIMER" pour confirmer.',
        variant: "warning",
      });
      return;
    }
    setDeletingAccount(true);
    try {
      const res = await deleteAccount("SUPPRIMER");
      if (res.ok) {
        setDeleteZoneOpen(false);
        setDeleteConfirmText("");
      } else {
        toast({
          title: "Suppression impossible",
          description: res.message,
          variant: "warning",
        });
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = importLibraryJson(text);
    if (!res.ok) {
      toast({
        title: "Échec de l'import",
        description: res.error,
        variant: "warning",
      });
    }
    e.target.value = "";
  };

  const handleTestNotification = () => {
    pushNotification({
      kind: "AIRING",
      title: "Notification de test Shiori",
      body: "Vos alertes fonctionnent correctement pour vos séries en cours.",
      mediaId: library[0]?.mediaId,
      coverImage: library[0]?.coverImage,
    });
    toast({
      title: "Notification envoyée",
      description: "Consultez la cloche en haut de l'écran.",
      variant: "info",
    });
  };

  return (
    <div className="pt-[calc(5rem+env(safe-area-inset-top))] sm:pt-24 pb-24 md:pb-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Clean Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gradient-editorial">
          Paramètres
        </h1>
        <p className="text-sm text-[#8A8FA4] mt-1">
          Personnalisez l&apos;apparence, votre profil, vos préférences et vos sauvegardes.
        </p>
      </div>

      {/* Mobile Horizontal Category Bar */}
      <div className="lg:hidden overflow-x-auto no-scrollbar pb-1">
        <div className="inline-flex items-center gap-1.5 p-1 rounded-2xl bg-surface border border-white/[0.08]">
          {SETTINGS_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveTab(cat.id)}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-all cursor-pointer",
                  active
                    ? "bg-accent text-accent-fg shadow-accent"
                    : "text-[#9A9EAE] hover:text-white"
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Clean Categorized 2-Column Layout (Sidebar on Desktop + Focused Category Content) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Desktop Category Sidebar */}
        <aside className="hidden lg:block lg:col-span-3 sticky top-24 space-y-1.5">
          {SETTINGS_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveTab(cat.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all cursor-pointer",
                  active
                    ? "bg-accent/15 border-accent/45 text-white"
                    : "bg-transparent border-transparent text-[#9A9EAE] hover:bg-white/[0.04] hover:text-white"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0",
                    active ? "text-accent-soft" : "text-[#7D8296]"
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{cat.label}</p>
                  <p className="text-[11px] text-[#7D8296] truncate">{cat.desc}</p>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Active Category Content */}
        <div className="lg:col-span-9 space-y-6 min-w-0">
          {/* CATEGORY 1: APPARENCE */}
          {activeTab === "appearance" && (
            <>
              <ThemeSettingsCard />
              <DisplayPreferencesCard />
              <AmbianceSettingsCard />

              {/* Synopsis Language Selector */}
              <section
                id="langue"
                className="rounded-2xl card-surface p-5 sm:p-6 space-y-4 scroll-mt-24"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-white flex items-center gap-2">
                      <Languages className="w-4 h-4 text-accent" />
                      <span>Langue des synopsis</span>
                    </h2>
                    <p className="text-xs text-[#858A9E] mt-0.5">
                      Traduit automatiquement les résumés des animés et mangas dans la langue choisie.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-accent/15 border border-accent/35 font-mono text-[10.5px] font-bold text-accent-soft self-start sm:self-auto shrink-0">
                    {contentLanguage.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {CONTENT_LANGUAGES.map((lang) => {
                    const active = contentLanguage === lang.id;
                    return (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => setContentLanguage(lang.id)}
                        className={cn(
                          "p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2",
                          active
                            ? "bg-accent/16 border-accent/55"
                            : "bg-obsidian/70 hover:bg-white/[0.06] border-white/[0.08]"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border",
                              active
                                ? "bg-accent text-accent-fg border-accent"
                                : "bg-white/[0.06] text-[#C8CCE0] border-white/[0.1]"
                            )}
                          >
                            {lang.code}
                          </span>
                          {active && <Check className="w-4 h-4 text-accent-soft" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{lang.label}</p>
                          <p className="text-[11px] text-[#8E93A6] mt-0.5 leading-snug">
                            {lang.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {/* CATEGORY 2: PROFIL & CONFIDENTIALITÉ */}
          {activeTab === "profile" && (
            <>
              <form
                id="profil"
                onSubmit={handleSaveProfile}
                className="rounded-2xl card-surface p-5 sm:p-6 space-y-5 scroll-mt-24"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <UserAvatar
                      avatarUrl={avatarUrl || null}
                      initials={displayName.trim().slice(0, 2).toUpperCase() || "SH"}
                      accentColor={accentColor}
                      alt={displayName}
                      size="lg"
                      className="shadow-lg ring-2 ring-white/15"
                    />
                    <div>
                      <h2 className="text-base font-semibold text-white">
                        Profil public & Avatar
                      </h2>
                      <p className="text-xs text-[#858A9E]">
                        Nom, identifiant, bio et photo visibles sur votre page de profil.
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/profile/${encodeURIComponent(username.trim() || profile.username)}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-white transition-colors self-start sm:self-auto shrink-0"
                  >
                    <span>Voir mon profil</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Avatar Upload / URL */}
                <div className="p-3.5 rounded-xl bg-obsidian/70 border border-white/[0.08] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-medium text-[#C8CCE0]">
                      Photo de profil
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={handleAvatarFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={uploadingAvatar}
                        onClick={() => avatarInputRef.current?.click()}
                        className="h-8 px-3 rounded-lg bg-accent/18 hover:bg-accent/30 border border-accent/40 text-accent-soft text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {uploadingAvatar ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Camera className="w-3.5 h-3.5" />
                        )}
                        <span>Importer une image</span>
                      </button>
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setAvatarUrl("");
                            updateProfile({ avatarUrl: null });
                          }}
                          className="h-8 px-2.5 rounded-lg bg-white/[0.05] hover:bg-rose-500/20 border border-white/[0.09] text-[#9A9EAE] hover:text-rose-300 text-xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Retirer</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="Ou collez le lien d'une image (https://...)"
                    className="w-full h-9 px-3 rounded-lg bg-surface border border-white/[0.09] text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Banner URL */}
                <div className="p-3.5 rounded-xl bg-obsidian/70 border border-white/[0.08] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-medium text-[#C8CCE0]">
                      Bannière du profil
                    </label>
                    {bannerUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setBannerUrl("");
                          updateProfile({ bannerUrl: null });
                        }}
                        className="text-xs text-[#9A9EAE] hover:text-rose-300 cursor-pointer"
                      >
                        Retirer
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    placeholder="Lien d'image panoramique (https://...)"
                    className="w-full h-9 px-3 rounded-lg bg-surface border border-white/[0.09] text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
                  />
                  {bannerUrl && (
                    <div className="h-20 rounded-lg overflow-hidden border border-white/10">
                      <img src={bannerUrl} alt="Aperçu bannière" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#9EA3B5] mb-1.5">
                      Nom affiché
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl bg-[#08090E] border border-white/[0.09] text-sm text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#9EA3B5] mb-1.5">
                      Pseudo (@)
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl bg-[#08090E] border border-white/[0.09] text-sm text-white font-mono focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#9EA3B5] mb-1.5">
                    Présentation (bio)
                  </label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090E] border border-white/[0.09] text-sm text-[#ECEBE6] focus:outline-none focus:border-accent resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#9EA3B5] mb-2">
                    Couleur d&apos;avatar
                  </label>
                  <div className="flex items-center gap-2.5">
                    {ACCENT_SWATCHES.map((s) => (
                      <button
                        key={s.color}
                        type="button"
                        onClick={() => setAccentColor(s.color)}
                        title={s.name}
                        style={{ backgroundColor: s.color }}
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center transition-transform cursor-pointer",
                          accentColor === s.color
                            ? "ring-2 ring-white ring-offset-2 ring-offset-surface scale-110"
                            : "opacity-75 hover:opacity-100"
                        )}
                      >
                        {accentColor === s.color && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Public vs Private Toggle */}
                <div className="p-3.5 rounded-xl bg-obsidian/70 border border-white/[0.08] flex items-center justify-between gap-4">
                  <div className="flex items-start gap-2.5">
                    {isActivityPublic ? (
                      <Globe className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-white">
                        Profil et activité {isActivityPublic ? "publics" : "privés"}
                      </p>
                      <p className="text-[11.5px] text-[#858A9E] mt-0.5">
                        {isActivityPublic
                          ? "Les membres peuvent voir votre activité et vos favoris."
                          : "Votre bibliothèque, vos favoris et vos activités restent strictement privés."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isActivityPublic}
                    onClick={() => {
                      const next = !isActivityPublic;
                      setIsActivityPublic(next);
                      updateProfile({ isActivityPublic: next });
                    }}
                    className={cn(
                      "w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer",
                      isActivityPublic ? "bg-emerald-500" : "bg-white/[0.14]"
                    )}
                  >
                    <span
                      className={cn(
                        "block w-5 h-5 rounded-full bg-white shadow transition-transform",
                        isActivityPublic ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold shadow-accent transition-all cursor-pointer"
                  >
                    Enregistrer le profil
                  </button>
                </div>
              </form>

              {/* Blocked Users (Properly placed under Profile & Privacy!) */}
              <section
                id="bloques"
                className="rounded-2xl card-surface p-5 sm:p-6 space-y-3 scroll-mt-24"
              >
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <ShieldBan className="w-4 h-4 text-rose-400" />
                  <span>Comptes bloqués ({blockedUsers.length})</span>
                </h2>
                {blockedUsers.length === 0 ? (
                  <p className="text-xs text-[#858A9E]">
                    Aucun compte bloqué. Vous pouvez bloquer un membre depuis son profil public.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {blockedUsers.map((b) => (
                      <div
                        key={b.blockedId}
                        className="p-2.5 rounded-xl bg-obsidian/70 border border-white/[0.08] flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            avatarUrl={b.blockedAvatarUrl}
                            initials={b.blockedDisplayName.slice(0, 2)}
                            accentColor="#E5484D"
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">
                              {b.blockedDisplayName}
                            </p>
                            <p className="text-[10.5px] font-mono text-[#858A9E] truncate">
                              @{b.blockedUsername}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void unblockUser(b.blockedId)}
                          className="h-8 px-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.1] text-[11px] font-semibold text-white inline-flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Unlock className="w-3 h-3" />
                          <span>Débloquer</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Collapsible Secondary Profile Extras: Badges & Voice Actors */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowBadgesPanel((v) => !v)}
                  className="w-full rounded-2xl card-surface px-5 py-4 flex items-center justify-between gap-3 text-left hover:border-white/[0.18] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Award className="w-4 h-4 text-kinpaku shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-white">Badges & Trophées épinglés</p>
                      <p className="text-xs text-[#858A9E]">
                        Choisissez jusqu&apos;à 3 badges à afficher sur votre profil
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-[#858A9E] transition-transform shrink-0",
                      showBadgesPanel && "rotate-180"
                    )}
                  />
                </button>
                {showBadgesPanel && (
                  <BadgesShowcase
                    badges={evaluatedBadges}
                    pinnedBadges={pinnedBadges}
                    canPin
                    onTogglePin={togglePinBadge}
                    onPreviewUnlock={previewBadgeUnlock}
                    compact
                  />
                )}

                <button
                  type="button"
                  onClick={() => setShowSeiyuuPanel((v) => !v)}
                  className="w-full rounded-2xl card-surface px-5 py-4 flex items-center justify-between gap-3 text-left hover:border-white/[0.18] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Mic2 className="w-4 h-4 text-accent shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-white">Doubleurs favoris (Seiyuu)</p>
                      <p className="text-xs text-[#858A9E]">
                        Mettez en avant vos comédiens de doublage préférés sur votre profil
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-[#858A9E] transition-transform shrink-0",
                      showSeiyuuPanel && "rotate-180"
                    )}
                  />
                </button>
                {showSeiyuuPanel && <VoiceActorFavoritesManager />}
              </div>
            </>
          )}

          {/* CATEGORY 3: COMPTE & NOTIFICATIONS */}
          {activeTab === "account" && (
            <>
              <section
                id="compte"
                className="rounded-2xl card-surface p-5 sm:p-6 space-y-4 scroll-mt-24"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      Mon compte Shiori
                    </h2>
                    <p className="text-xs text-[#858A9E] mt-0.5">
                      Connectez-vous pour retrouver votre bibliothèque sur tous vos appareils.
                    </p>
                  </div>
                  <span
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0",
                      isAuthenticated
                        ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                        : "bg-white/[0.06] border-white/[0.1] text-[#C8CCE0]"
                    )}
                  >
                    {isAuthenticated ? "Connecté" : "Mode invité"}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center gap-2.5 text-xs text-[#C8CCE0]">
                  {isAuthenticated ? (
                    <>
                      <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Connecté en tant que <strong className="text-white">{profile.displayName}</strong> (@{profile.username})
                        {profile.email ? ` · ${profile.email}` : ""}. Vos données sont sauvegardées automatiquement.
                      </span>
                    </>
                  ) : (
                    <>
                      <HardDrive className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        Vos titres sont enregistrés sur cet appareil. Créez un compte gratuit pour les synchroniser partout.
                      </span>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {!isAuthenticated ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openAuthModal("signup")}
                        className="h-10 px-5 rounded-xl bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Créer un compte gratuit
                      </button>
                      <button
                        type="button"
                        onClick={() => openAuthModal("signin")}
                        className="h-10 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Se connecter
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => openAuthModal("signin")}
                        className="h-10 px-4 rounded-xl bg-white text-[#090A0F] hover:bg-[#ECEBE6] text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Changer de compte
                      </button>
                      <button
                        type="button"
                        onClick={() => void signOutSupabase()}
                        className="h-10 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold cursor-pointer"
                      >
                        Déconnexion
                      </button>
                    </>
                  )}
                </div>
              </section>

              {/* Notification Preferences */}
              <section
                id="notifications"
                className="rounded-2xl card-surface p-5 sm:p-6 space-y-5 scroll-mt-24"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-white flex items-center gap-2">
                      <Bell className="w-4 h-4 text-[#F0B95B]" />
                      <span>Notifications</span>
                    </h2>
                    <p className="text-xs text-[#858A9E] mt-0.5">
                      Choisissez les alertes que vous souhaitez recevoir dans Shiori.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestNotification}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-white transition-colors cursor-pointer shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#F0B95B]" />
                    <span>Tester</span>
                  </button>
                </div>

                <div className="divide-y divide-white/[0.06]">
                  {[
                    {
                      key: "airingAlerts" as const,
                      title: "Sorties d'épisodes suivis",
                      desc: "Alerte lorsqu'un nouvel épisode de votre liste « En cours » est disponible.",
                    },
                    {
                      key: "weeklyDigest" as const,
                      title: "Récapitulatif hebdomadaire",
                      desc: "Résumé chaque dimanche des sorties de la semaine à venir.",
                    },
                    {
                      key: "milestones" as const,
                      title: "Séries terminées & paliers",
                      desc: "Célébrez vos séries complétées et nouveaux paliers atteints.",
                    },
                    {
                      key: "recommendations" as const,
                      title: "Suggestions personnalisées",
                      desc: "Nouvelles recommandations basées sur vos coups de cœur.",
                    },
                  ].map((item) => {
                    const enabled = profile.notificationPrefs[item.key];
                    return (
                      <div
                        key={item.key}
                        className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#ECEBE6]">{item.title}</p>
                          <p className="text-xs text-[#808599] mt-0.5">{item.desc}</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={enabled}
                          onClick={() => updateNotificationPrefs({ [item.key]: !enabled })}
                          className={cn(
                            "w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer",
                            enabled ? "bg-accent" : "bg-white/[0.12]"
                          )}
                        >
                          <span
                            className={cn(
                              "block w-5 h-5 rounded-full bg-white shadow transition-transform",
                              enabled ? "translate-x-5" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* System / PWA OS Notifications Control */}
                <div className="pt-4 border-t border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white flex items-center gap-2">
                      <span>Notifications système &amp; PWA (appareil)</span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-mono border",
                          browserAlertsOn && browserNotifPerm === "granted"
                            ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                            : browserNotifPerm === "denied"
                              ? "bg-rose-500/15 border-rose-500/35 text-rose-300"
                              : "bg-white/[0.06] border-white/[0.1] text-[#9A9EAE]"
                        )}
                      >
                        {browserNotifPerm === "unsupported"
                          ? "Non supporté"
                          : browserNotifPerm === "denied"
                            ? "Bloqué"
                            : browserAlertsOn && browserNotifPerm === "granted"
                              ? "Actif"
                              : "Inactif"}
                      </span>
                    </p>
                    <p className="text-xs text-[#808599] mt-0.5">
                      Recevez une notification native sur ordinateur ou mobile (PWA) lorsqu&apos;un épisode de votre liste « En cours » sort.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {browserNotifPerm === "granted" && browserAlertsOn && (
                      <button
                        type="button"
                        onClick={() =>
                          void sendShioriSystemNotification({
                            title: "Test Shiori · Nouvel épisode",
                            body: "Les alertes système fonctionnent parfaitement sur cet appareil !",
                            url: "/episodes",
                            tag: `shiori-test-${Date.now()}`,
                          })
                        }
                        className="h-9 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-[#D6D9E6] hover:text-white transition-colors cursor-pointer"
                      >
                        Test OS
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={browserNotifPerm === "unsupported"}
                      onClick={() => void handleToggleBrowserAlerts()}
                      className={cn(
                        "h-9 px-3.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-40",
                        browserAlertsOn && browserNotifPerm === "granted"
                          ? "bg-white/[0.07] hover:bg-white/[0.12] border-white/[0.14] text-white"
                          : "bg-accent hover:bg-accent-hover border-accent text-accent-fg"
                      )}
                    >
                      {browserAlertsOn && browserNotifPerm === "granted"
                        ? "Désactiver"
                        : "Activer les alertes"}
                    </button>
                  </div>
                </div>
              </section>

              <PwaInstallCard />
            </>
          )}

          {/* CATEGORY 4: ANILIST & MYANIMELIST */}
          {activeTab === "anilist" && (
            <>
              <AniListImportCard />
              <MalImportCard />
              {!anilistConnection.connected && (
                <div className="text-xs text-[#858A9E] flex items-center gap-2 px-1">
                  <Link2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>
                    La connexion AniList est entièrement optionnelle : Shiori fonctionne de façon autonome sans compte externe.
                  </span>
                </div>
              )}
            </>
          )}

          {/* CATEGORY 5: DONNÉES & SAUVEGARDE */}
          {activeTab === "data" && (
            <>
              <section
                id="donnees"
                className="rounded-2xl card-surface p-5 sm:p-6 space-y-4 scroll-mt-24"
              >
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Sauvegarde & Import / Export
                  </h2>
                  <p className="text-xs text-[#858A9E] mt-0.5">
                    {library.length} œuvres actuellement enregistrées dans votre bibliothèque.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={handleExport}
                    className="w-full h-10 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.09] text-xs font-medium text-white flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-sky-400" />
                      Exporter ma bibliothèque (JSON)
                    </span>
                    <span className="font-mono text-[#858A9E]">{library.length} titres</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleFullExport()}
                    disabled={exportingFull}
                    className="w-full h-10 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.09] text-xs font-medium text-white flex items-center justify-between transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <span className="flex items-center gap-2">
                      {exportingFull ? (
                        <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                      ) : (
                        <FileDown className="w-4 h-4 text-violet-400" />
                      )}
                      Export complet de mes données (RGPD)
                    </span>
                    <span className="font-mono text-[#858A9E]">JSON</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-10 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.09] text-xs font-medium text-white flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span>Importer une sauvegarde JSON</span>
                  </button>

                  {!confirmResetOpen ? (
                    <button
                      type="button"
                      onClick={() => setConfirmResetOpen(true)}
                      className="w-full h-10 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/18 border border-rose-500/25 text-xs font-medium text-rose-300 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Restaurer la bibliothèque de démonstration</span>
                    </button>
                  ) : (
                    <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 space-y-2.5">
                      <p className="text-xs text-rose-200 leading-relaxed">
                        Attention : cette action remplacera vos {library.length} œuvres actuelles par le jeu de démonstration. Exportez une sauvegarde JSON avant de continuer.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            resetDemoData();
                            setConfirmResetOpen(false);
                          }}
                          className="flex-1 h-8 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          Confirmer la réinitialisation
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmResetOpen(false)}
                          className="h-8 px-3 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-xs text-white cursor-pointer"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {isAuthenticated && (
                <section className="rounded-2xl card-surface border border-rose-500/25 p-5 sm:p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-white">
                        Supprimer définitivement mon compte
                      </h2>
                      <p className="text-xs text-[#858A9E] mt-0.5 leading-relaxed">
                        Efface votre profil, votre bibliothèque, vos collections, vos messages et votre historique associés sur Shiori.
                      </p>
                    </div>
                  </div>

                  {!deleteZoneOpen ? (
                    <button
                      type="button"
                      onClick={() => setDeleteZoneOpen(true)}
                      className="h-10 px-4 rounded-xl bg-rose-500/12 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-semibold text-rose-300 inline-flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Supprimer mon compte</span>
                    </button>
                  ) : (
                    <div className="rounded-xl bg-rose-950/30 border border-rose-500/35 p-4 space-y-3">
                      <p className="text-xs text-rose-200 leading-relaxed">
                        Cette action est <strong className="text-white">irréversible</strong>. Saisissez{" "}
                        <code className="px-1.5 py-0.5 rounded bg-black/40 text-rose-300 font-mono">
                          SUPPRIMER
                        </code>{" "}
                        ci-dessous pour confirmer :
                      </p>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="Tapez SUPPRIMER"
                        autoComplete="off"
                        className="w-full h-9 px-3 rounded-lg bg-obsidian border border-rose-500/35 text-xs font-mono text-white focus:outline-none focus:border-rose-400"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={
                            deletingAccount ||
                            deleteConfirmText.trim().toUpperCase() !== "SUPPRIMER"
                          }
                          onClick={() => void handleDeleteAccount()}
                          className="flex-1 h-9 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-45 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {deletingAccount ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          <span>Confirmer la suppression</span>
                        </button>
                        <button
                          type="button"
                          disabled={deletingAccount}
                          onClick={() => {
                            setDeleteZoneOpen(false);
                            setDeleteConfirmText("");
                          }}
                          className="h-9 px-3.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-xs text-white cursor-pointer"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
