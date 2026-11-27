"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Settings,
  Star,
  Tv,
  BookOpen,
  Mic2,
  Lock,
  Globe,
  ExternalLink,
  Calendar,
  ArrowLeft,
  Sparkles,
  FolderKanban,
  Flag,
  Ban,
  ShieldCheck,
  Crown,
  X,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { ActivityCard } from "@/components/social/ActivityCard";
import { VoiceActorFavoritesManager } from "@/components/social/VoiceActorFavoritesManager";
import { FriendActionButton } from "@/components/social/FriendActionButton";
import { ProfileAffinityCard } from "@/components/social/ProfileAffinityCard";
import { ProfileTopTenPodium } from "@/components/social/ProfileTopTenPodium";
import { FavoritesOrganizer } from "@/components/favorites/FavoritesOrganizer";
import { PinnedBadgesRow } from "@/components/badges/PinnedBadgesRow";
import { SpecialBadgesSpotlight } from "@/components/badges/SpecialBadgesSpotlight";
import { BadgesShowcase } from "@/components/badges/BadgesShowcase";
import { evaluateAllBadges, extractSpecialBadgeIds } from "@/lib/badges";
import type {
  CommunityActivityItem,
  PublicUserProfile,
  ReportReason,
  SharedPublicCollection,
} from "@/types/media";

const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: "spam", label: "Spam ou publicité" },
  { id: "harassment", label: "Harcèlement ou comportement abusif" },
  { id: "inappropriate", label: "Contenu inapproprié" },
  { id: "spoiler", label: "Spoiler non masqué" },
  { id: "other", label: "Autre motif" },
];

interface PublicProfileClientProps {
  username: string;
}

export function PublicProfileClient({ username }: PublicProfileClientProps) {
  const {
    profile: currentUser,
    library,
    orderedFavorites,
    favoriteStaff,
    collections,
    hydrated,
    evaluatedBadges: ownEvaluatedBadges,
    unlockedBadges: ownUnlockedBadges,
    pinnedBadges: ownPinnedBadges,
    socialInteractionsCount: ownSocialCount,
    togglePinBadge,
    movePinnedBadge,
    reorderPinnedBadges,
    previewBadgeUnlock,
    isUserBlocked,
    blockUser,
    unblockUser,
    reportContent,
  } = useShiori();
  const { t, tr, locale } = useTranslation();
  const [member, setMember] = useState<PublicUserProfile | null>(null);
  const [activities, setActivities] = useState<CommunityActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [blockingBusy, setBlockingBusy] = useState(false);

  const isOwnProfile =
    hydrated &&
    (currentUser.username.toLowerCase() === username.toLowerCase() ||
      currentUser.id.toLowerCase() === username.toLowerCase());

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    if (isOwnProfile) {
      // Avoid 404 race on fresh own profile before debounced profile sync; just load own public activities
      fetch(`/api/community/activity?username=${encodeURIComponent(username)}`, {
        cache: "no-store",
      })
        .then((res) => (res.ok ? res.json() : { activities: [] }))
        .then((data) => {
          if (!cancelled && Array.isArray(data?.activities)) {
            setActivities(data.activities);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    fetch(`/api/community/profiles/${encodeURIComponent(username)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data?.profile) {
          setMember(data.profile);
          setActivities(Array.isArray(data.activities) ? data.activities : []);
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username, hydrated, isOwnProfile]);

  // If viewing own profile, overlay live local edits immediately so avatar/bio/Seiyuu are always fresh
  const displayProfile: PublicUserProfile | null = isOwnProfile
    ? (() => {
        const scored = library.filter((e) => e.score !== null);
        const meanScore = scored.length
          ? Math.round((scored.reduce((a, b) => a + (b.score ?? 0), 0) / scored.length) * 10) / 10
          : null;
        const entryById = new Map(library.map((e) => [e.mediaId, e]));
        const liveSharedCollections: SharedPublicCollection[] = collections
          .filter((c) => c.isPublic)
          .slice(0, 12)
          .map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            color: c.color,
            items: c.mediaIds
              .map((mid) => entryById.get(mid))
              .filter((e): e is NonNullable<typeof e> => Boolean(e))
              .slice(0, 18)
              .map((e) => ({
                mediaId: e.mediaId,
                type: e.type,
                title: e.title,
                coverImage: e.coverImage,
                score: e.score,
              })),
          }));
        return {
          id: currentUser.id,
          username: currentUser.username,
          displayName: currentUser.displayName,
          avatarUrl: currentUser.avatarUrl ?? null,
          bannerUrl: currentUser.bannerUrl ?? null,
          avatarInitials: currentUser.avatarInitials,
          bio: currentUser.bio,
          accentColor: currentUser.accentColor,
          role: currentUser.role,
          isActivityPublic: currentUser.isActivityPublic ?? true,
          joinedAt: currentUser.joinedAt,
          favoriteStaff,
          favoriteMedia: orderedFavorites.slice(0, 40).map((e) => ({
            mediaId: e.mediaId,
            type: e.type,
            title: e.title,
            coverImage: e.coverImage,
            score: e.score,
          })),
          sharedCollections: liveSharedCollections,
          stats: {
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
          },
          unlockedBadges: ownUnlockedBadges,
          pinnedBadges: ownPinnedBadges,
          socialInteractionsCount: ownSocialCount,
        };
      })()
    : member;

  if (loading && !displayProfile) {
    return (
      <div className="pt-28 pb-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 animate-pulse">
        <div className="h-44 rounded-3xl card-surface" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl card-surface" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound && !displayProfile) {
    return (
      <div className="pt-28 pb-16 max-w-xl mx-auto px-4 text-center space-y-4">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-accent">
          {tr("Profil introuvable")}
        </p>
        <h1 className="text-2xl font-bold text-white">
          {tr("Aucun membre trouvé pour @{username}", { username })}
        </h1>
        <p className="text-sm text-[#8A8FA4]">
          {tr("Ce pseudo n'existe pas encore ou a été modifié.")}
        </p>
        <Link
          href="/community"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold shadow-accent"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{tr("Retour à la communauté")}</span>
        </Link>
      </div>
    );
  }

  if (!displayProfile) return null;

  const previewItems = displayProfile.libraryPreview ?? [];
  const previewGenres = new Set<string>();
  for (const item of previewItems) {
    for (const g of item.genres ?? []) {
      if (g) previewGenres.add(g.trim().toLowerCase());
    }
  }
  const previewScoredCount = previewItems.filter(
    (m) => m.score !== null && m.score > 0
  ).length;
  const previewPerfectCount = Math.max(
    previewItems.filter((m) => m.score !== null && m.score >= 10).length,
    displayProfile.favoriteMedia.filter((m) => m.score !== null && m.score >= 10).length
  );

  const profileBadges = isOwnProfile
    ? ownEvaluatedBadges
    : evaluateAllBadges(
        {
          completedAnimeCount: Math.min(
            displayProfile.stats.animeCount,
            displayProfile.stats.completedCount
          ),
          mangaCount: displayProfile.stats.mangaCount,
          episodesWatched: displayProfile.stats.episodesWatched,
          chaptersRead: displayProfile.stats.chaptersRead,
          moviesCompletedCount: 0,
          uniqueGenresCount: previewGenres.size,
          totalLibraryCount: displayProfile.stats.totalEntries,
          scoredCount: previewScoredCount,
          perfectScoresCount: previewPerfectCount,
          favoriteMediaCount: displayProfile.favoriteMedia.length,
          favoriteStaffCount: displayProfile.favoriteStaff.length,
          hasCustomAvatar: Boolean(displayProfile.avatarUrl),
          socialInteractionsCount: displayProfile.socialInteractionsCount ?? 0,
        },
        displayProfile.unlockedBadges ?? []
      );

  const isDemoShowcaseProfile =
    displayProfile.source === "community" || displayProfile.id.startsWith("community-");

  const joinedLabel = new Date(displayProfile.joinedAt).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
  const isBlocked = !isOwnProfile && isUserBlocked(displayProfile.id);
  const sharedCollections = displayProfile.sharedCollections ?? [];

  const handleToggleBlock = async () => {
    if (blockingBusy || isOwnProfile) return;
    setBlockingBusy(true);
    try {
      if (isBlocked) {
        await unblockUser(displayProfile.id);
      } else {
        await blockUser({
          id: displayProfile.id,
          username: displayProfile.username,
          displayName: displayProfile.displayName,
          avatarUrl: displayProfile.avatarUrl,
        });
      }
    } finally {
      setBlockingBusy(false);
    }
  };

  const handleSubmitProfileReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingReport) return;
    setSubmittingReport(true);
    try {
      await reportContent({
        targetType: "profile",
        targetId: displayProfile.id,
        targetUserId: displayProfile.id,
        reason: reportReason,
        details: reportDetails.trim(),
      });
      setReportOpen(false);
      setReportDetails("");
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="pt-[calc(5rem+env(safe-area-inset-top))] sm:pt-24 pb-24 md:pb-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
      {/* Back link */}
      <Link
        href="/community"
        className="inline-flex items-center gap-1.5 text-xs text-[#9A9EAE] hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>{tr("Retour à la communauté")}</span>
      </Link>

      {/* Blocked User Banner */}
      {isBlocked && (
        <div className="rounded-2xl bg-rose-500/12 border border-rose-400/35 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-100">
          <div className="flex items-center gap-2.5">
            <Ban className="w-4 h-4 text-rose-300 shrink-0" />
            <span>
              {tr("Vous avez bloqué @{username}.", { username: displayProfile.username })}
            </span>
          </div>
          <button
            type="button"
            disabled={blockingBusy}
            onClick={() => void handleToggleBlock()}
            className="px-3.5 py-1.5 rounded-full bg-white/[0.1] hover:bg-white/[0.18] text-white font-semibold cursor-pointer transition-colors"
          >
            {tr("Débloquer")}
          </button>
        </div>
      )}

      {/* Hero Profile Header Card (with optional custom banner) */}
      <section className="rounded-3xl card-surface border border-white/[0.09] p-4 sm:p-6 md:p-8 relative overflow-hidden">
        {displayProfile.bannerUrl ? (
          <>
            <img
              src={displayProfile.bannerUrl}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-35"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#080A11]/95 via-[#080A11]/75 to-[#080A11]/88"
            />
          </>
        ) : (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full opacity-25 blur-3xl"
            style={{
              background: `radial-gradient(circle, ${displayProfile.accentColor}, transparent 70%)`,
            }}
          />
        )}

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 min-w-0">
            <UserAvatar
              avatarUrl={displayProfile.avatarUrl}
              initials={displayProfile.avatarInitials}
              accentColor={displayProfile.accentColor}
              alt={displayProfile.displayName}
              size="xl"
              className="ring-2 ring-white/20 shadow-2xl"
            />
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {displayProfile.displayName}
                </h1>
                <RoleBadge role={displayProfile.role} size="md" />
                <SpecialBadgesSpotlight
                  unlockedBadges={displayProfile.unlockedBadges}
                  variant="pill"
                  size="lg"
                />
                <span className="px-2.5 py-0.5 rounded-full bg-white/[0.07] border border-white/[0.1] font-mono text-xs text-[#C8CCE0]">
                  @{displayProfile.username}
                </span>
                {isDemoShowcaseProfile && (
                  <span
                    title={tr("Exemple")}
                    className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/35 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-200"
                  >
                    {tr("Exemple")}
                  </span>
                )}
                <PinnedBadgesRow
                  badgeIds={(displayProfile.pinnedBadges ?? []).filter(
                    (id) => !extractSpecialBadgeIds(displayProfile.unlockedBadges).includes(id as "beta_tester" | "supporter" | "vip")
                  )}
                  size="sm"
                />
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[10.5px] font-mono text-[#9EA3B5]">
                  {displayProfile.isActivityPublic ? (
                    <>
                      <Globe className="w-3 h-3 text-emerald-400" />
                      <span>{tr("Activité publique")}</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span>{tr("Activité privée")}</span>
                    </>
                  )}
                </span>
              </div>

              {displayProfile.bio && (
                <p className="text-sm text-[#B8BCCB] max-w-2xl leading-relaxed">
                  {displayProfile.bio}
                </p>
              )}

              <p className="text-xs text-[#7D8296] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>{tr("Membre depuis {date}", { date: joinedLabel })}</span>
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {isOwnProfile ? (
              <>
                {displayProfile.role === "creator" && (
                  <Link
                    href="/admin"
                    className="h-10 px-4 rounded-xl bg-[#F0B95B]/16 hover:bg-[#F0B95B]/26 border border-[#F0B95B]/55 text-xs font-bold text-[#FDE68A] inline-flex items-center gap-2 transition-colors"
                  >
                    <Crown className="w-4 h-4 text-[#F0B95B]" />
                    <span>{tr("Espace Créateur")}</span>
                  </Link>
                )}
                <Link
                  href="/settings#profil"
                  className="h-10 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-xs font-semibold text-white inline-flex items-center gap-2 transition-colors"
                >
                  <Settings className="w-4 h-4 text-accent" />
                  <span>{tr("Modifier mon profil")}</span>
                </Link>
              </>
            ) : (
              <>
                {!isBlocked && (
                  <>
                    <FriendActionButton
                      target={{
                        id: displayProfile.id,
                        username: displayProfile.username,
                        displayName: displayProfile.displayName,
                        avatarUrl: displayProfile.avatarUrl,
                      }}
                      size="md"
                    />
                    <Link
                      href={`/messages?to=${encodeURIComponent(displayProfile.username)}`}
                      className="h-10 px-5 rounded-xl bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold shadow-accent inline-flex items-center gap-2 transition-all"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>{tr("Envoyer un message")}</span>
                    </Link>
                  </>
                )}
                <button
                  type="button"
                  disabled={blockingBusy}
                  onClick={() => void handleToggleBlock()}
                  title={isBlocked ? tr("Débloquer") : tr("Bloquer")}
                  className="h-10 px-3.5 rounded-xl bg-white/[0.05] hover:bg-rose-500/15 border border-white/[0.1] hover:border-rose-400/40 text-xs font-medium text-[#C8CCE0] hover:text-rose-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isBlocked ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{tr("Débloquer")}</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-3.5 h-3.5" />
                      <span>{tr("Bloquer")}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  title={tr("Signaler")}
                  className="h-10 px-3 rounded-xl bg-white/[0.05] hover:bg-amber-500/15 border border-white/[0.1] hover:border-amber-400/40 text-xs font-medium text-[#C8CCE0] hover:text-amber-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tr("Signaler")}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Creator-Granted Special Distinctions (Always Shown Large & Prominent) */}
      <SpecialBadgesSpotlight
        unlockedBadges={displayProfile.unlockedBadges}
        variant="hero"
      />

      {/* Stats KPI Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: tr("Total titres"),
            value: displayProfile.stats.totalEntries.toLocaleString(locale),
            icon: Sparkles,
            color: "text-accent",
          },
          {
            label: t("common.anime"),
            value: displayProfile.stats.animeCount.toLocaleString(locale),
            icon: Tv,
            color: "text-sky-400",
          },
          {
            label: t("common.manga"),
            value: displayProfile.stats.mangaCount.toLocaleString(locale),
            icon: BookOpen,
            color: "text-violet-400",
          },
          {
            label: tr("Épisodes vus"),
            value: displayProfile.stats.episodesWatched.toLocaleString(locale),
            icon: Tv,
            color: "text-emerald-400",
          },
          {
            label: tr("Chapitres lus"),
            value: displayProfile.stats.chaptersRead.toLocaleString(locale),
            icon: BookOpen,
            color: "text-pink-400",
          },
          {
            label: tr("Note moyenne"),
            value:
              displayProfile.stats.meanScore !== null
                ? `${displayProfile.stats.meanScore.toFixed(1)}/10`
                : "—",
            icon: Star,
            color: "text-kinpaku",
          },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              style={{ ["--shiori-delay" as string]: `${idx * 45}ms` }}
              className="shiori-card-enter shiori-card-lift rounded-2xl card-surface p-3 sm:p-4 border border-white/[0.07] hover:border-white/[0.16] min-w-0"
            >
              <p className="text-[10px] sm:text-[10.5px] font-mono uppercase tracking-wider text-[#858A9E] flex items-center gap-1.5 truncate">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${stat.color}`} />
                <span className="truncate">{stat.label}</span>
              </p>
              <p className="text-lg sm:text-xl font-bold font-mono text-white mt-1.5 truncate">
                {stat.value}
              </p>
            </div>
          );
        })}
      </section>

      {/* Compatibility & Affinity Card (when visiting another member's public profile) */}
      {!isOwnProfile && <ProfileAffinityCard targetProfile={displayProfile} />}

      {/* Gamification: Badges & Trophies Showcase (starts compact on Profile so scrolling down is effortless) */}
      <BadgesShowcase
        badges={profileBadges}
        pinnedBadges={displayProfile.pinnedBadges ?? []}
        canPin={isOwnProfile}
        onTogglePin={isOwnProfile ? togglePinBadge : undefined}
        onMovePin={isOwnProfile ? movePinnedBadge : undefined}
        onReorderPins={isOwnProfile ? reorderPinnedBadges : undefined}
        onPreviewUnlock={isOwnProfile ? previewBadgeUnlock : undefined}
        defaultViewMode="mini"
      />

      {/* Favorite Voice Actors (Seiyuu) — Publicly Visible to All Visitors */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent flex items-center gap-1.5">
              <Mic2 className="w-3.5 h-3.5" />
              <span>{tr("Seiyuu & Doublage")}</span>
            </p>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-0.5">
              {tr("Voice Actors favoris")} ({displayProfile.favoriteStaff.length})
            </h2>
          </div>
        </div>

        {displayProfile.favoriteStaff.length === 0 ? (
          <div className="rounded-2xl card-surface p-6 text-xs text-[#858A9E]">
            {tr("Aucun Voice Actor favori pour le moment.")}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {displayProfile.favoriteStaff.map((staff) => (
              <a
                key={staff.id}
                href={staff.siteUrl || `https://anilist.co/staff/${staff.id}`}
                target="_blank"
                rel="noreferrer"
                className="group rounded-2xl card-surface border border-white/[0.08] hover:border-accent/45 overflow-hidden transition-all flex flex-col"
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-[#121521]">
                  <img
                    src={staff.image}
                    alt={staff.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-transparent to-transparent" />
                  <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-obsidian/80 border border-white/15 flex items-center justify-center text-[#B8BCCB] group-hover:text-white">
                    <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-xs sm:text-sm font-semibold text-white group-hover:text-accent-hover transition-colors line-clamp-1">
                    {staff.name}
                  </p>
                  {staff.nativeName && (
                    <p className="text-[10.5px] text-[#858A9E] truncate">{staff.nativeName}</p>
                  )}
                  {staff.notableRoles?.[0]?.name && (
                    <p className="text-[10.5px] text-accent-soft truncate mt-1">
                      {staff.notableRoles[0].name}
                    </p>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Allow owner to search & edit Seiyuu directly on their own profile */}
        {isOwnProfile && <VoiceActorFavoritesManager compact />}
      </section>

      {/* Visual Top 10 Podium Showcase (Shareable) */}
      <ProfileTopTenPodium
        displayName={displayProfile.displayName}
        username={displayProfile.username}
        favorites={displayProfile.favoriteMedia}
      />

      {/* Favorite Anime & Manga — Ranked #1 -> Last with Interactive Drag & Drop on Own Profile */}
      <FavoritesOrganizer
        editable={isOwnProfile}
        externalFavorites={displayProfile.favoriteMedia}
      />

      {/* Shared Public Custom Collections */}
      {(sharedCollections.length > 0 || isOwnProfile) && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5" />
                <span>{tr("Collections personnalisées")}</span>
              </p>
              <h2 className="text-lg sm:text-xl font-bold text-white mt-0.5">
                {tr("Collections partagées")} ({sharedCollections.length})
              </h2>
            </div>
            {isOwnProfile && (
              <Link
                href="/library"
                className="text-xs text-accent-soft hover:text-white transition-colors"
              >
                {tr("Gérer mes collections →")}
              </Link>
            )}
          </div>

          {sharedCollections.length === 0 ? (
            <div className="rounded-2xl card-surface p-6 text-xs text-[#858A9E]">
              {tr("Aucune collection publique pour le moment.")}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sharedCollections.map((col) => (
                <div
                  key={col.id}
                  className="rounded-2xl card-surface border border-white/[0.08] p-4 sm:p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: col.color }}
                        />
                        <h3 className="text-sm font-bold text-white truncate">{col.name}</h3>
                      </div>
                      {col.description && (
                        <p className="text-xs text-[#9EA3B5] mt-1 line-clamp-2">
                          {col.description}
                        </p>
                      )}
                    </div>
                    <span className="text-[10.5px] font-mono text-[#8A8FA4] shrink-0">
                      {col.items.length} {t("common.titles")}
                    </span>
                  </div>

                  {col.items.length === 0 ? (
                    <p className="text-xs text-[#7D8296]">{tr("Collection vide")}</p>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {col.items.slice(0, 6).map((item) => (
                        <Link
                          key={item.mediaId}
                          href={`/media/${item.mediaId}`}
                          title={item.title}
                          className="group relative aspect-[2/3] rounded-lg overflow-hidden border border-white/10 hover:border-accent/60 transition-all"
                        >
                          <img
                            src={item.coverImage}
                            alt={item.title}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Public Activity History */}
      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-white">
          {tr("Activité récente")}
        </h2>
        {isBlocked ? (
          <div className="rounded-2xl card-surface p-6 text-xs text-[#858A9E] flex items-center gap-2">
            <Ban className="w-4 h-4 text-rose-400" />
            <span>{tr("Activité masquée tant que cet utilisateur est bloqué.")}</span>
          </div>
        ) : !displayProfile.isActivityPublic ? (
          <div className="rounded-2xl card-surface p-6 text-xs text-[#858A9E] flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <span>{tr("Cet utilisateur a choisi de garder son activité privée.")}</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="rounded-2xl card-surface p-6 text-xs text-[#858A9E]">
            {tr("Aucune activité publique enregistrée pour le moment.")}
          </div>
        ) : (
          <div className="space-y-3.5">
            {activities.map((act) => (
              <ActivityCard
                key={act.id}
                item={act}
                onUpdate={(updated) =>
                  setActivities((prev) =>
                    prev.map((a) => (a.id === updated.id ? updated : a))
                  )
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Report Profile Modal */}
      {reportOpen && !isOwnProfile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={tr("Signaler")}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        >
          <form
            onSubmit={handleSubmitProfileReport}
            className="w-full max-w-md rounded-2xl bg-[#10131F] border border-white/[0.14] shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Flag className="w-4 h-4 text-amber-400" />
                <span>{tr("Signaler")} @{displayProfile.username}</span>
              </h3>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="p-1.5 rounded-lg text-[#9A9EAE] hover:text-white hover:bg-white/[0.08] cursor-pointer"
                aria-label={t("common.close")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-[#C8CCE0]">{tr("Motif du signalement :")}</label>
              <div className="grid grid-cols-1 gap-1.5">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setReportReason(r.id)}
                    className={`px-3 py-2 rounded-xl text-left text-xs font-medium border transition-colors cursor-pointer ${
                      reportReason === r.id
                        ? "bg-amber-500/18 border-amber-400/50 text-amber-100"
                        : "bg-white/[0.03] border-white/[0.08] text-[#B5B9C9] hover:text-white"
                    }`}
                  >
                    {tr(r.label)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#C8CCE0]">
                {tr("Détails complémentaires (optionnel)")}
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder={tr("Précisez ce qui vous pose problème...")}
                className="w-full px-3 py-2 rounded-xl bg-obsidian/80 border border-white/[0.1] text-base sm:text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="h-9 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-[#C8CCE0] cursor-pointer"
              >
                {tr("Annuler")}
              </button>
              <button
                type="submit"
                disabled={submittingReport}
                className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-[#090A0F] text-xs font-semibold cursor-pointer"
              >
                {submittingReport ? tr("Envoi...") : tr("Confirmer le signalement")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
