"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Settings,
  Star,
  Tv,
  BookOpen,
  Heart,
  Mic2,
  Lock,
  Globe,
  ExternalLink,
  Calendar,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ActivityCard } from "@/components/social/ActivityCard";
import { VoiceActorFavoritesManager } from "@/components/social/VoiceActorFavoritesManager";
import { PinnedBadgesRow } from "@/components/badges/PinnedBadgesRow";
import { BadgesShowcase } from "@/components/badges/BadgesShowcase";
import { evaluateAllBadges } from "@/lib/badges";
import type { CommunityActivityItem, PublicUserProfile } from "@/types/media";

interface PublicProfileClientProps {
  username: string;
}

export function PublicProfileClient({ username }: PublicProfileClientProps) {
  const {
    profile: currentUser,
    library,
    favoriteStaff,
    hydrated,
    evaluatedBadges: ownEvaluatedBadges,
    unlockedBadges: ownUnlockedBadges,
    pinnedBadges: ownPinnedBadges,
    socialInteractionsCount: ownSocialCount,
    togglePinBadge,
    previewBadgeUnlock,
  } = useShiori();
  const [member, setMember] = useState<PublicUserProfile | null>(null);
  const [activities, setActivities] = useState<CommunityActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
        return {
          id: currentUser.id,
          username: currentUser.username,
          displayName: currentUser.displayName,
          avatarUrl: currentUser.avatarUrl ?? null,
          avatarInitials: currentUser.avatarInitials,
          bio: currentUser.bio,
          accentColor: currentUser.accentColor,
          isActivityPublic: currentUser.isActivityPublic ?? true,
          joinedAt: currentUser.joinedAt,
          favoriteStaff,
          favoriteMedia: library
            .filter((e) => e.isFavorite)
            .slice(0, 12)
            .map((e) => ({
              mediaId: e.mediaId,
              type: e.type,
              title: e.title,
              coverImage: e.coverImage,
              score: e.score,
            })),
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
          Profil introuvable
        </p>
        <h1 className="text-2xl font-bold text-white">
          Aucun membre trouvé pour @{username}
        </h1>
        <p className="text-sm text-[#8A8FA4]">
          Ce pseudo n&apos;existe pas encore ou a été modifié. Découvrez les autres membres dans la
          communauté Shiori.
        </p>
        <Link
          href="/community"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold shadow-accent"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Explorer la communauté</span>
        </Link>
      </div>
    );
  }

  if (!displayProfile) return null;

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
          moviesCompletedCount: Math.round(displayProfile.stats.animeCount * 0.08),
          uniqueGenresCount: Math.min(18, Math.round(displayProfile.stats.totalEntries / 12)),
          totalLibraryCount: displayProfile.stats.totalEntries,
          scoredCount:
            displayProfile.stats.meanScore !== null
              ? Math.max(10, Math.round(displayProfile.stats.totalEntries * 0.45))
              : 0,
          perfectScoresCount: displayProfile.favoriteMedia.filter(
            (m) => m.score !== null && m.score >= 10
          ).length,
          favoriteMediaCount: displayProfile.favoriteMedia.length,
          favoriteStaffCount: displayProfile.favoriteStaff.length,
          hasCustomAvatar: Boolean(displayProfile.avatarUrl),
          socialInteractionsCount: displayProfile.socialInteractionsCount ?? 0,
        },
        displayProfile.unlockedBadges ?? []
      );

  const joinedLabel = new Date(displayProfile.joinedAt).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="pt-24 pb-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Back link */}
      <Link
        href="/community"
        className="inline-flex items-center gap-1.5 text-xs text-[#9A9EAE] hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Retour à la communauté</span>
      </Link>

      {/* Hero Profile Header Card */}
      <section className="rounded-3xl card-surface border border-white/[0.09] p-6 sm:p-8 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full opacity-25 blur-3xl"
          style={{
            background: `radial-gradient(circle, ${displayProfile.accentColor}, transparent 70%)`,
          }}
        />

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
                <span className="px-2.5 py-0.5 rounded-full bg-white/[0.07] border border-white/[0.1] font-mono text-xs text-[#C8CCE0]">
                  @{displayProfile.username}
                </span>
                <PinnedBadgesRow badgeIds={displayProfile.pinnedBadges} size="sm" />
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[10.5px] font-mono text-[#9EA3B5]">
                  {displayProfile.isActivityPublic ? (
                    <>
                      <Globe className="w-3 h-3 text-emerald-400" />
                      <span>Activité publique</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span>Activité privée</span>
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
                <span>Membre depuis {joinedLabel}</span>
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {isOwnProfile ? (
              <Link
                href="/settings#profil"
                className="h-10 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-xs font-semibold text-white inline-flex items-center gap-2 transition-colors"
              >
                <Settings className="w-4 h-4 text-accent" />
                <span>Modifier mon profil & avatar</span>
              </Link>
            ) : (
              <Link
                href={`/messages?to=${encodeURIComponent(displayProfile.username)}`}
                className="h-10 px-5 rounded-xl bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold shadow-accent inline-flex items-center gap-2 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Envoyer un message</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Stats KPI Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: "Total titres",
            value: displayProfile.stats.totalEntries.toLocaleString("fr-FR"),
            icon: Sparkles,
            color: "text-accent",
          },
          {
            label: "Animés",
            value: displayProfile.stats.animeCount.toLocaleString("fr-FR"),
            icon: Tv,
            color: "text-sky-400",
          },
          {
            label: "Mangas",
            value: displayProfile.stats.mangaCount.toLocaleString("fr-FR"),
            icon: BookOpen,
            color: "text-violet-400",
          },
          {
            label: "Épisodes vus",
            value: displayProfile.stats.episodesWatched.toLocaleString("fr-FR"),
            icon: Tv,
            color: "text-emerald-400",
          },
          {
            label: "Chapitres lus",
            value: displayProfile.stats.chaptersRead.toLocaleString("fr-FR"),
            icon: BookOpen,
            color: "text-pink-400",
          },
          {
            label: "Note moyenne",
            value:
              displayProfile.stats.meanScore !== null
                ? `${displayProfile.stats.meanScore.toFixed(1)}/10`
                : "—",
            icon: Star,
            color: "text-kinpaku",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-2xl card-surface p-4 border border-white/[0.07]"
            >
              <p className="text-[10.5px] font-mono uppercase tracking-wider text-[#858A9E] flex items-center gap-1.5">
                <Icon className={`w-3.5 h-3.5 ${stat.color}`} />
                <span>{stat.label}</span>
              </p>
              <p className="text-xl font-bold font-mono text-white mt-1.5">
                {stat.value}
              </p>
            </div>
          );
        })}
      </section>

      {/* Gamification: Badges & Trophies Showcase */}
      <BadgesShowcase
        badges={profileBadges}
        pinnedBadges={displayProfile.pinnedBadges ?? []}
        canPin={isOwnProfile}
        onTogglePin={isOwnProfile ? togglePinBadge : undefined}
        onPreviewUnlock={isOwnProfile ? previewBadgeUnlock : undefined}
      />

      {/* Favorite Voice Actors (Seiyuu) — Publicly Visible to All Visitors */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent flex items-center gap-1.5">
              <Mic2 className="w-3.5 h-3.5" />
              <span>Seiyuu & Doublage</span>
            </p>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-0.5">
              Voice Actors favoris ({displayProfile.favoriteStaff.length})
            </h2>
          </div>
        </div>

        {displayProfile.favoriteStaff.length === 0 ? (
          <div className="rounded-2xl card-surface p-6 text-xs text-[#858A9E]">
            {isOwnProfile
              ? "Vous n'avez pas encore ajouté de Voice Actors favoris. Utilisez la recherche ci-dessous pour mettre en avant vos Seiyuu préférés !"
              : `${displayProfile.displayName} n'a pas encore ajouté de Voice Actors favoris.`}
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

      {/* Favorite Anime & Manga */}
      <section className="space-y-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-rose-400 flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 fill-current" />
            <span>Coups de cœur</span>
          </p>
          <h2 className="text-lg sm:text-xl font-bold text-white mt-0.5">
            Animés & Mangas favoris ({displayProfile.favoriteMedia.length})
          </h2>
        </div>

        {displayProfile.favoriteMedia.length === 0 ? (
          <div className="rounded-2xl card-surface p-6 text-xs text-[#858A9E]">
            Aucun coup de cœur sélectionné pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {displayProfile.favoriteMedia.map((m) => (
              <Link
                key={m.mediaId}
                href={`/media/${m.mediaId}`}
                className="group rounded-2xl card-surface border border-white/[0.08] hover:border-white/[0.2] overflow-hidden flex flex-col"
              >
                <div className="relative aspect-[2/3] overflow-hidden bg-[#121521]">
                  <img
                    src={m.coverImage}
                    alt={m.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {m.score !== null && (
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-obsidian/85 border border-white/15 font-mono text-[10.5px] font-bold text-kinpaku">
                      ★ {m.score.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-white group-hover:text-accent-hover line-clamp-2 leading-snug">
                    {m.title}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Public Activity History */}
      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-white">
          Activité récente
        </h2>
        {!displayProfile.isActivityPublic ? (
          <div className="rounded-2xl card-surface p-6 text-xs text-[#858A9E] flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <span>Cet utilisateur a choisi de garder son activité privée.</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="rounded-2xl card-surface p-6 text-xs text-[#858A9E]">
            Aucune activité publique enregistrée pour le moment.
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
    </div>
  );
}
