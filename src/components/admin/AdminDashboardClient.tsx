"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Award,
  Check,
  Crown,
  ExternalLink,
  Flag,
  Heart,
  Loader2,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Save,
  Search,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { SITE_CONFIG_UPDATED_EVENT } from "@/components/layout/GlobalAnnouncementBanner";
import { cn, getDisplayTitle } from "@/lib/utils";
import type {
  ActivityCommentItem,
  CommunityActivityItem,
  ContentReportRecord,
  MediaItem,
  SiteAnnouncement,
  SiteConfig,
  UnlockedBadgeRecord,
  UserRole,
} from "@/types/media";

interface AdminUserRow {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  accentColor: string;
  role: UserRole;
  joinedAt: string;
  unlockedBadges: UnlockedBadgeRecord[];
  pinnedBadges: string[];
  source: "supabase" | "local" | "community";
}

interface GrantableBadgeMeta {
  id: string;
  title: string;
  description: string;
  rarity: string;
}

interface AdminDashboardClientProps {
  initialConfig: SiteConfig;
  creator: {
    id: string;
    username: string;
    displayName: string;
  };
}

type AdminTab = "spotlight" | "moderation" | "users";

export function AdminDashboardClient({
  initialConfig,
  creator,
}: AdminDashboardClientProps) {
  const { toast } = useShiori();
  const { t, tr, tRelativeTime } = useTranslation();
  const [activeTab, setActiveTab] = useState<AdminTab>("spotlight");

  // --- Tab 1: Hero & Global Banner State ---
  const [announcement, setAnnouncement] = useState<SiteAnnouncement>(
    initialConfig.announcement
  );
  const [heroEnabled, setHeroEnabled] = useState<boolean>(
    initialConfig.featuredHero.enabled
  );
  const [heroMediaId, setHeroMediaId] = useState<number | null>(
    initialConfig.featuredHero.mediaId
  );
  const [heroMedia, setHeroMedia] = useState<MediaItem | null>(
    initialConfig.featuredHero.media ?? null
  );
  const [heroTagline, setHeroTagline] = useState<string>(
    initialConfig.featuredHero.customTagline ?? ""
  );
  const [animeQuery, setAnimeQuery] = useState("");
  const [animeResults, setAnimeResults] = useState<MediaItem[]>([]);
  const [searchingAnime, setSearchingAnime] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // --- Tab 2: Moderation State ---
  const [modLoading, setModLoading] = useState(false);
  const [modSubTab, setModSubTab] = useState<"comments" | "activities" | "reports">("comments");
  const [modActivities, setModActivities] = useState<CommunityActivityItem[]>([]);
  const [modComments, setModComments] = useState<
    Array<ActivityCommentItem & { activityTitle: string }>
  >([]);
  const [modReports, setModReports] = useState<ContentReportRecord[]>([]);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  // --- Tab 3: Users & Badges State ---
  const [userQuery, setUserQuery] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersList, setUsersList] = useState<AdminUserRow[]>([]);
  const [grantableBadges, setGrantableBadges] = useState<GrantableBadgeMeta[]>([
    {
      id: "beta_tester",
      title: "Bêta-testeur",
      description: "Pionnier ayant aidé à tester et façonner Shiori dès ses débuts.",
      rarity: "gold",
    },
    {
      id: "supporter",
      title: "Supporter",
      description: "Soutien généreux contribuant aux serveurs et à l'indépendance de Shiori.",
      rarity: "gold",
    },
    {
      id: "vip",
      title: "VIP",
      description: "Membre d'honneur distingué par le créateur de Shiori.",
      rarity: "legendary",
    },
  ]);
  const [mutatingUserKey, setMutatingUserKey] = useState<string | null>(null);

  const loadModeration = useCallback(async () => {
    setModLoading(true);
    try {
      const res = await fetch("/api/admin/moderation", { cache: "no-store" });
      if (!res.ok) throw new Error(tr("Impossible de charger la modération"));
      const data = await res.json();
      setModActivities(Array.isArray(data.activities) ? data.activities : []);
      setModComments(Array.isArray(data.comments) ? data.comments : []);
      setModReports(Array.isArray(data.reports) ? data.reports : []);
    } catch (err) {
      toast({
        title: tr("Erreur modération"),
        description: err instanceof Error ? err.message : tr("Échec du chargement."),
        variant: "warning",
      });
    } finally {
      setModLoading(false);
    }
  }, [toast, tr]);

  const loadUsers = useCallback(
    async (query = "") => {
      setUsersLoading(true);
      try {
        const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
        const res = await fetch(`/api/admin/users${qs}`, { cache: "no-store" });
        if (!res.ok) throw new Error(tr("Impossible de charger les utilisateurs"));
        const data = await res.json();
        setUsersList(Array.isArray(data.users) ? data.users : []);
        if (Array.isArray(data.grantableBadges) && data.grantableBadges.length > 0) {
          setGrantableBadges(data.grantableBadges);
        }
      } catch (err) {
        toast({
          title: tr("Erreur utilisateurs"),
          description: err instanceof Error ? err.message : tr("Échec du chargement."),
          variant: "warning",
        });
      } finally {
        setUsersLoading(false);
      }
    },
    [toast, tr]
  );

  useEffect(() => {
    if (activeTab === "moderation") {
      void loadModeration();
    } else if (activeTab === "users") {
      void loadUsers(userQuery);
    }
  }, [activeTab, loadModeration, loadUsers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live debounced search for AniList featured Hero picker
  useEffect(() => {
    const trimmed = animeQuery.trim();
    if (trimmed.length < 2) {
      setAnimeResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingAnime(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&type=ANIME&perPage=6`
        );
        if (res.ok) {
          const data = await res.json();
          setAnimeResults(Array.isArray(data.items) ? data.items.slice(0, 6) : []);
        }
      } catch {
        // ignore
      } finally {
        setSearchingAnime(false);
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [animeQuery]);

  // Live debounced user search
  useEffect(() => {
    if (activeTab !== "users") return;
    const timer = setTimeout(() => {
      void loadUsers(userQuery);
    }, 260);
    return () => clearTimeout(timer);
  }, [userQuery, activeTab, loadUsers]);

  const handleSaveSiteConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch("/api/admin/site-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          announcement,
          featuredHero: {
            enabled: heroEnabled && Boolean(heroMediaId),
            mediaId: heroMediaId,
            customTagline: heroTagline,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || tr("Erreur lors de l'enregistrement."));
      }
      if (data.config) {
        setAnnouncement(data.config.announcement);
        setHeroEnabled(data.config.featuredHero.enabled);
        setHeroMediaId(data.config.featuredHero.mediaId);
        setHeroMedia(data.config.featuredHero.media ?? null);
        setHeroTagline(data.config.featuredHero.customTagline ?? "");
        window.dispatchEvent(
          new CustomEvent<SiteConfig>(SITE_CONFIG_UPDATED_EVENT, {
            detail: data.config,
          })
        );
      }
      toast({
        title: tr("Configuration enregistrée"),
        description: tr("Le Hero « Sélection Shiori » et la bannière globale sont à jour."),
        variant: "success",
      });
    } catch (err) {
      toast({
        title: tr("Échec de l'enregistrement"),
        description: err instanceof Error ? err.message : tr("Une erreur est survenue."),
        variant: "warning",
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDeleteModerationItem = async (
    targetType: "activity" | "comment",
    id: string,
    activityId?: string
  ) => {
    const key = `${targetType}:${id}`;
    setDeletingKey(key);
    try {
      const res = await fetch("/api/admin/moderation", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, id, activityId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr("Suppression impossible."));

      if (targetType === "activity") {
        setModActivities((prev) => prev.filter((a) => a.id !== id));
        setModComments((prev) => prev.filter((c) => c.activityId !== id));
      } else {
        setModComments((prev) => prev.filter((c) => c.id !== id));
        setModActivities((prev) =>
          prev.map((a) => ({
            ...a,
            comments: a.comments.filter((c) => c.id !== id),
          }))
        );
      }
      setConfirmDeleteKey(null);
      toast({
        title:
          targetType === "activity"
            ? tr("Avis / activité supprimé")
            : tr("Commentaire supprimé"),
        description: tr("Le contenu a été retiré de la communauté."),
        variant: "success",
      });
    } catch (err) {
      toast({
        title: tr("Erreur suppression"),
        description: err instanceof Error ? err.message : tr("Échec de la modération."),
        variant: "warning",
      });
    } finally {
      setDeletingKey(null);
    }
  };

  const handleToggleUserBadge = async (
    user: AdminUserRow,
    badgeId: string,
    hasBadge: boolean
  ) => {
    const key = `${user.id}:${badgeId}`;
    setMutatingUserKey(key);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          action: hasBadge ? "revoke_badge" : "grant_badge",
          badgeId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr("Impossible de modifier le badge."));

      setUsersList((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, unlockedBadges: data.unlockedBadges ?? u.unlockedBadges }
            : u
        )
      );
      const badgeTitle = tr(
        grantableBadges.find((b) => b.id === badgeId)?.title ?? badgeId
      );
      toast({
        title: hasBadge
          ? tr("Badge « {badge} » retiré", { badge: badgeTitle })
          : tr("Badge « {badge} » attribué", { badge: badgeTitle }),
        description: tr("Mis à jour pour @{user}.", { user: user.username }),
        variant: "success",
      });
    } catch (err) {
      toast({
        title: tr("Erreur badge"),
        description: err instanceof Error ? err.message : tr("Échec de la mise à jour."),
        variant: "warning",
      });
    } finally {
      setMutatingUserKey(null);
    }
  };

  const handleToggleModeratorRole = async (user: AdminUserRow) => {
    if (user.role === "creator") return;
    const nextRole: UserRole = user.role === "moderator" ? "user" : "moderator";
    const key = `${user.id}:role`;
    setMutatingUserKey(key);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          action: "set_role",
          role: nextRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr("Impossible de modifier le rôle."));

      setUsersList((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u))
      );
      toast({
        title:
          nextRole === "moderator"
            ? tr("Modérateur nommé")
            : tr("Rôle modérateur retiré"),
        description: tr("@{user} est maintenant {role}.", {
          user: user.username,
          role:
            nextRole === "moderator" ? tr("Modérateur") : tr("Membre standard"),
        }),
        variant: "success",
      });
    } catch (err) {
      toast({
        title: tr("Erreur rôle"),
        description: err instanceof Error ? err.message : tr("Échec de la mise à jour."),
        variant: "warning",
      });
    } finally {
      setMutatingUserKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080C] pt-[calc(5.25rem+env(safe-area-inset-top))] pb-28 md:pb-16">
      <div className="max-w-[1220px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Golden Creator Command Header */}
        <section className="relative overflow-hidden rounded-3xl border border-[#F0B95B]/30 bg-gradient-to-br from-[#18130B] via-[#0E1018] to-[#0B0C12] p-5 sm:p-7 shadow-[0_24px_60px_-24px_rgba(240,185,91,0.3)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#F0B95B]/12 blur-3xl"
          />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <RoleBadge role="creator" size="md" />
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#F0B95B]/80">
                  {tr("Administration Shiori")}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {tr("Panneau Créateur")}
              </h1>
              <p className="text-sm text-[#A5A9BA] max-w-2xl">
                {tr("Connecté en tant que")}{" "}
                <span className="text-white font-semibold">{creator.displayName}</span>{" "}
                <span className="text-[#8E93A4]">(@{creator.username})</span>.{" "}
                {tr("Pilotez la sélection Hero, les annonces globales, la modération communautaire et les badges exclusifs.")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-[#E4E6F0] transition-colors"
              >
                <span>{tr("Voir l'accueil")}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/support"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F0B95B]/15 hover:bg-[#F0B95B]/25 border border-[#F0B95B]/45 text-xs font-semibold text-[#FDE68A] transition-colors"
              >
                <Heart className="w-3.5 h-3.5 text-[#F0B95B]" />
                <span>{tr("Page Soutien")}</span>
              </Link>
            </div>
          </div>

          {/* Section Tabs */}
          <div className="relative mt-6 flex flex-wrap gap-2">
            {(
              [
                { id: "spotlight", label: tr("Hero & Annonce globale"), icon: Sparkles },
                { id: "moderation", label: tr("Modération communauté"), icon: Shield },
                { id: "users", label: tr("Utilisateurs & Badges"), icon: Users },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer border",
                    active
                      ? "bg-[#F0B95B]/18 border-[#F0B95B]/60 text-[#FDE68A] shadow-[0_8px_24px_-8px_rgba(240,185,91,0.45)]"
                      : "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-[#A9AEBF] hover:text-white"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* TAB 1: HERO SELECTION & GLOBAL ANNOUNCEMENT BANNER */}
        {activeTab === "spotlight" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hero Spotlight ("Sélection Shiori") */}
            <div className="rounded-2xl border border-white/[0.09] bg-[#0D0F16] p-5 sm:p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F0B95B]">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    {tr("Sélection Shiori (Hero)")}
                  </div>
                  <h2 className="text-lg font-bold text-white mt-1">
                    {tr("Animé mis en avant sur l'accueil")}
                  </h2>
                  <p className="text-xs text-[#8D92A4] mt-0.5">
                    {tr("Épinglez un animé en première position du carrousel Hero avec un badge doré.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHeroEnabled((v) => !v)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer shrink-0",
                    heroEnabled
                      ? "bg-[#F0B95B]/20 border-[#F0B95B]/60 text-[#FDE68A]"
                      : "bg-white/[0.05] border-white/[0.12] text-[#9A9EAE]"
                  )}
                >
                  {heroEnabled ? tr("Actif") : tr("Désactivé")}
                </button>
              </div>

              {/* Selected Anime Card */}
              {heroMedia ? (
                <div className="flex items-center gap-3.5 p-3 rounded-xl bg-white/[0.04] border border-[#F0B95B]/35">
                  <img
                    src={heroMedia.coverImage.large || heroMedia.coverImage.extraLarge}
                    alt={getDisplayTitle(heroMedia)}
                    className="w-12 h-16 rounded-lg object-cover shrink-0 border border-white/[0.1]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#F0B95B] uppercase tracking-wider">
                      ★ {tr("Sélection actuelle")} · #{heroMedia.id}
                    </p>
                    <p className="text-sm font-bold text-white truncate">
                      {getDisplayTitle(heroMedia)}
                    </p>
                    <p className="text-xs text-[#9A9EAE]">
                      {heroMedia.seasonYear ?? "—"} ·{" "}
                      {heroMedia.averageScore ? `${(heroMedia.averageScore / 10).toFixed(1)}/10` : "N/A"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setHeroMedia(null);
                      setHeroMediaId(null);
                      setHeroEnabled(false);
                    }}
                    aria-label={tr("Retirer la sélection")}
                    className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-[#E5484D]/25 text-[#A5A9BA] hover:text-white flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-white/[0.12] text-xs text-[#8D92A4] text-center">
                  {tr("Aucun animé épinglé. Recherchez un animé ci-dessous pour activer la Sélection Shiori.")}
                </div>
              )}

              {/* Search AniList Picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#CFD3E0] block">
                  {tr("Rechercher un animé (AniList)")}
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-[#8D92A4] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={animeQuery}
                    onChange={(e) => setAnimeQuery(e.target.value)}
                    placeholder="Frieren, Dandadan, Attack on Titan..."
                    className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[#07080C] border border-white/[0.1] focus:border-[#F0B95B]/60 focus:outline-none text-base sm:text-sm text-white placeholder:text-[#666B7D]"
                  />
                  {searchingAnime && (
                    <Loader2 className="w-4 h-4 text-[#F0B95B] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>

                {animeResults.length > 0 && (
                  <div className="rounded-xl border border-white/[0.1] bg-[#07080C] divide-y divide-white/[0.06] max-h-60 overflow-y-auto">
                    {animeResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setHeroMedia(item);
                          setHeroMediaId(item.id);
                          setHeroEnabled(true);
                          setAnimeResults([]);
                          setAnimeQuery("");
                        }}
                        className="w-full flex items-center gap-3 p-2.5 hover:bg-white/[0.06] text-left transition-colors cursor-pointer"
                      >
                        <img
                          src={item.coverImage.large || item.coverImage.extraLarge}
                          alt={getDisplayTitle(item)}
                          className="w-9 h-12 rounded object-cover shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate">
                            {getDisplayTitle(item)}
                          </p>
                          <p className="text-[11px] text-[#8D92A4]">
                            {item.format ?? "ANIME"} · {item.seasonYear ?? "—"} · ID #{item.id}
                          </p>
                        </div>
                        <span className="text-[11px] font-semibold text-[#F0B95B] shrink-0">
                          {tr("Choisir")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Optional Custom Tagline */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#CFD3E0] block">
                  {tr("Mot du créateur (optionnel)")}
                </label>
                <input
                  type="text"
                  maxLength={140}
                  value={heroTagline}
                  onChange={(e) => setHeroTagline(e.target.value)}
                  placeholder={tr("Ex. Le chef-d'œuvre immanquable de cette saison selon Shiori.")}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#07080C] border border-white/[0.1] focus:border-[#F0B95B]/60 focus:outline-none text-base sm:text-sm text-white placeholder:text-[#666B7D]"
                />
              </div>
            </div>

            {/* Global Announcement Banner */}
            <div className="rounded-2xl border border-white/[0.09] bg-[#0D0F16] p-5 sm:p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E5484D]">
                    <Megaphone className="w-3.5 h-3.5" />
                    {tr("Bannière Globale")}
                  </div>
                  <h2 className="text-lg font-bold text-white mt-1">
                    {tr("Annonce en haut du site")}
                  </h2>
                  <p className="text-xs text-[#8D92A4] mt-0.5">
                    {tr("Informez toute la communauté d'une nouveauté, d'un événement ou d'une maintenance.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setAnnouncement((prev) => ({ ...prev, enabled: !prev.enabled }))
                  }
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer shrink-0",
                    announcement.enabled
                      ? "bg-[#E5484D]/22 border-[#E5484D]/60 text-[#FCA5A5]"
                      : "bg-white/[0.05] border-white/[0.12] text-[#9A9EAE]"
                  )}
                >
                  {announcement.enabled ? tr("Active") : tr("Désactivée")}
                </button>
              </div>

              {/* Tone Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#CFD3E0] block">
                  {tr("Style visuel")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "gold", label: tr("Kinpaku Or"), accent: "border-[#F0B95B]/60 text-[#FDE68A] bg-[#F0B95B]/15" },
                      { id: "crimson", label: tr("Akane Rouge"), accent: "border-[#E5484D]/60 text-[#FCA5A5] bg-[#E5484D]/15" },
                      { id: "info", label: tr("Nuit Info"), accent: "border-sky-400/60 text-sky-200 bg-sky-400/15" },
                    ] as const
                  ).map((tone) => (
                    <button
                      key={tone.id}
                      type="button"
                      onClick={() =>
                        setAnnouncement((prev) => ({ ...prev, tone: tone.id }))
                      }
                      className={cn(
                        "py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                        announcement.tone === tone.id
                          ? tone.accent
                          : "bg-white/[0.03] border-white/[0.09] text-[#9A9EAE] hover:text-white"
                      )}
                    >
                      {tone.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#CFD3E0]">
                    {tr("Message d'annonce")}
                  </label>
                  <span className="text-[11px] font-mono text-[#7C8194]">
                    {announcement.message.length}/220
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={220}
                  value={announcement.message}
                  onChange={(e) =>
                    setAnnouncement((prev) => ({ ...prev, message: e.target.value }))
                  }
                  placeholder={tr("Ex. Nouvelle mise à jour Shiori : guide de reprise Manga & espace Soutien !")}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#07080C] border border-white/[0.1] focus:border-[#F0B95B]/60 focus:outline-none text-base sm:text-sm text-white placeholder:text-[#666B7D] resize-none"
                />
              </div>

              {/* Optional CTA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#CFD3E0] block">
                    {tr("Texte du bouton (optionnel)")}
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={announcement.ctaLabel ?? ""}
                    onChange={(e) =>
                      setAnnouncement((prev) => ({ ...prev, ctaLabel: e.target.value }))
                    }
                    placeholder={tr("Soutenir Shiori")}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#07080C] border border-white/[0.1] focus:border-[#F0B95B]/60 focus:outline-none text-base sm:text-sm text-white placeholder:text-[#666B7D]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#CFD3E0] block">
                    {tr("Lien cible (interne ou https)")}
                  </label>
                  <input
                    type="text"
                    value={announcement.ctaHref ?? ""}
                    onChange={(e) =>
                      setAnnouncement((prev) => ({ ...prev, ctaHref: e.target.value }))
                    }
                    placeholder="/support"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#07080C] border border-white/[0.1] focus:border-[#F0B95B]/60 focus:outline-none text-base sm:text-sm text-white placeholder:text-[#666B7D]"
                  />
                </div>
              </div>

              {/* Live Preview */}
              {announcement.message.trim() && (
                <div className="rounded-xl border border-white/[0.1] p-3 bg-[#07080C] space-y-1.5">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-[#7C8194]">
                    {tr("Aperçu en direct")}
                  </p>
                  <div
                    className={cn(
                      "rounded-lg px-3 py-2 border text-xs flex flex-wrap items-center gap-2",
                      announcement.tone === "crimson"
                        ? "bg-[#E5484D]/14 border-[#E5484D]/40 text-[#FDE8E8]"
                        : announcement.tone === "info"
                        ? "bg-sky-500/12 border-sky-400/35 text-sky-100"
                        : "bg-[#F0B95B]/14 border-[#F0B95B]/45 text-[#FEF3C7]"
                    )}
                  >
                    <span className="font-medium">{announcement.message}</span>
                    {announcement.ctaLabel && (
                      <span className="px-2 py-0.5 rounded-full bg-white/[0.12] text-[11px] font-semibold">
                        {announcement.ctaLabel} →
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Save Bar */}
            <div className="lg:col-span-2 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={savingConfig}
                onClick={handleSaveSiteConfig}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#F0B95B] to-[#D99B38] hover:brightness-110 text-[#07080C] font-bold text-sm shadow-[0_12px_32px_-8px_rgba(240,185,91,0.55)] transition-all disabled:opacity-60 cursor-pointer"
              >
                {savingConfig ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{tr("Enregistrer la configuration")}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: COMMUNITY MODERATION */}
        {activeTab === "moderation" && (
          <section className="rounded-2xl border border-white/[0.09] bg-[#0D0F16] p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: "comments", label: `${tr("Commentaires")} (${modComments.length})`, icon: MessageSquare },
                    { id: "activities", label: `${tr("Activités & Avis")} (${modActivities.length})`, icon: Sparkles },
                    { id: "reports", label: `${tr("Signalements")} (${modReports.length})`, icon: Flag },
                  ] as const
                ).map((sub) => {
                  const Icon = sub.icon;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setModSubTab(sub.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer",
                        modSubTab === sub.id
                          ? "bg-[#E5484D]/20 border-[#E5484D]/55 text-white"
                          : "bg-white/[0.04] border-white/[0.08] text-[#A2A6B8] hover:text-white"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{sub.label}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => void loadModeration()}
                disabled={modLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.09] text-xs font-medium text-[#CFD3E0] cursor-pointer"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", modLoading && "animate-spin")} />
                <span>{tr("Actualiser")}</span>
              </button>
            </div>

            {modLoading ? (
              <div className="py-12 flex items-center justify-center gap-2 text-sm text-[#8D92A4]">
                <Loader2 className="w-4 h-4 animate-spin text-[#F0B95B]" />
                <span>{tr("Chargement des contenus communautaires…")}</span>
              </div>
            ) : modSubTab === "comments" ? (
              modComments.length === 0 ? (
                <p className="py-10 text-center text-sm text-[#8D92A4]">
                  {tr("Aucun commentaire à modérer pour le moment.")}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {modComments.map((c) => {
                    const key = `comment:${c.id}`;
                    const confirming = confirmDeleteKey === key;
                    return (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-xl bg-[#07080C] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-semibold text-white">
                              {c.authorDisplayName}
                            </span>
                            <span className="text-[#858A9E]">@{c.authorUsername}</span>
                            <span className="text-[#666B7D]">·</span>
                            <span className="text-[#858A9E]">
                              {tr("sur « {title} »", { title: c.activityTitle })}
                            </span>
                            <span className="text-[#666B7D]">
                              ({tRelativeTime(c.createdAt)})
                            </span>
                          </div>
                          <p className="text-sm text-[#D7DAE6] break-words">{c.body}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {confirming ? (
                            <>
                              <button
                                type="button"
                                disabled={deletingKey === key}
                                onClick={() =>
                                  void handleDeleteModerationItem("comment", c.id, c.activityId)
                                }
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#E5484D] hover:bg-[#D43B40] text-white text-xs font-semibold cursor-pointer"
                              >
                                {deletingKey === key ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                {tr("Confirmer")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteKey(null)}
                                className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] text-xs text-[#A5A9BA] hover:text-white cursor-pointer"
                              >
                                {t("common.cancel")}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteKey(key)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E5484D]/12 hover:bg-[#E5484D]/25 border border-[#E5484D]/35 text-xs font-semibold text-[#FCA5A5] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {tr("Supprimer")}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : modSubTab === "activities" ? (
              modActivities.length === 0 ? (
                <p className="py-10 text-center text-sm text-[#8D92A4]">
                  {tr("Aucune activité ou avis à modérer.")}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {modActivities.map((act) => {
                    const key = `activity:${act.id}`;
                    const confirming = confirmDeleteKey === key;
                    return (
                      <div
                        key={act.id}
                        className="p-3.5 rounded-xl bg-[#07080C] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-semibold text-white">
                              {act.actorDisplayName}
                            </span>
                            <span className="text-[#858A9E]">@{act.actorUsername}</span>
                            <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-[10px] font-mono text-[#B8BCCB]">
                              {act.kind}
                            </span>
                            <span className="text-[#666B7D]">
                              {tRelativeTime(act.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-[#D7DAE6]">
                            <span className="font-semibold text-white">{act.mediaTitle}</span>{" "}
                            — {act.action}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {confirming ? (
                            <>
                              <button
                                type="button"
                                disabled={deletingKey === key}
                                onClick={() =>
                                  void handleDeleteModerationItem("activity", act.id)
                                }
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#E5484D] hover:bg-[#D43B40] text-white text-xs font-semibold cursor-pointer"
                              >
                                {deletingKey === key ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                {tr("Confirmer")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteKey(null)}
                                className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] text-xs text-[#A5A9BA] hover:text-white cursor-pointer"
                              >
                                {t("common.cancel")}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteKey(key)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E5484D]/12 hover:bg-[#E5484D]/25 border border-[#E5484D]/35 text-xs font-semibold text-[#FCA5A5] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {tr("Supprimer")}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : modReports.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#8D92A4]">
                {tr("Aucun signalement en attente.")}
              </p>
            ) : (
              <div className="space-y-2.5">
                {modReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-3.5 rounded-xl bg-[#07080C] border border-[#E5484D]/25 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#FCA5A5] uppercase tracking-wider">
                        {rep.targetType} · {rep.reason}
                      </span>
                      <span className="text-[#7C8194]">
                        {tRelativeTime(rep.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-[#A5A9BA]">
                      {tr("Cible ID")} : <code className="text-white">{rep.targetId}</code>
                    </p>
                    {rep.details && (
                      <p className="text-sm text-[#D7DAE6]">{rep.details}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: USERS & EXCLUSIVE BADGES */}
        {activeTab === "users" && (
          <section className="rounded-2xl border border-white/[0.09] bg-[#0D0F16] p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#F0B95B]" />
                  <span>{tr("Gestion des membres & badges spéciaux")}</span>
                </h2>
                <p className="text-xs text-[#8D92A4] mt-0.5">
                  {tr("Recherchez un membre inscrit pour lui attribuer ou retirer les distinctions Bêta-testeur, Supporter ou VIP.")}
                </p>
              </div>
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-[#8D92A4] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder={tr("Rechercher par @pseudo ou nom...")}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#07080C] border border-white/[0.1] focus:border-[#F0B95B]/60 focus:outline-none text-base sm:text-sm text-white placeholder:text-[#666B7D]"
                />
              </div>
            </div>

            {usersLoading ? (
              <div className="py-12 flex items-center justify-center gap-2 text-sm text-[#8D92A4]">
                <Loader2 className="w-4 h-4 animate-spin text-[#F0B95B]" />
                <span>{tr("Recherche des utilisateurs…")}</span>
              </div>
            ) : usersList.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#8D92A4]">
                {tr("Aucun utilisateur trouvé pour cette recherche.")}
              </p>
            ) : (
              <div className="space-y-3">
                {usersList.map((u) => {
                  const unlockedIds = new Set(u.unlockedBadges.map((b) => b.badgeId));
                  return (
                    <div
                      key={u.id}
                      className="p-4 rounded-xl bg-[#07080C] border border-white/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          avatarUrl={u.avatarUrl}
                          initials={u.displayName.slice(0, 2).toUpperCase()}
                          accentColor={u.accentColor}
                          alt={u.displayName}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/profile/${encodeURIComponent(u.username)}`}
                              className="text-sm font-bold text-white hover:text-[#F0B95B] transition-colors truncate"
                            >
                              {u.displayName}
                            </Link>
                            <RoleBadge role={u.role} size="xs" />
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] text-[#8D92A4]">
                              {u.source}
                            </span>
                          </div>
                          <p className="text-xs text-[#8D92A4] truncate">
                            @{u.username} · {tr("{n} badges", { n: u.unlockedBadges.length })}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {grantableBadges.map((badge) => {
                          const has = unlockedIds.has(badge.id);
                          const busy = mutatingUserKey === `${u.id}:${badge.id}`;
                          const localizedBadgeTitle = tr(badge.title);
                          return (
                            <button
                              key={badge.id}
                              type="button"
                              disabled={busy}
                              onClick={() => void handleToggleUserBadge(u, badge.id, has)}
                              title={
                                has
                                  ? tr("Retirer {badge}", { badge: localizedBadgeTitle })
                                  : tr("Attribuer {badge}", { badge: localizedBadgeTitle })
                              }
                              className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer disabled:opacity-60",
                                has
                                  ? "bg-[#F0B95B]/22 border-[#F0B95B]/65 text-[#FDE68A] shadow-[0_0_16px_-6px_rgba(240,185,91,0.6)]"
                                  : "bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.1] text-[#A2A6B8] hover:text-white"
                              )}
                            >
                              {busy ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : has ? (
                                <Check className="w-3 h-3 text-[#F0B95B]" />
                              ) : (
                                <Crown className="w-3 h-3 opacity-60" />
                              )}
                              <span>{localizedBadgeTitle}</span>
                            </button>
                          );
                        })}

                        {u.role !== "creator" && (
                          <button
                            type="button"
                            disabled={mutatingUserKey === `${u.id}:role`}
                            onClick={() => void handleToggleModeratorRole(u)}
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer",
                              u.role === "moderator"
                                ? "bg-[#E5484D]/20 border-[#E5484D]/55 text-[#FCA5A5]"
                                : "bg-white/[0.03] hover:bg-white/[0.08] border-white/[0.08] text-[#8D92A4] hover:text-white"
                            )}
                          >
                            <Shield className="w-3 h-3" />
                            <span>
                              {u.role === "moderator" ? `${tr("Modérateur")} ✓` : "+ Mod"}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
