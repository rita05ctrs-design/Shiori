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
  Database,
  ShieldCheck,
  Sparkles,
  Copy,
  Link2,
  ArrowLeftRight,
  Camera,
  Trash2,
  Globe,
  Lock,
  ExternalLink,
  Loader2,
  Languages,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { CONTENT_LANGUAGES } from "@/lib/i18n";
import { AniListImportCard } from "@/components/settings/AniListImportCard";
import { AmbianceSettingsCard } from "@/components/settings/AmbianceSettingsCard";
import { ThemeSettingsCard } from "@/components/settings/ThemeSettingsCard";
import { PwaInstallCard } from "@/components/settings/PwaInstallCard";
import { VoiceActorFavoritesManager } from "@/components/social/VoiceActorFavoritesManager";
import { BadgesShowcase } from "@/components/badges/BadgesShowcase";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { cn } from "@/lib/utils";

const ACCENT_SWATCHES = [
  { name: "Akane Crimson", color: "#E5484D" },
  { name: "Sakura Ember", color: "#EC4899" },
  { name: "Indigo Nocturne", color: "#6366F1" },
  { name: "Jade Kyōto", color: "#10B981" },
  { name: "Kinpaku Gold", color: "#D97706" },
];

export default function SettingsPage() {
  const {
    profile,
    isAuthenticated,
    supabaseReady,
    anilistConnection,
    updateProfile,
    uploadAvatar,
    updateNotificationPrefs,
    openAuthModal,
    signOutSupabase,
    pushNotification,
    exportLibraryJson,
    importLibraryJson,
    resetDemoData,
    library,
    evaluatedBadges,
    pinnedBadges,
    togglePinBadge,
    previewBadgeUnlock,
    contentLanguage,
    setContentLanguage,
    toast,
  } = useShiori();

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [accentColor, setAccentColor] = useState(profile.accentColor);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [isActivityPublic, setIsActivityPublic] = useState(
    profile.isActivityPublic !== false
  );
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayName(profile.displayName);
    setUsername(profile.username);
    setBio(profile.bio);
    setAccentColor(profile.accentColor);
    setAvatarUrl(profile.avatarUrl ?? "");
    setIsActivityPublic(profile.isActivityPublic !== false);
  }, [profile]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedAvatar = avatarUrl.trim();
    updateProfile({
      displayName: displayName.trim() || "Membre Shiori",
      username: username.trim().replace(/\s+/g, "_") || "shiori_user",
      bio: bio.trim(),
      accentColor,
      avatarUrl: trimmedAvatar ? trimmedAvatar : null,
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
      title: "Alerte de test Shiori",
      body: "Les notifications temps réel sont opérationnelles pour vos séries en cours.",
      mediaId: library[0]?.mediaId,
      coverImage: library[0]?.coverImage,
    });
    toast({
      title: "Notification envoyée",
      description: "Consultez l'icône cloche dans la barre supérieure.",
      variant: "info",
    });
  };

  const envSnippet = `NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-cle-anon-publique`;

  const handleCopyEnv = async () => {
    try {
      await navigator.clipboard.writeText(envSnippet);
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 1800);
    } catch {
      // ignore clipboard restrictions
    }
  };

  return (
    <div className="pt-[calc(5rem+env(safe-area-inset-top))] sm:pt-24 pb-24 md:pb-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent mb-1.5">
          Personnalisation & Configuration
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gradient-editorial">
          Thème, Compte & Notifications
        </h1>
        <p className="text-sm text-[#8A8FA4] mt-1.5">
          Personnalisez les couleurs et l&apos;ambiance de Shiori, gérez votre profil, importez AniList et synchronisez avec Supabase.
        </p>
      </div>

      {/* App-Wide Color, Surface & Visual Personalization Studio */}
      <ThemeSettingsCard />

      {/* Content Language Selector for Automatic Synopsis Translation */}
      <section
        id="langue"
        className="rounded-2xl card-surface p-6 space-y-4 scroll-mt-24"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Languages className="w-4 h-4 text-accent" />
              <span>Langue des synopsis (Traduction automatique)</span>
            </h2>
            <p className="text-xs text-[#858A9E] mt-0.5">
              Traduit automatiquement à la volée tous les animés et mangas (actuels et futurs) avec mise en cache partagée sur Supabase.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-accent/15 border border-accent/35 font-mono text-[10.5px] font-bold text-accent-soft self-start sm:self-auto shrink-0">
            Actif : {contentLanguage.toUpperCase()}
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
                    ? "bg-accent/16 border-accent/55 shadow-[0_8px_24px_rgb(var(--shiori-accent-rgb)/0.22)]"
                    : "bg-obsidian/70 hover:bg-white/[0.06] border-white/[0.08] hover:border-white/[0.16]"
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

      {/* Progressive Web App (PWA) Native Install Card */}
      <PwaInstallCard />

      {/* Atmospheric Ambiance & Continuous Particle Effects */}
      <AmbianceSettingsCard />

      {/* Prominent AniList OAuth & Public Username Import Card */}
      <AniListImportCard />

      {/* Favorite Voice Actors (Seiyuu) Manager */}
      <VoiceActorFavoritesManager />

      {/* Gamification: Badges & Trophies Showcase + Pin Manager */}
      <BadgesShowcase
        badges={evaluatedBadges}
        pinnedBadges={pinnedBadges}
        canPin
        onTogglePin={togglePinBadge}
        onPreviewUnlock={previewBadgeUnlock}
        compact
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Profile & Notifications */}
        <div className="lg:col-span-7 space-y-6">
          {/* Profile Card */}
          <form
            id="profil"
            onSubmit={handleSaveProfile}
            className="rounded-2xl card-surface p-6 space-y-5 scroll-mt-24"
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
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-accent" />
                    <span>Profil public & Avatar</span>
                  </h2>
                  <p className="text-xs text-[#858A9E]">
                    Visible dans la barre de navigation, votre profil public et le fil d&apos;activité.
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

            {/* Custom Avatar Upload (Supabase Storage) + Direct URL with Live Preview */}
            <div className="p-3.5 rounded-xl bg-obsidian/70 border border-white/[0.08] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-[11px] font-mono uppercase tracking-wider text-[#9EA3B5]">
                  Photo de profil personnalisée (Upload ou URL)
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
                      title="Retirer la photo personnalisée"
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
                placeholder="Ou collez un lien d'image direct (https://...)"
                className="w-full h-9 px-3 rounded-lg bg-surface border border-white/[0.09] text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#858A9E] mb-1.5">
                  Nom d&apos;affichage
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl bg-[#08090E] border border-white/[0.09] text-sm text-white focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#858A9E] mb-1.5">
                  Identifiant (@)
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
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#858A9E] mb-1.5">
                Bio éditoriale
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090E] border border-white/[0.09] text-sm text-[#ECEBE6] focus:outline-none focus:border-accent resize-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#858A9E] mb-2">
                Teinte d&apos;avatar
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

            {/* Public vs Private Community Activity Switch */}
            <div className="p-3.5 rounded-xl bg-obsidian/70 border border-white/[0.08] flex items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                {isActivityPublic ? (
                  <Globe className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-xs font-semibold text-white">
                    Activité communautaire {isActivityPublic ? "publique" : "privée"}
                  </p>
                  <p className="text-[11px] text-[#858A9E] mt-0.5">
                    {isActivityPublic
                      ? "Vos coups de cœur, Voice Actors favoris, séries terminées et notes apparaissent dans le fil Activité."
                      : "Votre activité reste privée et n'est pas diffusée dans le fil communautaire."}
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

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              {anilistConnection.connected && anilistConnection.user ? (
                <a
                  href="#anilist-sync"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/12 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>AniList connecté · @{anilistConnection.user.name}</span>
                </a>
              ) : (
                <a
                  href="/api/auth/anilist/start"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-sky-200 text-xs font-semibold transition-colors"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Connecter mon compte AniList</span>
                </a>
              )}

              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold shadow-[0_8px_22px_rgb(var(--shiori-accent-rgb)/0.35)] transition-all cursor-pointer"
              >
                Enregistrer le profil
              </button>
            </div>
          </form>

          {/* Notification Preferences Card */}
          <div className="rounded-2xl card-surface p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#F0B95B]" />
                  <span>Centre de notifications</span>
                </h2>
                <p className="text-xs text-[#858A9E] mt-0.5">
                  Choisissez les événements qui déclenchent une alerte dans Shiori.
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
                  desc: "Soyez averti lorsqu'un nouvel épisode de votre liste Watching est diffusé.",
                },
                {
                  key: "weeklyDigest" as const,
                  title: "Récapitulatif hebdomadaire",
                  desc: "Résumé chaque dimanche soir des sorties de la semaine à venir.",
                },
                {
                  key: "milestones" as const,
                  title: "Paliers & séries terminées",
                  desc: "Célébrez vos séries complétées et nouveaux records d'épisodes/chapitres.",
                },
                {
                  key: "recommendations" as const,
                  title: "Suggestions éditoriales",
                  desc: "Recommandations ciblées basées sur vos coups de cœur.",
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
                      onClick={() =>
                        updateNotificationPrefs({ [item.key]: !enabled })
                      }
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
          </div>
        </div>

        {/* RIGHT: Comptes Shiori & Supabase Cloud Sync + Data Portability */}
        <div className="lg:col-span-5 space-y-6">
          {/* Account & Auth Architecture Card */}
          <div className="rounded-2xl card-surface p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>Comptes & Synchronisation</span>
                </h2>
                <p className="text-xs text-[#858A9E] mt-0.5">
                  Inscriptions actives avec mots de passe chiffrés (scrypt) et sessions sécurisées.
                </p>
              </div>
              <span
                className={cn(
                  "px-2.5 py-1 rounded-full text-[10.5px] font-mono font-semibold border shrink-0",
                  isAuthenticated
                    ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                    : "bg-sky-500/15 border-sky-500/35 text-sky-300"
                )}
              >
                {profile.mode === "supabase"
                  ? "Cloud Supabase"
                  : profile.mode === "account"
                    ? "Compte connecté"
                    : "Inscriptions actives"}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-2 text-xs text-[#B5B9C9]">
              <div className="flex items-center gap-2">
                {isAuthenticated ? (
                  <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <HardDrive className="w-4 h-4 text-sky-400 shrink-0" />
                )}
                <span>
                  {profile.mode === "supabase"
                    ? `Connecté via Supabase (${profile.email}).`
                    : profile.mode === "account"
                      ? `Connecté en tant que ${profile.displayName} (@${profile.username}) — synchronisation serveur active.`
                      : "Session invité : créez un compte pour isoler et sauvegarder votre bibliothèque."}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {supabaseReady
                    ? "Supabase connecté dans .env.local."
                    : "Optionnel : ajoutez vos clés Supabase dans .env.local et exécutez supabase/schema.sql pour migrer sur le cloud."}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              {!isAuthenticated ? (
                <>
                  <button
                    type="button"
                    onClick={() => openAuthModal("signup")}
                    className="flex-1 h-10 rounded-xl bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold shadow-[0_8px_22px_rgb(var(--shiori-accent-rgb)/0.35)] transition-colors cursor-pointer"
                  >
                    Créer un compte
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuthModal("signin")}
                    className="h-10 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Connexion
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => openAuthModal("signin")}
                    className="flex-1 h-10 rounded-xl bg-white text-[#090A0F] hover:bg-[#ECEBE6] text-xs font-semibold transition-colors cursor-pointer"
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

            <div className="rounded-xl bg-obsidian border border-white/[0.08] p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10.5px] font-mono text-[#7D8296]">
                  Optionnel · .env.local (Supabase Cloud)
                </span>
                <button
                  type="button"
                  onClick={handleCopyEnv}
                  className="inline-flex items-center gap-1 text-[11px] text-[#A8ADBE] hover:text-white cursor-pointer"
                >
                  {copiedEnv ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copié</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copier</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="text-[11px] font-mono text-[#C8CCE0] whitespace-pre-wrap break-all leading-relaxed">
                {envSnippet}
              </pre>
              <p className="mt-2 pt-2 border-t border-white/[0.06] text-[10.5px] text-[#858A9E]">
                Callback Google OAuth (PKCE serveur) :{" "}
                <code className="text-[#C8CCE0]">/auth/callback</code>
              </p>
            </div>
          </div>

          {/* Data Backup / Portability */}
          <div className="rounded-2xl card-surface p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                Sauvegarde & Portabilité
              </h2>
              <p className="text-xs text-[#858A9E] mt-0.5">
                {library.length} œuvres actuellement enregistrées dans votre espace.
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

              <button
                type="button"
                onClick={resetDemoData}
                className="w-full h-10 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/18 border border-rose-500/25 text-xs font-medium text-rose-300 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restaurer la bibliothèque de démonstration</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
